from fastapi import FastAPI, Request, Form
from fastapi.responses import PlainTextResponse
from typing import Optional
import uvicorn

from agents.vision import classify_issue
from agents.memory import get_asset_history, create_or_update_asset
from agents.decision import make_decision
from agents.execution import file_complaint, send_whatsapp
from agents.geo_router import get_ward
from db.connection import get_connection

app = FastAPI()

# Store pending sessions
# citizen_phone → what we're waiting for
pending = {}

@app.post("/webhook/whatsapp")
async def whatsapp_webhook(
    request: Request,
    From: str = Form(...),
    Body: str = Form(default=""),
    NumMedia: str = Form(default="0"),
    MediaUrl0: Optional[str] = Form(default=None),
    Latitude: Optional[str] = Form(default=None),
    Longitude: Optional[str] = Form(default=None),
    MediaContentType0: Optional[str] = Form(default=None)
):
    citizen_phone = From
    num_media = int(NumMedia)
    body = Body.strip().lower()

    print(f"\n--- Incoming message from {citizen_phone} ---")
    print(f"Body: {Body}, Media: {num_media}, Lat: {Latitude}, Lng: {Longitude}")

    # CASE 1: Citizen sent a photo
    if num_media > 0 and MediaUrl0:
        print("Photo received — running Vision agent")

        # Store photo URL, ask for location
        pending[citizen_phone] = {
            "photo_url": MediaUrl0,
            "waiting_for": "location"
        }

        send_whatsapp(citizen_phone,
            "📸 Got your photo! Now please share your location:\n\n"
            "Tap the 📎 attachment icon → Location → "
            "*Send Your Current Location*"
        )
        return PlainTextResponse("OK")

    # CASE 2: Citizen sent location
    if Latitude and Longitude:
        lat = float(Latitude)
        lng = float(Longitude)
        print(f"Location received: {lat}, {lng}")

        session = pending.get(citizen_phone)

        if not session or session.get('waiting_for') != 'location':
            send_whatsapp(citizen_phone,
                "Please send a photo first, then share your location 📸"
            )
            return PlainTextResponse("OK")

        photo_url = session['photo_url']

        send_whatsapp(citizen_phone,
            "🔍 Analyzing your photo and location...\n"
            "This takes about 10 seconds ⏳"
        )

        # Run the 4 agents
        print("Running Vision agent...")
        vision = classify_issue(photo_url)
        print(f"Vision result: {vision}")

        print("Running geo-router...")
        ward = get_ward(lat, lng)
        print(f"Ward: {ward}")

        print("Running Memory agent...")
        memory = get_asset_history(lat, lng, vision['issue_type'])
        print(f"Memory result: {memory}")

        print("Running Decision agent...")
        decision = make_decision(
            vision['issue_type'],
            vision['severity'],
            memory
        )
        print(f"Decision result: {decision}")

        print("Running Execution agent...")
        asset_id = create_or_update_asset(
            lat, lng,
            vision['issue_type'],
            ward,
            vision['department']
        )

        ticket_id = file_complaint(
            citizen_phone,
            asset_id,
            photo_url,
            vision,
            memory,
            decision,
            ward
        )

        print(f"Complaint filed: {ticket_id}")

        # Clear session
        pending.pop(citizen_phone, None)
        return PlainTextResponse("OK")

    # CASE 3: Text message
    if body in ['hi', 'hello', 'hey', 'start']:
        send_whatsapp(citizen_phone,
            "👋 Welcome to *SwachhBot*!\n\n"
            "I help resolve civic issues in Bengaluru automatically.\n\n"
            "To report an issue:\n"
            "1️⃣ Send a *photo* of the problem\n"
            "2️⃣ Share your *location*\n\n"
            "I'll handle everything else — filing, follow-up, "
            "and escalation until it's resolved. 🏙️"
        )
        return PlainTextResponse("OK")

    # Default
    send_whatsapp(citizen_phone,
        "Please send a 📸 *photo* of the civic issue to get started."
    )
    return PlainTextResponse("OK")


@app.get("/complaints")
async def get_complaints():
    """API for React dashboard"""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                c.ticket_id, c.issue_type, c.severity,
                c.ward, c.department, c.status,
                c.escalation_level, c.filed_at,
                a.location
            FROM complaints c
            LEFT JOIN assets a ON c.asset_id = a.id
            ORDER BY c.filed_at DESC
            LIMIT 50
        """)
        rows = cur.fetchall()
        cur.close()
        conn.close()

        complaints = []
        for row in rows:
            complaints.append({
                "ticket_id": row[0],
                "issue_type": row[1],
                "severity": row[2],
                "ward": row[3],
                "department": row[4],
                "status": row[5],
                "escalation_level": row[6],
                "filed_at": str(row[7])
            })
        return complaints
    except Exception as e:
        return {"error": str(e)}


@app.get("/health")
async def health():
    return {"status": "SwachhBot is running"}

@app.get("/debug")
async def debug():
    import os
    return {
        "TWILIO_ACCOUNT_SID": os.environ.get("TWILIO_ACCOUNT_SID", "NOT FOUND"),
        "TWILIO_AUTH_TOKEN_LENGTH": len(os.environ.get("TWILIO_AUTH_TOKEN", "")),
        "GROQ_KEY_START": os.environ.get("GROQ_API_KEY", "NOT FOUND")[:10] + "..." if os.environ.get("GROQ_API_KEY") else "NOT FOUND",
        "ALL_ENV_KEYS": list(os.environ.keys())
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)