from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, case, extract, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict
from uuid import UUID
from datetime import datetime, timezone, timedelta

from app.database import get_db
from app.models.user import User
from app.models.sales import Lead, LeadActivity
from app.models.customer import Customer
from app.schemas.sales import LeadCreate, LeadUpdate, LeadResponse, ActivityResponse, ConversionStats
from app.services.auth import get_current_user, get_current_tenant

router = APIRouter(prefix="/sales", tags=["Sales CRM"])

@router.get("/dashboard", response_model=ConversionStats)
async def get_sales_dashboard(
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(get_current_tenant)
):
    """Return aggregated sales KPIs for the dashboard."""
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # 1. Total Leads counts
    total_leads = await db.scalar(select(func.count(Lead.id)).where(Lead.tenant_id == current_tenant))
    
    # 2. Conversion Rate
    converted_leads = await db.scalar(
        select(func.count(Lead.id)).where(Lead.tenant_id == current_tenant, Lead.status == "installed")
    )
    conversion_rate = (converted_leads / total_leads * 100) if total_leads > 0 else 0.0

    # 3. Leads per Stage
    stage_counts = await db.execute(
        select(Lead.status, func.count(Lead.id))
        .where(Lead.tenant_id == current_tenant)
        .group_by(Lead.status)
    )
    leads_per_stage = {stage: count for stage, count in stage_counts.all()}

    # 4. Follow-ups
    follow_ups_due = await db.scalar(
        select(func.count(Lead.id))
        .where(
            Lead.tenant_id == current_tenant, 
            Lead.follow_up_at >= today, 
            Lead.follow_up_at < today + timedelta(days=1)
        )
    )
    missed_follow_ups = await db.scalar(
        select(func.count(Lead.id))
        .where(Lead.tenant_id == current_tenant, Lead.follow_up_at < today, Lead.status.notin_(["installed", "rejected"]))
    )

    # 5. Top Agents
    top_agents_res = await db.execute(
        select(User.full_name, User.email, func.count(Lead.id))
        .join(Lead, Lead.assigned_agent_id == User.id)
        .where(Lead.tenant_id == current_tenant, Lead.status == "installed")
        .group_by(User.id)
        .order_by(func.count(Lead.id).desc())
        .limit(5)
    )
    top_agents = [{"name": (fname or email), "conversions": count} for fname, email, count in top_agents_res.all()]

    # 6. Area distribution
    area_res = await db.execute(
        select(Lead.location, func.count(Lead.id))
        .where(Lead.tenant_id == current_tenant)
        .group_by(Lead.location)
    )
    area_dist = {area if area else "Unknown": count for area, count in area_res.all()}

    # 7. Recent Leads
    recent_leads_res = await db.execute(
        select(Lead)
        .options(selectinload(Lead.activities))
        .where(Lead.tenant_id == current_tenant)
        .order_by(Lead.created_at.desc())
        .limit(10)
    )
    recent_leads = recent_leads_res.scalars().all()

    return ConversionStats(
        total_leads=total_leads,
        conversion_rate=conversion_rate,
        leads_per_stage=leads_per_stage,
        follow_ups_due=follow_ups_due,
        missed_follow_ups=missed_follow_ups,
        top_agents=top_agents,
        recent_leads=recent_leads,
        area_distribution=area_dist
    )

