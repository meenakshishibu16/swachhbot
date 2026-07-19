import os
import json
import requests
from google import genai
from google.genai import types
from config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

DEPARTMENT_MAP = {
    "garbage": "BBMP Solid Waste Management",
    "pothole": "BBMP Roads Department",
    "streetlight": "BBMP Electrical Division",
    "drainage": "BBMP Stormwater Drains",
    "other": "BBMP General"
}

def apply_classification_rules(description: str) -> dict:
    """Apply deterministic classification rules before falling back."""
    text = (description or "").lower()

    pothole_keywords = [
        "pothole", "crater", "hole", "cavity", "depression", "sink", "broken asphalt",
        "broken concrete", "missing road surface", "road damage", "damaged road",
        "cracked road", "damaged patch", "uneven road", "deeper hole", "road surface"
    ]
    drainage_keywords = [
        "waterlogging", "blocked drain", "drain blocked", "sewage overflow",
        "stagnant water", "drainage", "flooded", "water on road"
    ]
    garbage_keywords = [
        "overflowing garbage", "overflowing bin", "garbage bin", "waste pile",
        "waste dump", "trash", "dumping", "garbage", "litter"
    ]
    streetlight_keywords = [
        "streetlight", "street light", "light fixture", "broken pole", "fallen pole",
        "missing fixture", "non-functioning light", "light is broken"
    ]

    if any(keyword in text for keyword in pothole_keywords):
        severity = "high" if any(token in text for token in ["deep", "large", "major", "danger", "crater", "hole"]) else "medium"
        return {
            "issue_type": "pothole",
            "severity": severity,
            "confidence": 0.95,
            "description": "Road surface damage such as a crater, hole, or broken asphalt is visible.",
            "department": DEPARTMENT_MAP["pothole"]
        }

    if any(keyword in text for keyword in drainage_keywords):
        severity = "high" if any(token in text for token in ["sewage", "overflow", "flood", "flooded"]) else "medium"
        return {
            "issue_type": "drainage",
            "severity": severity,
            "confidence": 0.92,
            "description": "Drainage infrastructure or waterlogging is visible in the scene.",
            "department": DEPARTMENT_MAP["drainage"]
        }

    if any(keyword in text for keyword in garbage_keywords):
        severity = "high" if any(token in text for token in ["overflow", "dump", "pile"]) else "medium"
        return {
            "issue_type": "garbage",
            "severity": severity,
            "confidence": 0.9,
            "description": "Garbage or waste dumping is visible in the area.",
            "department": DEPARTMENT_MAP["garbage"]
        }

    if any(keyword in text for keyword in streetlight_keywords):
        severity = "high" if any(token in text for token in ["fallen", "broken", "missing"]) else "medium"
        return {
            "issue_type": "streetlight",
            "severity": severity,
            "confidence": 0.91,
            "description": "A streetlight or related lighting infrastructure is damaged or non-functional.",
            "department": DEPARTMENT_MAP["streetlight"]
        }

    return {
        "issue_type": "other",
        "severity": "medium",
        "confidence": 0.5,
        "description": "No clear civic infrastructure issue was detected.",
        "department": DEPARTMENT_MAP["other"]
    }


def download_image_bytes(media_url: str) -> bytes:
    """Download Twilio image and return raw content bytes"""
    response = requests.get(
        media_url,
        auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    )
    return response.content


def classify_issue(media_url: str) -> dict:
    """Vision agent — classify civic issue from photo using Gemini 2.5 Flash"""
    try:
        client = genai.Client()
        image_bytes = download_image_bytes(media_url)

        prompt = """
        You are a civic infrastructure expert for Indian cities.
        Analyze this photo and classify the civic issue.
        
        Classification rules (apply in order of priority):
        1. POTHOLE (highest priority): Choose if the road surface shows any sign of a crater, hole, cavity, depression, broken asphalt, or uneven damaged patch.
        2. DRAINAGE: Waterlogging, blocked drain, sewage overflow, or stagnant water.
        3. GARBAGE: Overflowing bins, waste piles, or scattered trash.
        4. STREETLIGHT: Broken streetlight, fallen pole, missing fixture, or dark non-functioning setup.
        5. OTHER: Only if none of the above categories match.
        """

        # Enforce exact JSON response formats via Gemini Engine configs
        vision_schema = {
            "type": "OBJECT",
            "properties": {
                "issue_type": {"type": "STRING", "enum": ["garbage", "pothole", "streetlight", "drainage", "other"]},
                "severity": {"type": "STRING", "enum": ["low", "medium", "high"]},
                "confidence": {"type": "NUMBER"},
                "description": {"type": "STRING"}
            },
            "required": ["issue_type", "severity", "confidence", "description"]
        }

        # Format image parts for the GenAI SDK
        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type="image/jpeg"
        )

        response = client.models.generate_content(
            model='gemini-1.5-flash',
            contents=[image_part, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=vision_schema,
                temperature=0.2
            )
        )

        result = json.loads(response.text)
        normalized_issue = result.get('issue_type', 'other').lower().strip()
        result['department'] = DEPARTMENT_MAP.get(normalized_issue, 'BBMP General')

        # Fallback evaluation
        confidence = float(result.get('confidence', 0))
        if normalized_issue == 'other' or confidence < 0.6:
            print(f"Gemini confidence low ({confidence}) — performing rules verification...")
            fallback = apply_classification_rules(result.get('description', ''))
            if fallback['issue_type'] != 'other':
                return fallback

        return result

    except Exception as e:
        print(f"Vision agent error: {e}")
        return {
            "issue_type": "other",
            "severity": "medium",
            "confidence": 0.5,
            "description": "Could not classify image through Gemini engine.",
            "department": "BBMP General"
        }