import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class PingLog(Base):
    __tablename__ = "ping_logs"

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    device_id  = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False)
    status     = Column(String(20), nullable=False)  # up / down
    latency_ms = Column(Float, nullable=True)
    packet_loss = Column(Float, nullable=True, default=0.0)
    checked_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)

    device = relationship("Device", backref="ping_logs")
