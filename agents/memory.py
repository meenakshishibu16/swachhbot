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