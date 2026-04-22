#\!/usr/bin/env bash
# Changelog entry for QoL batch 2 (2026-04-11) — Firestore write
# The scheduled agent couldn't reach firestore.googleapis.com from the sandbox.
# Run this from any machine with network access to the project's Firestore.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/add-changelog-entry.js \
  "Design token migration (batch 2)" \
  "Migrated 170 hardcoded status colors across 56 tool CSS files to three new global semantic tokens (--error-color, --warning-color, --info-color) in src/styles.css. Future palette tweaks are now a one-file edit. Follows the 2026-04-03 batch that handled the top 5 offenders." \
  "infrastructure" \
  "2026-04-11"
