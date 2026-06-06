import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
from datetime import datetime, timezone

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Customer(Base):
    __tablename__ = "customers"

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id     = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name          = Column(String, nullable=False)
    contact_email = Column(String, nullable=True)
    created_at    = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    tenant = relationship("Tenant", backref=backref("customers", cascade="all, delete-orphan"))
    devices = relationship("Device", back_populates="customer", cascade="all, delete-orphan")

    @property
    def tenant_name(self):
        return self.tenant.name if self.tenant else None
