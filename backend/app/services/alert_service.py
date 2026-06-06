from datetime import datetime
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.email_service import send_email_alert
from app.services.whatsapp_service import send_whatsapp_alert
from app.config import settings
from app.models.user import User


async def send_device_alert(db: AsyncSession, tenant_id, device_name: str, customer_name: str, ip_address: str, status: str, timestamp: datetime):
    """
    Orchestrates dispatching both Email and WhatsApp notifications 
    when a device changes status, dynamically fetching tenant admin contacts.
    """
    subject = f"🚨 DEVICE ALERT: {device_name} is {status.upper()}"
    if status.lower() == "up":
        subject = f"✅ DEVICE RECOVERED: {device_name} is {status.upper()}"

    message = f"""Network Monitor Alert
---------------------
Device: {device_name}
Customer: {customer_name}
IP Address: {ip_address}
New Status: {status.upper()}
Timestamp: {timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")}
"""

    # Fetch Tenant Admin Contacts from DB
    result = await db.execute(select(User).where(User.tenant_id == tenant_id, User.role == "isp_admin"))
    # 1. Fetch relevant recipients: Tenant Admins + Superadmins (for platform-wide visibility)
    query = select(User).where(
        (User.tenant_id == tenant_id) | (User.role == "superadmin"),
        User.status == "active"
    )
    result = await db.execute(query)
    admins = result.scalars().all()
    
    recipient_emails = [u.email for u in admins if u.email_alerts]
    recipient_phones = [u.phone_number for u in admins if u.whatsapp_alerts and u.phone_number]

    print(f"[ALERT DISPATCHER] Triggering parallel alerts for device {device_name} for tenant {tenant_id}...")

    # Dispatch Email
    for email in recipient_emails:
        await send_email_alert(
            subject=subject,
            message=message,
            recipient=email
        )

    # Dispatch WhatsApp
    whatsapp_content = f"*{subject}*\n\n{message}"
    for phone in recipient_phones:
        # Ensure 'whatsapp:' prefix is handled correctly by service or append here
        target = phone
        if not target.startswith("whatsapp:"):
            target = f"whatsapp:{target}"
        send_whatsapp_alert(
            message=whatsapp_content,
            phone_number=target
        )


async def send_bandwidth_alert(db: AsyncSession, tenant_id, device_name: str, if_name: str, bps: float, threshold_mbps: float):
    """
    Trigger alerts when an interface exceeds its performance threshold.
    """
    subject = f"⚠️ BANDWIDTH THRESHOLD EXCEEDED: {device_name} - {if_name}"
    
    def fmt(b):
        if b >= 1_000_000_000: return f"{b/1_000_000_000:.2f} Gbps"
        return f"{b/1_000_000:.2f} Mbps"

    message = f"""Traffic Threshold Alert
---------------------
Device: {device_name}
Interface: {if_name}
Current Usage: {fmt(bps)}
Threshold: {threshold_mbps} Mbps
Time: {datetime.now().strftime("%H:%M:%S")}
"""
    
    # Simple redirect to send_device_alert logic for now
    await send_device_alert(db, tenant_id, device_name, "SNMP Threshold", "N/A", "bandwidth limit exceeded", datetime.now())
