#!/usr/bin/env python3
"""Daily tool-generation pipeline orchestrator.

Runs all 4 agents in sequence. If a previous run partially completed,
already-saved JSON outputs are skipped so the pipeline is resumable.

Usage:
  python pipeline/run.py                # run all agents
  python pipeline/run.py --from-agent 3 # restart from agent 3 (development)
  python pipeline/run.py --date 2026-03-23 # rerun for a specific date
"""
import argparse
import os
import sys
import traceback
from datetime import date
from pathlib import Path

# Load .env if present (local development)
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env")
    load_dotenv(Path(__file__).parent / ".env.local", override=True)
except ImportError:
    pass  # python-dotenv not installed — rely on environment variables

# Make sure the pipeline package is importable regardless of CWD
sys.path.insert(0, str(Path(__file__).parent))

from agents import research, planning, development, deploy


def _validate_env() -> None:
    missing = [k for k in ("ANTHROPIC_API_KEY",) if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}\n"
            "Copy pipeline/.env.example to pipeline/.env and fill in the values."
        )


def _make_run_dir(date_str: str) -> Path:
    repo_root = Path(__file__).parent.parent
    run_dir = repo_root / "runs" / date_str
    run_dir.mkdir(parents=True, exist_ok=True)
    return run_dir


def main() -> int:
    parser = argparse.ArgumentParser(description="xsantcastx daily tool pipeline")
    parser.add_argument(
        "--from-agent",
        type=int,
        default=1,
        choices=[1, 2, 3, 4],
        metavar="N",
        help="Start from agent N (1=research, 2=planning, 3=development, 4=deploy). "
             "Defaults to 1 (full run). Prior agents' outputs must exist.",
    )
    parser.add_argument(
        "--date",
        default=None,
        help="Run date in YYYY-MM-DD format (defaults to today).",
    )
    args = parser.parse_args()

    date_str = args.date or date.today().isoformat()
    from_agent = args.from_agent

    print(f"{'=' * 60}")
    print(f"  xsantcastx daily tool pipeline")
    print(f"  Date: {date_str}")
    print(f"  Starting from agent: {from_agent}")
    print(f"{'=' * 60}\n")

    _validate_env()
    run_dir = _make_run_dir(date_str)
    print(f"Run directory: {run_dir}\n")

    agents = [
        (1, "Research",     lambda: research.run(run_dir)),
        (2, "Planning",     lambda: planning.run(run_dir)),
        (3, "Development",  lambda: development.run(run_dir)),
        (4, "Deploy",       lambda: deploy.run(run_dir, date_str)),
    ]

    for agent_num, agent_name, agent_fn in agents:
        if agent_num < from_agent:
            print(f"[{agent_num}/{len(agents)}] {agent_name} — skipped (--from-agent={from_agent})")
            continue

        print(f"\n{'─' * 60}")
        print(f"[{agent_num}/{len(agents)}] Running {agent_name} Agent…")
        print(f"{'─' * 60}")

        try:
            agent_fn()
        except Exception:
            print(f"\n[FATAL] {agent_name} Agent failed with an unhandled exception:")
            traceback.print_exc()
            print(
                f"\nTo resume from this step, run:\n"
                f"  python pipeline/run.py --from-agent {agent_num} --date {date_str}"
            )
            return 1

        print(f"[{agent_num}/{len(agents)}] {agent_name} Agent — done.\n")

    print(f"\n{'=' * 60}")
    print("  Pipeline completed successfully!")
    print(f"{'=' * 60}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
