from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text

from app.config import settings
from app.database import engine, Base

# Import all models here so Base.metadata knows about them
from app.models import tenant, user, customer, device, device_interface, ping_log, downtime, snmp_log, subscription, payment, sales, user_permission  # noqa: F401

from app.api.tenants import router as tenants_router
from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.customers import router as customers_router
from app.api.devices import router as devices_router
from app.api.monitoring import router as monitoring_router
from app.api.sla import router as sla_router
from app.api.portal import router as portal_router
from app.api.subscriptions import router as subscriptions_router
from app.api.profile import router as profile_router
from app.api.billing import router as billing_router
from app.api.payments import router as payments_router
from app.api.snmp import router as snmp_router
from app.api.maintenance import router as maintenance_router
from app.api.sales import router as sales_router
from app.api.team import router as team_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    # (Schema creation removed to prevent deadlocks on restart)
    pass

    # Background task for subscription expiration
    import asyncio
    from app.services.subscription_service import process_subscription_daily
    from app.database import AsyncSessionLocal

    async def run_periodic_subscription_checks():
        await asyncio.sleep(10) # Wait for server to stabilize
        while True:
            try:
                print("🔄 Starting background subscription check...")
                async with AsyncSessionLocal() as db:
                    await process_subscription_daily(db)
                print("✅ Background subscription check finished.")
            except Exception as e:
                print(f"❌ Error in periodic subscription check: {e}")
            await asyncio.sleep(12 * 3600)  # Every 12 hours

    asyncio.create_task(run_periodic_subscription_checks())

    # Background task for SNMP Polling
    from app.services.snmp_service import run_snmp_poll_cycle
    async def run_periodic_snmp_polls():
        await asyncio.sleep(15) # Wait for server to stabilize
        while True:
            try:
                print("📡 Starting SNMP poll cycle...")
                await run_snmp_poll_cycle()
                print("✅ SNMP poll cycle finished.")
            except Exception as e:
                print(f"❌ Error in periodic SNMP poll: {e}")
            await asyncio.sleep(60) # Poll every 60 seconds

    asyncio.create_task(run_periodic_snmp_polls())

    # Background task for ICMP/Ping Monitoring
    from app.services.ping_monitor import monitor_devices_async
    async def run_periodic_pings():
        await asyncio.sleep(20) # Wait for server to stabilize
        while True:
            try:
                print("🏓 Starting Ping monitor cycle...")
                await monitor_devices_async()
                print("✅ Ping monitor cycle finished.")
            except Exception as e:
                print(f"❌ Error in periodic ping: {e}")
            await asyncio.sleep(30) # Check every 30 seconds
    
    asyncio.create_task(run_periodic_pings())

    yield  # App runs here

    # ── Shutdown ──────────────────────────────────────────────
    await engine.dispose()
    print("🔌  Database connection closed")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Multi-Tenant ISP SLA Monitoring SaaS API",
    lifespan=lifespan,
)

# ─── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(tenants_router, prefix=API_PREFIX)
app.include_router(customers_router, prefix=API_PREFIX)
app.include_router(devices_router, prefix=API_PREFIX)
app.include_router(monitoring_router, prefix=API_PREFIX)
app.include_router(sla_router, prefix=API_PREFIX)
app.include_router(portal_router, prefix=API_PREFIX)
app.include_router(subscriptions_router, prefix=API_PREFIX)
app.include_router(profile_router, prefix=API_PREFIX)
app.include_router(billing_router, prefix=API_PREFIX)
app.include_router(payments_router, prefix=API_PREFIX)
app.include_router(snmp_router, prefix=API_PREFIX)
app.include_router(maintenance_router, prefix=API_PREFIX)
app.include_router(sales_router, prefix=API_PREFIX)
app.include_router(team_router, prefix=API_PREFIX)


# ─── Health Check ─────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}
