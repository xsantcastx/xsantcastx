"""GitHub REST API helpers.

Uses GH_PAT and GH_REPO environment variables.
"""
import os
import time
import zipfile
import io
import requests

BASE = "https://api.github.com"


def _repo() -> str:
    return os.environ.get("GH_REPO", "xsantcastx/xsantcastx")


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {os.environ['GH_PAT']}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }


# ---------------------------------------------------------------------------
# Pull requests
# ---------------------------------------------------------------------------

def create_pr(branch: str, title: str, body: str, base: str = "main") -> dict:
    """Create a pull request and return the response JSON."""
    url = f"{BASE}/repos/{_repo()}/pulls"
    resp = requests.post(
        url,
        headers=_headers(),
        json={"title": title, "body": body, "head": branch, "base": base},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


# ---------------------------------------------------------------------------
# Actions / workflow runs
# ---------------------------------------------------------------------------

def get_latest_workflow_run(branch: str) -> dict | None:
    """Return the most recent workflow run for a branch, or None."""
    url = f"{BASE}/repos/{_repo()}/actions/runs"
    resp = requests.get(url, headers=_headers(), params={"branch": branch, "per_page": 5}, timeout=20)
    resp.raise_for_status()
    runs = resp.json().get("workflow_runs", [])
    return runs[0] if runs else None


def poll_workflow_run(branch: str, timeout_seconds: int = 600, poll_interval: int = 30) -> dict:
    """Poll until the latest workflow run for *branch* completes.

    Returns the final run dict (check .get('conclusion') for 'success'/'failure').
    Returns {'conclusion': 'timeout', 'status': 'timeout'} if the deadline passes.
    Returns {'conclusion': 'not_found', 'status': 'not_found'} if no run appears.
    """
    deadline = time.time() + timeout_seconds

    # Wait for a run to appear (it may take a few seconds after push)
    run = None
    for _ in range(12):
        run = get_latest_workflow_run(branch)
        if run:
            break
        print("[github] Waiting for workflow run to appear…")
        time.sleep(poll_interval)

    if not run:
        return {"conclusion": "not_found", "status": "not_found"}

    while time.time() < deadline:
        run = get_latest_workflow_run(branch)
        if not run:
            time.sleep(poll_interval)
            continue
        status = run.get("status", "")
        conclusion = run.get("conclusion", "")
        print(f"[github] Workflow run #{run.get('run_number')} — status={status} conclusion={conclusion}")
        if status == "completed":
            return run
        time.sleep(poll_interval)

    return run or {"conclusion": "timeout", "status": "timeout"}


def get_workflow_run_logs(run_id: int, max_chars: int = 12000) -> str:
    """Download and return the text logs for a workflow run.

    The GitHub API returns a zip archive; we extract and concatenate log files.
    """
    url = f"{BASE}/repos/{_repo()}/actions/runs/{run_id}/logs"
    resp = requests.get(url, headers=_headers(), timeout=60, allow_redirects=True)

    if resp.status_code == 404:
        return "Logs not available (404)."
    if resp.status_code != 200:
        return f"Could not fetch logs: HTTP {resp.status_code}"

    try:
        with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
            parts: list[str] = []
            total = 0
            for name in sorted(zf.namelist()):
                if total >= max_chars:
                    break
                try:
                    text = zf.read(name).decode("utf-8", errors="replace")
                    chunk = text[: max_chars - total]
                    parts.append(f"--- {name} ---\n{chunk}")
                    total += len(chunk)
                except Exception:
                    continue
            return "\n".join(parts)
    except zipfile.BadZipFile:
        # Some responses are plain text redirected content
        return resp.text[:max_chars]
