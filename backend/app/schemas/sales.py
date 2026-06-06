from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID
from typing import Optional, List

class ActivityResponse(BaseModel):
    id: UUID
    lead_id: UUID
    actor_id: Optional[UUID]
    action: str
    note: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class LeadCreate(BaseModel):
    name: str
    phone: str
    location: Optional[str] = None # Area
    interested_plan: Optional[str] = None
    assigned_agent_id: Optional[UUID] = None
    notes: Optional[str] = None
    follow_up_at: Optional[datetime] = None

class LeadUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None
    interested_plan: Optional[str] = None
    assigned_agent_id: Optional[UUID] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    follow_up_at: Optional[datetime] = None

class LeadResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    name: str
    phone: str
    location: Optional[str]
    interested_plan: Optional[str]
    assigned_agent_id: Optional[UUID]
    status: str
    notes: Optional[str]
    follow_up_at: Optional[datetime]
    created_at: datetime
    converted_at: Optional[datetime]
    
    # Optional nested data if requested
    activities: List[ActivityResponse] = []

    class Config:
        from_attributes = True

class ConversionStats(BaseModel):
    total_leads: int
    conversion_rate: float
    leads_per_stage: dict
    follow_ups_due: int
    missed_follow_ups: int
    top_agents: List[dict]
    recent_leads: List[LeadResponse]
    area_distribution: dict
