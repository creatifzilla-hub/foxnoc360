from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.services.auth import hash_password

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    """Register a new user under a specific tenant."""
    # Verify tenant exists
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == payload.tenant_id))
    if not tenant_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tenant not found.",
        )

    # Check for duplicate email
    user_result = await db.execute(select(User).where(User.email == payload.email))
    if user_result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    user = User(
        tenant_id=payload.tenant_id,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.get("", response_model=list[UserResponse])
async def list_users(db: AsyncSession = Depends(get_db)):
    """Return all users across the system."""
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return result.scalars().all()
