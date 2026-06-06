from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from sqlalchemy import func as sqlfunc
from uuid import UUID
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.models.customer import Customer
from app.models.tenant import Tenant
from app.models.subscription import SubscriptionPlan, TenantSubscription
from app.schemas.customer import CustomerCreate, CustomerResponse, CustomerUpdate
from app.services.auth import get_current_tenant, check_subscription_restriction, get_token_payload, get_current_user
from app.models.user import User
class BulkDeletePayload(BaseModel):
    ids: List[str]

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_tenant: str = Depends(check_subscription_restriction)
):
    """Create a new customer under the authenticated ISP tenant."""
    import uuid as uuid_lib
    try:
        tenant_uuid = uuid_lib.UUID(current_tenant)
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid tenant ID")

    # Subscription check
    sub_res = await db.execute(
        select(TenantSubscription).where(TenantSubscription.tenant_id == tenant_uuid)
    )
    sub = sub_res.scalars().first()
    if sub:
        plan_res = await db.execute(
            select(SubscriptionPlan).where(SubscriptionPlan.id == sub.plan_id)
        )
        plan = plan_res.scalars().first()
        if plan:
            customer_count = await db.scalar(
                select(sqlfunc.count(Customer.id)).where(Customer.tenant_id == tenant_uuid)
            )
            if customer_count >= plan.max_customers:
                raise HTTPException(
                    status_code=403,
                    detail=f"Customer limit reached. Your '{plan.name}' plan allows a maximum of {plan.max_customers} customers. Please upgrade your subscription."
                )

    if customer.contact_email:
        email_check = await db.execute(
            select(Customer).where(
                Customer.tenant_id == tenant_uuid,
                Customer.contact_email == customer.contact_email
            )
        )
        if email_check.scalars().first():
            raise HTTPException(status_code=409, detail="A customer with this email already exists.")

    new_customer = Customer(
        tenant_id=tenant_uuid,
        name=customer.name,
        contact_email=customer.contact_email
    )
    db.add(new_customer)
    await db.flush()
    new_cust_id = new_customer.id
    await db.commit()
    
    stmt = select(Customer).options(joinedload(Customer.tenant)).where(Customer.id == new_cust_id)
    result = await db.execute(stmt)
    return result.scalars().first()

@router.get("", response_model=list[CustomerResponse])
async def list_customers(
    tenant_id: Optional[UUID] = None, 
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_token_payload)
):
    """Retrieve all customers."""
    current_tenant_id = payload.get("tenant_id")
    is_super = payload.get("role") in ["superadmin", "super_admin"]

    stmt = select(Customer).options(joinedload(Customer.tenant))
    if not is_super and current_tenant_id and current_tenant_id != "None":
        stmt = stmt.where(Customer.tenant_id == current_tenant_id)
    
    if tenant_id:
        stmt = stmt.where(Customer.tenant_id == tenant_id)
        
    result = await db.execute(stmt)
    return result.scalars().all()

@router.put("/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str, payload: CustomerUpdate, db: AsyncSession = Depends(get_db)
):
    """Update an existing customer."""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalars().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    if payload.name is not None:
        customer.name = payload.name
    if payload.contact_email is not None and payload.contact_email != customer.contact_email:
        email_check = await db.execute(
            select(Customer).where(
                Customer.tenant_id == customer.tenant_id,
                Customer.contact_email == payload.contact_email
            )
        )
        if email_check.scalars().first():
            raise HTTPException(status_code=409, detail="A customer with this email already exists.")
        customer.contact_email = payload.contact_email
        
    await db.commit()
    stmt = select(Customer).options(joinedload(Customer.tenant)).where(Customer.id == customer.id)
    result = await db.execute(stmt)
    return result.scalars().first()

@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(customer_id: UUID, db: AsyncSession = Depends(get_db)):
    """Delete a customer."""
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalars().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    await db.delete(customer)
    await db.commit()
    return None

@router.post("/bulk-delete", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_delete_customers(
    payload: BulkDeletePayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Bulk delete customers."""
    import uuid as uuid_lib
    try:
        uuids = [uuid_lib.UUID(i) for i in payload.ids if i and i != "undefined"]
    except (ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid UUID in request")

    is_super = current_user.role in ["superadmin", "super_admin"]

    from sqlalchemy import delete as sa_delete
    stmt = sa_delete(Customer).where(Customer.id.in_(uuids))
    if not is_super:
        stmt = stmt.where(Customer.tenant_id == current_user.tenant_id)
        
    await db.execute(stmt)
    await db.commit()
    return None
