import os
import json
from google import genai
from google.genai import types

def make_decision(issue_type: str, severity: str, history: dict) -> dict:
    """Decision agent — root cause reasoning using Gemini"""
    try:
        # Initialize official GenAI client (picks up GEMINI_API_KEY from environment)
        client = genai.Client()

        prompt = f"""
        You are a civic infrastructure expert advising BBMP Bengaluru.
        
        Issue reported: {issue_type} (severity: {severity})
        Times reported at this location before: {history.get('complaint_count', 0)}
        Last reported: {history.get('last_reported', 'first time')}
        Is recurring: {history.get('is_recurring', False)}
        
        Guidelines:
        - If reported 3+ times: recommend permanent_fix
        - If first or second time: recommend patch
        - failure_probability: higher if more complaints + recent repair
        - action: be specific e.g. "Full road resurfacing recommended" not just "fix the road"
        """

        # Define the exact JSON schema required
        response_schema = {
            "type": "OBJECT",
            "properties": {
                "is_recurring": {"type": "BOOLEAN"},
                "recommendation": {"type": "STRING", "enum": ["patch", "permanent_fix"]},
                "failure_probability": {"type": "INTEGER"},
                "action": {"type": "STRING"},
                "reasoning": {"type": "STRING"}
            },
            "required": ["is_recurring", "recommendation", "failure_probability", "action", "reasoning"]
        }

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction="You are a civic infrastructure expert. Return data fitting the requested schema.",
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.1
            )
        )

        return json.loads(response.text)

    except Exception as e:
        print(f"Decision agent error: {e}")
        return {
            "is_recurring": False,
            "recommendation": "patch",
            "failure_probability": 30,
            "action": "Standard repair recommended",
            "reasoning": "Insufficient data for detailed analysis."
        }