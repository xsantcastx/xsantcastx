#!/usr/bin/env bash
# Commit + push the hero carousel hardening shipped by the backlog executor
# on 2026-04-11. The file edits are already on disk in your working tree;
# this script just stages them, writes the commit message, and pushes.
#
# Context: the flicker + counter bug from Notion task
# 33ee6899-f10e-8148-99db-dff97d29b406 had its primary cause (14→5 cards)
# fixed in commit 6b9c548. This follow-up hardens the fix so:
#   • the counter cannot regress to the "01:016" timer-lookalike,
#   • the card cap is enforced by a named constant + runtime warn,
#   • a11y + pointer-events stop the carousel from stealing focus.
#
# The scheduled backlog executor could not commit from its sandbox because
# .git/index.lock is immutable there. Run this from the repo root on a
# machine with normal git access.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [[ -f .git/index.lock ]]; then
  echo "Removing stale .git/index.lock..."
  rm -f .git/index.lock
fi

git add \
  src/app/landing/landing.component.ts \
  src/app/landing/landing.component.html \
  src/app/landing/landing.component.css

git commit -m "fix(landing): harden hero carousel — padded counter, pointer-events guard, invariant

The flickering red/orange overlay + malformed 01:016 counter the owner
reported on 2026-04-10 had its primary cause fixed in 6b9c548 by capping
the hero carousel to 5 cards. This follow-up hardens the fix so the bug
cannot silently regress and removes the timer-lookalike UX confusion.

Changes:
- Extract HERO_CAROUSEL_MAX constant + runtime warning if the slice ever
  drifts past the invariant the CSS keyframes were tuned for.
- Precompute HeroCarouselCard view models with padStart(2,'0') index
  and total labels. The previous template used hardcoded '0' prefixes
  (0{{i+1}}/0{{len}}) that would render as '010/010' once the count
  crossed 10 — exactly the kind of silent regression that produced
  '01/014' in the original bug.
- Space out the counter separator ('01 / 05' not '01/05') and add a
  comment clarifying this is a card index, not a timer — the owner
  explicitly reported mistaking it for a broken mm:ss clock.
- aria-hidden the rotating carousel so screen readers stop announcing
  meaningless cycling previews, and add pointer-events:none on cards
  so invisible slots can't catch ghost clicks during fade transitions.

Verified from the sandbox:
- npx tsc --noEmit --project tsconfig.app.json: clean
- ng build --configuration production: 209 routes prerendered, 20.4s

Related: task [BUG] Homepage tool cards flickering + broken cycling
preview overlay (Notion 33ee6899-f10e-8148-99db-dff97d29b406)."

git push origin main

echo ""
echo "Pushed. Homepage will redeploy on next CI run."
echo "Don't forget to publish the changelog entry:"
echo "  node scripts/add-changelog-entry.js \\"
echo "    \"Homepage carousel hardening\" \\"
echo "    \"Hero carousel counter is now properly zero-padded and a11y-friendly; the card cap is enforced by an invariant so the flickering overlay bug cannot regress.\" \\"
echo "    \"fix\" \\"
echo "    \"2026-04-11\""
