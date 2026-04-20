#!/usr/bin/env bash
# Run from /Users/xsantcastx/Documents/1. Projects/xsantcastx
# Sandbox hit `EAI_AGAIN firestore.googleapis.com` again on 2026-04-20.
# These two entries cover what was shipped this run.

set -euo pipefail

node scripts/add-changelog-entry.js \
  "Fix SSR prerender: 27 missing /embed/* tool routes" \
  "Added 27 /embed/* route entries to app-routing.module.ts that were missing after sitemap.xml additions. This closes Root Cause 1 of the prerender worker crashes affecting ~160 routes. Also short-circuits PortfolioService HTTP calls during SSR (no more ng-localhost failures) and adds the OG preview image for /tools/color-palette so social shares render correctly." \
  "Bug Fix" \
  "2026-04-20"

node scripts/add-changelog-entry.js \
  "Char-map tool: fix smart-quote literals breaking TypeScript build" \
  "Lines 501-504 in char-map.component.ts used '''/'''/'\"'/'\"' as character literals (which the TS parser reads as empty strings + stray apostrophes), breaking tsc with 40+ TS1005 errors. Replaced with explicit \\u2018/\\u2019/\\u201C/\\u201D unicode escapes." \
  "Bug Fix" \
  "2026-04-20"
