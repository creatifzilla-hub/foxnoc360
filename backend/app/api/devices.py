import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import delete as sa_delete

from pydantic import BaseModel
from typing import List, Optional
from app.database import get_db
from app.models.tenant import Tenant
from app.models.customer import Customer
from app.models.device import Device
from app.schemas.device import DeviceCreate, DeviceResponse, DeviceUpdate
from app.services.auth import get_current_tenant, check_subscription_restriction, get_token_payload, get_current_user
from app.models.user import User
from app.models.ping_log import PingLog
from app.models.downtime import Downtime
from app.models.subscription import SubscriptionPlan, TenantSubscription
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import joinedload

router = APIRouter(prefix="/devices", tags=["Devices"])


class CSVImportRow(BaseModel):
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    device_name: str
    device_ip: str
    location: Optional[str] = None

class CSVImportResponse(BaseModel):
    success_count: int
    error_count: int
    errors: List[str]


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_device(
    payload: DeviceCreate,
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(check_subscription_restriction)
):
    """Register a new device under the authenticated ISP tenant."""
    try:
        tenant_uuid = uuid.UUID(current_tenant)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid tenant ID")

    # ── Subscription limit check ──────────────────────────────
    sub_res = await db.execute(
        select(TenantSubscription).where(TenantSubscription.tenant_id == tenant_uuid)
    )
    sub = sub_res.scalars().first()
    if sub:
        plan_res = await db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.id == sub.plan_id)
        )
        plan = plan_res.scalars().first()
        if plan:
            device_count = await db.scalar(
                select(sqlfunc.count(Device.id)).where(Device.tenant_id == tenant_uuid)
            )
            if device_count >= plan.max_devices:
                raise HTTPException(
                    status_code=403,
                    detail=f"Device limit reached. Your '{plan.name}' plan allows a maximum of {plan.max_devices} devices. Please upgrade your subscription."
                )
    # ─────────────────────────────────────────────────────────

    # Check for duplicate IP within the tenant
    ip_check = await db.execute(
        select(Device).where(
            Device.tenant_id == tenant_uuid,
            Device.ip_address == payload.ip_address
        )
    )
    if ip_check.scalars().first():
        raise HTTPException(status_code=409, detail="A device with this IP address already exists.")

    device = Device(
        tenant_id=tenant_uuid,
        customer_id=payload.customer_id,
        name=payload.name,
        ip_address=payload.ip_address,
        location=payload.location
    )
    db.add(device)
    await db.flush()  # Ensure device.id is populated
    new_device_id = device.id
    await db.commit()
    
    # Reload with customer and tenant relationships using the saved ID
    stmt = select(Device).options(joinedload(Device.customer), joinedload(Device.tenant)).where(Device.id == new_device_id)
    result = await db.execute(stmt)
    return result.scalars().first()


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """Return all devices. Scoped to the current tenant (bypassed for superadmin)."""
    current_tenant = payload.get("tenant_id")
    is_super = payload.get("role") in ["superadmin", "super_admin"]

    stmt = select(Device).options(joinedload(Device.customer), joinedload(Device.tenant))
    
    if not is_super and current_tenant and current_tenant != "None":
        try:
            tenant_uuid = uuid.UUID(current_tenant)
            stmt = stmt.where(Device.tenant_id == tenant_uuid)
        except (ValueError, AttributeError):
            raise HTTPException(status_code=400, detail="Invalid tenant ID")

    result = await db.execute(stmt.order_by(Device.created_at.desc()))
    return result.scalars().all()


