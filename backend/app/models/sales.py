import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Lead(Base):
    """
    Tracks potential ISP customers through the sales pipeline.
    """
    __tablename__ = "leads"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id        = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    
    name             = Column(String(255), nullable=False)
    phone            = Column(String(50), nullable=False)
    location         = Column(String(500), nullable=True) # Area
    interested_plan  = Column(String(255), nullable=True)
    
    assigned_agent_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Stages: new, contacted, feasibility, installation, installed, rejected
    status           = Column(String(50), default="new", nullable=False, index=True) 
    
    notes            = Column(String(2000), nullable=True)
    follow_up_at     = Column(DateTime(timezone=True), nullable=True)
    
    created_at       = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    converted_at     = Column(DateTime(timezone=True), nullable=True)

    tenant = relationship("Tenant")
    agent  = relationship("User", foreign_keys=[assigned_agent_id])

class LeadActivity(Base):
    """
    Audit log of status changes, notes, and calls per lead.
    """
    __tablename__ = "lead_activities"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id     = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id    = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    action      = Column(String(100), nullable=False) # "created", "status_change", "note_added"
    note        = Column(String(500), nullable=True)
    created_at  = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    lead = relationship("Lead", backref="activities")
