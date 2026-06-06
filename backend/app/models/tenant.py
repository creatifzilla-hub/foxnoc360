import uuid
from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Tenant(Base):
    __tablename__ = "tenants"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name         = Column(String(255), nullable=False, unique=True)
    company_email = Column(String(255), nullable=False, unique=True)
    status       = Column(String(20), nullable=False, default="active")  # active | suspended
    created_at   = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # New Profile Fields (Tenant level)
    alternate_email = Column(String(255), nullable=True)
    company_website = Column(String(255), nullable=True)
    gst_number      = Column(String(50), nullable=True)
