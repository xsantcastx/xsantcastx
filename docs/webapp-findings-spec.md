# Spec — Webapp Findings: What Needs Improvement Next

**Status:** Draft for review
**Source:** Findings from the rendering-spec implementation (June 2026) — 33-agent section verification, adversarial challenges, completeness critic, build/CI observation. Every item below was *observed in the actual code or pipeline*, not speculated.
**Prior context:** `docs/rendering-optimization-spec.md` (the plan), `docs/rendering-implementation-report.md` (what shipped + deviations).

Priorities: **P0** = correctness/trust gaps, **P1** = user-visible quality, **P2** = hygiene and robustness, **P3** = strategic.

---

## A. P0 — Runtime verification harness (the biggest hole)

Everything shipped so far was verified by *static code analysis only*. No browser ever rendered the changes before prod. The spec's §5 deliverables were never built, which means these acceptance criteria are currently **unverified, not passed**:

- CLS ≤ 0.02 (three CLS-relevant changes shipped: variable fonts with different metrics than the CDN fonts, `content-visibility` on changelog days, new planet layers)
- ≥55fps sustained scroll on 6× CPU-throttled Chrome
- No horizontal overflow 320–768px (every landing media block was rewritten)
- Safari rendering of `mask` + `mix-blend-mode` stacks (the planet uses both heavily; Safari is the named risk in the original spec)

### Work items
1. **A-1. Lighthouse CI budgets in repo** — `@lhci/cli` config + GitHub Actions step on PRs: mobile perf ≥ 90, TBT < 200ms, CLS < 0.02 on `/home` and `/tools`. (~half day)
2. **A-2. Playwright visual-regression suite** — screenshots of hero, planet section (animation frozen via `animation-delay` injection), spotlight, footer, galaxy map at 375/768/1440px, Chromium + WebKit. WebKit screenshots are the cheap proxy for the Safari mask/blend risk. (~1 day)
3. **A-3. One manual device pass** — real iPhone + mid-tier Android: carousel cycles, planet animates, touch ripples fire, no overflow, fonts swap cleanly. Record results in the implementation report. (~1 hour, do first)
4. **A-4. Embed surface smoke test** — `/embed/*` routing was rewritten wholesale during the chunk split and no runtime check ever loaded an embed route. Add 2–3 embed URLs to the Playwright suite. (~included in A-2)

---

## B. P1 — Accessibility & touch correctness (real defects found)

