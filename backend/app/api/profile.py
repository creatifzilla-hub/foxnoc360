from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.services.auth import get_current_user, hash_password

router = APIRouter(prefix="/profile", tags=["Profile"])

class ProfileResponse(BaseModel):
    user_id: str
    email: str
    role: str
    tenant_id: str
    tenant_name: Optional[str] = None
    company_email: Optional[str] = None
    plan_name: Optional[str] = None
    max_devices: int = 0
    max_customers: int = 0
    price_charged: float = 0.0
    expires_at: Optional[datetime] = None
    
    # New User Fields
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    profile_picture: Optional[str] = None
    
    # New Tenant Fields
    alternate_email: Optional[str] = None
    company_website: Optional[str] = None
    gst_number: Optional[str] = None
    
    # Notifications
    email_alerts: Optional[bool] = True
    whatsapp_alerts: Optional[bool] = True

class ProfileUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    tenant_name: Optional[str] = None
    company_email: Optional[EmailStr] = None
    
    # New Fields
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    profile_picture: Optional[str] = None
    alternate_email: Optional[EmailStr] = None
    company_website: Optional[str] = None
    gst_number: Optional[str] = None
    email_alerts: Optional[bool] = None
    whatsapp_alerts: Optional[bool] = None

@router.get("/", response_model=ProfileResponse)
async def get_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Fetch current user and tenant profile info."""
    tenant = None
    if current_user.tenant_id:
        result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
        tenant = result.scalars().first()

    # Fetch Subscription info
    from app.models.subscription import TenantSubscription, SubscriptionPlan
    sub_res = await db.execute(
        select(TenantSubscription, SubscriptionPlan)
        .join(SubscriptionPlan, TenantSubscription.plan_id == SubscriptionPlan.id)
        .where(TenantSubscription.tenant_id == current_user.tenant_id)
    )
    sub_data = sub_res.first()
    sub, plan = sub_data if sub_data else (None, None)

    return ProfileResponse(
        user_id=str(current_user.id),
        email=current_user.email,
        role=current_user.role,
        tenant_id=str(current_user.tenant_id),
        tenant_name=tenant.name if tenant else None,
        company_email=tenant.company_email if tenant else None,
        plan_name=plan.name if plan else None,
        max_devices=plan.max_devices if plan else 0,
        max_customers=plan.max_customers if plan else 0,
        price_charged=sub.price_charged if sub else 0.0,
        expires_at=sub.expires_at if sub else None,
        
        full_name=current_user.full_name,
        phone_number=current_user.phone_number,
        profile_picture=current_user.profile_picture,
        
        alternate_email=tenant.alternate_email if tenant else None,
        company_website=tenant.company_website if tenant else None,
        gst_number=tenant.gst_number if tenant else None,
        email_alerts=current_user.email_alerts if current_user.email_alerts is not None else True,
        whatsapp_alerts=current_user.whatsapp_alerts if current_user.whatsapp_alerts is not None else True
    )

@router.put("/")
async def update_profile(
    payload: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update user and tenant profile info."""
    # 1. Update User Password/Email if provided
    if payload.email:
        # Check if email is already taken by another user
        existing_res = await db.execute(select(User).where(User.email == payload.email, User.id != current_user.id))
        if existing_res.scalars().first():
            raise HTTPException(status_code=400, detail="Email already in use by another account.")
        current_user.email = payload.email
    
    if payload.password:
        current_user.password_hash = hash_password(payload.password)
        
    if payload.full_name is not None:
        current_user.full_name = payload.full_name
    if payload.phone_number is not None:
        current_user.phone_number = payload.phone_number
    if payload.profile_picture is not None:
        current_user.profile_picture = payload.profile_picture
    if payload.email_alerts is not None:
        current_user.email_alerts = payload.email_alerts
    if payload.whatsapp_alerts is not None:
        current_user.whatsapp_alerts = payload.whatsapp_alerts

    # 2. Update Tenant Info if ISP Admin
    if current_user.role not in ["superadmin", "super_admin"] and current_user.tenant_id:
        result = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
        tenant = result.scalars().first()
        if tenant:
            if payload.tenant_name:
                tenant.name = payload.tenant_name
            if payload.company_email:
                tenant.company_email = payload.company_email
            if payload.alternate_email is not None:
                tenant.alternate_email = payload.alternate_email
            if payload.company_website is not None:
                tenant.company_website = payload.company_website
            if payload.gst_number is not None:
                tenant.gst_number = payload.gst_number

    await db.commit()
    return {"message": "Profile updated successfully"}
