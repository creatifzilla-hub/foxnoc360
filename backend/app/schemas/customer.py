from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime

class CustomerCreate(BaseModel):
    tenant_id: Optional[UUID] = None
    name: str
    contact_email: Optional[str] = None


class CustomerUpdate(BaseModel):
    tenant_id: Optional[UUID] = None
    name: Optional[str] = None
    contact_email: Optional[str] = None

class CustomerResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    tenant_name: Optional[str] = None
    name: str
    contact_email: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
