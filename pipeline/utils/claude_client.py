"""Anthropic SDK wrapper for the pipeline."""
import os
import json
import re
import anthropic

MODEL = "claude-opus-4-6"


def call_claude(system: str, messages: list[dict], max_tokens: int = 8096) -> str:
    """Call Claude and return the text of the first content block."""
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=messages,
    )
    return response.content[0].text


def call_claude_json(system: str, messages: list[dict], max_tokens: int = 8096, retries: int = 2) -> dict:
    """Call Claude and parse the response as JSON.

    Strips markdown code fences if present, then parses. Retries on parse failure.
    """
    for attempt in range(retries + 1):
        raw = call_claude(system, messages, max_tokens=max_tokens)

        # Strip ```json ... ``` fences if present
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
                    f"Raw response (first 500 chars): {raw[:500]}"
                ) from exc

            # Ask Claude to fix its own output
            messages = messages + [
                {"role": "assistant", "content": raw},
                {
                    "role": "user",
                    "content": (
                        "Your response was not valid JSON. "
                        f"Parse error: {exc}. "
                        "Please return ONLY valid JSON with no markdown fences or extra text."
                    ),
                },
            ]
    # Unreachable but satisfies type checkers
    raise RuntimeError("Unexpected exit from retry loop")
