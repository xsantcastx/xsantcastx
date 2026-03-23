"""Agent 2 — Planning Agent.

Uses claude-haiku (cheap) — just picking from a list.
Output: runs/YYYY-MM-DD/02_plan.json
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.claude_client import call_claude_json, HAIKU

SITE_CONTEXT = """\
Site: xsantcastx.web.app — Angular 20 module-based, dark glassmorphism theme
Existing tools (do NOT suggest): pdf-generator, color-palette, contrast-checker, image-compressor
Coming soon (skip): gradient-generator, font-pairer
Target users: web devs, designers, indie hackers"""

SYSTEM = f"""\
You are a product strategist. Pick the SINGLE BEST browser tool to build today.
It MUST: run fully in-browser (no backend), be one Angular component, have high SEO value,
not duplicate existing tools.

{SITE_CONTEXT}

Return ONLY valid JSON — no markdown:
{{
  "tool": {{
    "name": "Tool Name",
    "slug": "url-slug",
    "description": "One sentence under 100 chars",
    "seo_title": "Title under 65 chars | xsantcastx",
    "seo_description": "Meta description under 160 chars",
    "seo_keywords": "keyword1, keyword2",
    "why_chosen": "2 sentences",
    "pain_point_addressed": "which pain point",
    "component_spec": {{
      "purpose": "1 sentence",
      "inputs": ["input1"],
      "outputs": ["output1"],
      "ui_sections": ["Section 1"],
      "key_features": ["Feature 1"],
      "angular_class_name": "MyToolComponent",
      "angular_selector": "app-my-tool"
    }},
    "tags": ["Tag1", "Tag2", "Tag3"]
  }}
}}"""


def run(run_dir: Path) -> dict:
    output_path = run_dir / "02_plan.json"
    if output_path.exists():
        print("[planning] Output already exists — skipping.")
        return json.loads(output_path.read_text())

    research = json.loads((run_dir / "01_research.json").read_text())
    pain_points = research.get("pain_points", [])

    if pain_points:
        # Send only titles + tool ideas to keep tokens low
        summary = [{"rank": p["rank"], "title": p["title"], "tool_idea": p["tool_idea"],
                    "demand": p["demand"]} for p in pain_points]
        user_msg = f"Pain points:\n{json.dumps(summary, ensure_ascii=False)}\n\nPick the best tool. Return JSON."
    else:
        user_msg = "No data available. Pick the best browser tool from your knowledge. Return JSON."

    result = call_claude_json(
        system=SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
        max_tokens=800,
        model=HAIKU,
    )

    tool = result.get("tool", {})
    if not tool.get("slug"):
        raise ValueError(f"No slug in plan: {result}")

    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"[planning] Tool: {tool.get('name')} (slug: {tool.get('slug')})")
    print(f"[planning] Why: {tool.get('why_chosen','')[:100]}")
    return result
