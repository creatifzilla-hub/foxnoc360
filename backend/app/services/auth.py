from datetime import datetime, timedelta, timezone
from typing import Optional, List
from uuid import UUID
from jose import jwt
import bcrypt
from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models.subscription import TenantSubscription, SubscriptionPlan

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain-text password against a stored bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_token_payload(token: str = Depends(oauth2_scheme)) -> dict:
    """Decode and return the current token payload."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid session")

async def get_current_tenant(token: str = Depends(oauth2_scheme)) -> str:
    """Extract tenant_id from the current validated JWT."""
    payload = await get_token_payload(token)
    tenant_id: str = payload.get("tenant_id")
    if tenant_id is None:
        raise HTTPException(status_code=401, detail="Invalid tenant ID")
    return tenant_id


async def check_subscription_restriction(tenant_id: str = Depends(get_current_tenant)):
    """
    Middleware/Dependency to check if a tenant is allowed to perform 'write' actions.
    Tenants in 'grace_period' or 'suspended' cannot add devices or customers.
    """
    from uuid import UUID as uuid_lib
    try:
        tenant_uuid = uuid_lib(tenant_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="Invalid tenant ID in session")

    async with AsyncSessionLocal() as db:
        # Superadmin bypass check (hit User table)
        from app.models.user import User
        is_super = await db.scalar(select(User.role).where(User.tenant_id == tenant_uuid, User.role.in_(["superadmin", "super_admin"])))
        if is_super:
             return tenant_id

        result = await db.execute(
            select(TenantSubscription).where(TenantSubscription.tenant_id == tenant_uuid)
        )
        sub = result.scalars().first()
        
        now = datetime.now(timezone.utc)
        if not sub:
            return tenant_id # No subscription record yet (e.g., seeding)
            
        if sub.status == "suspended" or sub.status == "disabled":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account access has been disabled by the administrator."
            )

        if sub.expires_at and sub.expires_at < now:
            # Auto-marking as expired if encountered
            if sub.status != "expired":
                sub.status = "expired"
                await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your subscription has expired. Please renew to continue."
            )
            
        if sub.status == "expired":
             raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your subscription has expired. Please renew to continue."
            )
    return tenant_id


async def require_sla_reports(tenant_id: str = Depends(get_current_tenant)):
    """Dependency to ensure the current tenant has SLA reports enabled in their plan."""
    from uuid import UUID as uuid_lib
    try:
        tenant_uuid = uuid_lib(tenant_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="Invalid tenant ID in session")

    async with AsyncSessionLocal() as db:
        # Join with plans to check sla_reports flag
        result = await db.execute(
            select(SubscriptionPlan.sla_reports)
            .join(TenantSubscription, TenantSubscription.plan_id == SubscriptionPlan.id)
            .where(TenantSubscription.tenant_id == tenant_uuid)
        )
        has_sla = result.scalar()
        
        if not has_sla:
            from app.models.user import User
            is_super = await db.scalar(select(User.role).where(User.tenant_id == tenant_uuid, User.role.in_(["superadmin", "super_admin"])))
            if not is_super:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="SLA Reports are not included in your current plan. Please upgrade to Professional or Enterprise."
                )
    return tenant_id


async def require_snmp(tenant_id: str = Depends(get_current_tenant)):
    """Dependency to ensure the current tenant has SNMP features enabled in their plan."""
    from uuid import UUID as uuid_lib
    try:
        tenant_uuid = uuid_lib(tenant_id)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="Invalid tenant ID in session")

    async with AsyncSessionLocal() as db:
        # Join with plans to check snmp_enabled flag
        result = await db.execute(
            select(SubscriptionPlan.snmp_enabled)
            .join(TenantSubscription, TenantSubscription.plan_id == SubscriptionPlan.id)
            .where(TenantSubscription.tenant_id == tenant_uuid)
        )
        has_snmp = result.scalar()
        
        if not has_snmp:
            from app.models.user import User
            is_super = await db.scalar(select(User.role).where(User.tenant_id == tenant_uuid, User.role.in_(["superadmin", "super_admin"])))
            if not is_super:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="SNMP monitoring is not included in your current plan. Please upgrade to Professional or Enterprise."
                )
    return tenant_id


async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Extract full User object from the current validated JWT."""
    from app.models.user import User
    from app.models.user_permission import UserPermission # Import for join
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except Exception:
        raise credentials_exception

    async with AsyncSessionLocal() as db:
        # Load user and their permissions
        try:
            target_id = UUID(user_id) if isinstance(user_id, str) else user_id
        except ValueError:
            raise credentials_exception
            
        result = await db.execute(select(User).where(User.id == target_id))
        user = result.scalars().first()
        if user is None:
            raise credentials_exception
            
        # Enrich permissions object if it exists
        p_res = await db.execute(select(UserPermission).where(UserPermission.user_id == user.id))
        user.permissions = p_res.scalars().first()
        return user


def require_module(module_name: str):
    """
    Higher-order dependency to check if a user is allowed to access 
    a specific module (dashboard, sales, customers, devices, sla).
    """
    async def _dependency(user: User = Depends(get_current_user)):
        # Bypass for Admins
        if user.role in ["super_admin", "superadmin", "isp_admin"]:
            return user
            
        # Check granular permissions
        if not user.permissions or module_name not in (user.permissions.allowed_modules or []):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: You do not have permission for the {module_name} module."
            )
        return user
    return _dependency
