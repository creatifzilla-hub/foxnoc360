from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.models.customer import Customer
from app.models.device import Device
from app.models.subscription import TenantSubscription, SubscriptionPlan
from app.schemas.tenant import TenantCreate, TenantResponse, TenantUpdate
from app.services.auth import hash_password, get_current_tenant, get_current_user
from datetime import datetime, timedelta, timezone
from app.services.email_service import send_welcome_email
from uuid import UUID
from pydantic import BaseModel
from typing import List, Optional
class BulkDeletePayload(BaseModel):
    ids: List[str]

router = APIRouter(prefix="/tenants", tags=["Tenants"])

@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    payload: TenantCreate, 
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Create a new tenant (ISP)."""
    # Check for duplicate name or email in Tenants
    result = await db.execute(
        select(Tenant).where(
            (Tenant.name == payload.name) | (Tenant.company_email == payload.company_email)
        )
    )
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A tenant with this name or email already exists.",
        )

    # Check for duplicate email in Users
    user_result = await db.execute(select(User).where(User.email == payload.company_email))
    if user_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    tenant = Tenant(name=payload.name, company_email=payload.company_email)
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)

    # Automatically provision the ISP Admin user for this tenant
    admin_user = User(
        tenant_id=tenant.id,
        email=payload.company_email,
        password_hash=hash_password(payload.admin_password),
        role="isp_admin",
        status="active"
    )
    db.add(admin_user)
    await db.commit()

    # Schedule the welcome email
    background_tasks.add_task(
        send_welcome_email,
        company_name=payload.name,
        company_email=payload.company_email,
        admin_password=payload.admin_password
    )

    # 4. Auto-assign "Starter" plan
    # Ensure "Starter" plan exists
    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.name == "Starter"))
    starter_plan = plan_result.scalars().first()
    
    if not starter_plan:
        # Seed default plans if Starter is missing
        from app.api.subscriptions import seed_default_plans
        await seed_default_plans(db)
        plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.name == "Starter"))
        starter_plan = plan_result.scalars().first()

    if starter_plan:
        new_sub = TenantSubscription(
            tenant_id=tenant.id,
            plan_id=starter_plan.id,
            status="active",
            started_at=datetime.now(timezone.utc),
            expires_at=datetime.now(timezone.utc) + timedelta(days=30)
        )
        db.add(new_sub)
        await db.commit()

    return tenant


@router.get("", response_model=list[TenantResponse])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return all tenants (ISPs). Restricted to Superadmins."""
    if current_user.role not in ["superadmin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Superadmin access required.")

    query = (
        select(
            Tenant,
            func.count(Customer.id.distinct()).label("customer_count"),
            func.count(Device.id.distinct()).label("device_count"),
        )
        .outerjoin(Customer, Customer.tenant_id == Tenant.id)
        .outerjoin(Device, Device.tenant_id == Tenant.id)
        .outerjoin(TenantSubscription, TenantSubscription.tenant_id == Tenant.id)
        .outerjoin(SubscriptionPlan, SubscriptionPlan.id == TenantSubscription.plan_id)
        .add_columns(
            SubscriptionPlan.name.label("plan_name"),
            SubscriptionPlan.max_devices.label("max_devices"),
            TenantSubscription.expires_at.label("expires_at")
        )
        .group_by(Tenant.id, SubscriptionPlan.name, TenantSubscription.expires_at, SubscriptionPlan.max_devices)
        .order_by(Tenant.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()
    
    response_list = []
    for row in rows:
        tenant_obj = row.Tenant
        tenant_dict = {
            "id": str(tenant_obj.id),
            "name": tenant_obj.name,
            "company_email": tenant_obj.company_email,
            "status": tenant_obj.status,
            "created_at": tenant_obj.created_at,
            "customer_count": row.customer_count,
            "device_count": row.device_count,
            "max_devices": row.max_devices or 0,
            "plan_name": row.plan_name or "No Plan",
            "expires_at": row.expires_at,
        }
        response_list.append(TenantResponse(**tenant_dict))
        
    return response_list


@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_tenants(
    payload: BulkDeletePayload, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete multiple tenants by ID. Only for superadmins."""
    if current_user.role not in ["superadmin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Superadmin access required.")
        
    tenant_ids_raw = payload.ids
    if not tenant_ids_raw:
        return None
        
    try:
        tenant_ids = [UUID(tid) for tid in tenant_ids_raw if tid and tid != "undefined"]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format in selection")
        
    from sqlalchemy import delete as sa_delete
    # Use direct delete for efficiency. Cascades will handle children.
    await db.execute(sa_delete(Tenant).where(Tenant.id.in_(tenant_ids)))
    await db.commit()
    return None


@router.put("/{tenant_id}", response_model=TenantResponse)
async def update_tenant(
    tenant_id: str, payload: TenantUpdate, db: AsyncSession = Depends(get_db)
):
    """Update an existing tenant."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    if payload.name is not None and payload.name != tenant.name:
        # Check duplicate name
        name_check = await db.execute(select(Tenant).where(Tenant.name == payload.name))
        if name_check.scalars().first():
            raise HTTPException(status_code=409, detail="A tenant with this name already exists.")
        tenant.name = payload.name
        
    if payload.company_email is not None and payload.company_email != tenant.company_email:
        # Check duplicate email
        email_check = await db.execute(select(Tenant).where(Tenant.company_email == payload.company_email))
        if email_check.scalars().first():
            raise HTTPException(status_code=409, detail="A tenant with this email already exists.")
        # Also check User table
        user_check = await db.execute(select(User).where(User.email == payload.company_email))
        if user_check.scalars().first():
            raise HTTPException(status_code=409, detail="A user with this email already exists.")
            
        # Update the ISP Admin user's email too
        admin_user = await db.execute(select(User).where(User.tenant_id == tenant_id, User.role == "isp_admin"))
        admin = admin_user.scalars().first()
        if admin:
            admin.email = payload.company_email
            
        tenant.company_email = payload.company_email
        
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.patch("/{tenant_id}/status", response_model=TenantResponse)
async def update_tenant_status(
    tenant_id: str, status: str, db: AsyncSession = Depends(get_db)
):
    """Archive or activate a tenant."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    # Valid statuses: "active", "archived", "suspended"
    if status not in ["active", "archived", "suspended"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    tenant.status = status
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.delete("/{tenant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tenant(tenant_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a tenant."""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    await db.delete(tenant)
    await db.commit()
    return None

class TenantPasswordUpdate(BaseModel):
    new_password: str

@router.put("/{tenant_id}/password")
async def update_tenant_password(
    tenant_id: UUID,
    payload: TenantPasswordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a tenant's admin password directly. Superadmin only."""
    if current_user.role not in ["superadmin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Superadmin access required.")
        
    result = await db.execute(select(User).where(User.tenant_id == tenant_id, User.role == "isp_admin"))
    tenant_admin = result.scalars().first()
    
    if not tenant_admin:
        raise HTTPException(status_code=404, detail="ISP Admin user not found for this tenant")
        
    tenant_admin.password_hash = hash_password(payload.new_password)
    await db.commit()
    
    return {"message": "Tenant password successfully updated"}
