# Agent brief — read this instead of long prompts

You are building **Eclipse Realms** (Angular 21 SSR, Firebase). The task prompt tells you WHAT; this file is HOW.
Keep token use lean: read the handoff summaries for the systems you touch (`docs/handoff/<name>.md`), not whole
design bibles, unless the task says "your spec". Don't re-read large files you've already read; grep first.
Find files via `docs/agents/SYSTEMS.md` before searching.

## Setup (once)
1. If your branch has no commits: `git fetch origin && git reset --hard origin/main` (or the base the task names).
2. `ln -s "/Users/xsantcastx/Documents/1. Projects/xsantcastx/node_modules" node_modules` if missing.
3. Before any gate, move untracked sync duplicates out of the tree (they make local checks lie):
   `find src -name "* [0-9].*" -type f` minus `git ls-files` → move to your scratchpad. Never `git add` "<name> 2.*".

## Rules (owner)
Everything needs meaning (source, use, lore, visible) — `npm run -s check:meaning`. Terraria is the art/feel reference.
Gold only, never real money. Stations: one plain primary action. Phones: ≥44px, nothing over the centre 50%.
Lore is pre-approved: write it, ship it, log it in `docs/world/lore-addendum.md` ("shipped — owner reviews in play").
New player text goes in LAZY i18n tables, EN + ES. Saved state only through the save gateway, merge-safe.
Never push, deploy, or touch `firestore.rules`, `functions/`, or market flags.

## The gate (run ONCE at the end, long steps in the background — the disk is slow)
```
npm run -s check:meaning
npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.spec.json
node --test scripts/seamworks-engine.test.cjs scripts/homestead.test.cjs scripts/home-forge.test.cjs scripts/delve-endless.test.cjs
node scripts/check-ds-adherence.js && node scripts/check-i18n-keys.js && node scripts/audit-nav.js
node scripts/economy-sim.mjs --check
npm run build            # initial < 1.85 MB; then: git checkout -- src/sitemap.xml
node scripts/verify-csp-hashes.js
npx ng test --watch=false --browsers=ChromeHeadless --include='<the specs you touched>'
PW_PORT=<your own free port> npx playwright test e2e/play- --project=chromium
```
Run the full play suite once, after your last code change. If one spec fails, rerun just it; if it passes alone, say
so and move on. In specs that assert English copy, `localStorage.setItem('preferred-language','en')` in `beforeEach`.

## Finish
Commit (end messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), write a short handoff
`docs/handoff/<feature>.md`, update `docs/roadmap/ROADMAP.md`. Final report ≤ 40 lines: branch, head sha, what a
player gets, gate results, anything unverified. Screenshots go in `output/<feature>/` (not committed).
