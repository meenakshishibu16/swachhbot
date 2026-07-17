import os
import uuid
import requests
from twilio.rest import Client
from db.connection import get_connection


def get_twilio_client():
    sid = os.environ.get("TWILIO_ACCOUNT_SID")
    token = os.environ.get("TWILIO_AUTH_TOKEN")
    print(f"Using SID: {sid}")
    print(f"Token length: {len(token) if token else 'NONE'}")
    return Client(sid, token)


def send_whatsapp(to: str, message: str):
    """Send WhatsApp message"""
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


def upload_photo_to_supabase(photo_url: str, ticket_id: str) -> str:
    """Download photo from Twilio and upload to Supabase Storage"""
    try:
        from supabase import create_client

        response = requests.get(
            photo_url,
            auth=(
                os.environ.get("TWILIO_ACCOUNT_SID"),
                os.environ.get("TWILIO_AUTH_TOKEN")
            )
        )

        if response.status_code != 200:
            print(f"Failed to download photo: {response.status_code}")
            return photo_url

        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_SERVICE_KEY")

        if not supabase_url or not supabase_key:
            print("Supabase credentials not found")
            return photo_url

        sb = create_client(supabase_url, supabase_key)
        file_name = f"{ticket_id}-citizen.jpg"
        sb.storage.from_("resolved-photos").upload(
            file_name,
            response.content,
            {"content-type": "image/jpeg", "upsert": "true"}
        )
        public_url = sb.storage.from_("resolved-photos").get_public_url(file_name)
        print(f"Photo uploaded: {public_url}")
        return public_url

    except Exception as e:
        print(f"Photo upload error: {e}")
        return photo_url


def notify_department(issue_type: str, ticket_id: str, ward: str,
                      severity: str, photo_url: str,
                      decision: dict, memory: dict):
    """Notify department when new complaint is filed"""
    try:
        from db.connection import get_contact
        print(f"Looking up contact for department: {issue_type}")
        dept_number = get_contact('department', department=issue_type)
        print(f"Department contact found: {dept_number}")
        
        if not dept_number:
            print(f"No contact found for department: {issue_type}")
            return

        history_line = ""
        if memory.get('is_recurring'):
            history_line = (
                f"\n⚠️ Recurring issue — reported "
                f"{memory['complaint_count']} times before."
            )

        decision_line = ""
        if decision.get('recommendation') == 'permanent_fix':
            decision_line = (
                f"\n🔧 AI recommends: Permanent fix "
                f"(failure probability: {decision.get('failure_probability')}%)"
            )
        else:
            decision_line = (
                f"\n🩹 AI recommends: Patch repair "
                f"(failure probability: {decision.get('failure_probability')}%)"
            )

        msg = (
            f"📋 *New Complaint — SwachhBot*\n\n"
            f"Ticket: #{ticket_id}\n"
            f"Issue: {issue_type.title()} (Severity: {severity})\n"
            f"Ward: {ward}"
            f"{history_line}"
            f"{decision_line}\n\n"
            f"Photo: {photo_url}\n\n"
            f"Please log into the dashboard to take action.\n"
            f"SLA clock has started. ⏱️"
        )
        print(f"Sending department notification to {dept_number}")
        send_whatsapp(dept_number, msg)
        print(f"Department notification sent successfully")

    except Exception as e:
        print(f"notify_department error: {e}")

def file_complaint(citizen_phone: str, asset_id: str,
                   photo_url: str, vision: dict,
                   memory: dict, decision: dict,
                   ward: str) -> str:
    """File complaint, notify citizen and department"""
    try:
        ticket_id = f"BBMP-{uuid.uuid4().hex[:6].upper()}"

        # Upload citizen photo to Supabase Storage
        public_photo_url = upload_photo_to_supabase(photo_url, ticket_id)

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
            public_photo_url,
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

        # Build citizen WhatsApp reply
        history_line = ""
        if memory.get('is_recurring'):
            history_line = (
                f"\n⚠️ This spot has been reported "
                f"{memory['complaint_count']} times before."
                f"\nLast reported: {str(memory.get('last_reported', ''))[:10]}"
            )

        decision_line = ""
        if decision.get('recommendation') == 'permanent_fix':
            decision_line = (
                f"\n🔧 AI Recommendation: Permanent fix over patch repair."
                f"\nFailure probability: {decision.get('failure_probability')}%"
            )
        elif decision.get('recommendation') == 'patch':
            decision_line = (
                f"\n🩹 AI Recommendation: Standard patch repair."
                f"\nFailure probability: {decision.get('failure_probability')}%"
            )

        citizen_msg = (
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
        send_whatsapp(citizen_phone, citizen_msg)

        # Notify department
        notify_department(
            vision['issue_type'], ticket_id, ward,
            vision['severity'], public_photo_url,
            decision, memory
        )

        return ticket_id

    except Exception as e:
        print(f"Execution agent error: {e}")
        return None