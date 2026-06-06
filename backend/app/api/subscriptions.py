"""
Subscription Plans Management API — ISP Admin & Super Admin.

Endpoints:
  GET  /subscriptions/plans        — List all available plans
  POST /subscriptions/plans        — Create a new plan (super admin only)
  GET  /subscriptions/tenant/{id}  — Get current plan for a tenant
  PUT  /subscriptions/tenant/{id}  — Upgrade/downgrade tenant's plan
  GET  /subscriptions/usage/{tenant_id} — Get device/user usage vs limits
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import Optional
from datetime import datetime, timezone, timedelta
from uuid import UUID
from pydantic import BaseModel

from app.database import get_db
from app.models.subscription import SubscriptionPlan, TenantSubscription
from app.models.device import Device
from app.models.user import User
from app.services.auth import get_current_tenant
from app.services.subscription_service import calculate_renewal_price

router = APIRouter(prefix="/subscriptions", tags=["Subscription Plans"])


class PlanCreate(BaseModel):
    name: str
    max_devices: int = 50
    max_customers: int = 10
    max_users: int = 5
    snmp_enabled: bool = False
    sla_reports: bool = False
    price_per_month: float = 0.0


class PlanUpdate(BaseModel):
    name: Optional[str] = None
    max_devices: Optional[int] = None
    max_customers: Optional[int] = None
    max_users: Optional[int] = None
    snmp_enabled: Optional[bool] = None
    sla_reports: Optional[bool] = None
    price_per_month: Optional[float] = None


class PlanResponse(BaseModel):
    id: UUID
    name: str
    max_devices: int
    max_customers: int
    max_users: int
    snmp_enabled: bool
    sla_reports: bool
    price_per_month: float

    class Config:
        from_attributes = True


class UsageResponse(BaseModel):
    tenant_id: UUID
    plan_name: Optional[str]
    devices_used: int
    devices_limit: int
    customers_used: int
    customers_limit: int
    users_used: int
    users_limit: int
    snmp_enabled: bool
    sla_reports: bool
    started_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    price_charged: float = 0.0


@router.get("/plans", response_model=list[PlanResponse])
async def list_plans(db: AsyncSession = Depends(get_db)):
    """List all available subscription plans."""
    result = await db.execute(select(SubscriptionPlan).order_by(SubscriptionPlan.price_per_month))
    return result.scalars().all()


@router.post("/plans", response_model=PlanResponse, status_code=201)
async def create_plan(plan: PlanCreate, db: AsyncSession = Depends(get_db)):
    """Create a new subscription plan. (Super admin only in production.)"""
    new_plan = SubscriptionPlan(**plan.model_dump())
    db.add(new_plan)
    await db.commit()
    await db.refresh(new_plan)
    return new_plan


@router.put("/plans/{plan_id}", response_model=PlanResponse)
async def update_plan(plan_id: UUID, payload: PlanUpdate, db: AsyncSession = Depends(get_db)):
    """Update an existing subscription plan."""
    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
    plan = plan_result.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, key, value)
        
    await db.commit()
    await db.refresh(plan)
    return plan


@router.delete("/plans/{plan_id}", status_code=204)
async def delete_plan(plan_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a subscription plan."""
    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
    plan = plan_result.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
        
    usage_result = await db.execute(select(TenantSubscription).where(TenantSubscription.plan_id == plan_id))
    if usage_result.scalars().first():
        raise HTTPException(status_code=400, detail="Cannot delete plan currently in use by a tenant")
        
    await db.delete(plan)
    await db.commit()
    return None


