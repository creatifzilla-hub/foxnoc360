"""
Customer Portal API — Public, no authentication required.

Endpoints:
  GET /portal/status?email=...  — Look up a customer's devices by their email address
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from typing import Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from app.database import get_db
from app.models.customer import Customer
from app.models.device import Device

router = APIRouter(prefix="/portal", tags=["Customer Portal"])


class PortalDeviceInfo(BaseModel):
    id: UUID
    name: str
    ip_address: str
    location: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class PortalCustomerResponse(BaseModel):
    id: UUID
    name: str
    contact_email: Optional[str]
    devices: list[PortalDeviceInfo]


@router.get("/status", response_model=PortalCustomerResponse)
async def get_customer_status(email: str, db: AsyncSession = Depends(get_db)):
    """
    Look up a customer's device status by their contact email.
    This is a public endpoint — no auth token required.
    """
    result = await db.execute(
        select(Customer).where(Customer.contact_email == email)
    )
    customer = result.scalars().first()

    if not customer:
        raise HTTPException(status_code=404, detail="No account found for this email address.")

    # Fetch all devices for this customer
    devices_result = await db.execute(
        select(Device)
        .where(Device.customer_id == customer.id)
        .order_by(Device.name.asc())
    )
    devices = devices_result.scalars().all()

    return PortalCustomerResponse(
        id=customer.id,
        name=customer.name,
        contact_email=customer.contact_email,
        devices=[
            PortalDeviceInfo(
                id=d.id,
                name=d.name,
                ip_address=d.ip_address,
                location=d.location,
                status=d.status,
            )
            for d in devices
        ],
    )
