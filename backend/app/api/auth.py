from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timezone

from app.database import get_db
# Move models to internal imports to break circular dependency cycles
from app.schemas.user import Token
from app.services.auth import verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    """Secure login with broken-cycle model imports."""
    from app.models.user import User
    from app.models.subscription import TenantSubscription
    from app.models.user_permission import UserPermission

    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account is disabled")

    # Subscription logic (Internalized to avoid cycle)
    allowed_modules = ["dashboard", "sales", "customers", "devices", "sla"]
    
    if user.role not in ["superadmin", "super_admin"]:
        sub_res = await db.execute(select(TenantSubscription).where(TenantSubscription.tenant_id == user.tenant_id))
        sub = sub_res.scalars().first()
        if sub and (sub.status in ["suspended", "expired"]):
             # We allow login but restrict modules? No, let's keep it simple for now
             pass

    # Permissions
    perm_res = await db.execute(select(UserPermission).where(UserPermission.user_id == user.id))
    perms = perm_res.scalars().first()
    if perms and perms.allowed_modules:
        allowed_modules = perms.allowed_modules
    
    # Generate JWT
    access_token = create_access_token(
        data={
            "sub": str(user.id), 
            "email": user.email, 
            "role": user.role, 
            "tenant_id": str(user.tenant_id),
            "allowed_modules": allowed_modules
        }
    )
    return {"access_token": access_token, "token_type": "bearer"}
