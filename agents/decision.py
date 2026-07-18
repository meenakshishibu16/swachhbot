import os
import json
from groq import Groq

def make_decision(issue_type: str, severity: str, history: dict) -> dict:
    """Decision agent — root cause reasoning"""
    try:
        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

        prompt = f"""
        You are a civic infrastructure expert advising BBMP Bengaluru.
        
        Issue reported: {issue_type} (severity: {severity})
        Times reported at this location before: {history.get('complaint_count', 0)}
        Last reported: {history.get('last_reported', 'first time')}
        Is recurring: {history.get('is_recurring', False)}
        
        Return ONLY a JSON object, no other text:
        {{
            "is_recurring": true or false,
            "recommendation": "patch" or "permanent_fix",
            "failure_probability": integer 0-100,
            "action": "specific one-line action for the department",
            "reasoning": "two sentences explaining your decision"
        }}
        
        Guidelines:
        - If reported 3+ times: recommend permanent_fix
        - If first or second time: recommend patch
        - failure_probability: higher if more complaints + recent repair
        - action: be specific e.g.
          "Full road resurfacing recommended" not just "fix the road"
        """

        response = client.chat.completions.create(
            model='meta-llama/llama-4-scout-17b-16e-instruct',
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=300
        )

        result_text = response.choices[0].message.content.strip()

        if '```' in result_text:
            result_text = result_text.split('```')[1]
            if result_text.startswith('json'):
                result_text = result_text[4:]

        return json.loads(result_text)

    except Exception as e:
        print(f"Decision agent error: {e}")
        return {
            "is_recurring": False,
            "recommendation": "patch",
            "failure_probability": 30,
            "action": "Standard repair recommended",
            "reasoning": "Insufficient data for detailed analysis."
        }