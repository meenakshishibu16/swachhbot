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
    print("Running escalation check...")
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Check complaints with no action taken
        cur.execute("""
            SELECT c.id, c.ticket_id, c.citizen_phone, c.ward,
                   c.department, c.escalation_level, c.filed_at,
                   s.no_action_hours
            FROM complaints c
            JOIN sla_config s ON c.issue_type = s.issue_type
                AND c.severity = s.severity
            WHERE c.status = 'filed'
            OR c.status = 'reactivated'
        """)
        no_action = cur.fetchall()

        for row in no_action:
            comp_id, ticket_id, phone, ward, dept, level, filed_at, sla_hours = row
            hours_open = (datetime.now() - filed_at).total_seconds() / 3600

            if hours_open >= sla_hours:
                new_level = level + 1
                msg_citizen = (
                    f"⚠️ *Escalation Notice — Ticket #{ticket_id}*\n\n"
                    f"No action taken after {int(hours_open)} hours.\n"
                    f"Escalated to "
                    f"{'Ward Councillor' if new_level == 1 else 'Commissioner'}."
                )
                send_whatsapp(phone, msg_citizen)
                cur.execute("""
                    UPDATE complaints
                    SET escalation_level = %s
                    WHERE id = %s
                """, (new_level, comp_id))
                print(f"No-action escalation: {ticket_id} → Level {new_level}")

        # Check complaints where action started but not resolved
        cur.execute("""
            SELECT c.id, c.ticket_id, c.citizen_phone, c.ward,
                   c.department, c.escalation_level,
                   c.action_started_at, c.action_sla_hours
            FROM complaints c
            WHERE c.status = 'action_started'
            AND c.action_started_at IS NOT NULL
            AND c.action_sla_hours IS NOT NULL
        """)
        in_action = cur.fetchall()

        for row in in_action:
            comp_id, ticket_id, phone, ward, dept, level, action_at, action_sla = row
            hours_since_action = (datetime.now() - action_at).total_seconds() / 3600

            if hours_since_action >= action_sla:
                new_level = level + 1
                msg_citizen = (
                    f"⚠️ *Escalation Notice — Ticket #{ticket_id}*\n\n"
                    f"Action was started but issue not resolved after "
                    f"{int(hours_since_action)} hours.\n"
                    f"Escalated to "
                    f"{'Ward Councillor' if new_level == 1 else 'Commissioner'}."
                )
                send_whatsapp(phone, msg_citizen)
                cur.execute("""
                    UPDATE complaints
                    SET escalation_level = %s,
                        status = 'filed'
                    WHERE id = %s
                """, (new_level, comp_id))
                print(f"Action-incomplete escalation: {ticket_id} → Level {new_level}")

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

    # CASE 3: Citizen confirming resolution (replies 1 or 2)
    if body in ['1', '2']:
        try:
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("""
                SELECT ticket_id FROM complaints
                WHERE citizen_phone = %s
                AND status = 'pending_citizen'
                ORDER BY filed_at DESC
                LIMIT 1
            """, (citizen_phone,))
            row = cur.fetchone()
            cur.close()
            conn.close()

            if row:
                ticket_id = row[0]
                confirmed = body == '1'

                conn2 = get_connection()
                cur2 = conn2.cursor()

                if confirmed:
                    cur2.execute("""
                        UPDATE complaints
                        SET status = 'resolved_certified',
                            citizen_confirmed = TRUE,
                            resolved_at = NOW()
                        WHERE ticket_id = %s
                    """, (ticket_id,))
                    send_whatsapp(citizen_phone,
                        f"✅ *Complaint #{ticket_id} Certified Resolved*\n\n"
                        f"Thank you for confirming! Your complaint is now closed.\n"
                        f"Report any new issues by sending a photo. 🙏"
                    )
                else:
                    cur2.execute("""
                        UPDATE complaints
                        SET status = 'reactivated',
                            citizen_confirmed = FALSE,
                            reactivated_count = reactivated_count + 1,
                            action_started_at = NULL,
                            filed_at = NOW(),
                            escalation_level = escalation_level + 1
                        WHERE ticket_id = %s
                    """, (ticket_id,))
                    send_whatsapp(citizen_phone,
                        f"🔄 *Complaint #{ticket_id} Reactivated*\n\n"
                        f"Sorry the issue wasn't resolved.\n"
                        f"Your complaint has been reactivated and escalated.\n"
                        f"We'll follow up again until it's fixed. 🙏"
                    )

                conn2.commit()
                cur2.close()
                conn2.close()
                return PlainTextResponse("OK")

        except Exception as e:
            print(f"Citizen confirm error: {e}")

    # CASE 4: Welcome message
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
# COMPLAINT ENDPOINTS
# ─────────────────────────────────────────

