from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Optional
from datetime import datetime
from uuid import UUID
from pydantic import BaseModel

from app.database import get_db
from app.services.auth import require_sla_reports, get_current_user
from app.services.sla_service import calculate_device_uptime
from app.models.device import Device
from app.models.customer import Customer
from app.models.downtime import Downtime

router = APIRouter(prefix="/sla", tags=["SLA Reports"])


class IncidentResponse(BaseModel):
    started_at: datetime
    ended_at: Optional[datetime]
    duration_seconds: Optional[int]

class SLAReportResponse(BaseModel):
    device_id: UUID
    uptime_percentage: float
    total_downtime_seconds: int
    incident_count: int
    total_checks: int
    successful_checks: int
    failed_checks: int
    avg_latency: float
    max_latency: float
    avg_packet_loss: float
    is_compliant: bool
    incidents: list[IncidentResponse] = []

class CustomerSLAResponse(BaseModel):
    customer_id: UUID
    total_devices: int
    avg_uptime: float
    total_downtime: int
    total_incidents: int
    is_compliant: bool
    device_reports: list[SLAReportResponse]

class SLASummaryResponse(BaseModel):
    total_devices: int
    sla_met: int
    sla_breached: int
    avg_uptime: float


@router.get("/summary", response_model=SLASummaryResponse)
async def get_sla_summary(
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    threshold: float = Query(99.9),
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(require_sla_reports)
):
    """
    Returns aggregated SLA statistics for all devices under the tenant.
    """
    from app.services.sla_service import calculate_sla_summary
    return await calculate_sla_summary(
        db=db,
        tenant_id=current_tenant,
        start_date=start_date,
        end_date=end_date,
        sla_threshold=threshold
    )


@router.get("/device-report/{device_id}", response_model=SLAReportResponse)
async def get_device_sla_report(
    device_id: UUID,
    start_date: datetime = Query(..., description="Start of reporting window (ISO format)"),
    end_date: datetime = Query(..., description="End of reporting window (ISO format)"),
    threshold: float = Query(99.9),
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(require_sla_reports)
):
    """
    Returns the SLA Uptime percentage and incident breakdown for a specific device.
    """
    report = await calculate_device_uptime(
        db=db,
        device_id=device_id,
        start_date=start_date,
        end_date=end_date,
        sla_threshold=threshold
    )

    # Fetch downtime incidents
    dt_result = await db.execute(
        select(Downtime)
        .where(
            Downtime.device_id == device_id,
            Downtime.started_at >= start_date,
            Downtime.started_at <= end_date,
        )
        .order_by(Downtime.started_at.desc())
    )
    
    report["incidents"] = [
        {
            "started_at": dt.started_at,
            "ended_at": dt.ended_at,
            "duration_seconds": dt.duration_seconds,
        }
        for dt in dt_result.scalars().all()
    ]
    
    return report

@router.get("/customer-report/{customer_id}", response_model=CustomerSLAResponse)
async def get_customer_sla_report(
    customer_id: UUID,
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    threshold: float = Query(99.5),
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(require_sla_reports)
):
    """
    Generate an aggregated SLA report for all devices associated with a specific customer.
    """
    from app.services.sla_service import get_customer_sla_summary
    
    # In a full multi-tenant env, verify customer belongs to current_tenant here
    summary = await get_customer_sla_summary(
        db=db,
        customer_id=str(customer_id),
        start_date=start_date,
        end_date=end_date,
        sla_threshold=threshold
    )
    return summary


@router.get("/pdf-report/{device_id}", response_class=Response)
async def download_pdf_sla_report(
    device_id: UUID,
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(require_sla_reports)
):
    """
    Download a professionally formatted PDF SLA report for a device and date range.
    """
    from sqlalchemy.orm import joinedload
    from app.services.pdf_service import generate_sla_pdf

    # Fetch device + customer info
    dev_result = await db.execute(
        select(Device).options(joinedload(Device.customer)).where(Device.id == device_id)
    )
    device = dev_result.scalars().first()
    if not device:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Device not found")

    customer_name = device.customer.name if device.customer else "Unknown"

    # Get SLA stats
    report = await calculate_device_uptime(db, device_id, start_date, end_date)

    # Fetch downtime incidents list
    dt_result = await db.execute(
        select(Downtime)
        .where(
            Downtime.device_id == device_id,
            Downtime.started_at >= start_date,
            Downtime.started_at <= end_date,
        )
        .order_by(Downtime.started_at)
    )
    incidents = [
        {
            "started_at": dt.started_at,
            "ended_at": dt.ended_at,
            "duration_seconds": dt.duration_seconds,
        }
        for dt in dt_result.scalars().all()
    ]

    pdf_bytes = generate_sla_pdf(
        device_name=device.name,
        customer_name=customer_name,
        ip_address=device.ip_address,
        start_date=start_date,
        end_date=end_date,
        uptime_percentage=report["uptime_percentage"],
        total_downtime_seconds=report["total_downtime_seconds"],
        incident_count=report["incident_count"],
        total_checks=report["total_checks"],
        successful_checks=report["successful_checks"],
        avg_latency=report["avg_latency"],
        max_latency=report["max_latency"],
        packet_loss=report["avg_packet_loss"],
        incidents=incidents,
        is_compliant=report["is_compliant"]
    )

    filename = f"sla_report_{device.name}_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/share-report/{device_id}")
