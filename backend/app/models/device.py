import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, backref
from datetime import datetime, timezone
from app.models.tenant import Tenant
from app.models.customer import Customer

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Device(Base):
    __tablename__ = "devices"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    name       = Column(String(255), nullable=False)
    ip_address = Column(String(50), nullable=False)
    location   = Column(String(255), nullable=True)
    status     = Column(String(20), nullable=False, default="unknown", index=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    
    # SNMP Configuration
    snmp_version    = Column(String(10), default="v2c", nullable=False) # v2c, v3
    snmp_community  = Column(String(100), default="public", nullable=True)
    snmp_port       = Column(Integer, default=161, nullable=False)
    
    # SNMP v3 Auth/Priv
    snmp_v3_user    = Column(String(100), nullable=True)
    snmp_v3_auth_p  = Column(String(20), nullable=True) # MD5, SHA
    snmp_v3_auth_k  = Column(String(100), nullable=True)
    snmp_v3_priv_p  = Column(String(20), nullable=True) # DES, AES
    snmp_v3_priv_k  = Column(String(100), nullable=True)

    tenant = relationship("Tenant", backref=backref("devices", cascade="all, delete-orphan"))
    customer = relationship("Customer", back_populates="devices")

    @property
    def customer_name(self):
        return self.customer.name if self.customer else None

    @property
    def tenant_name(self):
        return self.tenant.name if self.tenant else None