@app.get("/complaints")
async def get_complaints():
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT
                c.ticket_id, c.issue_type, c.severity,
                c.ward, c.department, c.status,
                c.escalation_level, c.filed_at,
                c.action_started_at, c.action_started_by,
                c.resolved_note, c.resolved_by,
                c.resolved_photo_url, c.reactivated_count,
                c.photo_url,
                c.decision_recommendation, c.failure_probability,
                c.decision_action, c.decision_reasoning,
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
            "action_started_at": str(row[8]) if row[8] else None,
            "action_started_by": row[9],
            "resolved_note": row[10],
            "resolved_by": row[11],
            "resolved_photo_url": row[12],
            "reactivated_count": row[13] or 0,
            "photo_url": row[14],
            "decision_recommendation": row[15],
            "failure_probability": row[16],
            "decision_action": row[17],
            "decision_reasoning": row[18],
            "lat": float(row[19]) if row[19] else 12.9716,
            "lng": float(row[20]) if row[20] else 77.5946
        })
        return complaints
    except Exception as e:
        return {"error": str(e)}


@app.post("/complaint/{ticket_id}/start-action")
async def start_action(ticket_id: str, data: dict):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT c.issue_type, c.severity,
                   s.no_action_hours, s.action_started_hours
            FROM complaints c
            JOIN sla_config s ON c.issue_type = s.issue_type
                AND c.severity = s.severity
            WHERE c.ticket_id = %s
        """, (ticket_id,))
        row = cur.fetchone()

        if not row:
            return {"error": "Ticket not found"}

        issue_type, severity, no_action_hours, action_sla_hours = row

        cur.execute("""
            UPDATE complaints
            SET status = 'action_started',
                action_started_at = NOW(),
                action_started_by = %s,
                action_sla_hours = %s
            WHERE ticket_id = %s
            RETURNING citizen_phone, ward, department
        """, (data.get('started_by'), action_sla_hours, ticket_id))

        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if result:
            phone, ward, dept = result
            send_whatsapp(phone,
                f"⚡ *Action Started — Ticket #{ticket_id}*\n\n"
                f"A {dept} officer has started working on your complaint.\n"
                f"Ward: {ward}\n\n"
                f"Expected resolution within {action_sla_hours} hours."
            )
            return {"message": "Action started"}
        return {"error": "Ticket not found"}
    except Exception as e:
        return {"error": str(e)}


@app.post("/complaint/{ticket_id}/resolve")
async def resolve_complaint_v2(ticket_id: str, data: dict):
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE complaints
            SET status = 'pending_citizen',
                resolved_by = %s,
                resolved_note = %s,
                resolved_photo_url = %s
            WHERE ticket_id = %s
            RETURNING citizen_phone, ward, issue_type
        """, (
            data.get('resolved_by'),
            data.get('resolved_note'),
            data.get('resolved_photo_url'),
            ticket_id
        ))

        result = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()

        if result:
            phone, ward, issue_type = result
            photo_url = data.get('resolved_photo_url', '')

            msg = (
                f"🔍 *Resolution Check — Ticket #{ticket_id}*\n\n"
                f"The {issue_type} issue at {ward} has been marked resolved.\n"
            )
            if photo_url:
                msg += f"📸 Photo: {photo_url}\n"
            if data.get('resolved_note'):
                msg += f"📝 Note: {data.get('resolved_note')}\n"

            msg += (
                f"\nIs your issue resolved?\n"
                f"Reply *1* — Yes, resolved ✅\n"
                f"Reply *2* — No, still an issue ❌"
            )

            send_whatsapp(phone, msg)
            return {"message": "Pending citizen confirmation"}
        return {"error": "Ticket not found"}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────
# UTILITY ENDPOINTS
# ─────────────────────────────────────────

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
            return {"message": f"Ticket {ticket_id} backdated — escalation fires in 30 sec"}
        return {"error": "Ticket not found"}
    except Exception as e:
        return {"error": str(e)}


@app.post("/demo/seed")
async def seed_demo_data():
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("SELECT id, issue_type, ward, department FROM assets LIMIT 5")
        assets = cur.fetchall()

        if not assets:
            return {"error": "No assets found — run Supabase seed SQL first"}

        for i, asset in enumerate(assets):
            statuses = ['filed', 'action_started', 'filed', 'resolved', 'filed']
            escalations = [0, 0, 1, 0, 2]
            intervals = ['1 day', '2 days', '4 days', '2 days', '8 days']
            ticket_ids = ['BBMP-A1B2C3', 'BBMP-D4E5F6', 'BBMP-G7H8I9', 'BBMP-J1K2L3', 'BBMP-M4N5O6']

            cur.execute(f"""
                INSERT INTO complaints
                (asset_id, citizen_phone, ticket_id, issue_type, severity,
                 ward, department, status, escalation_level, filed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, NOW() - INTERVAL '{intervals[i]}')
                ON CONFLICT (ticket_id) DO NOTHING
            """, (
                asset[0], 'whatsapp:+917736161679',
                ticket_ids[i], asset[1], 'high',
                asset[2], asset[3],
                statuses[i], escalations[i]
            ))

        conn.commit()
        cur.close()
        conn.close()
        return {"message": "Demo data seeded — refresh dashboard"}

    except Exception as e:
        return {"error": str(e)}


@app.get("/resolve/{ticket_id}")
async def resolve_complaint_simple(ticket_id: str):
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
                f"Ticket #{ticket} has been resolved.\n"
                f"Ward: {ward}\n\n"
                f"Thank you for helping keep Bengaluru clean! 🙏"
            )
            return {"message": f"Ticket {ticket_id} resolved"}
        return {"error": "Ticket not found"}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)