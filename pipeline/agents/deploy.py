"""Agent 4 — Deploy & Verify Agent.

Commits generated files, pushes to a branch, creates a PR (or pushes to main),
then polls GitHub Actions and attempts an AI-assisted fix if the build fails.
Output: runs/YYYY-MM-DD/04_deploy.json
"""
import json
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.github_api import create_pr, poll_workflow_run, get_workflow_run_logs
from utils.claude_client import call_claude, HAIKU

REPO_ROOT = Path(__file__).parent.parent.parent

# Maximum CI fix attempts before giving up
MAX_FIX_ATTEMPTS = 2


# ---------------------------------------------------------------------------
# Git helpers
# ---------------------------------------------------------------------------

def _git(*args: str, check: bool = True) -> subprocess.CompletedProcess:
    result = subprocess.run(
        ["git", "-C", str(REPO_ROOT)] + list(args),
        capture_output=True,
        text=True,
        check=False,
    )
    if check and result.returncode != 0:
        raise RuntimeError(
            f"git {' '.join(args)} failed (exit {result.returncode}):\n"
            f"stdout: {result.stdout}\nstderr: {result.stderr}"
        )
    return result


def _configure_git() -> None:
    """Set git identity and inject PAT into remote URL if available."""
    _git("config", "user.name", "xsantcastx-pipeline")
    _git("config", "user.email", "noreply@github.com")

    gh_pat = os.environ.get("GH_PAT", "")
    gh_repo = os.environ.get("GH_REPO", "xsantcastx/xsantcastx")
    if gh_pat:
        remote_url = f"https://x-access-token:{gh_pat}@github.com/{gh_repo}.git"
        _git("remote", "set-url", "origin", remote_url)


def _current_branch() -> str:
    return _git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip()


def _create_branch(branch_name: str) -> None:
    # Check if branch already exists
    result = _git("show-ref", "--verify", f"refs/heads/{branch_name}", check=False)
    if result.returncode == 0:
        _git("checkout", branch_name)
    else:
        _git("checkout", "-b", branch_name)


def _stage_tool_files(slug: str) -> None:
    """Stage the new tool component files and all modified config files."""
    tool_dir = f"src/app/tools/{slug}"
    _git("add", tool_dir)
    _git("add", "src/app/app-routing.module.ts")
    _git("add", "src/app/app.module.ts")
    _git("add", "src/app/tools/tools.component.ts")


def _commit(message: str) -> None:
    result = _git("diff", "--cached", "--quiet", check=False)
    if result.returncode == 0:
        print("[deploy] Nothing staged to commit.")
        return
    _git("commit", "-m", message)


def _push(branch: str) -> None:
    _git("push", "--set-upstream", "origin", branch)


# ---------------------------------------------------------------------------
# CI fix loop helpers
# ---------------------------------------------------------------------------

DIAGNOSE_SYSTEM = """\
You are an Angular build expert. Given CI failure logs and a .component.ts file,
identify WHICH file has the error and what the fix is.
Reply in 3 lines max: FILE: <ts|html|css>, ERROR: <short description>, FIX: <what to change>."""