1. **B-1. Near-invisible interactive stars on mobile** — `tools.component.css:1115` fades even-index orbit stars to `opacity: 0.08` at ≤768px, but they remain focusable anchors with aria-labels: invisible tap targets for touch users, ghost stops for keyboard/screen-reader users. Fix: `visibility: hidden` (removes from a11y tree and hit-testing) instead of near-zero opacity, or `pointer-events: none` + `tabindex=-1` via template binding.
2. **B-2. Tag-connection lines are hover-only** — `index.html:577–610` attaches mouseover handlers with no touch alternative; the discoverability feature is invisible on mobile. Fix: tap-to-toggle on touch (first tap shows connections, second tap navigates), or accept and document the exclusion.
3. **B-3. Category pills under 44px** — `.hp-cat-btn` (`landing.component.css:718–731`) measures ~25–27px tall; it was outside the original touch-target list. Bump padding/min-height ≤768px.
4. **B-4. Hover-anchor stale coordinates** — the constellation-tooltip anchor is captured once at `mouseover` (`index.html:~582`) and reused per frame; scrolling while hovering draws lines to the wrong place. Re-read `getBoundingClientRect` per frame (cheap, one element) or on scroll.
5. **B-5. Reduced-motion parked states** — two un-designed end states: the moon has no parked position when `planetMoonOrbit` is stopped (lands at center-bottom default), and all 5 stacked carousel cards sit at `opacity: 1` with semi-transparent backgrounds bleeding through each other. Design explicit static states (moon parked at orbit's near point; only first card visible).

---

## C. P1 — Rendering consistency fixes (planet + breakpoints)

1. **C-1. Sun-variable desynchronization** — three layers hardcode approximations of `--sun-x/--sun-y` instead of deriving from them: outer atmosphere glow at `38% 34%` (`landing.component.css:2247,2262`), moon highlight at `33% 30%` (`:2576`), limb mask at `135deg` (`:2420`). Visually consistent today; silently breaks if the sun vars change. Fix the glow (can take `var()` directly); document the moon/limb/box-shadow cases with a `--sun-x/--sun-y dependents` comment block so future edits update them together.
2. **C-2. Conic wedge anchor mismatch** — the sphere-shadow's `from 140deg` + 210deg stop places the dark band near the ring's *top*, not opposite the sun as the comment claims (`:2531`). Re-derive the angle or fix the comment after a visual check (this is exactly what A-2's frozen-animation screenshot will show).
3. **C-3. Breakpoint behavior shifts need a visual verdict** — two intentional-but-unreviewed changes from the 1080/900/680→1024/768/480 consolidation: 901–1024px viewports now get the single-column hero; 481–680px keeps the 2-column tools grid. Eyeball both bands (A-3) and either accept or re-tune.
4. **C-4. Leftover non-canonical/dead CSS** — `@media (max-width: 640px)` planet-sizing block (`landing.component.css:2662`, pre-existing); dead `rotateX(14deg)` scene rule shadowed by the 768px block (`tools.component.css:1054`); dead `.hp-tools__search*` rules matching no markup (`landing.component.css:663–707`); unreferenced `.lp-card__live-badge`/`.lp-text__eyebrow` styles (`styles.css:1310,1486` — my contrast fix touched dead code); two disjoint 480px blocks that should merge. One cleanup pass, ~1 hour, zero behavior change.

---

## D. P2 — Performance round 2

### Paint hygiene leftovers (found by verifiers, outside the original spec's named items)
1. **D-1. Permanent `will-change` after one-shot animations** — `.cosmic-reveal` (`styles.css:357`) and `.cosmic-char` (`styles.css:506`) keep `will-change` forever after their entrance animations finish; every revealed section and every type-on character stays compositor-promoted. Fix: remove via `animationend` in the engine, or just delete the hints (the one-shot animations don't need pre-promotion).
2. **D-2. `body::after` starfield** — animates `background-position` over 90s on a fixed full-viewport element: infinite, non-composited, full-screen repaint band. Convert to a transform-based drift on an oversized pseudo-element (same pattern the planet surface should eventually use).

### Canvas engine robustness (`src/index.html`)
3. **D-3. Governor blind spots** — first frame after tab-restore injects a huge rAF delta into the rolling average (clamp samples to ~100ms); `resize()` rebuilds the particle array to full density, discarding governor sheds (carry the shed factor through resize); 60Hz displays sit at ~16.7ms deltas permanently above the 12ms threshold — **verify the governor isn't constantly shedding to the floor on normal displays**; consider keying on frames-over-33ms instead.
4. **D-4. Static lite/DPR capture** — `lite` and `dpr` are computed once at init: rotating a tablet across 768px or dragging between monitors keeps the stale mode. Re-evaluate both inside `resize()`.

### Bundle round 2
5. **D-5. Lazy-load Firebase on the routes that use it** — the CLAUDE.md F-2 quick win still stands: `@angular/fire/firestore`, auth, functions are in the initial bundle but only used on /guestbook + /donate. ~100–150 kB transfer saved for home/tools visitors. The 634 kB shared vendor chunk (`chunk-I35J33AB`) is the target — run `npm run analyze:why` first.
6. **D-6. FontAwesome from cdnjs** — the last render-relevant third-party CDN. Subset to the icons actually used (likely <30) into a self-hosted woff2 or inline SVGs; also removes a preconnect.
7. **D-7. font-pairer decision** — the tool legitimately loads Google Fonts at runtime (`font-pairer.component.ts:140`). Decide: add a route-local preconnect for snappier previews, or accept as-is. One line either way; just make it a decision instead of an accident.

---

## E. P2 — Ops & pipeline findings

1. **E-1. Daily Tool Generation Pipeline is failing** — the scheduled run on 2026-06-09 failed after 43s (observed in `gh run list`, run 27199353229). Unrelated to the rendering work but it's the pipeline that ships new tools. Pull its logs, diagnose, fix. **Do this first in this group — broken automation rots silently.**
2. **E-2. Deploy hygiene** — local `dist/` accumulated macOS " 2"-suffixed duplicate chunks *and entire stale prerendered route directories* (cleaned this round). CI builds fresh so prod was never at risk, but any manual `firebase deploy` from a dirty local dist would ship stale pages. Add `rm -rf dist` to the build script (`"prebuild": "rimraf dist"` or shell equivalent).
3. **E-3. Sitemap merge conflicts** — `src/sitemap.xml` is generated output committed to git; it conflicted on rebase and will again every time local and CI both regenerate it. Either gitignore it and generate only at build time (CI already does), or accept recurring noise.

---

## F. P3 — Strategic / gated

1. **F-1. Phase 4 WebGL planet — run the decision gate.** The CSS planet now has its full lighting model. Per the original spec: side-by-side screenshot review (A-2 artifacts give you this for free) → decide whether the ≤40 kB OGL shader sphere is worth building. Note the project CLAUDE.md anti-goals say no heavyweight 3D library; the OGL/raw-WebGL path was designed to respect that, but the decision should be explicit.
2. **F-2. Spec/docs drift** — CLAUDE.md still describes the pre-split bundle ("5.47 MB main.js", "tool components standalone: false", F-2b as future work) and the old planet structure. Update §5/§9 to reflect the shipped state so the next session doesn't plan against stale facts. (The same drift produced this round's wrong baseline — the original spec inherited the 5.47 MB claim and the implementation had to correct course mid-flight.)
3. **F-3. Error tracking** (CLAUDE.md E-6, still open) — all this new client-side animation/engine code has zero crash visibility. Sentry's free tier on the browser bundle would cover it; gate its script behind the existing consent service.

---

## Suggested sequencing

| Order | Items | Effort | Why first |
|---|---|---|---|
| 1 | A-3 manual device pass, E-1 pipeline failure | ~2h | Cheapest validation of everything already live; broken automation |
| 2 | B-1, B-3, B-5 (a11y defects), C-2 visual check | ~half day | User-facing defects, all small CSS/template fixes |
| 3 | A-1, A-2, A-4 (CI harness) | ~2 days | Locks in everything; makes C-3/F-1 reviews free |
| 4 | C-1, C-4, D-1–D-4 (consistency + paint/canvas hygiene) | ~1 day | Quality compounding, zero-risk cleanups |
| 5 | D-5, D-6 (bundle round 2) | ~1 day | Measurable transfer wins |
| 6 | E-2, E-3, F-2 (hygiene/docs), then F-1, F-3 decisions | ~half day + decisions | Close the loop |
