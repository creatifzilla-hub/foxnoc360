import uuid
from sqlalchemy import Column, String, ForeignKey, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, backref
from datetime import datetime, timezone
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class UserPermission(Base):
    """
    Stores granular module-level access and permissions for team members.
    Used to implement RBAC without modifying the existing 'users' table.
    """
    __tablename__ = "user_permissions"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id          = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    
    # List of modules allowed: ["dashboard", "sales", "customers", "devices", "sla"]
    allowed_modules  = Column(JSONB, default=["dashboard"], nullable=False)
    
    # Specific restrictions for Sales Agents
    assigned_leads_only = Column(Boolean, default=False, nullable=False)
    
    created_at       = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at       = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user = relationship("User", backref=backref("permissions", uselist=False, cascade="all, delete-orphan"))
