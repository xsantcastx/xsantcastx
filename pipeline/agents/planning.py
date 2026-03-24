"""Agent 2 — Planning Agent (multi-agent debate).

Flow:
  1. 3 Proposer agents (Haiku) — each proposes a DIFFERENT tool idea
  2. 1 Critic agent   (Haiku) — critiques all 3 proposals
  3. 1 Judge agent    (Sonnet) — picks winner + emits full tool spec

Falls back to single-agent planning if the debate pipeline fails.
Output: runs/YYYY-MM-DD/02_plan.json
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.claude_client import call_claude, call_claude_json, HAIKU, SONNET

SITE_CONTEXT = """\
Site: xsantcastx.web.app — Angular 20 module-based, dark glassmorphism theme
Existing tools (do NOT suggest): pdf-generator, color-palette, contrast-checker, image-compressor
Coming soon (skip): gradient-generator, font-pairer
Target users: web devs, designers, indie hackers"""

# ── Proposer ──────────────────────────────────────────────────────────────────

_COMPLEXITY_CAP = "COMPLEXITY CAP: The proposed tool must have at most 4 TypeScript methods, at most 3 UI sections, and must use zero external npm packages."

PROPOSER_SYSTEM = f"""\
You are a product strategist. Your job is to propose ONE browser tool idea.
It MUST: run fully in-browser (no backend), be one Angular component, have high SEO value,
not duplicate existing tools.

{_COMPLEXITY_CAP}

{SITE_CONTEXT}

You will be told which proposal number you are (1, 2, or 3). Each proposer MUST suggest a
DIFFERENT tool — read the constraint in the user message carefully.

Return ONLY valid JSON — no markdown:
{{
  "proposal_number": 1,
  "tool_name": "Tool Name",
  "slug": "url-slug",
  "description": "One sentence under 100 chars",
  "target_seo_keywords": "keyword1, keyword2, keyword3",
  "build_complexity": 3,
  "why_it_solves_pain_point": "2 sentences"
}}"""


def _run_proposers(user_msg_base: str) -> list[dict]:
    """Run 3 proposer agents in sequence, passing prior proposals as context."""
    proposals = []
    prior_slugs: list[str] = []

    for i in range(1, 4):
        if prior_slugs:
            exclusion = f"\n\nPrevious proposals (you MUST suggest something DIFFERENT): {', '.join(prior_slugs)}"
        else:
            exclusion = ""

        user_msg = (
            f"You are Proposer {i} of 3.{exclusion}\n\n"
            f"Proposal number field must be {i}.\n\n"
            f"{user_msg_base}"
        )

        proposal = call_claude_json(
            system=PROPOSER_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
            max_tokens=512,
            model=HAIKU,
        )
        proposals.append(proposal)
        slug = proposal.get("slug", f"proposal-{i}")
        prior_slugs.append(slug)
        print(f"[planning/proposer-{i}] {proposal.get('tool_name')} (slug: {slug})")

    return proposals


# ── Critic ────────────────────────────────────────────────────────────────────

CRITIC_SYSTEM = """\
You are a sharp product critic. You will receive 3 tool proposals and must critique each one.
Evaluate: SEO competition, build risk, existing alternatives, and traffic potential.
Be concise but specific — 2-3 sentences per proposal.

Return ONLY valid JSON — no markdown:
{
  "critiques": [
    {
      "proposal_number": 1,
      "slug": "url-slug",
      "seo_competition": "low/medium/high",
      "build_risk": "low/medium/high",
      "existing_alternatives": "Notable alternatives or 'none'",
      "traffic_potential": "low/medium/high",
      "overall": "2-3 sentence summary"
    }
  ]
}"""


def _run_critic(proposals: list[dict]) -> dict:
    user_msg = f"Proposals to critique:\n{json.dumps(proposals, indent=2, ensure_ascii=False)}"
    critique = call_claude_json(
        system=CRITIC_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
        max_tokens=1024,
        model=HAIKU,
    )
    print(f"[planning/critic] Critiqued {len(critique.get('critiques', []))} proposals")
    return critique


# ── Judge ─────────────────────────────────────────────────────────────────────

JUDGE_SYSTEM = f"""\
You are the final decision-maker. You receive 3 tool proposals and their critiques.
Pick the SINGLE BEST tool to build and produce its complete spec.

