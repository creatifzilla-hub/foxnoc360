"""
Redis Queue (RQ) dispatcher for distributed device ping monitoring.

Architecture:
  - Dispatcher: Fetches all devices from DB and enqueues one job per device into Redis.
  - Workers: Separate `rq worker` processes consume jobs from the queue, ping devices,
    and persist results to the database.

This decouples the monitoring scheduler from actual I/O heavy ping work,
enabling horizontal scaling of the worker pool.
"""
import asyncio
import logging
from datetime import datetime, timezone

import redis
from rq import Queue

from app.config import settings

logger = logging.getLogger("ping_worker")

# Use synchronous Redis connection — RQ requires sync redis
redis_conn = redis.Redis.from_url(settings.REDIS_URL)

# Named queue: "device_pings" — workers must listen on this queue name
ping_queue = Queue("device_pings", connection=redis_conn)


def get_queue() -> Queue:
    """Return the active Redis Queue instance."""
    return ping_queue


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def enqueue_device_ping(device_id: str, device_name: str, ip_address: str, current_status: str):
    """
    Enqueue a single device ping job into the Redis queue.
    The job will be picked up by an `rq worker` process.
    """
    from app.jobs.ping_job import run_ping_job  # lazy import to avoid circular deps

    job = ping_queue.enqueue(
        run_ping_job,
        kwargs={
            "device_id": device_id,
            "device_name": device_name,
            "ip_address": ip_address,
            "current_status": current_status,
        },
        job_timeout=30,       # Max 30 seconds per ping job
        result_ttl=120,       # Keep result for 2 minutes
    )

    logger.debug(f"[QUEUE] Enqueued ping job for {device_name} ({ip_address}) — Job ID: {job.id}")
    return job


async def dispatch_all_devices():
    """
    Queries all devices from the database and enqueues them in BATCHES.
    Grouping devices into batches (default 500) prevents Redis job explosion
    and allows workers to process multiple pings in a single parallel burst.
    """
    from sqlalchemy.future import select
    from app.database import AsyncSessionLocal
    from app.models.device import Device

    BATCH_SIZE = 500  # Configurable batch size for 20k+ device support

    async with AsyncSessionLocal() as session:
        # Load minimum required metadata to keep memory light
        result = await session.execute(
            select(Device.id, Device.name, Device.ip_address, Device.status)
        )
        devices = result.all()

    if not devices:
        logger.info("[QUEUE] No devices found to dispatch.")
        return

    # Split into batches
    device_list = [
        {
            "id": str(d.id),
            "name": d.name,
            "ip_address": d.ip_address,
            "status": d.status or "unknown"
        }
        for d in devices
    ]
    
    batches = [device_list[i : i + BATCH_SIZE] for i in range(0, len(device_list), BATCH_SIZE)]

    from app.jobs.ping_job import run_ping_batch  # New batch entry point
    
    for batch in batches:
        ping_queue.enqueue(
            run_ping_batch,
            kwargs={"device_batch": batch},
            job_timeout=60, # Allow more time for a batch
            result_ttl=120,
        )

    logger.info(f"[QUEUE] Dispatched {len(devices)} devices in {len(batches)} batches to Redis.")
