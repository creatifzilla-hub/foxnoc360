import smtplib
import asyncio
from email.message import EmailMessage
from typing import Optional

from app.config import settings

async def send_email_alert(subject: str, message: str, recipient: str, attachment: Optional[dict] = None):
    """
    Sends an SMTP email alert asynchronously with optional attachment.
    attachment format: {"filename": str, "content": bytes, "content_type": str}
    """
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME:
        print(f"[EMAIL SERVICE] Skipped email to {recipient}. SMTP not fully configured.")
        return

    def _send():
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.application import MIMEApplication

        msg = MIMEMultipart()
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = recipient

        msg.attach(MIMEText(message))

        if attachment:
            part = MIMEApplication(attachment["content"], _subtype="pdf")
            part.add_header('Content-Disposition', 'attachment', filename=attachment["filename"])
            msg.attach(part)

        try:
            # Connect with timeout to prevent hanging if host is unreachable
            if settings.SMTP_PORT == 465:
                server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            else:
                server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
                # Enable STARTTLS security for port 587 or Gmail
                if settings.SMTP_PORT == 587 or "gmail" in settings.SMTP_HOST.lower():
                    server.ehlo()
                    server.starttls()
                    server.ehlo()

            with server:
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(msg)
            print(f"[EMAIL SERVICE] Successfully sent email to {recipient}")
        except Exception as e:
            print(f"[EMAIL SERVICE] Failed to send email alert: {e}")
            raise e  # Re-raise so the endpoint is aware of the failure

    await asyncio.to_thread(_send)

async def send_welcome_email(company_name: str, company_email: str, admin_password: str):
    """
    Sends a welcome email to the newly created ISP with their login credentials asynchronously.
    """
    subject = f"Welcome to FoxNOC360, {company_name}!"
    body = f"""
    Hello {company_name},
    
    Your ISP admin account has been successfully created.
    
    Login URL: https://foxnoc360.com/login
    Email: {company_email}
    Password: {admin_password}
    
    Please log in and change your password as soon as possible.
    
    Best regards,
    The FoxNOC360 Team
    """
    await send_email_alert(subject, body, company_email)

async def send_sla_report_email(recipient: str, customer_name: str, device_name: str, start_date: str, end_date: str, pdf_content: bytes):
    """
    Sends an SLA report PDF to a customer.
    """
    subject = f"SLA Uptime Report: {device_name} ({start_date} - {end_date})"
    body = f"""
    Hello {customer_name},

    Please find attached the SLA Uptime Report for {device_name} for the period {start_date} to {end_date}.

    If you have any questions, please contact our support team.

    Best regards,
    Monitoring Department
    """
    attachment = {
        "filename": f"SLA_Report_{device_name}_{start_date}_{end_date}.pdf",
        "content": pdf_content,
        "content_type": "application/pdf"
    }
    await send_email_alert(subject, body, recipient, attachment=attachment)
