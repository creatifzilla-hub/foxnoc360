from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Optional


class TenantCreate(BaseModel):
    name: str
    company_email: EmailStr
    admin_password: str


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    company_email: Optional[EmailStr] = None


class TenantResponse(BaseModel):
    id: UUID
    name: str
    company_email: str
    status: str
    created_at: datetime
    customer_count: int = 0
    device_count: int = 0
    max_devices: Optional[int] = None
    plan_name: Optional[str] = None
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True
