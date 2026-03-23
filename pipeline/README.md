# xsantcastx Daily Tool Pipeline

A multi-agent Python system that runs every morning via GitHub Actions and automatically
researches, designs, builds, and deploys a new browser tool to the site.

## How it works

```
Agent 1 — Research   → scrapes Reddit for tool pain points → 01_research.json
Agent 2 — Planning   → picks the best tool to build        → 02_plan.json
Agent 3 — Development → generates Angular component files   → 03_dev.json + source files
Agent 4 — Deploy     → commits, pushes, opens PR, polls CI → 04_deploy.json
```

All agents save their output to `runs/YYYY-MM-DD/` so the pipeline is **resumable** —
if it crashes after Agent 2, restart from Agent 3 without re-running the expensive steps.

## Prerequisites

- Python 3.11+
- `git` configured and authenticated (or `GH_PAT` set)
- An Anthropic API key with access to `claude-opus-4-6`

## Local setup

```bash
cd pipeline
pip install -r requirements.txt
cp .env.example .env
# Edit .env and fill in ANTHROPIC_API_KEY and GH_PAT
```

## Running locally

```bash
# Full pipeline (all 4 agents)
python pipeline/run.py

# Resume from a specific agent (e.g. after fixing a crash)
python pipeline/run.py --from-agent 3

# Run for a specific date (re-uses that date's research/plan if they exist)
python pipeline/run.py --date 2026-03-23

# Start from planning, using a specific date's research
python pipeline/run.py --from-agent 2 --date 2026-03-23
```

## Environment variables

| Variable           | Required | Default                    | Description                                         |
|--------------------|----------|----------------------------|-----------------------------------------------------|
| `ANTHROPIC_API_KEY`| Yes      | —                          | Anthropic API key                                   |
| `GH_PAT`           | Yes      | —                          | GitHub Personal Access Token (repo + workflow scope)|
| `GH_REPO`          | No       | `xsantcastx/xsantcastx`   | GitHub repo in `owner/repo` format                  |
| `DEPLOY_TO_MAIN`   | No       | `false`                    | Set to `true` to push directly to main              |

## GitHub Actions setup

1. Add secrets in **Settings → Secrets and variables → Actions**:
   - `ANTHROPIC_API_KEY` — your Anthropic key
   - `GH_PAT` — a PAT with `repo` and `workflow` scopes

2. Optionally add a **variable** (not secret):
   - `DEPLOY_TO_MAIN` = `true` to auto-merge, or leave unset / `false` for PR-only mode

The workflow runs at **09:00 UTC daily** and can also be triggered manually via
**Actions → Daily Tool Generation Pipeline → Run workflow**.

## What gets committed

The pipeline commits:
- `src/app/tools/<slug>/<slug>.component.ts`
- `src/app/tools/<slug>/<slug>.component.html`
- `src/app/tools/<slug>/<slug>.component.css`
- Updated `src/app/app-routing.module.ts`
- Updated `src/app/app.module.ts`
- Updated `src/app/tools/tools.component.ts`

The `runs/` directory (JSON outputs and logs) is **gitignored** and uploaded as a
GitHub Actions artifact on failure for debugging.

## Agent details

### Agent 1 — Research (`agents/research.py`)

- Hits Reddit's public JSON API (no auth) for 10 subreddits
- Filters posts/comments matching tool-request keywords
- Sends to Claude with a research analysis prompt
- Outputs the top 10 pain points with evidence

### Agent 2 — Planning (`agents/planning.py`)

- Takes the pain points and site context
- Claude selects the single best tool based on SEO value, buildability, and uniqueness
- Outputs a full component spec (inputs, outputs, UI sections, class name, slug)

### Agent 3 — Development (`agents/development.py`)

- Reads the plan
- Reads source of 2 existing tools (`color-palette`, `image-compressor`) as code patterns
- Sends everything to Claude with strict rules matching the site's exact Angular patterns
- Writes generated `.ts`, `.html`, `.css` files to `src/app/tools/<slug>/`
- Updates `app-routing.module.ts`, `app.module.ts`, and `tools.component.ts`

### Agent 4 — Deploy (`agents/deploy.py`)

- Configures git identity and PAT-authenticated remote
- Creates branch `automated/<slug>-<date>`
- Commits and pushes
- Opens a PR to `main` (or pushes directly if `DEPLOY_TO_MAIN=true`)
- Polls GitHub Actions every 30s (up to 10 minutes)
- On failure: reads CI logs, asks Claude for a fix, re-commits and re-pushes (max 2 attempts)

## File structure

```
pipeline/
├── run.py                 # Orchestrator — runs all 4 agents
├── requirements.txt
├── .env.example
├── README.md
├── agents/
│   ├── research.py        # Agent 1
│   ├── planning.py        # Agent 2
│   ├── development.py     # Agent 3
│   └── deploy.py          # Agent 4
└── utils/
    ├── claude_client.py   # Anthropic SDK wrapper
    ├── reddit.py          # Reddit public JSON API helpers
    └── github_api.py      # GitHub REST API helpers
```
