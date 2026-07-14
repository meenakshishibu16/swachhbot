import os
import base64
import json
import requests
from groq import Groq
from config import GROQ_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

client = Groq(api_key=GROQ_API_KEY)

DEPARTMENT_MAP = {
    "garbage": "BBMP Solid Waste Management",
    "pothole": "BBMP Roads Department",
    "streetlight": "BBMP Electrical Division",
    "drainage": "BBMP Stormwater Drains",
    "other": "BBMP General"
}

def download_image_as_base64(media_url: str) -> str:
    response = requests.get(
        media_url,
        auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    )
    return base64.b64encode(response.content).decode('utf-8')

def classify_issue(media_url: str) -> dict:
    try:
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
        """
        response = client.chat.completions.create(
            model='meta-llama/llama-4-scout-17b-16e-instruct',
            messages=[{
                'role': 'user',
                'content': [
                    {'type': 'text', 'text': prompt},
                    {'type': 'image_url', 'image_url': {
                        'url': f'data:image/jpeg;base64,{image_b64}'
                    }}
                ]
            }],
            max_tokens=200
        )
        result_text = response.choices[0].message.content.strip()
        if '```' in result_text:
            result_text = result_text.split('```')[1]
            if result_text.startswith('json'):
                result_text = result_text[4:]
        result = json.loads(result_text)
        result['department'] = DEPARTMENT_MAP.get(
            result['issue_type'], 'BBMP General'
        )
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