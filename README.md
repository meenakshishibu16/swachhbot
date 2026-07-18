# SwachhBot 🏙️
### Autonomous Civic Grievance Resolution Powered by Agentic AI

> **One photo. Four agents. No follow-up needed.**

SwachhBot is a WhatsApp-based agentic AI system that autonomously files, tracks, escalates, and resolves civic grievances for Indian cities — giving every public asset a persistent memory and every citizen complaint an AI representative that never stops until the issue is genuinely fixed.

---

## 🔗 Live Links

| | URL |
|---|---|
| **Dashboard** | https://swachhbot-dashboard.vercel.app |
| **Backend API** | https://swachhbot-production.up.railway.app |
| **Health check** | https://swachhbot-production.up.railway.app/health |
| **Complaints API** | https://swachhbot-production.up.railway.app/complaints |
| **Ward routing test** | https://swachhbot-production.up.railway.app/test/ward |

---

## 🎯 Problem Statement

Indian municipalities receive thousands of civic complaints daily — potholes, overflowing garbage, broken streetlights. Citizens file complaints and nothing happens. The same road gets repaired six times. The same drain floods every monsoon. Cities treat every complaint as a brand-new incident because they have no institutional memory, and the burden of follow-up falls entirely on citizens who never follow up.

**750+ complaints are filed daily in Bengaluru alone (BBMP, 2025) — and most go unresolved.**

---

## 💡 Solution

A citizen sends **one WhatsApp photo**. Four AI agents take over:

| Agent | What it does |
|---|---|
| **Vision Agent** | Classifies the issue from the photo, routes to correct ward and department |
| **Memory Agent** | Checks if this exact spot has failed before — retrieves full complaint and repair history |
| **Decision Agent** | Reasons whether this needs a patch or permanent fix, estimates failure probability |
| **Execution Agent** | Files the complaint, monitors resolution, escalates autonomously |

The citizen never follows up. The agent keeps acting until the issue is resolved.

---

## ✨ Key Features

- **WhatsApp-only** — no app install, no portal login required
- **Asset memory** — every public asset gets a persistent history of complaints and repairs
- **Agentic escalation** — SLA-based automatic escalation to Ward Councillor → Commissioner
- **Public landing page** — visitors can see a public SwachhBot overview and WhatsApp CTA before entering the dashboard
- **Role-based dashboard** — Department / Councillor / Commissioner each see their relevant complaints
- **Separate route flow** — the landing experience is available at the root route, while the dashboard is reached at /dashboard
- **Two-step resolution** — department marks resolved, citizen verifies via WhatsApp
- **Complaint reactivation** — if citizen says not resolved, complaint restarts with higher escalation
- **Daily reminders** — up to 7 daily reminders to Commissioner if no action taken
- **Real-time map** — live complaint pins on Bengaluru map with status color coding

---

## 🏗️ Architecture

```
Citizen (WhatsApp)
        ↓
Twilio WhatsApp API
        ↓
FastAPI Backend (Railway)
        ↓
LangGraph Agent Runtime
    ├── Vision Agent (Groq Llama 4 Vision)
    ├── Memory Agent (PostgreSQL + PostGIS)
    ├── Decision Agent (Groq Llama 4)
    └── Execution Agent (Twilio + PostgreSQL)
        ↓
PostgreSQL + PostGIS (Supabase)
        ↓
React Dashboard (Vercel — Role-based)
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| Agent Orchestration | LangGraph |
| LLM + Vision | Groq (Llama 4 Scout) |
| WhatsApp | Twilio WhatsApp Business API |
| Database | PostgreSQL + PostGIS (Supabase) |
| Geo-routing | Shapely + BBMP Ward GeoJSON |
| Scheduling | APScheduler |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Frontend | React + Leaflet.js |
| Deployment (Backend) | Railway |
| Deployment (Frontend) | Vercel |

---

## 📁 Project Structure

```
swachhbot/
├── agents/
│   ├── vision.py          # Vision agent — Groq image classification
│   ├── memory.py          # Memory agent — PostgreSQL asset history
│   ├── decision.py        # Decision agent — Groq root cause reasoning
│   ├── execution.py       # Execution agent — filing + notifications
│   └── geo_router.py      # GPS → ward mapping via PostGIS + GeoJSON
├── db/
│   ├── connection.py      # PostgreSQL connection + contact lookup
│   └── models.py          # Table creation SQL
├── dashboard/             # React frontend (deployed on Vercel)
│   └── src/
│       ├── App.js         # Main dashboard + map
│       ├── Login.js       # Role-based login
│       ├── ComplaintCard.js # Complaint card with actions
│       └── supabase.js    # Supabase client
├── main.py                # FastAPI app + webhook + scheduler
├── config.py              # Environment variable loader
├── blr_wards.geojson      # Bengaluru ward boundaries (243 wards)
├── Procfile               # Railway deployment config
└── requirements.txt       # Python dependencies
```

---

## 🚀 Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+
- Accounts: Twilio, Groq, Supabase, Google Maps

### 1. Clone the repository
```bash
git clone https://github.com/meenakshishibu16/swachhbot.git
cd swachhbot
```

### 2. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 3. Set up environment variables
Create a `.env` file in the root directory:
```
GROQ_API_KEY=your_groq_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
GOOGLE_MAPS_API_KEY=your_google_maps_key
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

