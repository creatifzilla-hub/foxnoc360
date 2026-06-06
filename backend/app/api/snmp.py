from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, func, and_, update
from uuid import UUID
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.models.snmp_log import SNMPLog
from app.models.device import Device
from app.models.device_interface import DeviceInterface
from app.services.auth import get_current_tenant, require_snmp, get_token_payload
from app.services.snmp_service import discover_interfaces
from pydantic import BaseModel


router = APIRouter(prefix="/snmp", tags=["SNMP Bandwidth"])


class InterfaceUpdate(BaseModel):
    if_index: int
    is_monitored: bool
    is_wan: bool = False

class InterfaceUpdateBatch(BaseModel):
    interfaces: List[InterfaceUpdate]


@router.get("/discover/{device_id}")
async def discover_device_interfaces(
    device_id: UUID, 
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """
    Walk the device's SNMP table and return all interfaces.
    """
    is_super = payload.get("role") in ["superadmin", "super_admin"]
    current_tenant_id = payload.get("tenant_id")

    stmt = select(Device).where(Device.id == device_id)
    if not is_super:
        stmt = stmt.where(Device.tenant_id == uuid.UUID(current_tenant_id))
    
    result = await db.execute(stmt)
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
        
    discovered = await discover_interfaces(str(device_id))
    return discovered


@router.get("/interfaces/{device_id}")
async def get_monitored_interfaces(
    device_id: UUID,
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """
    Return all discovered interfaces for a device and their monitoring status.
    """
    is_super = payload.get("role") in ["superadmin", "super_admin"]
    current_tenant_id = payload.get("tenant_id")

    stmt = select(DeviceInterface).join(Device, DeviceInterface.device_id == Device.id).where(Device.id == device_id)
    if not is_super:
        stmt = stmt.where(Device.tenant_id == uuid.UUID(current_tenant_id))
    
    result = await db.execute(stmt.order_by(DeviceInterface.if_index))
    return result.scalars().all()


@router.post("/interfaces/{device_id}")
async def update_monitored_interfaces(
    device_id: UUID,
    batch: InterfaceUpdateBatch,
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """
    Mark which interfaces should be polled and which is the primary WAN.
    """
    is_super = payload.get("role") in ["superadmin", "super_admin"]
    current_tenant_id = payload.get("tenant_id")

    stmt = select(Device).where(Device.id == device_id)
    if not is_super:
        stmt = stmt.where(Device.tenant_id == uuid.UUID(current_tenant_id))
    
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Device not found")
        
    for item in batch.interfaces:
        await db.execute(
            update(DeviceInterface)
            .where(DeviceInterface.device_id == device_id, DeviceInterface.if_index == item.if_index)
            .values(is_monitored=item.is_monitored, is_wan=item.is_wan)
        )
    
    await db.commit()
    return {"status": "updated"}


@router.get("/charts/{device_id}")
async def get_bandwidth_chart_data(
    device_id: UUID,
    if_index: int,
    period: str = Query(default="1h"),
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """
    Get historical bandwidth for a specific interface.
    """
    now = datetime.now()
    if period == "1h": start = now - timedelta(hours=1)
    elif period == "24h": start = now - timedelta(days=1)
    elif period == "7d": start = now - timedelta(days=7)
    elif period == "30d": start = now - timedelta(days=30)
    else: start = now - timedelta(hours=1)

    is_super = payload.get("role") in ["superadmin", "super_admin"]
    current_tenant_id = payload.get("tenant_id")

    stmt = select(SNMPLog).where(
        SNMPLog.device_id == device_id,
        SNMPLog.if_index == if_index,
        SNMPLog.polled_at >= start
    )
    if not is_super:
        stmt = stmt.where(SNMPLog.tenant_id == uuid.UUID(current_tenant_id))

    result = await db.execute(stmt.order_by(SNMPLog.polled_at))
    logs = result.scalars().all()
    
    in_bps  = [l.in_bps for l in logs if l.in_bps]
    out_bps = [l.out_bps for l in logs if l.out_bps]
    
    def calc_95th(vals):
        if not vals: return 0
        sorted_vals = sorted(vals)
        idx = int(len(sorted_vals) * 0.95) - 1
        return sorted_vals[max(0, idx)]

    return {
        "device_id": device_id,
        "if_index": if_index,
        "period": period,
        "points": [{
            "time": l.polled_at,
            "in": l.in_bps,
            "out": l.out_bps
        } for l in logs],
        "stats": {
            "in_avg": sum(in_bps) / len(in_bps) if in_bps else 0,
            "in_peak": max(in_bps) if in_bps else 0,
            "in_95th": calc_95th(in_bps),
            "out_avg": sum(out_bps) / len(out_bps) if out_bps else 0,
            "out_peak": max(out_bps) if out_bps else 0,
            "out_95th": calc_95th(out_bps)
        }
    }
