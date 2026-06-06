import uuid
from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class Downtime(Base):
    __tablename__ = "downtimes"

    id               = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    device_id        = Column(UUID(as_uuid=True), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at       = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    ended_at         = Column(DateTime(timezone=True), nullable=True)
    duration_seconds = Column(Integer, nullable=True)

    device = relationship("Device", backref="downtimes")
