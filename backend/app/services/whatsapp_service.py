from twilio.rest import Client
from app.config import settings

def send_whatsapp_alert(message: str, phone_number: str):
    """
    Sends a WhatsApp message via the Twilio API.
    """
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        print(f"[WHATSAPP SERVICE] Skipped WhatsApp to {phone_number}. Twilio not fully configured.")
        return

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        
        # Twilio WhatsApp numbers require a 'whatsapp:' prefix
        from_number = settings.TWILIO_WHATSAPP_NUMBER
        if not from_number.startswith("whatsapp:"):
            from_number = f"whatsapp:{from_number}"
            
        to_number = phone_number
        if not to_number.startswith("whatsapp:"):
            to_number = f"whatsapp:{to_number}"

        message_instance = client.messages.create(
            body=message,
            from_=from_number,
            to=to_number
        )
        print(f"[WHATSAPP SERVICE] Successfully sent WhatsApp message SID: {message_instance.sid}")
    except Exception as e:
        print(f"[WHATSAPP SERVICE] Failed to send WhatsApp alert: {e}")
