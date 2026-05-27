import os
import json
import re
from openai import OpenAI


class LLMClient:
    def __init__(self):
        api_key = os.environ.get("LLM_API_KEY")
        base_url = os.environ.get("LLM_BASE_URL")
        self.model = os.environ.get("LLM_MODEL")

        if not api_key:
            raise ValueError("LLM_API_KEY is required")
        if not self.model:
            raise ValueError("LLM_MODEL is required")

        kwargs = {"api_key": api_key}
        if base_url:
            kwargs["base_url"] = base_url

        self.client = OpenAI(**kwargs)

    def analyze(self, signals_summary: str, early_excerpt: str, late_excerpt: str) -> dict:
        prompt = f"""You are an expert at reading interpersonal communication patterns and detecting when someone is losing interest in a conversation or relationship.

Analyze the following conversation data and return a JSON ghosting probability assessment.

QUANTITATIVE SIGNALS:
{signals_summary}

EARLY CONVERSATION SAMPLE:
{early_excerpt}

RECENT CONVERSATION SAMPLE:
{late_excerpt}

Return a JSON object with exactly this structure:
{{
  "ghosting_probability": <integer 0-100>,
  "confidence": "low|medium|high",
  "verdict": "one of: All good|Proceed with caution|Warning signs present|Already checked out|They are gone",
  "signals_detected": [
    {{
      "signal": "signal name",
      "direction": "positive|negative|neutral",
      "weight": "low|medium|high",
      "explanation": "one sentence explanation with evidence from the conversation"
    }}
  ],
  "tone_shift": "description of how the tone changed from early to recent messages",
  "what_changed": "specific behaviors that changed between early and recent conversation",
  "recommendation": "2-3 sentence honest, direct recommendation on what to do next",
  "positive_signs": ["any genuine positive signals if they exist"],
  "red_flags": ["specific concerning behaviors observed"]
}}

Be direct and honest. Base your assessment strictly on evidence in the conversation. Do not be optimistic without reason.
Return ONLY valid JSON, no explanation outside the JSON."""

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a communication pattern analyst. Respond only with valid JSON."
                },
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=2000
        )

        content = response.choices[0].message.content.strip()

        # Extract JSON block if wrapped in markdown
        json_match = re.search(r"```json\s*([\s\S]*?)\s*```", content)
        if json_match:
            content = json_match.group(1)
        else:
            # Try to find raw JSON object
            json_match = re.search(r"\{[\s\S]*\}", content)
            if json_match:
                content = json_match.group(0)

        if not content:
            raise ValueError(f"LLM returned empty or non-JSON response. Raw: {response.choices[0].message.content[:200]}")

        return json.loads(content)