@router.get("/usage", response_model=Optional[UsageResponse])
async def get_subscription_usage(db: AsyncSession = Depends(get_db), current_tenant: str = Depends(get_current_tenant)):
    """Return the active subscription and usage stats for a tenant."""
    from uuid import UUID as uuid_lib
    try:
        tenant_uuid = uuid_lib(current_tenant)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid tenant ID in session")

    sub_result = await db.execute(
        select(TenantSubscription)
        .where(TenantSubscription.tenant_id == tenant_uuid)
    )
    subscription = sub_result.scalars().first()

    plan = None
    if subscription:
        plan_result = await db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.id == subscription.plan_id)
        )
        plan = plan_result.scalars().first()

    # Count current usage
    device_count = await db.scalar(
        select(func.count(Device.id)).where(Device.tenant_id == tenant_uuid)
    )
    from app.models.customer import Customer
    customer_count = await db.scalar(
        select(func.count(Customer.id)).where(Customer.tenant_id == tenant_uuid)
    )
    user_count = await db.scalar(
        select(func.count(User.id)).where(User.tenant_id == tenant_uuid)
    )

    # 🚨 Global Defaults for trial/new ISPs
    default_users = 5
    default_devices = 5
    default_customers = 10
    
    # Try to find 'Starter' plan in DB for more accurate defaults if possible
    if not plan:
        starter_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.name == "Starter"))
        starter = starter_result.scalars().first()
        if starter:
            default_users = starter.max_users
            default_devices = starter.max_devices
            default_customers = starter.max_customers

    return UsageResponse(
        tenant_id=tenant_uuid,
        plan_name=plan.name if plan else "Free / Trial",
        devices_used=device_count or 0,
        devices_limit=plan.max_devices if plan else default_devices,
        customers_used=customer_count or 0,
        customers_limit=plan.max_customers if plan else default_customers,
        users_used=user_count or 0,
        users_limit=plan.max_users if plan else default_users,
        snmp_enabled=plan.snmp_enabled if plan else False,
        sla_reports=plan.sla_reports if plan else False,
        started_at=subscription.started_at if subscription else None,
        expires_at=subscription.expires_at if subscription else None,
        price_charged=subscription.price_charged if subscription else 0.0,
    )


@router.put("/my-plan")
async def update_tenant_plan(
    plan_id: UUID,
    duration_months: int = 1,
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(get_current_tenant)
):
    """Upgrade or renew a tenant subscription with duration-based pricing."""
    if duration_months not in [1, 3, 6]:
        raise HTTPException(status_code=400, detail="Invalid duration. Support 1, 3, or 6 months.")

    # Fetch plan details
    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
    plan = plan_result.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Fetch existing subscription
    sub_result = await db.execute(
        select(TenantSubscription).where(TenantSubscription.tenant_id == current_tenant)
    )
    subscription = sub_result.scalars().first()

    # Calculate new expiration date
    # If currently active and not expired, extend from existing expiration
    now = datetime.now(timezone.utc)
    base_date = now
    if subscription and subscription.expires_at and subscription.expires_at > now:
        base_date = subscription.expires_at
    
    new_expires_at = base_date + timedelta(days=30 * duration_months)

    if subscription:
        # No Downgrade Policy
        if subscription.plan_id:
            curr_plan_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == subscription.plan_id))
            curr_plan = curr_plan_res.scalars().first()
            if curr_plan and plan.price_per_month < curr_plan.price_per_month:
                raise HTTPException(
                    status_code=400, 
                    detail="Downgrading subscription plans is not allowed. Please wait until the current subscription expires."
                )

        subscription.plan_id = plan_id
        subscription.duration_months = duration_months
        subscription.expires_at = new_expires_at
        subscription.status = "active"
        subscription.price_charged = plan.price_per_month * duration_months # Simplistic for now
    else:
        subscription = TenantSubscription(
            tenant_id=current_tenant, 
            plan_id=plan_id,
            duration_months=duration_months,
            expires_at=new_expires_at,
            status="active",
            price_charged=plan.price_per_month * duration_months
        )
        db.add(subscription)

    await db.commit()
    return {
        "message": "Subscription updated successfully",
        "expires_at": new_expires_at,
        "plan": plan.name,
        "duration": duration_months
    }


@router.post("/seed-default-plans")
async def seed_default_plans(db: AsyncSession = Depends(get_db)):
    """
    Seed the three default subscription tiers into the database.
    Safe to call multiple times — skips existing plans by name.
    """
    default_plans = [
        {"name": "Starter",     "max_devices": 5,    "max_customers": 10,  "max_users": 5,  "snmp_enabled": False, "sla_reports": False, "price_per_month": 0.0},
        {"name": "Professional","max_devices": 250,  "max_customers": 50,  "max_users": 20, "snmp_enabled": False, "sla_reports": True,  "price_per_month": 49.0},
        {"name": "Enterprise",  "max_devices": 5000, "max_customers": 1000,"max_users": 100,"snmp_enabled": False, "sla_reports": True,  "price_per_month": 199.0},
    ]

    created = []
    for p in default_plans:
        existing = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.name == p["name"]))
        if not existing.scalars().first():
            db.add(SubscriptionPlan(**p))
            created.append(p["name"])

    await db.commit()
    return {"seeded": created, "message": f"Created {len(created)} plans"}


