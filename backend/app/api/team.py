from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional
from uuid import UUID

from app.database import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.models.subscription import TenantSubscription, SubscriptionPlan
from app.models.user_permission import UserPermission
from app.schemas.user import UserCreate, UserUpdate, UserResponse, PermissionSchema
from app.services.auth import get_current_user, get_current_tenant, hash_password
from pydantic import BaseModel
from sqlalchemy import delete as sa_delete

class BulkDeletePayload(BaseModel):
    ids: List[str]

router = APIRouter(prefix="/team", tags=["Team Management"])

from sqlalchemy.orm import selectinload
import uuid as uuid_lib

@router.get("/users", response_model=List[UserResponse])
async def list_team_members(
    tenant_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    current_tenant: str = Depends(get_current_tenant)
):
    """List all team members for the current ISP, including their module-level permissions."""
    # Superadmins can filter or see all
    target_tenant = current_tenant
    if current_user.role in ["superadmin", "super_admin"]:
        target_tenant = tenant_id if tenant_id else None
        
    query = select(User).options(selectinload(User.permissions))
    if target_tenant:
        if isinstance(target_tenant, str):
            try:
                target_tenant = uuid_lib.UUID(target_tenant)
            except ValueError:
                pass
        query = query.where(User.tenant_id == target_tenant)
    
    result = await db.execute(query.order_by(User.created_at.desc()))
    users = result.scalars().all()
    
    return users

@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_team_member(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new team member. 
    Checks subscription limits and creates associated permissions.
    """
    if current_user.role not in ["isp_admin", "superadmin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Only ISP Admins can manage team members.")

    is_managed_by_super = current_user.role in ["superadmin", "super_admin"]

    # 1. EMAIL DUPLICATION CHECK (Global) 
    ep_check = await db.scalar(select(User).where(User.email == payload.email))
    if ep_check:
        raise HTTPException(status_code=400, detail=f"User with email {payload.email} already exists.")

    # 3. CREATE USER
    target_tenant = current_user.tenant_id
    # Superadmin can override tenant
    if is_managed_by_super and payload.tenant_id:
        target_tenant = payload.tenant_id

    # 4. SUBSCRIPTION LIMIT CHECK (Moved after target_tenant is settled)
    # Get current user count for the TARGET tenant
    user_count = await db.scalar(
        select(func.count(User.id)).where(User.tenant_id == target_tenant)
    )
    
    # Get limit from target tenant's subscription
    sub_result = await db.execute(
        select(SubscriptionPlan.max_users)
        .join(TenantSubscription, TenantSubscription.plan_id == SubscriptionPlan.id)
        .where(TenantSubscription.tenant_id == target_tenant)
    )
    max_users = sub_result.scalar()
    
    # 🚨 DEBUG LOGGING (Temporary)
    print(f"DEBUG: Validating User Limit for Tenant ID: {target_tenant}")
    print(f"DEBUG: Current User Count: {user_count} | Allowed Max Users: {max_users}")
    print(f"DEBUG: Is Managed By Super: {is_managed_by_super}")

    # Fallback to a safe baseline if no subscription record found (e.g., seeding or processing delay)
    effective_limit = max_users if max_users is not None else 5 # Match Starter plan default
    
    if user_count >= effective_limit and not is_managed_by_super:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User limit reached as per your subscription. Your {effective_limit} seats are full. Please upgrade your plan."
        )

    new_user = User(
        tenant_id=target_tenant,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        full_name=payload.full_name,
        status="active"
    )
    db.add(new_user)
    await db.flush() # Get the new_user.id

    # 4. CREATE PERMISSIONS
    perms_data = payload.permissions if payload.permissions else PermissionSchema()
    new_perms = UserPermission(
        user_id=new_user.id,
        allowed_modules=perms_data.allowed_modules,
        assigned_leads_only=perms_data.assigned_leads_only
    )
    db.add(new_perms)
    
    await db.commit()
    
    # Re-fetch with permissions explicitly loaded
    result = await db.execute(select(User).options(selectinload(User.permissions)).where(User.id == new_user.id))
    return result.scalars().first()

@router.put("/users/{user_id}", response_model=UserResponse)
async def update_team_member(
    user_id: UUID,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a team member's role, status, or module-level permissions."""
    if current_user.role not in ["isp_admin", "superadmin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied.")

    result = await db.execute(select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    # Update basic fields
    if payload.email: user.email = payload.email
    if payload.role: user.role = payload.role
    if payload.status: user.status = payload.status
    if payload.full_name: user.full_name = payload.full_name
    if payload.password: user.password_hash = hash_password(payload.password)

    # Update permissions
    if payload.permissions:
        # Check if already exists, else create
        p_res = await db.execute(select(UserPermission).where(UserPermission.user_id == user.id))
        perms = p_res.scalars().first()
        
        if perms:
            perms.allowed_modules = payload.permissions.allowed_modules
            perms.assigned_leads_only = payload.permissions.assigned_leads_only
        else:
            new_perms = UserPermission(
                user_id=user.id,
                allowed_modules=payload.permissions.allowed_modules,
                assigned_leads_only=payload.permissions.assigned_leads_only
            )
            db.add(new_perms)

    await db.commit()
    
    # Re-fetch with permissions explicitly loaded
    updated_result = await db.execute(select(User).options(selectinload(User.permissions)).where(User.id == user.id))
    return updated_result.scalars().first()

@router.delete("/users/{user_id}", status_code=204)
async def delete_team_member(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Permanently delete a team member."""
    if current_user.role not in ["isp_admin", "superadmin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Permission denied.")

    result = await db.execute(select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    await db.delete(user)
    await db.commit()
    return None

@router.post("/users/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_users(
    payload: BulkDeletePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete multiple team members, strictly scoped to the current tenant."""
    if current_user.role not in ["isp_admin", "superadmin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Unprivileged action.")

    import uuid as uuid_lib
    try:
        uuids = [uuid_lib.UUID(i) for i in payload.ids if i and i != "undefined"]
        tenant_uuid = current_user.tenant_id
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid UUID in request")

    # 🚨 SECURITY: Only allow deleting users from the same tenant
    is_super = current_user.role in ["superadmin", "super_admin"]
    
    stmt = select(User.id).where(User.id.in_(uuids))
    if not is_super:
        stmt = stmt.where(User.tenant_id == tenant_uuid)
    
    # Preventing self-deletion in bulk
    stmt = stmt.where(User.id != current_user.id)

    authorized_res = await db.execute(stmt)
    authorized_uuids = [r[0] for r in authorized_res.all()]

    if not authorized_uuids:
        return None

    # Delete permissions first
    from app.models.user_permission import UserPermission
    await db.execute(sa_delete(UserPermission).where(UserPermission.user_id.in_(authorized_uuids)))
    # Delete users
    await db.execute(sa_delete(User).where(User.id.in_(authorized_uuids)))
    
    await db.commit()
    return None
