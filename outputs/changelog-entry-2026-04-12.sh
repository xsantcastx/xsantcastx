#!/usr/bin/env bash
# Changelog entry for the 2026-04-12 Backlog Executor run.
# firestore.googleapis.com still returns 403 blocked-by-allowlist on the
# scheduled-task egress proxy despite being listed in CLAUDE.md's
# sandbox.network.allowedDomains — same persistent blocker from prior runs.
# Run this once from any machine with normal network access to publish it.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/add-changelog-entry.js \
  "Footer TranslationService leak fix" \
  "Tore down the FooterComponent translation subscription on destroy. Mirrors the header and hero fixes from fef89a2 — prevents stacked listeners if the footer is ever lazy-mounted in a future refactor. Defence-in-depth, no user-visible change." \
  "perf" \
  "2026-04-12"
