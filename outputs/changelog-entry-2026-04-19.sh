#!/usr/bin/env bash
# Changelog entry for 2026-04-19. Run from repo root.
# Sandbox could not reach firestore.googleapis.com (EAI_AGAIN); run this
# manually from a network-enabled shell.
node scripts/add-changelog-entry.js \
  "SSR template refactor + security patches" \
  "Replaced 8 [style.--xxx] Ivy bindings with SSR-safe [attr.style] strings. Closed 1 Critical (protobufjs RCE) + 3 Moderate CVEs via npm audit fix. A11y: label/for associations across 5 tool pages." \
  "fix" \
  "2026-04-19"
