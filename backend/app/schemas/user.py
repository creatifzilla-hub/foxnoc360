from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Optional, List

class PermissionSchema(BaseModel):
    allowed_modules: List[str] = ["dashboard"]
    assigned_leads_only: bool = False

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    role: str
    full_name: Optional[str] = None
    tenant_id: Optional[UUID] = None
    permissions: Optional[PermissionSchema] = None

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    full_name: Optional[str] = None
    permissions: Optional[PermissionSchema] = None

class UserResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    email: EmailStr
    role: str
    status: str
    full_name: Optional[str] = None
    created_at: datetime
    permissions: Optional[PermissionSchema] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