@router.get("/leads", response_model=List[LeadResponse])
async def list_leads(
    status: Optional[str] = None,
    agent_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all leads for the tenant with optional filtering by status and agent."""
    query = select(Lead).options(selectinload(Lead.activities)).where(Lead.tenant_id == current_user.tenant_id)
    
    if status:
        query = query.where(Lead.status == status)
    
    # Access Control: Sales agents may only see their own leads if configured
    is_sales = current_user.role == "operator" or current_user.role == "Sales Agent" # Handling both just in case
    
    # We'll check the UserPermission flag later but for now we'll allow filtering by agent_id
    if agent_id:
        query = query.where(Lead.assigned_agent_id == agent_id)

    result = await db.execute(query.order_by(Lead.created_at.desc()))
    return result.scalars().all()

@router.post("/leads", response_model=LeadResponse, status_code=201)
async def create_lead(
    payload: LeadCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new sales lead and log the creation activity."""
    new_lead = Lead(
        tenant_id=current_user.tenant_id,
        name=payload.name,
        phone=payload.phone,
        location=payload.location,
        interested_plan=payload.interested_plan,
        assigned_agent_id=payload.assigned_agent_id,
        notes=payload.notes,
        follow_up_at=payload.follow_up_at,
        status=payload.status if hasattr(payload, 'status') else "new"
    )
    db.add(new_lead)
    await db.flush()

    # Log Activity
    activity = LeadActivity(
        lead_id=new_lead.id,
        actor_id=current_user.id,
        action="created",
        note="Lead manually added to the pipeline."
    )
    db.add(activity)
    
    await db.commit()
    await db.refresh(new_lead)
    
    # Must retrieve relationships properly for nested Pydantic schemas over Asyncpg
    re_fetched = await db.execute(select(Lead).options(selectinload(Lead.activities)).where(Lead.id == new_lead.id))
    return re_fetched.scalars().first()

@router.put("/leads/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: UUID,
    payload: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update lead details or status and track changes in the activity log."""
    result = await db.execute(select(Lead).options(selectinload(Lead.activities)).where(Lead.id == lead_id, Lead.tenant_id == current_user.tenant_id))
    lead = result.scalars().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    old_status = lead.status
    
    # Update fields
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(lead, k, v)
    
    # Log Change if status updated
    if payload.status and payload.status != old_status:
        activity = LeadActivity(
            lead_id=lead.id,
            actor_id=current_user.id,
            action="status_change",
            note=f"Moved from {old_status} to {payload.status}"
        )
        db.add(activity)
        
        # Auto-set conversion date if installed
        if payload.status == "installed" and not lead.converted_at:
            lead.converted_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(lead)
    return lead

@router.post("/leads/{lead_id}/convert", status_code=201)
async def convert_lead_to_customer(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    One-click conversion: Creates a Customer record from lead data 
    and marks lead as 'installed' (converted).
    """
    result = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.tenant_id == current_user.tenant_id))
    lead = result.scalars().first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found.")

    if lead.status == "installed":
        raise HTTPException(status_code=400, detail="Lead is already converted.")

    # 1. Create Customer
    new_customer = Customer(
        tenant_id=current_user.tenant_id,
        name=lead.name,
        contact_email=None # Can be improved later if we add email to Lead
    )
    db.add(new_customer)
    
    # 2. Update Lead Status
    lead.status = "installed"
    lead.converted_at = datetime.now(timezone.utc)
    lead.notes = (lead.notes or "") + f"\n[Auto-Convert]: Formed Customer entry on {lead.converted_at}"

    # 3. Log Activity
    activity = LeadActivity(
        lead_id=lead.id,
        actor_id=current_user.id,
        action="converted",
        note="Converted to paying customer!"
    )
    db.add(activity)

    await db.commit()
    return {"status": "success", "customer_id": new_customer.id}


@router.post("/leads/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_leads(
    payload: Dict, # {ids: List[str]}
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete multiple leads, strictly scoped to the tenant."""
    import uuid as uuid_lib
    from sqlalchemy import delete as sa_delete
    
    ids = payload.get("ids", [])
    try:
        uuids = [uuid_lib.UUID(i) for i in ids if i and i != "undefined"]
        tenant_uuid = current_user.tenant_id
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid UUID in request")

    # Verify ownership
    authorized_res = await db.execute(
        select(Lead.id).where(Lead.id.in_(uuids), Lead.tenant_id == tenant_uuid)
    )
    authorized_uuids = [r[0] for r in authorized_res.all()]

    if not authorized_uuids:
        return None

    # Delete activities first
    await db.execute(sa_delete(LeadActivity).where(LeadActivity.lead_id.in_(authorized_uuids)))
    # Delete leads
    await db.execute(sa_delete(Lead).where(Lead.id.in_(authorized_uuids)))
    
    await db.commit()
    return None
