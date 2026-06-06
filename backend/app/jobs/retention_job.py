import logging
import datetime
from sqlalchemy import text
from app.database import engine

logger = logging.getLogger("maintenance")

def run_retention_job():
    """
    Deletes old raw monitoring data to prevent database bloat.
    Summarized data (Downtime records) are preserved for SLA reports.
    """
    logger.info("Starting database maintenance: cleaning old raw logs...")
    
    # Retention period: 30 days for raw ping logs
    # Using raw SQL for efficiency on large datasets
    retention_days = 30
    cutoff = datetime.datetime.now() - datetime.timedelta(days=retention_days)
    
    try:
        # Note: In a production environment with massive data, 
        # consider using table partitioning or deleting in smaller chunks.
        query = text("DELETE FROM ping_logs WHERE checked_at < :cutoff")
        
        # We use a synchronous connection here as retention jobs typically run 
        # in background threads or simpler contexts where async is not mandatory.
        # However, for consistency with our engine, we use the global engine.
        
        import asyncio
        async def _cleanup():
            async with engine.begin() as conn:
                result = await conn.execute(query, {"cutoff": cutoff})
                logger.info(f"Cleanup complete. Removed {result.rowcount} raw logs older than {retention_days} days.")
        
        asyncio.run(_cleanup())
        
    except Exception as e:
        logger.error(f"Maintenance job failed: {e}")

if __name__ == "__main__":
    run_retention_job()