async def share_pdf_sla_report(
    device_id: UUID,
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    recipient_email: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(require_sla_reports)
):
    """
    Generate an SLA PDF report and email it directly to the associated customer.
    """
    from sqlalchemy.orm import joinedload
    from app.services.pdf_service import generate_sla_pdf
    from app.services.email_service import send_sla_report_email

    # Fetch device + customer info
    dev_result = await db.execute(
        select(Device).options(joinedload(Device.customer)).where(Device.id == device_id)
    )
    device = dev_result.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    target_email = recipient_email or (device.customer.contact_email if device.customer else None)
    
    if not target_email:
        raise HTTPException(status_code=400, detail="No recipient email provided and no customer email assigned to this device.")

    customer_name = device.customer.name if device.customer else "Valued Customer"

    # Get SLA stats
    report = await calculate_device_uptime(db, device_id, start_date, end_date)

    # Fetch downtime incidents list
    dt_result = await db.execute(
        select(Downtime)
        .where(
            Downtime.device_id == device_id,
            Downtime.started_at >= start_date,
            Downtime.started_at <= end_date,
        )
        .order_by(Downtime.started_at)
    )
    incidents = [
        {
            "started_at": dt.started_at,
            "ended_at": dt.ended_at,
            "duration_seconds": dt.duration_seconds,
        }
        for dt in dt_result.scalars().all()
    ]

    pdf_bytes = generate_sla_pdf(
        device_name=device.name,
        customer_name=customer_name,
        ip_address=device.ip_address,
        start_date=start_date,
        end_date=end_date,
        uptime_percentage=report["uptime_percentage"],
        total_downtime_seconds=report["total_downtime_seconds"],
        incident_count=report["incident_count"],
        total_checks=report["total_checks"],
        successful_checks=report["successful_checks"],
        avg_latency=report["avg_latency"],
        max_latency=report["max_latency"],
        packet_loss=report["avg_packet_loss"],
        incidents=incidents,
        is_compliant=report["is_compliant"]
    )

    await send_sla_report_email(
        recipient=target_email,
        customer_name=customer_name,
        device_name=device.name,
        start_date=start_date.strftime('%Y-%m-%d'),
        end_date=end_date.strftime('%Y-%m-%d'),
        pdf_content=pdf_bytes
    )

    return {"message": f"SLA Report successfully shared with {target_email}"}


@router.post("/reset")
async def reset_sla_data(
    device_id: Optional[UUID] = Query(None),
    device_ids: Optional[str] = Query(None), # Comma separated IDs
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Permanently resets SLA metrics.
    """

    from sqlalchemy import delete
    from app.models.ping_log import PingLog
    from app.models.downtime import Downtime
    from app.models.device import Device

    query_log = delete(PingLog)
    query_dt = delete(Downtime)

    target_ids = []
    if device_id:
        target_ids.append(device_id)
    if device_ids:
        try:
            target_ids.extend([UUID(d.strip()) for d in device_ids.split(",") if d.strip()])
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid UUID format in device_ids.")

    if target_ids:
        if current_user.role != "superadmin":
            dev_result = await db.execute(select(Device.id).where(Device.id.in_(target_ids), Device.tenant_id == current_user.tenant_id))
            found_ids = [r[0] for r in dev_result.all()]
            if len(found_ids) != len(set(target_ids)):
                 raise HTTPException(status_code=404, detail="Some devices not found or not owned by you.")
        
        query_log = query_log.where(PingLog.device_id.in_(target_ids))
        query_dt = query_dt.where(Downtime.device_id.in_(target_ids))
    else:
        if current_user.role != "superadmin":
            device_subquery = select(Device.id).where(Device.tenant_id == current_user.tenant_id)
            query_log = query_log.where(PingLog.device_id.in_(device_subquery))
            query_dt = query_dt.where(Downtime.device_id.in_(device_subquery))

    await db.execute(query_log)
    await db.execute(query_dt)
    await db.commit()
    
    return {"message": "SLA data has been reset successfully."}


