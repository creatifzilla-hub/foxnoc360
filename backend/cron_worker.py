import asyncio
import logging
import sys
from app.database import engine, AsyncSessionLocal
from app.services.subscription_service import process_subscription_daily

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stdout
)
logger = logging.getLogger("cron_worker")

async def run_cron():
    """
    Daily Cron Job for Subscription Management.
    """
    logger.info("Starting Daily Subscription Cron Worker...")
    
    # We use a loop that checks the time, but for the sake of THIS exercise,
    # we'll just run it once and exit, or provide a simple sleep loop.
    # In a real environment, this might be triggered by a system-level cron.
    
    while True:
        try:
            # We wrap in a block to ensure session is closed even on error
            async with AsyncSessionLocal() as db:
                await process_subscription_daily(db)
            
            logger.info("Daily task completed. Waiting for next cycle (24 hours)...")
            # Wait for 24 hours
            await asyncio.sleep(86400) 
            
        except Exception as e:
            logger.error(f"Error in Subscription Cron Worker: {e}")
            await asyncio.sleep(60) # Retry in a minute on error

if __name__ == "__main__":
    try:
        asyncio.run(run_cron())
    except KeyboardInterrupt:
        logger.info("Cron Worker stopped by user.")
