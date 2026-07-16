import psycopg2
from config import DATABASE_URL

def get_connection():
    return psycopg2.connect(DATABASE_URL)  

def get_contact(role: str, department: str = None, ward: str = None) -> str:
    """Get WhatsApp number from contacts table"""
    try:
        conn = get_connection()
        cur = conn.cursor()

        if role == 'department' and department:
            cur.execute("""
                SELECT whatsapp FROM contacts
                WHERE role = 'department' AND department = %s
                LIMIT 1
            """, (department,))
        elif role == 'councillor' and ward:
            cur.execute("""
                SELECT whatsapp FROM contacts
                WHERE role = 'councillor' AND ward = %s
                LIMIT 1
            """, (ward,))
        elif role == 'commissioner':
            cur.execute("""
                SELECT whatsapp FROM contacts
                WHERE role = 'commissioner'
                LIMIT 1
            """)
        else:
            return None

        row = cur.fetchone()
        cur.close()
        conn.close()
        return row[0] if row else None

    except Exception as e:
        print(f"Contact lookup error: {e}")
        return None