from pydantic import BaseModel
from datetime import datetime
from uuid import UUID
from typing import Optional


class DeviceCreate(BaseModel):
    tenant_id: Optional[UUID] = None
    customer_id: Optional[UUID] = None
    name: str
    ip_address: str
    location: Optional[str] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None
    customer_id: Optional[UUID] = None


class DeviceResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    tenant_name: Optional[str] = None
    customer_id: Optional[UUID]
    customer_name: Optional[str] = None
    name: str
    ip_address: str
    location: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
