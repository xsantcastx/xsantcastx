"""Anthropic SDK wrapper for the pipeline.

Model selection by agent:
  research  → haiku   (fast, cheap — just extracting structured data)
  planning  → haiku   (fast, cheap — picking from a list)
  development → sonnet (needs code quality)
  deploy fix  → haiku  (log reading, simple fix identification)
"""
import os
import json
import re
import anthropic

HAIKU  = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-6"
OPUS   = "claude-opus-4-6"

# Default model — overridden per call
DEFAULT_MODEL = SONNET


def call_claude(system: str, messages: list[dict], max_tokens: int = 2048,
                model: str = DEFAULT_MODEL) -> str:
    """Call Claude and return the text of the first content block."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    return response.content[0].text


def call_claude_json(system: str, messages: list[dict], max_tokens: int = 2048,
                     model: str = DEFAULT_MODEL, retries: int = 2) -> dict:
    """Call Claude and parse the response as JSON.

    Strips markdown code fences if present, then parses. Retries on parse failure.
    """
    for attempt in range(retries + 1):
        raw = call_claude(system, messages, max_tokens=max_tokens, model=model)

        stripped = raw.strip()
        if stripped.startswith("```"):
            stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
            stripped = re.sub(r"\s*```$", "", stripped)

        try:
            return json.loads(stripped)
        except json.JSONDecodeError as exc:
            if attempt == retries:
                raise ValueError(
                    f"Claude returned non-JSON after {retries + 1} attempts.\n"
                    f"Raw response (first 300 chars): {raw[:300]}"
                ) from exc

            messages = messages + [
                {"role": "assistant", "content": raw},
                {
                    "role": "user",
                    "content": (
                        "Your response was not valid JSON. "
                        f"Parse error: {exc}. "
                        "Return ONLY valid JSON, no markdown fences or extra text."
                    ),
                },
            ]
    raise RuntimeError("Unexpected exit from retry loop")
