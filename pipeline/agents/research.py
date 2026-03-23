"""Agent 1 — Research Agent.

Collects tool pain points from Reddit (primary) or HN (fallback),
then uses Claude to extract the top 10. If both sources return 0 results,
Claude generates pain points from its own knowledge of common developer needs.

Output: runs/YYYY-MM-DD/01_research.json
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.reddit import collect_all
from utils.claude_client import call_claude_json

SYSTEM_FROM_POSTS = """\
You are a product research analyst specialising in developer and designer tooling.

You will receive posts/comments where users have expressed pain points or wishes
for tools that don't yet exist (or aren't well known). Extract the top 10
distinct, actionable tool requests — ranked by how much demand you see.

For each pain point return:
- rank (1 = most in-demand)
- title: short human-readable pain point title
- problem: 1-2 sentence description of the problem users face
- evidence: a direct quote or close paraphrase from one of the posts
- subreddit: the source community (subreddit name or "HackerNews")
- demand: "high" | "medium" | "low"
- tool_idea: what kind of browser-based tool could solve this (1 sentence)

Return ONLY valid JSON — no markdown, no extra text:
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
  ],
  "source": "reddit_or_hn"
}"""

SYSTEM_FROM_KNOWLEDGE = """\
You are a product research analyst specialising in developer and designer tooling.

No live community data is available today. Based on your knowledge of common pain points
expressed by web developers, designers, indie hackers, and freelancers in communities like
Reddit (r/webdev, r/programming, r/SideProject) and Hacker News, generate the top 10
most in-demand tool pain points for which a free browser-based tool would be valuable.

Focus on problems where:
- People frequently search for a solution online
- A simple, single-page browser tool could address it
- The tool does NOT require a backend or file storage

Return ONLY valid JSON — no markdown, no extra text:
{
  "pain_points": [
    {
      "rank": 1,
      "title": "...",
      "problem": "...",
      "evidence": "Commonly reported in r/webdev and similar communities",
      "subreddit": "synthesized",
      "demand": "high",
      "tool_idea": "..."
    }
  ],
  "source": "claude_knowledge"
}"""


def run(run_dir: Path) -> dict:
    output_path = run_dir / "01_research.json"

    if output_path.exists():
        print("[research] Output already exists — skipping.")
        return json.loads(output_path.read_text())

    print("[research] Collecting posts from community sources…")
    posts = collect_all()
    print(f"[research] Total relevant posts collected: {len(posts)}")

    if posts:
        posts_text = json.dumps(posts[:100], indent=2, ensure_ascii=False)
        result = call_claude_json(
            system=SYSTEM_FROM_POSTS,
            messages=[{
                "role": "user",
                "content": (
                    "Here are the posts mentioning tool requests or pain points:\n\n"
                    f"{posts_text}\n\n"
                    "Extract the top 10 pain points and return valid JSON."
                ),
            }],
            max_tokens=4096,
        )
    else:
        print("[research] No posts from any source — asking Claude to generate pain points from knowledge.")
        result = call_claude_json(
            system=SYSTEM_FROM_KNOWLEDGE,
            messages=[{
                "role": "user",
                "content": (
                    "No live community data is available today. "
                    "Generate the top 10 developer/designer tool pain points from your knowledge. "
                    "Return valid JSON."
                ),
            }],
            max_tokens=4096,
        )

    count = len(result.get("pain_points", []))
    source = result.get("source", "unknown")
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"[research] {count} pain points extracted (source: {source}) → {output_path}")
    return result