@router.put("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: str, 
    payload: DeviceUpdate, 
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(get_current_tenant)
):
    """Update an existing device."""
    try:
        tenant_uuid = uuid.UUID(current_tenant)
        dev_id_uuid = uuid.UUID(device_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid UUID")

    result = await db.execute(
        select(Device)
        .options(joinedload(Device.customer), joinedload(Device.tenant))
        .where(Device.id == dev_id_uuid, Device.tenant_id == tenant_uuid)
    )
    device = result.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    if payload.name is not None:
        device.name = payload.name
    if payload.ip_address is not None and payload.ip_address != device.ip_address:
        # Check duplicate IP
        ip_check = await db.execute(
            select(Device).where(
                Device.tenant_id == device.tenant_id,
                Device.ip_address == payload.ip_address
            )
        )
        if ip_check.scalars().first():
            raise HTTPException(status_code=409, detail="A device with this IP address already exists.")
        device.ip_address = payload.ip_address
    if payload.location is not None:
        device.location = payload.location
    if payload.customer_id is not None:
        # Verify customer exists
        customer_result = await db.execute(select(Customer).where(Customer.id == payload.customer_id))
        if not customer_result.scalars().first():
            raise HTTPException(status_code=404, detail="Customer not found")
        device.customer_id = payload.customer_id
        
    await db.commit()
    
    # Reload with customer and tenant relationship
    stmt = select(Device).options(joinedload(Device.customer), joinedload(Device.tenant)).where(Device.id == device.id)
    result = await db.execute(stmt)
    return result.scalars().first()


@router.patch("/{device_id}/status", response_model=DeviceResponse)
async def update_device_status(
    device_id: str, 
    status: str, 
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(get_current_tenant)
):
    """Archive or activate a device."""
    try:
        tenant_uuid = uuid.UUID(current_tenant)
        dev_id_uuid = uuid.UUID(device_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid UUID")

    result = await db.execute(
        select(Device)
        .options(joinedload(Device.customer))
        .where(Device.id == dev_id_uuid, Device.tenant_id == tenant_uuid)
    )
    device = result.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    if status not in ["up", "down", "archived", "maintenance"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    device.status = status
    await db.commit()
    
    stmt = select(Device).options(joinedload(Device.customer), joinedload(Device.tenant)).where(Device.id == dev_id_uuid)
    result = await db.execute(stmt)
    return result.scalars().first()


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: str, 
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(get_current_tenant)
):
    """Delete a device and its related records."""
    try:
        tenant_uuid = uuid.UUID(current_tenant)
        dev_id_uuid = uuid.UUID(device_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid UUID")

    result = await db.execute(
        select(Device)
        .where(Device.id == dev_id_uuid, Device.tenant_id == tenant_uuid)
    )
    device = result.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    # Delete child records first to avoid FK constraint violations
    await db.execute(sa_delete(Downtime).where(Downtime.device_id == device.id))
    await db.execute(sa_delete(PingLog).where(PingLog.device_id == device.id))
    await db.delete(device)
    await db.commit()
    return None


class BulkDeletePayload(BaseModel):
    ids: List[str]


@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_devices(
    payload: BulkDeletePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete multiple devices in one transaction."""
    import uuid as uuid_lib
    try:
        uuids = [uuid_lib.UUID(i) for i in payload.ids if i and i != "undefined"]
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid UUID in request")

    is_super = current_user.role in ["superadmin", "super_admin"]

    # 🚨 SECURITY: Verify that all requested IDs actually belong to this tenant
    # This prevents malicious attempts to delete or clear data from other ISPs
    stmt = select(Device.id).where(Device.id.in_(uuids))
    if not is_super:
        stmt = stmt.where(Device.tenant_id == current_user.tenant_id)
        
    authorized_res = await db.execute(stmt)
    authorized_uuids = [r[0] for r in authorized_res.all()]
    
    if not authorized_uuids:
        return None # Nothing to delete that belongs to this tenant

    # Use direct delete for efficiency, targeting ONLY authorized child records
    await db.execute(sa_delete(Downtime).where(Downtime.device_id.in_(authorized_uuids)))
    await db.execute(sa_delete(PingLog).where(PingLog.device_id.in_(authorized_uuids)))
    await db.execute(sa_delete(Device).where(Device.id.in_(authorized_uuids)))
    
    await db.commit()
    return None


@router.post("/import/csv", response_model=CSVImportResponse)
async def import_devices_csv(
    rows: List[CSVImportRow],
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(check_subscription_restriction)
):
    """Bulk import devices with auto-creation of customers, enforcing subscription limits."""
    try:
        tenant_uuid = uuid.UUID(current_tenant)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid tenant ID")

    # ── Subscription pre-fetch ──────────────────────────────
    sub_res = await db.execute(
        select(TenantSubscription).where(TenantSubscription.tenant_id == tenant_uuid)
    )
    sub = sub_res.scalars().first()
    plan = None
    if sub:
        plan_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == sub.plan_id))
        plan = plan_res.scalars().first()
    
    current_device_count = await db.scalar(
        select(sqlfunc.count(Device.id)).where(Device.tenant_id == tenant_uuid)
    )
    current_customer_count = await db.scalar(
        select(sqlfunc.count(Customer.id)).where(Customer.tenant_id == tenant_uuid)
    )
    # ─────────────────────────────────────────────────────────

    success_count = 0
    new_customers_created = 0 # Track new customers for limit check
    errors = []
    
    # Pre-fetch existing customers to avoid redundant lookups
    customers_result = await db.execute(select(Customer).where(Customer.tenant_id == tenant_uuid))
    customer_map = {c.name.lower(): c.id for c in customers_result.scalars().all()}
    
    # Pre-fetch existing devices by IP for duplicate checking
    devices_result = await db.execute(select(Device).where(Device.tenant_id == tenant_uuid))
    device_ips = {d.ip_address for d in devices_result.scalars().all()}

    for i, row in enumerate(rows):
        row_num = i + 1
        
        try:
            # Enforce subscription limit per row (Devices)
            if plan and (current_device_count + success_count) >= plan.max_devices:
                errors.append(f"Row {row_num}: Maximum device limit ({plan.max_devices}) reached for your '{plan.name}' plan.")
                continue

            if not row.device_name or not row.device_ip:
                errors.append(f"Row {row_num}: Missing device name or IP.")
                continue
                
            if row.device_ip in device_ips:
                errors.append(f"Row {row_num}: Device IP {row.device_ip} already exists.")
                continue

            customer_id = None
            if row.customer_name:
                cust_key = row.customer_name.strip().lower()
                if cust_key in customer_map:
                    customer_id = customer_map[cust_key]
                else:
                    # Enforce subscription limit per row (Customers)
                    if plan and (current_customer_count + new_customers_created) >= plan.max_customers:
                         errors.append(f"Row {row_num}: Maximum customer limit ({plan.max_customers}) reached. Cannot auto-create customer '{row.customer_name}'.")
                         continue

                    # Create new customer
                    new_cust = Customer(
                        tenant_id=tenant_uuid,
                        name=row.customer_name.strip(),
                        contact_email=row.customer_email or f"info@{cust_key.replace(' ', '')}.com"
                    )
                    db.add(new_cust)
                    await db.flush()  # Get ID without committing
                    customer_id = new_cust.id
                    customer_map[cust_key] = customer_id
                    new_customers_created += 1
                    
            new_dev = Device(
                tenant_id=tenant_uuid,
                customer_id=customer_id,
                name=row.device_name.strip(),
                ip_address=row.device_ip.strip(),
                location=row.location.strip() if row.location else None
            )
            db.add(new_dev)
            device_ips.add(row.device_ip.strip())
            success_count += 1
            
        except Exception as e:
            errors.append(f"Row {row_num}: Failed to process due to error ({str(e)})")

    await db.commit()
    return {"success_count": success_count, "error_count": len(errors), "errors": errors}
