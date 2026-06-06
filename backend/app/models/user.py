import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
from datetime import datetime, timezone

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id     = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(50), nullable=False)  # super_admin, isp_admin, operator
    status        = Column(String(20), nullable=False, default="active")  # active, disabled
    created_at    = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    
    # New Profile Fields
    full_name       = Column(String(255), nullable=True)
    phone_number    = Column(String(50), nullable=True)
    profile_picture = Column(String(500), nullable=True)

    # Notification Preferences
    email_alerts    = Column(Boolean, default=True)
    whatsapp_alerts = Column(Boolean, default=True)

    tenant = relationship("Tenant", backref=backref("users", cascade="all, delete-orphan"))
