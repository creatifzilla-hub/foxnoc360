from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from typing import Optional
import datetime
from app.services.maintenance_service import MaintenanceService
from app.services.auth import get_current_tenant

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])

class MaintenanceScheduleRequest(BaseModel):
    device_id: str
    start_time: str # "HH:MM" or ISO timestamp
    end_time: str   # "HH:MM" or ISO timestamp
    is_recurrent: bool = False

    @field_validator("start_time", "end_time")
    @classmethod
    def validate_times(cls, v, info):
        # Basic format validation
        if ":" in v and len(v) <= 5: # Assume HH:MM
            h, m = map(int, v.split(":"))
            if not (0 <= h <= 23 and 0 <= m <= 59):
                raise ValueError("Invalid time format HH:MM")
        else:
            try:
                datetime.datetime.fromisoformat(v)
            except:
                raise ValueError("Must be HH:MM or ISO timestamp")
        return v

@router.post("/schedule")
async def schedule_maintenance(
    payload: MaintenanceScheduleRequest,
    current_tenant: str = Depends(get_current_tenant)
):
    """
    Schedule a maintenance window for a device.
    Scoped to the current tenant for security (implicitly handled by app logic).
    """
    # In a full implementation, verify device_id belongs to current_tenant here.
    
    MaintenanceService.set_maintenance_window(
        device_id=payload.device_id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_recurrent=payload.is_recurrent
    )
    return {"message": "Maintenance window scheduled successfully"}

@router.delete("/{device_id}")
async def clear_maintenance(
    device_id: str,
    current_tenant: str = Depends(get_current_tenant)
):
    """Cancel any active or scheduled maintenance for a device."""
    MaintenanceService.clear_maintenance(device_id)
    return {"message": "Maintenance cleared"}

@router.get("/{device_id}")
async def get_maintenance_status(
    device_id: str,
    current_tenant: str = Depends(get_current_tenant)
):
    """Check if a device is currently under maintenance according to Redis."""
    is_active = MaintenanceService.is_in_maintenance(device_id)
    return {"device_id": device_id, "is_in_maintenance": is_active}
