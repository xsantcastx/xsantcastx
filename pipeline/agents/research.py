"""Agent 1 — Research Agent.

Scrapes Reddit for tool pain points and uses Claude to extract the top 10.
Output: runs/YYYY-MM-DD/01_research.json
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.reddit import collect_all
from utils.claude_client import call_claude_json

SYSTEM = """\
You are a product research analyst specialising in developer and designer tooling.

You will receive a list of Reddit posts where users have expressed pain points or wishes
for tools that don't yet exist (or aren't well known). Your job is to extract the top 10
distinct, actionable tool requests — ranked by how much demand you see across posts.

For each pain point, return:
- rank (1 = most in-demand)
- title: short human-readable pain point title
- problem: 1-2 sentence description of the problem users face
- evidence: a direct quote or close paraphrase from one of the Reddit posts
- subreddit: where the evidence came from
- demand: "high" | "medium" | "low"
- tool_idea: what kind of web-based tool could solve this (1 sentence)

Return ONLY valid JSON matching this schema exactly — no markdown, no extra text:
{
  "pain_points": [
    {
      "rank": 1,
      "title": "...",
      "problem": "...",
      "evidence": "...",
      "subreddit": "...",
      "demand": "high",
      "tool_idea": "..."
    }
  ]
}"""


def run(run_dir: Path) -> dict:
    output_path = run_dir / "01_research.json"

    if output_path.exists():
        print("[research] Output already exists — skipping.")
        return json.loads(output_path.read_text())

    print("[research] Collecting Reddit posts…")
    posts = collect_all()
    print(f"[research] Found {len(posts)} relevant posts across all subreddits.")

    if not posts:
        print("[research] No posts matched keywords. Using empty pain_points list.")
        result = {"pain_points": []}
        output_path.write_text(json.dumps(result, indent=2))
        return result

    # Cap at 100 posts to avoid exceeding context limits
    posts_text = json.dumps(posts[:100], indent=2, ensure_ascii=False)

    result = call_claude_json(
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    "Here are the Reddit posts mentioning tool requests or pain points:\n\n"
                    f"{posts_text}\n\n"
                    "Extract the top 10 pain points and return valid JSON."
                ),
            }
        ],
        max_tokens=4096,
    )

    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"[research] Extracted {len(result.get('pain_points', []))} pain points → {output_path}")
    return result