### 4. Set up the database
```bash
py -m db.models
```

### 5. Run the backend
```bash
py -m uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`

### 6. Set up Twilio webhook
Install ngrok and expose your local server:
```bash
ngrok http 8000
```
Set the ngrok URL as your Twilio WhatsApp sandbox webhook:
```
https://YOUR_NGROK_URL/webhook/whatsapp
```

### 7. Run the dashboard
```bash
cd dashboard
npm install
npm start
```

Dashboard runs at `http://localhost:3000`

---

## 🔑 Demo Credentials

| Role | Email | Password |
|---|---|---|
| Solid Waste Dept | swm@bbmp.demo | Demo@1234 |
| Roads Dept | roads@bbmp.demo | Demo@1234 |
| Electrical Dept | electrical@bbmp.demo | Demo@1234 |
| Drainage Dept | drainage@bbmp.demo | Demo@1234 |
| Ward Councillor | councillor@bbmp.demo | Demo@1234 |
| Commissioner | commissioner@bbmp.demo | Demo@1234 |

---

## 📱 How to Test (WhatsApp)

1. Join the Twilio sandbox by sending `join [keyword]` to `+1 415 523 8886`
2. Send `hi` to get started
3. Send a photo of a civic issue
4. Share your location
5. Receive ticket confirmation with AI decision
6. Reply `1` to confirm resolved or `2` to reactivate

---

## 🔄 Escalation Flow

```
Complaint Filed (Level 0) → Department notified
        ↓ SLA expires — no department action
Escalated to Ward Councillor (Level 1)
        ↓ SLA expires — no councillor action
Escalated to Commissioner (Level 2)
        ↓ Daily reminders — up to 7 days
Marked as Stuck — citizen directed to IPGRS portal
```

**SLA times by issue and severity:**

| Issue | High | Medium | Low |
|---|---|---|---|
| Garbage | 12 hrs | 24 hrs | 48 hrs |
| Pothole | 24 hrs | 48 hrs | 72 hrs |
| Streetlight | 12 hrs | 24 hrs | 48 hrs |
| Drainage | 12 hrs | 24 hrs | 48 hrs |

---

## 📊 Dashboard Roles

| Role | Sees | Can do |
|---|---|---|
| Department | Their issue type only | Start Action, Mark Resolved |
| Councillor | Their ward at Level 1+ | Direct Department, Confirm Resolution |
| Commissioner | All complaints at Level 2+ | Issue Directive, Close Complaint |

---

## 📊 BBMP Complaint Data (Source: OpenCity, 2025)

- **126,974** complaints filed across 198 wards in 5.5 months
- **750+** daily average complaints
- **33.2%** streetlight failures — largest single category
- **30%** solid waste management
- **~75%** of all complaints fall in categories SwachhBot handles

---

## 🗃️ Open Source Attribution

| Library | Version | License | Role |
|---|---|---|---|
| FastAPI | 0.115.x | MIT | Backend web framework |
| LangGraph | 0.2.x | MIT | Stateful agent orchestration |
| Groq Python SDK | 0.11.x | Apache 2.0 | LLM + Vision API |
| Twilio Python | 9.x | MIT | WhatsApp messaging |
| psycopg2-binary | 2.9.x | LGPL | PostgreSQL connection |
| Shapely | 2.x | BSD | GPS point-in-polygon |
| APScheduler | 3.x | MIT | Escalation scheduling |
| python-dotenv | 1.x | BSD | Environment variables |
| supabase-py | 2.x | MIT | Storage + Auth |
| requests | 2.x | Apache 2.0 | HTTP requests |
| React | 18.x | MIT | Dashboard frontend |
| Leaflet.js | 1.9.x | BSD | Map rendering |
| @supabase/supabase-js | 2.x | MIT | Frontend Auth + Storage |
| axios | 1.x | MIT | API calls from React |

---

## 👥 Built By

**Meenakshi Shibu**


> *SwachhBot — Because every complaint deserves a resolution, not just an acknowledgement.*