FIX_TS_SYSTEM   = "Fix the Angular TypeScript build error described. Return ONLY the complete corrected .ts file — no markdown, no explanation."
FIX_HTML_SYSTEM = "Fix the Angular HTML template error described. Return ONLY the complete corrected .html file — no markdown, no explanation."
FIX_CSS_SYSTEM  = "Fix the CSS error described. Return ONLY the complete corrected .css file — no markdown, no explanation."


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```[\w]*\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _attempt_ci_fix(slug: str, run_id: int, attempt: int) -> bool:
    """Read CI logs, ask Claude to diagnose + fix. Returns True if any file changed."""
    print(f"[deploy] Fetching CI logs for run {run_id}…")
    logs = get_workflow_run_logs(run_id)

    tool_dir = REPO_ROOT / "src" / "app" / "tools" / slug
    ts_path   = tool_dir / f"{slug}.component.ts"
    html_path = tool_dir / f"{slug}.component.html"
    css_path  = tool_dir / f"{slug}.component.css"

    ts_content = ts_path.read_text()

    # Step 1: cheap haiku call — identify which file needs fixing
    diagnosis = call_claude(
        system=DIAGNOSE_SYSTEM,
        messages=[{"role": "user", "content":
            f"Logs (last 3000 chars):\n{logs[-3000:]}\n\n"
            f".ts file (first 2000 chars):\n{ts_content[:2000]}\n\nDiagnose."}],
        max_tokens=200, model=HAIKU,
    )
    print(f"[deploy] Diagnosis: {diagnosis.strip()}")

    # Step 2: fix the identified file (plain text, sonnet)
    from utils.claude_client import SONNET
    changed = False
    target = diagnosis.lower()

    if "html" in target:
        html_content = html_path.read_text()
        fixed = _strip_fences(call_claude(
            system=FIX_HTML_SYSTEM,
            messages=[{"role": "user", "content":
                f"Error: {diagnosis}\n\nCurrent HTML:\n{html_content}\n\nReturn fixed HTML."}],
            max_tokens=3000, model=SONNET,
        ))
        if fixed:
            html_path.write_text(fixed)
            print("[deploy] Applied fix to .html")
            changed = True
    elif "css" in target:
        css_content = css_path.read_text()
        fixed = _strip_fences(call_claude(
            system=FIX_CSS_SYSTEM,
            messages=[{"role": "user", "content":
                f"Error: {diagnosis}\n\nCurrent CSS:\n{css_content}\n\nReturn fixed CSS."}],
            max_tokens=2000, model=SONNET,
        ))
        if fixed:
            css_path.write_text(fixed)
            print("[deploy] Applied fix to .css")
            changed = True
    else:
        # Default: fix .ts
        fixed = _strip_fences(call_claude(
            system=FIX_TS_SYSTEM,
            messages=[{"role": "user", "content":
                f"Error: {diagnosis}\n\nCurrent TS:\n{ts_content}\n\nReturn fixed TypeScript."}],
            max_tokens=5000, model=SONNET,
        ))
        if fixed:
            ts_path.write_text(fixed)
            print("[deploy] Applied fix to .ts")
            changed = True

    return changed


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def run(run_dir: Path, date_str: str) -> dict:
    output_path = run_dir / "04_deploy.json"

    if output_path.exists():
        print("[deploy] Output already exists — skipping.")
        return json.loads(output_path.read_text())

    dev_path = run_dir / "03_dev.json"
    if not dev_path.exists():
        raise FileNotFoundError(f"Dev manifest not found: {dev_path}")

    dev = json.loads(dev_path.read_text())
    slug = dev["slug"]
    tool_name = dev["tool_name"]
    deploy_to_main = os.environ.get("DEPLOY_TO_MAIN", "false").lower() == "true"

    _configure_git()

    branch_name = f"automated/{slug}-{date_str}"
    print(f"[deploy] Creating branch: {branch_name}")
    _create_branch(branch_name)

    _stage_tool_files(slug)
    commit_msg = f"feat: add {tool_name} tool [automated]"
    _commit(commit_msg)
    print(f"[deploy] Committed: {commit_msg}")

    if deploy_to_main:
        print("[deploy] DEPLOY_TO_MAIN=true — pushing directly to main.")
        _git("checkout", "main")
        _git("merge", "--ff-only", branch_name)
        _push("main")
        active_branch = "main"
    else:
        print(f"[deploy] Pushing branch {branch_name} and opening PR.")
        _push(branch_name)
        active_branch = branch_name

    result: dict = {
        "slug": slug,
        "tool_name": tool_name,
        "branch": branch_name,
        "deploy_to_main": deploy_to_main,
        "commit_message": commit_msg,
        "pr_url": None,
        "workflow_conclusion": None,
        "fix_attempts": 0,
    }

    # Create PR if not deploying to main
    if not deploy_to_main:
        try:
            pr_body = (
                f"## Automated tool: {tool_name}\n\n"
                f"**Slug:** `/tools/{slug}`\n\n"
                f"This PR was generated automatically by the daily pipeline.\n\n"
                f"### Files added\n"
                + "\n".join(f"- `{f}`" for f in dev["files_written"])
                + "\n\n### Files updated\n"
                + "\n".join(f"- `{f}`" for f in dev["files_updated"])
                + "\n\n---\n🤖 Generated by xsantcastx-pipeline"
            )
            pr = create_pr(
                branch=branch_name,
                title=f"feat: add {tool_name} tool [automated]",
                body=pr_body,
            )
            result["pr_url"] = pr.get("html_url")
            print(f"[deploy] PR created: {result['pr_url']}")
        except Exception as exc:
            print(f"[deploy] WARNING: Could not create PR: {exc}")

    # Poll GitHub Actions
    print(f"[deploy] Polling GitHub Actions for branch {active_branch}…")
    workflow_run = poll_workflow_run(active_branch, timeout_seconds=600, poll_interval=30)
    conclusion = workflow_run.get("conclusion", "unknown")
    run_id = workflow_run.get("id")
    print(f"[deploy] Workflow conclusion: {conclusion}")

    result["workflow_conclusion"] = conclusion
    result["workflow_run_id"] = run_id

    # CI fix loop
    fix_attempt = 0
    while conclusion == "failure" and fix_attempt < MAX_FIX_ATTEMPTS and run_id:
        fix_attempt += 1
        print(f"[deploy] CI failed — attempting fix {fix_attempt}/{MAX_FIX_ATTEMPTS}…")

        changed = _attempt_ci_fix(slug, run_id, fix_attempt)
        if not changed:
            print("[deploy] Claude made no changes — stopping fix loop.")
            break

        _stage_tool_files(slug)
        _commit(f"fix: CI fix attempt {fix_attempt} for {tool_name} [automated]")
        _push(active_branch)

        print(f"[deploy] Pushed fix #{fix_attempt} — re-polling CI…")
        workflow_run = poll_workflow_run(active_branch, timeout_seconds=600, poll_interval=30)
        conclusion = workflow_run.get("conclusion", "unknown")
        run_id = workflow_run.get("id")
        print(f"[deploy] Workflow conclusion after fix {fix_attempt}: {conclusion}")

    result["fix_attempts"] = fix_attempt
    result["final_conclusion"] = conclusion

    output_path.write_text(json.dumps(result, indent=2))
    print(f"[deploy] Saved → {output_path}")

    if conclusion == "success":
        print(f"[deploy] ✓ Pipeline complete! Tool '{tool_name}' deployed successfully.")
    else:
        print(f"[deploy] ✗ Final CI conclusion: {conclusion} after {fix_attempt} fix attempt(s).")

    return result
