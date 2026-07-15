from fastapi import FastAPI, Request, Form
from fastapi.responses import PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import uvicorn
from datetime import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from agents.vision import classify_issue
from agents.memory import get_asset_history, create_or_update_asset
from agents.decision import make_decision
from agents.execution import file_complaint, send_whatsapp
from agents.geo_router import get_ward
from db.connection import get_connection

app = FastAPI()
scheduler = AsyncIOScheduler()

# CORS — allows React dashboard to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store pending sessions
pending = {}


# ─────────────────────────────────────────
# SCHEDULER
# ─────────────────────────────────────────

async def check_escalations():
    """Runs on schedule — checks all open complaints and escalates if needed"""
    print("Running escalation check...")
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, ticket_id, citizen_phone, ward,
                   department, escalation_level, filed_at
            FROM complaints
            WHERE status = 'filed'
        """)

        complaints = cur.fetchall()
        print(f"Open complaints to check: {len(complaints)}")

        for complaint in complaints:
            comp_id, ticket_id, phone, ward, dept, level, filed_at = complaint
            days_open = (datetime.now() - filed_at).days

            if days_open >= 7 and level < 2:
                msg = (
                    f"⚠️ *SwachhBot Escalation — Level 2*\n\n"
                    f"Ticket #{ticket_id} unresolved for {days_open} days.\n"
                    f"Ward: {ward}\n"
                    f"Department: {dept}\n\n"
                    f"Escalated to Commissioner level.\n"
                    f"Action required immediately."
                )
                send_whatsapp(phone, msg)
                cur.execute("""
                    UPDATE complaints
                    SET escalation_level = 2
                    WHERE id = %s
                """, (comp_id,))
                print(f"Escalated {ticket_id} to Level 2")

            elif days_open >= 3 and level < 1:
                msg = (
                    f"⚠️ *SwachhBot Escalation — Level 1*\n\n"
                    f"Ticket #{ticket_id} unresolved for {days_open} days.\n"
                    f"Ward: {ward}\n"
                    f"Department: {dept}\n\n"
                    f"Escalated to Ward Councillor.\n"
                    f"Please action this complaint."
                )
                send_whatsapp(phone, msg)
                cur.execute("""
                    UPDATE complaints
                    SET escalation_level = 1
                    WHERE id = %s
                """, (comp_id,))
                print(f"Escalated {ticket_id} to Level 1")

        conn.commit()
        cur.close()
        conn.close()

    except Exception as e:
        print(f"Escalation check error: {e}")


# ─────────────────────────────────────────
# STARTUP / SHUTDOWN
# ─────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    # 30 seconds for demo — change to hours=24 for production
    scheduler.add_job(check_escalations, 'interval', seconds=30)
    scheduler.start()
    print("Scheduler started")

@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()


# ─────────────────────────────────────────
# WHATSAPP WEBHOOK
# ─────────────────────────────────────────

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


# ─────────────────────────────────────────
# API ENDPOINTS
# ─────────────────────────────────────────

@app.get("/complaints")
async def get_complaints():
    """API for React dashboard — includes lat/lng for map pins"""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                c.ticket_id, c.issue_type, c.severity,
                c.ward, c.department, c.status,
                c.escalation_level, c.filed_at,
                ST_Y(a.location::geometry) as lat,
                ST_X(a.location::geometry) as lng
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
                "filed_at": str(row[7]),
                "lat": float(row[8]) if row[8] else 12.9716,
                "lng": float(row[9]) if row[9] else 77.5946
            })
        return complaints
    except Exception as e:
        return {"error": str(e)}


@app.post("/resolve/{ticket_id}")
async def resolve_complaint(ticket_id: str):
    """Mark complaint as resolved and notify citizen"""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE complaints
            SET status = 'resolved', resolved_at = NOW()
            WHERE ticket_id = %s
            RETURNING ticket_id, citizen_phone, ward
        """, (ticket_id,))
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if result:
            ticket, phone, ward = result
            send_whatsapp(phone,
                f"✅ *Complaint Resolved*\n\n"
                f"Ticket #{ticket} has been marked resolved.\n"
                f"Ward: {ward}\n\n"
                f"Thank you for helping keep Bengaluru clean! 🙏\n"
                f"Report any new issues by sending a photo."
            )
            return {"message": f"Ticket {ticket_id} resolved"}
        return {"error": "Ticket not found"}
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
    }


@app.get("/test/ward")
async def test_ward():
    from agents.geo_router import get_ward
    test_cases = [
        {"name": "Marathahalli", "lat": 12.975254, "lng": 77.710777},
        {"name": "Indiranagar", "lat": 12.9784, "lng": 77.6408},
        {"name": "Koramangala", "lat": 12.9352, "lng": 77.6245},
        {"name": "Whitefield", "lat": 12.9698, "lng": 77.7499},
        {"name": "Jayanagar", "lat": 12.9250, "lng": 77.5938},
    ]
    results = []
    for tc in test_cases:
        ward = get_ward(tc["lat"], tc["lng"])
        results.append({
            "location": tc["name"],
            "ward_detected": ward
        })
    return {"ward_routing_test": results}


@app.post("/demo/escalate/{ticket_id}")
async def demo_escalate(ticket_id: str):
    """Demo endpoint — manually trigger escalation for a ticket"""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE complaints
            SET filed_at = NOW() - INTERVAL '4 days'
            WHERE ticket_id = %s
            RETURNING ticket_id
        """, (ticket_id,))
        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        if result:
            return {"message": f"Ticket {ticket_id} backdated — escalation fires in next scheduler run (30 sec)"}
        return {"error": "Ticket not found"}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)