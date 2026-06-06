"""
scheduler.py — Monitoring Job Dispatcher

Runs on a 30-second interval and enqueues one Redis/RQ job per device.
This replaces the direct in-process monitor_devices_async() call,
enabling true horizontal scaling by separating job scheduling from
job execution.

Usage:
    python scheduler.py

The actual work is done by `rq worker device_pings` processes.
"""
import asyncio
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("ping_scheduler")


import psutil

async def check_system_load():
    """Abort dispatching if the main server is under heavy load."""
    cpu = psutil.cpu_percent()
    mem = psutil.virtual_memory().percent
    if cpu > 80 or mem > 90:
        logger.warning(f"[OVERLOAD] Skipping dispatch cycle: CPU {cpu}%, MEM {mem}%")
        return False
    return True

async def scheduling_loop():
    from app.services.redis_queue import dispatch_all_devices
    from app.jobs.retention_job import run_retention_job
    from app.services.snmp_service import run_snmp_poll_cycle
    import datetime

    logger.info("Starting Scalable Monitoring Scheduler (20k Device Support)...")
    last_retention_date = None

    while True:
        cycle_start = datetime.datetime.now()
        
        try:
            if await check_system_load():
                logger.info("Dispatching batched device pings to Redis...")
                await dispatch_all_devices()
                
                logger.info("Starting SNMP bandwidth poll cycle...")
                await run_snmp_poll_cycle()
                
            # Daily cleanup at midnight (approx)
            today = datetime.date.today()
            if last_retention_date != today:
                logger.info("Running daily data retention job...")
                run_retention_job()
                last_retention_date = today
                
        except Exception as e:
            logger.error(f"Scheduler Error: {e}")

        # Ensure we sleep relative to the start of the cycle to maintain 60s intervals
        elapsed = (datetime.datetime.now() - cycle_start).total_seconds()
        sleep_time = max(0, 60 - elapsed)
        await asyncio.sleep(sleep_time)


if __name__ == "__main__":
    try:
        asyncio.run(scheduling_loop())
    except KeyboardInterrupt:
        logger.info("Scheduler stopped.")
