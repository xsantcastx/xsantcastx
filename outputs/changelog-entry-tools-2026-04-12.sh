#\!/usr/bin/env bash
cd "$(dirname "$0")/.."
node scripts/add-changelog-entry.js \
  "2 New Tools: SEO Checker, Encoding Converter" \
  "SEO Checker with live SERP preview, keyword density, and OG preview. Encoding Converter with 9 formats, hex dump, and character table." \
  "feature" \
  "2026-04-12"
