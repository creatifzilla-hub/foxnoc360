"""
snmp_worker.py — Standalone SNMP Bandwidth Polling Worker

Runs an async loop every 5 minutes, polling all devices for SNMP bandwidth data.
Can run alongside the ping monitoring worker.py independently.

Usage:
    python snmp_worker.py
"""
import asyncio
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("snmp_worker")

# SNMP poll interval (5 minutes = 300 seconds)
SNMP_POLL_INTERVAL = 300


async def snmp_loop():
    from app.services.snmp_service import run_snmp_poll_cycle

    logger.info("Starting SNMP Bandwidth Monitoring Worker...")
    while True:
        try:
            logger.info("Running SNMP poll cycle...")
            await run_snmp_poll_cycle()
        except Exception as e:
            logger.error(f"SNMP poll error: {e}")

        await asyncio.sleep(SNMP_POLL_INTERVAL)


if __name__ == "__main__":
    try:
        asyncio.run(snmp_loop())
    except KeyboardInterrupt:
        logger.info("SNMP worker stopped.")
