# Implementation Report — Rendering Optimization Spec

**Spec:** `docs/rendering-optimization-spec.md`
**Implemented:** 2026-06-09 → 2026-06-10
**Verification:** 33-agent workflow — one verifier per spec section, each verdict adversarially challenged by an independent skeptic, plus a completeness critic over the full git diff. **0 of 16 verdicts were overturned.**
**Build evidence:** `npm run typecheck` pass; production build exit 0 (~21s); 264 routes prerendered; 158 lazy chunks.

## Verdict summary

| Section | Status | One-liner |
|---|---|---|
| 1.1 Sun lighting vars | ⚠ Deviated | Vars exist and drive 7 layers; 3 layers hardcode approximations |
| 1.2 Terminator | ✅ Implemented | Exact spec gradient, correctly above surface + clouds |
| 1.3 Fresnel atmosphere rim | ✅ Implemented | Spec CSS verbatim; layer named `__atmosphere-rim` (name collision) |
| 1.4 Ring↔sphere shadows | ✅ Implemented | Both shadows present, Safari-safe masks |
| 1.5 Glint / noise / seam / banding | ✅ Implemented | All five items verified, 5/5 `stitchTiles` |
| 1.6 Moon shading + orbit | ✅ Implemented | Static sun-side gradient; 7% smooth orbit window |
| 2.1 Tiered mobile policy | ⚠ Partial → fixed | Two bugs found by skeptics, both fixed (see below) |
| 2.2 Canvas lite + governor | ✅ Implemented | Exact lite flag, DPR 1.5, halved density, governor |
| 2.3 Viewport / touch / hover | ⚠ Partial | Core items done; tag-lines touch guard + 2 small targets remain |
| 2.4 Breakpoint consolidation | ✅ Implemented | 1080/900/680 gone; two intentional behavior shifts noted |
| 3.1 Tools chunk split | ✅ Implemented | 3.7 MB monolith → 158 chunks, largest tool 124 kB |
| 3.2 Self-hosted fonts | ✅ Implemented | 3 variable WOFF2 subsets, CDN removed |
| 3.3 Paint hygiene | ✅ Implemented | Blur-animation gone, will-change audited, content-visibility added |
| 3.4 Crispness + contrast | ✅ Implemented | 0.5px hairlines @2dppx, 6 contrast fixes, banding overlay |
| 3.5 Images + galaxy lite | ⚠ Deviated | Lazy-img vacuous (no imgs); stars faded not removed |
| Reduced-motion audit | ✅ Implemented | Every new animation covered |
| Phase 4 WebGL planet | ⏭ Skipped | Spec-gated on visual review of the CSS planet — not started by design |

## What was implemented