{_COMPLEXITY_CAP}

{SITE_CONTEXT}

Return ONLY valid JSON — no markdown:
{{
  "judge_rationale": "3-4 sentences explaining why you chose this tool over the others",
  "winning_proposal_number": 1,
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


def _run_judge(proposals: list[dict], critique: dict) -> dict:
    user_msg = (
        f"Proposals:\n{json.dumps(proposals, indent=2, ensure_ascii=False)}\n\n"
        f"Critiques:\n{json.dumps(critique, indent=2, ensure_ascii=False)}\n\n"
        "Pick the winner and return the full tool spec."
    )
    result = call_claude_json(
        system=JUDGE_SYSTEM,
        messages=[{"role": "user", "content": user_msg}],
        max_tokens=2048,
        model=SONNET,
    )
    winner = result.get("winning_proposal_number", "?")
    print(f"[planning/judge] Winner: proposal #{winner} — {result.get('tool', {}).get('name')}")
    return result


# ── Fallback (original single-agent) ─────────────────────────────────────────

FALLBACK_SYSTEM = f"""\
You are a product strategist. Pick the SINGLE BEST browser tool to build today.
It MUST: run fully in-browser (no backend), be one Angular component, have high SEO value,
not duplicate existing tools.

{_COMPLEXITY_CAP}

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


def _run_fallback(user_msg_base: str) -> dict:
    print("[planning] Running fallback single-agent planning...")
    return call_claude_json(
        system=FALLBACK_SYSTEM,
        messages=[{"role": "user", "content": user_msg_base + "\n\nPick the best tool. Return JSON."}],
        max_tokens=800,
        model=HAIKU,
    )


# ── Main entry point ──────────────────────────────────────────────────────────

def run(run_dir: Path) -> dict:
    output_path = run_dir / "02_plan.json"
    if output_path.exists():
        print("[planning] Output already exists — skipping.")
        return json.loads(output_path.read_text())

    research = json.loads((run_dir / "01_research.json").read_text())
    pain_points = research.get("pain_points", [])

    if pain_points:
        summary = [
            {"rank": p["rank"], "title": p["title"], "tool_idea": p["tool_idea"], "demand": p["demand"]}
            for p in pain_points
        ]
        user_msg_base = f"Pain points:\n{json.dumps(summary, ensure_ascii=False)}"
    else:
        user_msg_base = "No research data available. Use your knowledge of web dev / designer tooling."

    # ── Debate pipeline ───────────────────────────────────────────────────────
    try:
        proposals = _run_proposers(user_msg_base)
        critique = _run_critic(proposals)
        judge_result = _run_judge(proposals, critique)

        tool = judge_result.get("tool", {})
        if not tool.get("slug"):
            raise ValueError(f"Judge returned no slug: {judge_result}")

        result = {
            "tool": tool,
            "debate_log": {
                "proposals": proposals,
                "critiques": critique.get("critiques", []),
                "judge_rationale": judge_result.get("judge_rationale", ""),
                "winning_proposal_number": judge_result.get("winning_proposal_number"),
            },
        }

    except Exception as exc:
        print(f"[planning] Debate failed ({exc}) — falling back to single-agent.")
        fallback = _run_fallback(user_msg_base)
        tool = fallback.get("tool", {})
        if not tool.get("slug"):
            raise ValueError(f"No slug in fallback plan: {fallback}") from exc
        result = {
            "tool": tool,
            "debate_log": {
                "proposals": [],
                "critiques": [],
                "judge_rationale": f"Fallback used due to debate error: {exc}",
                "winning_proposal_number": None,
            },
        }

    output_path.write_text(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"[planning] Tool: {result['tool'].get('name')} (slug: {result['tool'].get('slug')})")
    print(f"[planning] Why: {result['tool'].get('why_chosen', '')[:100]}")
    return result
