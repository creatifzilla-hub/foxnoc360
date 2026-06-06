from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from datetime import datetime, timezone

from app.database import get_db
from app.models.user import User
from app.models.tenant import Tenant
from app.models.subscription import TenantSubscription, SubscriptionPlan
from app.services.auth import get_current_user

router = APIRouter(prefix="/billing", tags=["Billing"])

@router.get("/invoice/{record_id}")
async def generate_invoice_pdf(
    record_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Generates a professional PDF invoice for the current subscription.
    Includes GST 18% and CreatifZilla Private Limited branding.
    """
    if not current_user.tenant_id:
        raise HTTPException(status_code=400, detail="User not associated with a tenant.")

    # Fetch Tenant info
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
    tenant = tenant_res.scalars().first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found.")

    # Fetch Subscription info
    sub_res = await db.execute(
        select(TenantSubscription, SubscriptionPlan)
        .join(SubscriptionPlan, TenantSubscription.plan_id == SubscriptionPlan.id)
        .where(TenantSubscription.tenant_id == current_user.tenant_id)
    )
    sub_data = sub_res.first()
    if not sub_data:
        raise HTTPException(status_code=404, detail="No active subscription found for invoicing.")

    sub, plan = sub_data

    # Financial Calculations
    base_amount = sub.price_charged or 0.0
    gst_amount = base_amount * 0.18
    total_amount = base_amount + gst_amount

    # PDF Generation
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    
    # Custom Styles
    title_style = ParagraphStyle('TitleStyle', parent=styles['Heading1'], fontSize=24, spaceAfter=20, textColor=colors.HexColor("#FF5F00"))
    header_style = ParagraphStyle('HeaderStyle', parent=styles['Normal'], fontSize=10, leading=14, textColor=colors.grey)
    billing_style = ParagraphStyle('BillingStyle', parent=styles['Normal'], fontSize=11, leading=16)

    elements = []

    # 1. Header (Logo & Vendor Info)
    import os
    logo_path = "/Users/amritsingh/PuLink/backend/logo.png"
    if os.path.exists(logo_path):
        logo = Image(logo_path, width=2.5*cm, height=2.5*cm)
        logo.hAlign = 'LEFT'
        elements.append(logo)
    
    elements.append(Paragraph("INVOICE", title_style))
    
    vendor_data = [
        [Paragraph(f"<b>CreatifZilla Private Limited</b><br/>"
                  f"Financial District, New Delhi<br/>"
                  f"GSTIN: 07AAACC1234F1Z5 (Dummy)<br/>"
                  f"Email: accounts@foxnoc360.com", header_style),
         Paragraph(f"Invoice #: INV-{datetime.now().strftime('%Y%m%d')}-{str(sub.id)[:6].upper()}<br/>"
                  f"Date: {datetime.now().strftime('%d %b, %Y')}<br/>"
                  f"Due Date: {datetime.now().strftime('%d %b, %Y')}", header_style)]
    ]
    t_header = Table(vendor_data, colWidths=[10*cm, 7*cm])
    elements.append(t_header)
    elements.append(Spacer(1, 1*cm))

    # 2. Billing To
    elements.append(Paragraph("<b>BILLED TO:</b>", billing_style))
    billed_to_html = f"{tenant.name}<br/>{tenant.company_email}<br/>Customer ID: {str(tenant.id)[:8].upper()}"
    if hasattr(tenant, 'gst_number') and tenant.gst_number:
        billed_to_html += f"<br/>GSTIN: {tenant.gst_number}"
    elements.append(Paragraph(billed_to_html, billing_style))
    elements.append(Spacer(1, 1*cm))

    # 3. Item Table
    table_data = [
        ["DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL"],
        [f"Subscription Plan: {plan.name}\n(Duration: {sub.duration_months} Month(s))", "1", f"₹{base_amount:,.2f}", f"₹{base_amount:,.2f}"]
    ]
    
    t_items = Table(table_data, colWidths=[9*cm, 2*cm, 3*cm, 3*cm])
    t_items.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f8fafc")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#64748b")),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 10),
        ('BOTTOMPADDING', (0,0), (-1,0), 12),
        ('TOPPADDING', (0,0), (-1,1), 12),
        ('GRID', (0,0), (-1,0), 1, colors.HexColor("#e2e8f0")),
        ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor("#f1f5f9")),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    elements.append(t_items)
    elements.append(Spacer(1, 0.5*cm))

    # 4. Totals
    totals_data = [
        ["", "Subtotal:", f"₹{base_amount:,.2f}"],
        ["", "GST (18%):", f"₹{gst_amount:,.2f}"],
        ["", "Total Amount:", f"₹{total_amount:,.2f}"]
    ]
    t_totals = Table(totals_data, colWidths=[11*cm, 3*cm, 3*cm])
    t_totals.setStyle(TableStyle([
        ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
        ('FONTNAME', (1,2), (2,2), 'Helvetica-Bold'),
        ('FONTSIZE', (1,2), (2,2), 12),
        ('TEXTCOLOR', (1,2), (2,2), colors.HexColor("#FF5F00")),
        ('TOPPADDING', (1,0), (-1,-1), 6),
    ]))
    elements.append(t_totals)
    
    elements.append(Spacer(1, 2*cm))

    # 5. Footer & Terms
    elements.append(Paragraph("<b>Notes:</b>", styles['Normal']))
    elements.append(Paragraph("Thank you for choosing FoxNOC360. All payments are non-refundable as per our company policy. This is a computer generated invoice and does not require a physical signature.", styles['Normal']))

    # Build PDF
    doc.build(elements)
    
    pdf_content = buffer.getvalue()
    buffer.close()

    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=Invoice_CreatifZilla_{record_id}.pdf"
        }
    )