### Phase 1 — Planet realism (CSS-only)
- `--sun-x: 30%; --sun-y: 27%` on `.cosmic-planet`; sphere, terminator, nightlights mask, glint, highlight, limb, and atmosphere rim all derive their light origin from the vars.
- New layers (all `aria-hidden`, all in HTML + CSS, verified no orphans): `__terminator` (rewritten to the exact spec gradient, z=3 above surface z=1 and clouds z=2 so clouds darken at night), `__atmosphere-rim` (Fresnel arc, spec CSS verbatim), `__sphere-shadow` (conic wedge of planet shadow on the ring's far half), `__ring-shadow` (tilted multiply ellipse of ring shadow on the sphere), `__banding` (2.2% turbulence overlay, kills OLED gradient banding).
- Surface SVG gained a second low-frequency `feTurbulence` octave (continent-scale variation); **all 5** `feTurbulence` elements now carry `stitchTiles='stitch'`, fixing the visible seam every 90s loop.
- Moon: static sun-side highlight gradient; orbit keyframes smoothed over a 7% window (the hard brightness/opacity pop at 50%/62.5% is gone; z-index still steps discretely — CSS can't interpolate it).
- `planetGlow` (animated `filter: blur()` radius = per-frame repaint) replaced by two pre-blurred layers cross-fading via `opacity`/`scale` only.

### Phase 2 — Mobile lite mode
- The blanket `animation: none !important` kill-switch is gone, replaced by the tiered policy: carousel keeps cycling via opacity-only `hcCardCycleFade` (all 5 cards in DOM); planet keeps sphere/terminator/rim/ring/moon animating (clouds, glow pulse, nightlights static; surface drift slowed to 180s); pulsar keeps `pulsarBeat`, drops `pulsarHue` (filter repaints), wander capped ±20px; glass cards get semi-opaque background substitutes for the disabled `backdrop-filter`.
- Canvas lite mode (`src/index.html`): flag = `≤768px OR hardwareConcurrency≤4 OR deviceMemory≤4`; DPR capped 1.5; particle density halved; the O(n²) constellation-line pass skipped entirely; ripples/touch sparks kept. Frame-time governor: rolling 60-frame average >12ms sheds 20% of particles (floor 24), silently.
- `90dvh` hero (with `vh` fallback), `viewport-fit=cover`, `env(safe-area-inset-bottom)` on the footer CTA (nav already had it), 44px touch targets on the three named offenders, `@media (hover: hover)` guards with `:focus-visible` twins kept unconditional, JS card-tilt early-returns on touch.
- Breakpoints consolidated: 1080/900 → 1024, 680 → 480. The 900→1024 mapping was a judgment call (single-column layout is tablet intent); see deviations.

### Phase 3 — Performance + polish
- **3.1:** All 126 tool components converted to standalone via the official `ng g @angular/core:standalone` schematic; 253 routes across `tools-routing` + `embed-routing` rewritten to `loadComponent` with path/title/SEO data preserved verbatim; `tools-page-components.module.ts` deleted. Result: the single ~3.7 MB lazy chunk became per-tool chunks of 3–55 kB (largest: pdf-generator at 124 kB including jspdf), 158 chunks total.
- **3.2:** Orbitron + Inter self-hosted as variable WOFF2 subsets (11/47/83 kB latin + latin-ext for Spanish), `@font-face` with `font-display: swap` + `unicode-range`, two preloads, Google Fonts links and preconnects removed.
- **3.3:** Permanent `will-change` kept only on continuously-animating elements; `.tool-card`'s moved into its `hover:hover` rule; `content-visibility: auto` added to changelog day groups.
- **3.4:** `@media (min-resolution: 2dppx)` block thins decorative hairlines to 0.5px; six contrast fixes (`#7b61ff → #9b86ff` ×2, anchor whisper alpha 0.55 → 0.78, LIVE badge text `#ff3355 → #ff8899` ×3).
- **3.5:** Tools galaxy lite at ≤768px (even orbit rings hidden, even stars faded, arms/dust dimmed, scene tilt eased); galaxy/orbit-star/tool-card hovers guarded by `hover:hover`.

## Bugs found by verification and fixed afterward

The adversarial pass earned its keep — both §2.1 bugs were invisible to the implementer's own checks:

1. **Mobile carousel didn't actually cycle.** The mobile `animation: hcCardCycleFade` shorthand reset `animation-delay` to 0s, so all 5 cards faded in sync (last DOM card always on top). Fixed: `animation-delay: calc(var(--ci, 0) * 5s)` restored after the shorthand.
2. **The 180s surface-drift rule was dead.** The mobile `animation-duration: 180s` was silently overridden by the base `animation:` shorthand later in source order. Fixed with `!important` (matching the neighboring mobile rules).
3. **Stale build artifacts.** `dist/` contained macOS " 2"-suffixed duplicate chunks and prerendered route directories from an older build; deploying as-is would have shipped stale pages. Cleaned, and `dist` rebuilt.

## Deviations from the spec (accepted, with rationale)

- **Spec's own baseline was wrong (biggest one):** the spec (echoing the CLAUDE.md F-2 audit) claimed main.js was 5.47 MB with 125 eager tool components. In reality main.js was 535 kB and the tools were already lazy — but batched into one 3.7 MB chunk. §3.1's *intent* (per-tool chunks) was implemented; the promised "main.js → ~270 kB" framing was never applicable. Initial-bundle size is unchanged, by design.
- **§1.1 single-source-of-truth is partial:** the outer atmosphere glow (38% 34%), moon highlight (33% 30%), and limb mask (135deg) hardcode directionally-consistent approximations instead of `var()` (box-shadow/conic-gradient can't consume position vars; the moon's gradient resolves against its own box). Visually consistent today; would desynchronize if the sun vars were ever changed.
- **§1.3 layer naming:** the Fresnel layer is `__atmosphere-rim`, not the spec's `__atmosphere` — that class name was already taken by the pre-existing outer glow halo. Behavior matches the spec exactly (verified verbatim CSS).
- **§1.6 / §2.1 pulsar + moon animate `top`/`left`:** kept the pre-existing positioning technique (sanctioned by CLAUDE.md §7.4) rather than restructuring to transforms.
- **§2.4 mapping side-effects:** 901–1024px viewports now get the single-column hero (previously 2-col at 901–900…1080 boundary), and 481–680px keeps the 2-column tools grid longer (680→480 mapping). Both judged intent-preserving; flagged here in case a visual pass disagrees. A pre-existing non-canonical 640px block remains.
- **§3.2 one Google Fonts reference survives:** `font-pairer` (the font-pairing *tool*) loads Google Fonts at runtime as its core feature. Intentional; site chrome no longer touches the CDN.
- **§3.5 "star count halved":** implemented as fading even-index stars to 0.08 opacity + hiding even orbit rings via CSS, not halving the rendered count (that would require component-logic changes). Visual goal met; the faded stars remain focusable (see remaining work).
- **§3.5 WebP/AVIF:** vacuously satisfied — there are no in-page `<img>` JPEGs; OG images stay JPEG for crawlers per the spec itself.
- **125 vs 126:** the repo has 126 tool components (spec said 125); all migrated.

## Not implemented (honest list)

- **Phase 4 (WebGL planet)** — spec-gated behind a side-by-side visual review of the Phase 1 CSS planet. Decision pending that review.
- **§5 verification-plan deliverables:** Lighthouse CI budgets (the spec said "add to repo") and the Playwright visual-regression suite were **not** built. All verification in this pass was static code analysis — no runtime/visual/device testing has happened yet. The Phase 1/2/3 acceptance criteria that need a browser (CLS ≤ 0.02, ≥55fps throttled scroll, no horizontal overflow 320–768px, Safari mask+blend rendering, font-swap reflow) are therefore **unverified**, not failed.
- **§2.3 leftovers:** the tag-connection hover lines in `index.html` still have no touch alternative (hover-only feature on touch); `.hp-cat-btn` category pills (~26px tall) weren't in the named touch-target list and remain under 44px.

## Remaining follow-ups (prioritized)

1. **Run the app and look at it** — `/home` and `/tools` at 375/768/1440px, desktop + iPhone Safari. Static analysis can't see rendering. (This is the §5.1 device matrix.)
2. `git add src/assets/fonts/` when committing — the WOFF2 files are untracked while `styles.css`/`index.html` already reference them; a commit without them breaks fonts in deploy.
3. Add Lighthouse CI budgets + Playwright screenshot suite (§5.2–5.3).
4. Touch polish: tap-to-toggle for tag-connection lines; 44px on `.hp-cat-btn`; consider `inert`/`tabindex=-1` on the opacity-0.08 lite-mode orbit stars.
5. Low-risk paint wins found by verifiers outside spec scope: `.cosmic-reveal` and `.cosmic-char` keep permanent `will-change` after their one-shot animations; `body::after` starfield animates `background-position` on a fixed full-viewport element.
6. Governor refinements (§2.2): exclude the first frame after tab-restore from the rolling average; `resize()` rebuilds the particle array and forgets governor sheds.

## Goal/task ledger

| # | Task | Status |
|---|---|---|
| 1 | Phase 1 planet realism | ✅ |
| 2 | Phase 2 mobile lite mode | ✅ (+2 post-verification fixes) |
| 3 | Phase 3.1 tools chunk split | ✅ |
| 4 | Phase 3.2 self-hosted fonts | ✅ |
| 5 | Phase 3.3–3.5 polish | ✅ |
| 6 | Build + typecheck gate | ✅ |
| 7 | Verification workflow (33 agents) | ✅ |
| 8 | This report | ✅ |
