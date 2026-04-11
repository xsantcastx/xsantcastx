#!/usr/bin/env bash
# Owner: run from repo root to publish the 2026-04-11 mobile perf changelog entry.
# The backlog executor couldn't reach firestore.googleapis.com from its sandbox
# (egress allowlist permits only xsantcastx.com).
set -e
cd "$(dirname "$0")/.."
node scripts/add-changelog-entry.js \
  "Mobile homepage perf overhaul — fix lag and navigation" \
  "Throttled scroll handler via rAF, cached section offsets, dropped filter:blur(80px) and backdrop-filter on mobile, disabled hero carousel 3D animation on small viewports, added trackBy to all tool *ngFor loops, enabled content-visibility:auto for below-fold sections. Fixes owner-reported mobile lag bug." \
  "fix" \
  "2026-04-11"
