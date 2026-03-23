"""Agent 1 — Research Agent.

Uses claude-haiku (cheap) — just extracting structured data from posts.
Output: runs/YYYY-MM-DD/01_research.json
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.reddit import collect_all
from utils.claude_client import call_claude_json, HAIKU

SYSTEM_FROM_POSTS = """\
You are a product research analyst. Given posts mentioning tool pain points, extract the
top 10 distinct, actionable tool requests ranked by demand.

Return ONLY valid JSON — no markdown, no extra text:
{
  "pain_points": [
    {
      "rank": 1,
      "title": "...",
      "problem": "1-2 sentences",
      "evidence": "quote or paraphrase",
      "subreddit": "source community",
      "demand": "high|medium|low",
      "tool_idea": "1 sentence browser-based tool idea"
    }
  ],
  "source": "reddit_or_hn"
}"""

SYSTEM_FROM_KNOWLEDGE = """\
You are a product research analyst. No live data available. Generate the top 10 most
in-demand developer/designer tool pain points that a free browser-based tool could address.
Focus on high SEO value, no-backend tools.

Return ONLY valid JSON — no markdown, no extra text:
{
  "pain_points": [
    {
      "rank": 1,
      "title": "...",
      "problem": "1-2 sentences",
      "evidence": "Commonly reported in webdev/programming communities",
      "subreddit": "synthesized",
      "demand": "high",
      "tool_idea": "1 sentence browser-based tool idea"
    }
  ],
  "source": "claude_knowledge"
}"""


def run(run_dir: Path) -> dict:
    output_path = run_dir / "01_research.json"
    if output_path.exists():
        print("[research] Output already exists — skipping.")
        return json.loads(output_path.read_text())

    print("[research] Collecting posts…")
    posts = collect_all()
    print(f"[research] Collected: {len(posts)} posts")

    if posts:
        # Trim posts to reduce tokens: title + first 200 chars of selftext only
        trimmed = [{"title": p["title"], "text": p["selftext"][:200],
                    "source": p.get("subreddit","?"), "kw": p.get("matched_keyword","")}
                   for p in posts[:60]]
        result = call_claude_json(
            system=SYSTEM_FROM_POSTS,
            messages=[{"role": "user", "content":
                f"Posts:\n{json.dumps(trimmed, ensure_ascii=False)}\n\nExtract top 10 pain points. Return JSON."}],
            max_tokens=2500,
            model=HAIKU,
        )
    else:
        print("[research] No posts — asking Claude for pain points from knowledge.")
        result = call_claude_json(
            system=SYSTEM_FROM_KNOWLEDGE,
            messages=[{"role": "user", "content":
                "Generate top 10 developer tool pain points. Return JSON."}],
            max_tokens=2500,
            model=HAIKU,
        )

    count = len(result.get("pain_points", []))
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"[research] {count} pain points → {output_path}")
    return result
