import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, BigInteger, Integer
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class SNMPLog(Base):
    """
    Stores per-interface SNMP bandwidth samples.
    """
    __tablename__ = "snmp_logs"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id      = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    device_id      = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    if_index       = Column(Integer, nullable=True)
    interface_name = Column(String(128), nullable=True)
    oid            = Column(String(256), nullable=False)
    in_octets      = Column(BigInteger, nullable=True)
    out_octets     = Column(BigInteger, nullable=True)
    in_bps         = Column(Float, nullable=True)
    out_bps        = Column(Float, nullable=True)
    polled_at      = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
