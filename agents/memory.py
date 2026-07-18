import json
from db.connection import get_connection

def get_asset_history(lat: float, lng: float, issue_type: str) -> dict:
    """Memory agent — check if this spot has been reported before"""
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Look for existing asset within 20 metres
        cur.execute("""
            SELECT
                id,
                issue_type,
                ward,
                department,
                complaint_count,
                last_reported,
                notes,
                ST_Distance(
                    location,
                    ST_MakePoint(%s, %s)::geography
                ) as distance
            FROM assets
            WHERE issue_type = %s
            AND ST_DWithin(
                location,
                ST_MakePoint(%s, %s)::geography,
                20
            )
            ORDER BY distance
            LIMIT 1
        """, (lng, lat, issue_type, lng, lat))

        row = cur.fetchone()
        cur.close()
        conn.close()

        if row:
            return {
                "found": True,
                "asset_id": str(row[0]),
                "complaint_count": row[4],
                "last_reported": str(row[5]),
                "ward": row[2],
                "department": row[3],
                "notes": row[6],
                "is_recurring": row[4] >= 3
            }
        else:
            return {
                "found": False,
                "complaint_count": 0,
                "is_recurring": False
            }

    except Exception as e:
        print(f"Memory agent error: {e}")
        return {"found": False, "complaint_count": 0, "is_recurring": False}


def create_or_update_asset(lat: float, lng: float,
                           issue_type: str, ward: str,
                           department: str) -> str:
    """Create new asset or update existing one"""
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Check if asset exists within 20m
        cur.execute("""
            SELECT id FROM assets
            WHERE issue_type = %s
            AND ST_DWithin(
                location,
                ST_MakePoint(%s, %s)::geography,
                20
            )
            LIMIT 1
        """, (issue_type, lng, lat))

        existing = cur.fetchone()

        if existing:
            # Update complaint count
            cur.execute("""
                UPDATE assets
                SET complaint_count = complaint_count + 1,
                    last_reported = NOW()
                WHERE id = %s
                RETURNING id
            """, (existing[0],))
            asset_id = str(cur.fetchone()[0])
        else:
            # Create new asset
            cur.execute("""
                INSERT INTO assets
                (issue_type, location, ward, department)
                VALUES (
                    %s,
                    ST_MakePoint(%s, %s)::geography,
                    %s, %s
                )
                RETURNING id
            """, (issue_type, lng, lat, ward, department))
            asset_id = str(cur.fetchone()[0])

        conn.commit()
        cur.close()
        conn.close()
        return asset_id

    except Exception as e:
        print(f"Asset update error: {e}")
        return None
    
def check_duplicate(lat: float, lng: float, issue_type: str) -> str:
    """Check if same issue reported at same spot in last 24 hours"""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            SELECT c.ticket_id
            FROM complaints c
            JOIN assets a ON c.asset_id = a.id
            WHERE c.issue_type = %s
            AND c.status NOT IN ('resolved', 'resolved_certified')
            AND c.filed_at > NOW() - INTERVAL '24 hours'
            AND ST_DWithin(
                a.location,
                ST_MakePoint(%s, %s)::geography,
                20
            )
            ORDER BY c.filed_at DESC
            LIMIT 1
        """, (issue_type, lng, lat))
        row = cur.fetchone()
        cur.close()
        conn.close()
        return row[0] if row else None
    except Exception as e:
        print(f"Duplicate check error: {e}")
        return None


def add_co_reporter(ticket_id: str, citizen_phone: str):
    """Add citizen as co-reporter and notify them when resolved"""
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("""
            UPDATE complaints
            SET co_reporters = CASE
                WHEN co_reporters IS NULL OR co_reporters = ''
                THEN %s
                ELSE co_reporters || ',' || %s
            END
            WHERE ticket_id = %s
        """, (citizen_phone, citizen_phone, ticket_id))
        conn.commit()
        cur.close()
        conn.close()
        print(f"Added co-reporter {citizen_phone} to {ticket_id}")
    except Exception as e:
        print(f"Co-reporter error: {e}")