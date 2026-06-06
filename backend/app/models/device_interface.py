import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class DeviceInterface(Base):
    """
    Represents a physical or logical interface on a network device.
    """
    __tablename__ = "device_interfaces"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    device_id      = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    
    if_index       = Column(Integer, nullable=False)
    name           = Column(String(128), nullable=False)
    description    = Column(String(255), nullable=True)
    type           = Column(Integer, nullable=True)
    mac_address    = Column(String(50), nullable=True)
    
    is_monitored   = Column(Boolean, default=False, nullable=False)
    is_wan         = Column(Boolean, default=False, nullable=False)
    threshold_mbps = Column(Float, nullable=True)
    
    last_updated   = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    device = relationship("Device", backref="interfaces")
