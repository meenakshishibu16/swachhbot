-- SwachhBot Database Schema
-- Run this file to set up the complete database
-- Prerequisites: PostgreSQL with PostGIS extension

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- ─────────────────────────────────────────
-- ASSETS TABLE
-- Stores every unique physical location/infrastructure item
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_type TEXT NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    ward TEXT,
    department TEXT,
    complaint_count INT DEFAULT 1,
    last_reported TIMESTAMP DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- COMPLAINTS TABLE
-- Stores every civic complaint filed by citizens
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS complaints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID REFERENCES assets(id),
    citizen_phone TEXT,
    photo_url TEXT,
    ticket_id TEXT UNIQUE,
    issue_type TEXT,
    severity TEXT,
    ward TEXT,
    department TEXT,
    status TEXT DEFAULT 'filed',
    escalation_level INT DEFAULT 0,
    filed_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,

    -- Action tracking
    action_started_at TIMESTAMP,
    action_started_by TEXT,
    action_note TEXT,
    action_sla_hours INT,

    -- Resolution tracking
    resolved_photo_url TEXT,
    resolved_note TEXT,
    resolved_by TEXT,
    citizen_confirmed BOOLEAN DEFAULT NULL,

    -- Decision agent output
    decision_recommendation TEXT,
    failure_probability INT,
    decision_action TEXT,
    decision_reasoning TEXT,

    -- Escalation tracking
    last_escalated_at TIMESTAMP,
    reminder_count INT DEFAULT 0,
    reactivated_count INT DEFAULT 0,

    -- Co-reporters
    co_reporters TEXT DEFAULT ''
);

-- ─────────────────────────────────────────
-- DEPARTMENT USERS TABLE
-- Stores all dashboard users with their roles
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS department_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,       -- 'department' | 'councillor' | 'commissioner'
    department TEXT,          -- 'garbage' | 'pothole' | 'streetlight' | 'drainage'
    ward TEXT,
    whatsapp TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SLA CONFIG TABLE
-- Stores escalation time limits per issue type and severity
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sla_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    no_action_hours INT NOT NULL,
    action_started_hours INT NOT NULL
);

-- ─────────────────────────────────────────
-- CONTACTS TABLE
-- Stores WhatsApp numbers for departments, councillors, commissioner
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,       -- 'department' | 'councillor' | 'commissioner'
    department TEXT,
    ward TEXT,
    name TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- SEED DATA
-- ─────────────────────────────────────────

-- SLA configuration
INSERT INTO sla_config (issue_type, severity, no_action_hours, action_started_hours) VALUES
('garbage', 'high', 12, 24),
('garbage', 'medium', 24, 48),
('garbage', 'low', 48, 72),
('pothole', 'high', 24, 48),
('pothole', 'medium', 48, 120),
('pothole', 'low', 72, 168),
('streetlight', 'high', 12, 24),
('streetlight', 'medium', 24, 48),
('streetlight', 'low', 48, 72),
('drainage', 'high', 12, 24),
('drainage', 'medium', 24, 48),
('drainage', 'low', 48, 72)
ON CONFLICT DO NOTHING;

-- Department users (dummy for prototype)
INSERT INTO department_users (email, name, role, department, ward, whatsapp) VALUES
('swm@bbmp.demo', 'Ravi Kumar', 'department', 'garbage', NULL, '+917736161679'),
('roads@bbmp.demo', 'Priya Sharma', 'department', 'pothole', NULL, '+917736161679'),
('electrical@bbmp.demo', 'Suresh Nair', 'department', 'streetlight', NULL, '+917736161679'),
('drainage@bbmp.demo', 'Anita Rao', 'department', 'drainage', NULL, '+917736161679'),
('councillor@bbmp.demo', 'Mohammed Hussain', 'councillor', NULL, 'Indiranagar Ward', '+917736161679'),
('commissioner@bbmp.demo', 'Dr. Tushar Giri', 'commissioner', NULL, NULL, '+917736161679')
ON CONFLICT DO NOTHING;

-- Contacts (dummy WhatsApp numbers for prototype)
INSERT INTO contacts (role, department, ward, name, whatsapp) VALUES
('department', 'garbage', NULL, 'BBMP Solid Waste Management', '+917736161679'),
('department', 'pothole', NULL, 'BBMP Roads Department', '+917736161679'),
('department', 'streetlight', NULL, 'BBMP Electrical Division', '+917736161679'),
('department', 'drainage', NULL, 'BBMP Stormwater Drains', '+917736161679'),
('councillor', NULL, 'Indiranagar Ward', 'Mohammed Hussain', '+917736161679'),
('councillor', NULL, 'Koramangala Ward', 'Priya Nair', '+917736161679'),
('councillor', NULL, 'Whitefield Ward', 'Rajan Kumar', '+917736161679'),
('councillor', NULL, 'Jayanagar Ward', 'Sunita Rao', '+917736161679'),
('commissioner', NULL, NULL, 'Dr. Tushar Giri', '+917736161679')
ON CONFLICT DO NOTHING;

-- Demo assets (sample Bengaluru locations)
INSERT INTO assets (issue_type, location, ward, department, complaint_count, last_reported, notes) VALUES
('garbage', ST_MakePoint(77.5946, 12.9716)::geography, 'Indiranagar Ward', 'BBMP Solid Waste Management', 4, '2025-03-15', 'Recurring overflow near market'),
('pothole', ST_MakePoint(77.5800, 12.9352)::geography, 'Koramangala Ward', 'BBMP Roads Department', 3, '2025-02-20', 'Road fails post-monsoon'),
('streetlight', ST_MakePoint(77.6408, 12.9784)::geography, 'Indiranagar Ward', 'BBMP Electrical Division', 5, '2025-04-01', 'Aging wiring repeated failures'),
('pothole', ST_MakePoint(77.7499, 12.9698)::geography, 'Whitefield Ward', 'BBMP Roads Department', 2, '2025-01-10', 'Near school zone'),
('garbage', ST_MakePoint(77.5938, 12.9250)::geography, 'Jayanagar Ward', 'BBMP Solid Waste Management', 6, '2025-05-01', 'Black spot needs permanent solution')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────
-- GRANT PERMISSIONS
-- ─────────────────────────────────────────
GRANT ALL ON complaints TO anon, authenticated, service_role;
GRANT ALL ON assets TO anon, authenticated, service_role;
GRANT ALL ON department_users TO anon, authenticated, service_role;
GRANT ALL ON sla_config TO anon, authenticated, service_role;
GRANT ALL ON contacts TO anon, authenticated, service_role;