"""
PDF SLA Report Generator using ReportLab.

Produces a professional PDF document containing:
  - Report header with ISP branding
  - Device details (name, IP, customer)
  - Monitoring period
  - Uptime percentage, downtime duration, incident count
  - Downtime incident timeline table

Usage (in API route):
    pdf_bytes = generate_sla_pdf(report_data)
    return Response(content=pdf_bytes, media_type="application/pdf")
"""
import io
from datetime import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


def _format_duration(seconds: int) -> str:
    """Convert total seconds to human-readable duration string."""
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    parts = []
    if hours:   parts.append(f"{hours}h")
    if minutes: parts.append(f"{minutes}m")
    if secs or not parts: parts.append(f"{secs}s")
    return " ".join(parts)


def generate_sla_pdf(
    device_name: str,
    customer_name: str,
    ip_address: str,
    start_date: datetime,
    end_date: datetime,
    uptime_percentage: float,
    total_downtime_seconds: int,
    incident_count: int,
    total_checks: int = 0,
    successful_checks: int = 0,
    avg_latency: float = 0.0,
    max_latency: float = 0.0,
    packet_loss: float = 0.0,
    incidents: Optional[list[dict]] = None,
    tenant_name: str = "FoxNOC360",
    is_compliant: bool = True
) -> bytes:
    """
    Generate a PDF SLA report and return as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2*cm, leftMargin=2*cm,
        topMargin=2*cm,   bottomMargin=2*cm,
    )

    styles = getSampleStyleSheet()
    story = []

    # ── Header ──────────────────────────────────────────────────
    title_style = ParagraphStyle(
        "Title", parent=styles["Title"],
        fontSize=22, textColor=colors.HexColor("#FF5F00"),
        spaceAfter=6, alignment=TA_CENTER,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle", parent=styles["Normal"],
        fontSize=11, textColor=colors.HexColor("#555555"),
        alignment=TA_CENTER, spaceAfter=2,
    )

    # ── Logo Header ──────────────────────────────────────────────
    import os
    logo_path = "/Users/amritsingh/PuLink/backend/logo.png"
    if os.path.exists(logo_path):
        logo = Image(logo_path, width=2.5*cm, height=2.5*cm)
        logo.hAlign = 'CENTER'
        story.append(logo)
        story.append(Spacer(1, 0.5*cm))

    story.append(Paragraph(f"{tenant_name}", title_style))
    story.append(Paragraph("SLA Compliance Report", subtitle_style))
    story.append(Paragraph(
        f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
        subtitle_style
    ))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#FF5F00"), spaceAfter=12))

    # ── Device Details ───────────────────────────────────────────
    section_style = ParagraphStyle(
        "Section", parent=styles["Heading2"],
        fontSize=13, textColor=colors.HexColor("#FF5F00"), spaceAfter=6,
    )
    normal = styles["Normal"]

    story.append(Paragraph("Device Information", section_style))
    device_data = [
        ["Field", "Value"],
        ["Device Name", device_name],
        ["Customer", customer_name],
        ["IP Address", ip_address],
        ["Report Period", f"{start_date.strftime('%Y-%m-%d')} → {end_date.strftime('%Y-%m-%d')}"],
        ["Compliance Status", "PASSED" if is_compliant else "BREACHED"],
    ]
    device_table = Table(device_data, colWidths=[5*cm, 12*cm])
    
    compliance_color = colors.HexColor("#27ae60") if is_compliant else colors.HexColor("#e74c3c")
    
    device_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FF5F00")),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f5f7fa"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("TEXTCOLOR", (1, 5), (1, 5), compliance_color),
        ("FONTNAME", (1, 5), (1, 5), "Helvetica-Bold"),
    ]))
    story.append(device_table)
    story.append(Spacer(1, 16))

    # ── SLA Summary & Performance ────────────────────────────────
    story.append(Paragraph("SLA Summary & Performance Metrics", section_style))

    # Color-code the uptime cell
    uptime_color = compliance_color

    sla_data = [
        ["Metric", "Value", "Metric", "Value"],
        ["Uptime Percentage", f"{uptime_percentage:.4f}%", "Avg Latency", f"{avg_latency} ms"],
        ["Total Downtime", _format_duration(total_downtime_seconds), "Max Latency", f"{max_latency} ms"],
        ["Total Incidents", str(incident_count), "Packet Loss", f"{packet_loss}%"],
        ["Total Checks", str(total_checks), "Successful", str(successful_checks)],
    ]
    sla_table = Table(sla_data, colWidths=[4*cm, 4.5*cm, 4*cm, 4.5*cm])
    sla_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FF5F00")),
        ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
        ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",   (0, 0), (-1, -1), 10),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#f5f7fa"), colors.white]),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("PADDING", (0, 0), (-1, -1), 6),
        # Highlight uptime value cell
        ("TEXTCOLOR", (1, 1), (1, 1), uptime_color),
        ("FONTNAME",  (1, 1), (1, 1), "Helvetica-Bold"),
    ]))
    story.append(sla_table)
    story.append(Spacer(1, 16))

    # ── Incident Timeline ────────────────────────────────────────
    if incidents:
        story.append(Paragraph("Downtime Incidents", section_style))
        inc_data = [["#", "Started At", "Ended At", "Duration"]]
        for i, inc in enumerate(incidents, 1):
            started = inc.get("started_at", "—")
            ended   = inc.get("ended_at", "Ongoing")
            duration = _format_duration(inc.get("duration_seconds", 0)) if inc.get("duration_seconds") else "—"
            inc_data.append([str(i), str(started)[:19], str(ended)[:19], duration])

        inc_table = Table(inc_data, colWidths=[1*cm, 5.5*cm, 5.5*cm, 5*cm])
        inc_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#c0392b")),
            ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
            ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, -1), 9),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.HexColor("#fff3f3"), colors.white]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(inc_table)

    # ── Footer ───────────────────────────────────────────────────
    story.append(Spacer(1, 24))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#aaaaaa")))
    footer_style = ParagraphStyle(
        "Footer", parent=styles["Normal"],
        fontSize=8, textColor=colors.HexColor("#999999"), alignment=TA_CENTER, spaceBefore=4
    )
    story.append(Paragraph(
        f"This report was automatically generated by {tenant_name} Monitoring Platform.",
        footer_style
    ))

    doc.build(story)
    return buffer.getvalue()
