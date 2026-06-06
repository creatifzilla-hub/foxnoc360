import razorpay
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from uuid import UUID

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.tenant import Tenant
from app.models.subscription import SubscriptionPlan, TenantSubscription
from app.models.payment import Payment
from app.services.auth import get_current_user
from app.services.subscription_service import calculate_renewal_price

router = APIRouter(prefix="/payments", tags=["Payments"])

client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

class CreateOrderRequest(BaseModel):
    plan_id: UUID
    duration_months: int

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    plan_id: UUID
    duration_months: int

@router.post("/create-order")
async def create_order(
    payload: CreateOrderRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    1. Calculate total price (including GST).
    2. Create Razorpay Order.
    3. Save pending payment record.
    """
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID missing")

    # Fetch Plan
    plan_res = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == payload.plan_id))
    plan = plan_res.scalars().first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Price Calculation
    base_price = calculate_renewal_price(plan.price_per_month, payload.duration_months)
    gst = base_price * 0.18
    total_price = base_price + gst
    
    # Razorpay amount is in paise (INR * 100)
    amount_paise = int(total_price * 83) # Simple USD to INR conversion for testing if price is in USD
    # Actually, let's assume price is in INR for Razorpay consistency if using Indian GST
    amount_paise = int(total_price * 100)

    # RAZORPAY SIMULATION MODE
    is_simulated = (settings.RAZORPAY_KEY_ID == "rzp_test_dummy")
    razorpay_order_id = f"order_sim_{int(datetime.now().timestamp())}"
    
    if is_simulated:
        print(">>> RAZORPAY SIMULATION MODE ACTIVE <<<")
    else:
        try:
            razorpay_order = client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "receipt": f"receipt_{datetime.now().timestamp()}",
                "payment_capture": 1
            })
            razorpay_order_id = razorpay_order['id']
        except Exception as e:
            print(f"RAZORPAY ERROR: {str(e)}")
            import traceback
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Razorpay error: {str(e)}")

    # Log initial payment
    new_payment = Payment(
        tenant_id=current_user.tenant_id,
        razorpay_order_id=razorpay_order_id,
        amount=total_price,
        gst_amount=gst,
        status="pending"
    )
    db.add(new_payment)
    await db.commit()

    return {
        "order_id": razorpay_order_id,
        "amount": amount_paise,
        "key_id": settings.RAZORPAY_KEY_ID,
        "currency": "INR",
        "company_name": "CreatifZilla Private Limited",
        "is_simulated": is_simulated # Tell frontend it's a simulation
    }
    db.add(new_payment)
    await db.commit()

    return {
        "order_id": razorpay_order['id'],
        "amount": amount_paise,
        "key_id": settings.RAZORPAY_KEY_ID,
        "currency": "INR",
        "company_name": "CreatifZilla Private Limited"
    }

@router.post("/verify")
async def verify_payment(
    payload: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    1. Verify signatures.
    2. Update Payment record.
    3. Update/Extend Tenant Subscription.
    """
    params_dict = {
        'razorpay_order_id': payload.razorpay_order_id,
        'razorpay_payment_id': payload.razorpay_payment_id,
        'razorpay_signature': payload.razorpay_signature
    }

    # RAZORPAY SIMULATION BYPASS
    if payload.razorpay_order_id.startswith("order_sim_"):
         print(">>> BYPASSING SIGNATURE VERIFICATION FOR SIMULATED ORDER <<<")
    else:
        try:
            client.utility.verify_payment_signature(params_dict)
        except Exception:
            raise HTTPException(status_code=400, detail="Payment verification failed")

    # Update Payment record
    pay_res = await db.execute(select(Payment).where(Payment.razorpay_order_id == payload.razorpay_order_id))
    payment = pay_res.scalars().first()
    if not payment:
         raise HTTPException(status_code=404, detail="Order record not found")

    payment.razorpay_payment_id = payload.razorpay_payment_id
    payment.razorpay_signature = payload.razorpay_signature
    payment.status = "captured"

    # Update Subscription Logic (reusing logic from subscriptions.py but officially)
    sub_res = await db.execute(select(TenantSubscription).where(TenantSubscription.tenant_id == current_user.tenant_id))
    sub = sub_res.scalars().first()
    
    now = datetime.now(timezone.utc)
    base_date = sub.expires_at if sub and sub.expires_at and sub.expires_at > now else now
    new_expires_at = base_date + timedelta(days=30 * payload.duration_months)

    if sub:
        sub.plan_id = payload.plan_id
        sub.expires_at = new_expires_at
        sub.status = "active"
        sub.price_charged = payment.amount / 1.18 # Base price
        sub.duration_months = payload.duration_months
    else:
        sub = TenantSubscription(
            tenant_id=current_user.tenant_id,
            plan_id=payload.plan_id,
            status="active",
            expires_at=new_expires_at,
            price_charged=payment.amount / 1.18,
            duration_months=payload.duration_months
        )
        db.add(sub)
    
    await db.flush() # Get sub.id if needed
    payment.subscription_id = sub.id
    
    await db.commit()

    return {"status": "success", "message": "Subscription activated"}

@router.get("/history")
async def get_payment_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the payment history for the current tenant.
    """
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID missing")

    # We'll join with SubscriptionPlan eventually if we want plan names, 
    # but for now let's just return what we have in Payment records.
    # To get plan names, we'd need to link via TenantSubscription or keep plan_id in Payment.
    # Let's assume we want a clean list.
    
    result = await db.execute(
        select(Payment, SubscriptionPlan.name)
        .outerjoin(TenantSubscription, Payment.subscription_id == TenantSubscription.id)
        .outerjoin(SubscriptionPlan, TenantSubscription.plan_id == SubscriptionPlan.id)
        .where(Payment.tenant_id == current_user.tenant_id)
        .order_by(Payment.created_at.desc())
    )
    history = result.all()

    response = []
    for pay, plan_name in history:
        response.append({
            "id": str(pay.id),
            "plan_name": plan_name or "Subscription",
            "amount": pay.amount - pay.gst_amount,
            "gst": pay.gst_amount,
            "total": pay.amount,
            "date": pay.created_at.strftime("%Y-%m-%d %H:%M"),
            "status": pay.status.capitalize()
        })
    
    return response
@router.get("/admin/all-history")
async def get_all_payment_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    [Superadmin] Returns the payment history for ALL tenants.
    """
    if current_user.role != "super_admin":
        raise HTTPException(status_code=403, detail="Superadmin access required")

    result = await db.execute(
        select(Payment, SubscriptionPlan.name, Tenant.name)
        .outerjoin(TenantSubscription, Payment.subscription_id == TenantSubscription.id)
        .outerjoin(SubscriptionPlan, TenantSubscription.plan_id == SubscriptionPlan.id)
        .outerjoin(Tenant, Payment.tenant_id == Tenant.id)
        .order_by(Payment.created_at.desc())
    )
    history = result.all()

    response = []
    for pay, plan_name, tenant_name in history:
        response.append({
            "id": str(pay.id),
            "tenant_name": tenant_name or "Unknown",
            "plan_name": plan_name or "Subscription",
            "amount": pay.amount - pay.gst_amount,
            "gst": pay.gst_amount,
            "total": pay.amount,
            "date": pay.created_at.strftime("%Y-%m-%d %H:%M"),
            "status": pay.status.capitalize()
        })
    
    return response
