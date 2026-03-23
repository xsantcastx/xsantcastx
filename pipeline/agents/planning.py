"""Agent 2 — Planning Agent.

Takes the research output and uses Claude to pick the single best tool to build today.
Output: runs/YYYY-MM-DD/02_plan.json
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.claude_client import call_claude_json

# ------------------------------------------------------------------
# Context about the site that Claude needs to make a good decision
# ------------------------------------------------------------------
SITE_CONTEXT = """\
Site: xsantcastx.web.app
Framework: Angular 20, module-based (NOT standalone components), TypeScript
Backend: Firebase (Firestore, Auth, Hosting)
UI theme: dark glassmorphism, neon accents (#00ffcc cyan, #7b61ff purple)
CSS variables: --primary-color, --secondary-color, --highlight-color, --surface-color,
               --surface-strong, --surface-hover, --glass-border, --text-color, --text-muted,
               --radius-md, --radius-lg, --font-heading (Orbitron), --font-body (Inter)
Target users: web developers, designers, indie hackers, freelancers

Existing tools at /tools (DO NOT suggest these):
  - pdf-generator:      PDF Catalog Generator (upload images → export PDF)
  - color-palette:      Color Palette Extractor (dominant colors from image → HEX/RGB/HSL/CSS)
  - contrast-checker:   WCAG Contrast Checker (color pair accessibility)
  - image-compressor:   Image Compressor (JPEG/PNG/WebP, batch, no upload)

Coming soon (also skip these):
  - gradient-generator
  - font-pairer
"""

SYSTEM = f"""\
You are a product strategist and SEO expert specialising in developer tools.

Given a list of pain points found on Reddit, select the SINGLE BEST tool to build for
a developer/designer tools website. The tool MUST:

1. Have high SEO search volume — people actively search for this kind of tool online
2. Run entirely in the browser — no server, no file uploads to a backend, no external APIs
3. Be implementable as a single Angular component (~200-400 lines of TypeScript)
4. NOT duplicate an existing tool on the site (see site context below)
5. Solve a clear, evidenced pain point from the research

Site context:
{SITE_CONTEXT}

Return ONLY valid JSON matching this schema exactly — no markdown, no extra text:
{{
  "tool": {{
    "name": "Human-Readable Tool Name",
    "slug": "url-slug-lowercase-hyphens",
    "description": "One sentence shown on the tools card (under 100 chars)",
    "seo_title": "SEO page title under 65 characters including | xsantcastx",
    "seo_description": "Meta description under 160 characters",
    "seo_keywords": "comma, separated, seo, keywords",
    "why_chosen": "2-3 sentences explaining why this beats the alternatives",
    "pain_point_addressed": "Which ranked pain point this solves",
    "component_spec": {{
      "purpose": "What the component does (1 sentence)",
      "inputs": ["list", "of", "user", "inputs"],
      "outputs": ["list", "of", "outputs"],
      "ui_sections": ["Input Section", "Output Section"],
      "key_features": ["Feature 1", "Feature 2"],
      "angular_class_name": "MyToolNameComponent",
      "angular_selector": "app-my-tool-name"
    }},
    "tags": ["Tag1", "Tag2", "Tag3"]
  }}
}}"""


def run(run_dir: Path) -> dict:
    output_path = run_dir / "02_plan.json"

    if output_path.exists():
        print("[planning] Output already exists — skipping.")
        return json.loads(output_path.read_text())

    research_path = run_dir / "01_research.json"
    if not research_path.exists():
        raise FileNotFoundError(f"Research output not found: {research_path}")

    research = json.loads(research_path.read_text())

    result = call_claude_json(
        system=SYSTEM,
        messages=[
            {
                "role": "user",
                "content": (
                    "Here are the top pain points discovered from Reddit:\n\n"
                    f"{json.dumps(research, indent=2, ensure_ascii=False)}\n\n"
                    "Select the single best tool to build today and return valid JSON."
                ),
            }
        ],
        max_tokens=2048,
    )

    tool = result.get("tool", {})
    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"[planning] Selected tool: {tool.get('name')} (slug: {tool.get('slug')})")
    print(f"[planning] Why chosen: {tool.get('why_chosen', '')[:120]}")
    print(f"[planning] Saved → {output_path}")
    return result