# ─── Superadmin: Tenant Subscription Management ───────────────────────────────

class TenantPlanResponse(BaseModel):
    tenant_id: UUID
    tenant_name: str
    plan_id: Optional[UUID] = None
    plan_name: Optional[str] = None
    status: Optional[str] = None
    started_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    price_charged: float = 0.0
    duration_months: int = 1
    company_email: Optional[str] = None

    class Config:
        from_attributes = True


class AssignPlanPayload(BaseModel):
    plan_id: UUID
    duration_months: Optional[int] = 1
    price_charged: Optional[float] = None
    expires_at: Optional[datetime] = None
    status: Optional[str] = "active"


@router.get("/admin/tenant-subscriptions", response_model=list[TenantPlanResponse])
async def list_all_tenant_subscriptions(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 20
):
    """[Superadmin] List all tenants and their current subscription plan."""
    from app.models.tenant import Tenant
    tenants_result = await db.execute(select(Tenant).order_by(Tenant.name).offset(skip).limit(limit))
    tenants = tenants_result.scalars().all()

    response = []
    for t in tenants:
        sub_result = await db.execute(
            select(TenantSubscription).where(TenantSubscription.tenant_id == t.id)
        )
        sub = sub_result.scalars().first()
        plan = None
        if sub:
            plan_result = await db.execute(
                select(SubscriptionPlan).where(SubscriptionPlan.id == sub.plan_id)
            )
            plan = plan_result.scalars().first()

        response.append(TenantPlanResponse(
            tenant_id=t.id,
            tenant_name=t.name,
            plan_id=sub.plan_id if sub else None,
            plan_name=plan.name if plan else None,
            status=sub.status if sub else None,
            started_at=sub.started_at if sub else None,
            expires_at=sub.expires_at if sub else None,
            price_charged=sub.price_charged if sub else 0.0,
            duration_months=sub.duration_months if sub else 1,
            company_email=t.company_email
        ))

    return response


@router.put("/admin/tenant-subscriptions/{tenant_id}")
async def assign_tenant_plan(
    tenant_id: UUID,
    payload: AssignPlanPayload,
    db: AsyncSession = Depends(get_db)
):
    """[Superadmin] Assign or update a subscription plan for a specific tenant."""
    # Verify plan exists
    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == payload.plan_id))
    if not plan_result.scalars().first():
        raise HTTPException(status_code=404, detail="Plan not found")

    sub_result = await db.execute(
        select(TenantSubscription).where(TenantSubscription.tenant_id == tenant_id)
    )
    sub = sub_result.scalars().first()

    now = datetime.now(timezone.utc)
    new_expires_at = payload.expires_at
    if not new_expires_at:
        # Calculate new expiration date
        # If currently active and not expired, extend from existing expiration
        base_date = now
        if sub and sub.expires_at and sub.expires_at > now:
            base_date = sub.expires_at
        new_expires_at = base_date + timedelta(days=30 * (payload.duration_months or 1))

    if sub:
        # No Downgrade Policy
        if sub.plan_id:
            curr_plan_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == sub.plan_id))
            curr_plan = curr_plan_res.scalars().first()
            # Only block if plan_id is actually changing to a cheaper one
            new_plan_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == payload.plan_id))
            new_plan = new_plan_res.scalars().first()
            if curr_plan and new_plan and sub.plan_id != payload.plan_id and new_plan.price_per_month < curr_plan.price_per_month:
                 raise HTTPException(
                    status_code=400, 
                    detail="Downgrading subscription plans is not allowed. Please wait until the current subscription expires."
                )

        sub.plan_id = payload.plan_id
        if payload.duration_months is not None: sub.duration_months = payload.duration_months
        if payload.price_charged is not None: sub.price_charged = payload.price_charged
        sub.expires_at = new_expires_at
        sub.status = payload.status or "active"
    else:
        sub = TenantSubscription(
            tenant_id=tenant_id,
            plan_id=payload.plan_id,
            duration_months=payload.duration_months or 1,
            expires_at=new_expires_at,
            status=payload.status or "active",
            price_charged=payload.price_charged or 0.0
        )
        db.add(sub)

    await db.commit()
    return {
        "message": "Tenant subscription updated successfully",
        "expires_at": new_expires_at,
        "status": sub.status,
        "price_charged": sub.price_charged
    }


