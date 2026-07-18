from db.connection import get_connection

def create_tables():
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        CREATE EXTENSION IF NOT EXISTS postgis;
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS assets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            issue_type TEXT,
            location GEOGRAPHY(POINT, 4326),
            ward TEXT,
            department TEXT,
            complaint_count INT DEFAULT 1,
            last_reported TIMESTAMP DEFAULT NOW(),
            notes TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS complaints (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            asset_id UUID REFERENCES assets(id),
            citizen_phone TEXT,
            photo_url TEXT,
            ticket_id TEXT,
            issue_type TEXT,
            severity TEXT,
            ward TEXT,
            department TEXT,
            status TEXT DEFAULT 'filed',
            escalation_level INT DEFAULT 0,
            filed_at TIMESTAMP DEFAULT NOW(),
            resolved_at TIMESTAMP
        );
    """)

    conn.commit()
    cur.close()
    conn.close()
    print("Tables created successfully")

if __name__ == "__main__":
    create_tables()