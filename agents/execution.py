import os
import uuid
from twilio.rest import Client
from db.connection import get_connection

def get_twilio_client():
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    print(f"Using SID: {sid}")
    print(f"Token length: {len(token) if token else 'NONE'}")
    return Client(sid, token)

def send_whatsapp(to: str, message: str):
    """Send WhatsApp message to citizen"""
    try:
        client = get_twilio_client()
        from_number = os.environ.get("TWILIO_WHATSAPP_NUMBER")
        print(f"Sending from: {from_number} to: {to}")
        client.messages.create(
            from_=from_number,
            to=f'whatsapp:{to}' if not to.startswith('whatsapp:') else to,
            body=message
        )
        print("WhatsApp sent successfully")
    except Exception as e:
        print(f"WhatsApp send error: {e}")

def file_complaint(citizen_phone: str, asset_id: str,
                   photo_url: str, vision: dict,
                   memory: dict, decision: dict,
                   ward: str) -> str:
    """File complaint and notify citizen"""
    try:
        ticket_id = f"BBMP-{uuid.uuid4().hex[:6].upper()}"

        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO complaints
            (asset_id, citizen_phone, photo_url, ticket_id,
            issue_type, severity, ward, department, status,
            decision_recommendation, failure_probability,
            decision_action, decision_reasoning)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'filed',
                    %s, %s, %s, %s)
        """, (
            asset_id,
            citizen_phone,
            photo_url,
            ticket_id,
            vision['issue_type'],
            vision['severity'],
            ward,
            vision['department'],
            decision.get('recommendation'),
            decision.get('failure_probability'),
            decision.get('action'),
            decision.get('reasoning')
        ))

        conn.commit()
        cur.close()
        conn.close()

        # Build WhatsApp reply
        history_line = ""
        if memory.get('is_recurring'):
            history_line = (
                f"\n⚠️ This spot has been reported "
                f"{memory['complaint_count']} times before."
                f"\nLast reported: {memory.get('last_reported', 'unknown')[:10]}"
            )

        decision_line = ""
        if decision.get('recommendation') == 'permanent_fix':
            decision_line = (
                f"\n🔧 Recommendation: Permanent fix over patch repair."
                f"\nFailure probability: {decision.get('failure_probability')}%"
            )

        message = (
            f"✅ *SwachhBot — Complaint Filed*\n\n"
            f"📋 Ticket: #{ticket_id}\n"
            f"🔍 Issue: {vision['issue_type'].title()} "
            f"(Severity: {vision['severity']})\n"
            f"📍 Ward: {ward}\n"
            f"🏢 Department: {vision['department']}"
            f"{history_line}"
            f"{decision_line}\n\n"
            f"I'll follow up automatically and update you.\n"
            f"You don't need to do anything else. 🙏"
        )

        send_whatsapp(citizen_phone, message)
        return ticket_id

    except Exception as e:
        print(f"Execution agent error: {e}")
        return None