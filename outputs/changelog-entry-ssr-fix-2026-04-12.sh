#!/bin/bash
cd "$(dirname "$0")/.."
node scripts/add-changelog-entry.js \
  "SSR prerender fix — 135 errors eliminated" \
  "Replaced all typeof window/document guards in HeaderComponent with Angular's isPlatformBrowser(). Eliminates 135 NotYetImplemented errors during prerender that were caused by SSR DOM stubs not implementing CSSStyleDeclaration.setProperty()." \
  "fix" \
  "2026-04-12"