@router.delete("/admin/tenant-subscriptions/{tenant_id}", status_code=204)
async def remove_tenant_plan(
    tenant_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """[Superadmin] Remove a tenant's subscription plan."""
    sub_result = await db.execute(
        select(TenantSubscription).where(TenantSubscription.tenant_id == tenant_id)
    )
    sub = sub_result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found for this tenant")
    await db.delete(sub)
    await db.commit()
    return None


class ExtendSubscriptionPayload(BaseModel):
    months: int


@router.post("/admin/extend/{tenant_id}")
async def extend_tenant_subscription(
    tenant_id: UUID,
    payload: ExtendSubscriptionPayload,
    db: AsyncSession = Depends(get_db)
):
    """[Superadmin] Extend an existing subscription by adding more months."""
    sub_result = await db.execute(
        select(TenantSubscription).where(TenantSubscription.tenant_id == tenant_id)
    )
    sub = sub_result.scalars().first()
    if not sub:
        raise HTTPException(status_code=404, detail="No subscription found for this tenant")

    now = datetime.now(timezone.utc)
    # Extend from current expiry if not expired, else from now
    base_date = sub.expires_at if sub.expires_at and sub.expires_at > now else now
    
    new_expires_at = base_date + timedelta(days=30 * payload.months)
    
    sub.expires_at = new_expires_at
    sub.duration_months += payload.months
    sub.status = "active"
    
    await db.commit()
    return {
        "message": f"Subscription extended by {payload.months} months",
        "new_expires_at": new_expires_at
    }


# ─── Renewal System ──────────────────────────────────────────────────────────

class RenewalPayload(BaseModel):
    plan_id: UUID
    duration_months: int  # 1, 3, 6


@router.post("/renew")
async def renew_subscription(
    payload: RenewalPayload,
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(get_current_tenant)
):
    """
    Renew or Extend current subscription.
    """
    # 1. Fetch Plan
    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == payload.plan_id))
    plan = plan_result.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # 2. Fetch Subscription
    sub_result = await db.execute(
        select(TenantSubscription).where(TenantSubscription.tenant_id == current_tenant)
    )
    sub = sub_result.scalars().first()

    now = datetime.now(timezone.utc)
    
    # Calculate price (for frontend display or simulation here)
    price = calculate_renewal_price(plan.price_per_month, payload.duration_months)

    if sub:
        # No Downgrade Policy
        if sub.plan_id:
            curr_plan_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == sub.plan_id))
            curr_plan = curr_plan_res.scalars().first()
            if curr_plan and plan.price_per_month < curr_plan.price_per_month:
                raise HTTPException(
                    status_code=400, 
                    detail="Downgrading subscription plans is not allowed. Please wait until the current subscription expires."
                )

        # If active, extend from expires_at. If expired, extend from NOW.
        base_date = sub.expires_at if sub.expires_at and sub.expires_at > now else now
        sub.expires_at = base_date + timedelta(days=30 * payload.duration_months)
        sub.plan_id = payload.plan_id
        sub.status = "active"
        sub.price_charged = price
    else:
        # Create new
        sub = TenantSubscription(
            tenant_id=current_tenant,
            plan_id=payload.plan_id,
            status="active",
            started_at=now,
            expires_at=now + timedelta(days=30 * payload.duration_months),
            price_charged=price,
            duration_months=payload.duration_months
        )
        db.add(sub)

    await db.commit()
    return {
        "message": f"Successfully renewed for {payload.duration_months} months",
        "new_expiry": sub.expires_at,
        "total_price": price
    }
