import os
import base64
import json
import re
import requests
from groq import Groq
from config import TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

DEPARTMENT_MAP = {
    "garbage": "BBMP Solid Waste Management",
    "pothole": "BBMP Roads Department",
    "streetlight": "BBMP Electrical Division",
    "drainage": "BBMP Stormwater Drains",
    "other": "BBMP General"
}


def apply_classification_rules(description: str) -> dict:
    """Apply deterministic classification rules before falling back to LLM inference."""
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


def download_image_as_base64(media_url: str) -> str:
    """Download Twilio image and convert to base64"""
    response = requests.get(
        media_url,
        auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    )
    return base64.b64encode(response.content).decode('utf-8')

def classify_issue(media_url: str) -> dict:
    """Vision agent — classify civic issue from photo"""
    try:
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        image_b64 = download_image_as_base64(media_url)

        prompt = """
        You are a civic infrastructure expert for Indian cities.
        Analyze this photo and classify the civic issue.
        
        Return ONLY a JSON object, no other text:
        {
            "issue_type": "garbage|pothole|streetlight|drainage|other",
            "severity": "low|medium|high",
            "confidence": 0.0 to 1.0,
            "description": "one sentence describing what you see"
        }
        
        Classification rules (apply in order of priority):
        1. POTHOLE (highest priority)
           Choose pothole if the road surface shows any sign of a crater, 
           hole, cavity, depression, broken asphalt, broken concrete, 
           missing road surface, cracked area large enough to affect vehicles, 
           or uneven damaged patch.
        2. DRAINAGE
           Choose drainage if there is waterlogging, blocked drain, 
           sewage overflow, or stagnant water near drainage infrastructure.
        3. GARBAGE
           Choose garbage if there is overflowing bins, waste piles, 
           or scattered trash.
        4. STREETLIGHT
           Choose streetlight if there is a broken streetlight, fallen pole, 
           missing fixture, or clearly non-functioning lighting infrastructure.
        5. OTHER
           Use other only if none of the above categories clearly apply.
           A damaged road with a visible hole must never be classified as other.
        """

        response = client.chat.completions.create(
            model='qwen/qwen3.6-27b',
            messages=[{
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {'type': 'image_url', 'image_url': {
                        'url': f'data:image/jpeg;base64,{image_b64}'
                    }}
                ]
            }],
            max_tokens=300
        )

        result_text = response.choices[0].message.content.strip()
        print(f"Raw LLM response: {result_text}")

        # Clean JSON
        if '```' in result_text:
            result_text = result_text.split('```')[1]
            if result_text.startswith('json'):
                result_text = result_text[4:]

        # Try to extract JSON even if there's extra text
        json_match = re.search(r'\{.*?\}', result_text, re.DOTALL)
        if json_match:
            result_text = json_match.group(0)

        result = json.loads(result_text)

        normalized_issue = (result.get('issue_type') or 'other').lower().strip()
        if normalized_issue not in DEPARTMENT_MAP:
            normalized_issue = 'other'

        result['issue_type'] = normalized_issue
        result['department'] = DEPARTMENT_MAP.get(normalized_issue, 'BBMP General')

        # If LLM returns 'other' or low confidence — try rule-based fallback
        confidence = float(result.get('confidence', 0))
        if normalized_issue == 'other' or confidence < 0.6:
            print(f"LLM confidence low ({confidence}) or returned 'other' — trying rule-based fallback")
            description = result.get('description', '')
            fallback = apply_classification_rules(description)
            if fallback['issue_type'] != 'other':
                print(f"Rule-based fallback: {fallback['issue_type']}")
                return fallback
            
            # If fallback also returns other — ask LLM again with stricter prompt
            print("Trying stricter LLM prompt...")
            strict_response = client.chat.completions.create(
                model='qwen/qwen3.6-27b',
                messages=[{
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': f"""
                        Look at this image very carefully.
                        
                        You previously described it as: "{description}"
                        
                        Now choose EXACTLY ONE category:
                        - pothole: ANY road damage, hole, crater, broken surface
                        - drainage: waterlogging, flooded area, blocked drain
                        - garbage: waste, trash, overflowing bin
                        - streetlight: broken light, fallen pole
                        - other: ONLY if truly none of the above
                        
                        Return ONLY: {{"issue_type": "one of the above", "severity": "low|medium|high", "confidence": 0.9, "description": "brief description"}}
                        """},
                        {'type': 'image_url', 'image_url': {
                            'url': f'data:image/jpeg;base64,{image_b64}'
                        }}
                    ]
                }],
                max_tokens=150
            )
            
            strict_text = strict_response.choices[0].message.content.strip()
            print(f"Strict LLM response: {strict_text}")
            
            json_match2 = re.search(r'\{.*?\}', strict_text, re.DOTALL)
            if json_match2:
                strict_result = json.loads(json_match2.group(0))
                strict_issue = (strict_result.get('issue_type') or 'other').lower()
                if strict_issue in DEPARTMENT_MAP and strict_issue != 'other':
                    strict_result['issue_type'] = strict_issue
                    strict_result['department'] = DEPARTMENT_MAP[strict_issue]
                    return strict_result

        return result

    except Exception as e:
        print(f"Vision agent error: {e}")
        return {
            "issue_type": "other",
            "severity": "medium",
            "confidence": 0.5,
            "description": "Could not classify image",
            "department": "BBMP General"
        }