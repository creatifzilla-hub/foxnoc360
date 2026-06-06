import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.subscription import TenantSubscription, SubscriptionPlan
from app.models.tenant import Tenant
from app.services.email_service import send_email_alert

logger = logging.getLogger("subscription_service")

def utc_now():
    return datetime.now(timezone.utc)

async def process_subscription_daily(db: AsyncSession):
    """
    Check all active/expiring subscriptions and update their status.
    """
    now = utc_now()
    logger.info(f"Starting daily subscription processing at {now}")

    # Fetch all subscriptions except manually disabled
    result = await db.execute(
        select(TenantSubscription, Tenant.name, Tenant.company_email, SubscriptionPlan.name)
        .join(Tenant, Tenant.id == TenantSubscription.tenant_id)
        .join(SubscriptionPlan, SubscriptionPlan.id == TenantSubscription.plan_id)
        .where(TenantSubscription.status.notin_(["disabled", "suspended", "cancelled"]))
    )
    subscriptions = result.fetchall()

    for sub_record, tenant_name, tenant_email, plan_name in subscriptions:
        if not sub_record.expires_at:
            continue

        expires_at = sub_record.expires_at
        
        # --- Handle Expiration ---
        if now > expires_at:
            if sub_record.status != "expired":
                logger.info(f"Tenant {tenant_name} subscription expired")
                await send_subscription_reminder(tenant_name, tenant_email, plan_name, expires_at, "expired")
        else:
            # If not expired and was previously expired/something else, set back to active
            if sub_record.status != "active":
                sub_record.status = "active"

    await db.commit()
    logger.info("Daily subscription processing complete.")

async def send_subscription_reminder(tenant_name: str, email: str, plan_name: str, expiry_date: datetime, type: str):
    """
    Send email reminders based on the remaining days or status change.
    """
    expiry_str = expiry_date.strftime("%d %B %Y")
    
    subject = f"Subscription Update: {tenant_name} - FoxNOC360"
    
    if type == "suspended":
        message = f"Hello {tenant_name},\n\nYour FoxNOC360 subscription ({plan_name}) has been suspended as the grace period has ended. Please renew immediately to restore full service."
    elif type == "expired":
        message = f"Hello {tenant_name},\n\nYour FoxNOC360 subscription ({plan_name}) expired on {expiry_str}. You are now in a 7-day grace period. Please renew to avoid service suspension."
    elif type == "0":
        message = f"Hello {tenant_name},\n\nYour FoxNOC360 subscription ({plan_name}) expires TODAY ({expiry_str}). Renew now to ensure uninterrupted service."
    else:
        message = f"Hello {tenant_name},\n\nYour FoxNOC360 subscription ({plan_name}) will expire in {type} days ({expiry_str}). Renew now to maintain your monitoring limits."

    message += f"\n\nRenew here: http://localhost:3000/dashboard/subscriptions"
    
    await send_email_alert(subject, message, email)

def calculate_renewal_price(base_price: float, duration_months: int) -> float:
    """
    Calculate price with duration discounts.
    1mo: 0%
    3mo: 5%
    6mo: 10%
    """
    total = base_price * duration_months
    if duration_months == 3:
        return total * 0.95  # 5% discount
    if duration_months >= 6:
        return total * 0.90  # 10% discount
    return total
