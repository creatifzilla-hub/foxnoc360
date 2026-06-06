import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone

from app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Payment(Base):
    """
    Tracks all subscription payments made via Razorpay or other gateways.
    Used for generating financial records and invoices.
    """
    __tablename__ = "payments"

    id                 = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id          = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    subscription_id    = Column(UUID(as_uuid=True), ForeignKey("tenant_subscriptions.id", ondelete="SET NULL"), nullable=True)
    
    razorpay_order_id  = Column(String(100), nullable=True, unique=True)
    razorpay_payment_id = Column(String(100), nullable=True, unique=True)
    razorpay_signature = Column(String(255), nullable=True)
    
    amount             = Column(Float, nullable=False)
    currency           = Column(String(10), default="INR", nullable=False)
    gst_amount         = Column(Float, default=0.0) # 18% GST tracked separately
    status             = Column(String(20), default="pending", nullable=False) # pending, captured, failed
    
    details            = Column(JSON, nullable=True) # Any extra callback data
    created_at         = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    updated_at         = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
