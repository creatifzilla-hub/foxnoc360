import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from app.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class SubscriptionPlan(Base):
    """
    Defines the different subscription tiers available on the platform.
    Plans are pre-seeded (e.g., Starter, Professional, Enterprise).
    """
    __tablename__ = "subscription_plans"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name              = Column(String(100), nullable=False, unique=True)  # "Starter", "Pro", "Enterprise"
    max_devices       = Column(Integer, nullable=False, default=50)
    max_customers     = Column(Integer, nullable=False, default=10)
    max_users         = Column(Integer, nullable=False, default=5)
    snmp_enabled      = Column(Boolean, default=False, nullable=False)
    sla_reports       = Column(Boolean, default=False, nullable=False)
    price_per_month   = Column(Float, nullable=False, default=0.0)
    created_at        = Column(DateTime(timezone=True), default=utc_now, nullable=False)


class TenantSubscription(Base):
    """
    Tracks which plan each tenant is currently subscribed to.
    """
    __tablename__ = "tenant_subscriptions"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    tenant_id         = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, unique=True)
    plan_id           = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=False)
    status            = Column(String(20), nullable=False, default="active")  # active, suspended, cancelled
    started_at        = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    expires_at        = Column(DateTime(timezone=True), nullable=True)
    duration_months   = Column(Integer, nullable=False, default=1)
    price_charged     = Column(Float, nullable=False, default=0.0)

    plan = relationship("SubscriptionPlan")
