# Spec — Perfect Rendering: Realistic Planets, Flawless UI, Mobile + Desktop

**Status:** Draft for review
**Scope:** Landing page (`/home`), global cosmic engine (`src/index.html`, `src/styles.css`), tools galaxy (`/tools`), and the responsive/performance foundation underneath all of it.
**Goal:** The site should render pixel-perfect and feel *alive* on every device — phones included — while the planets and cosmic visuals move from "stylized" to "believable."

The vibe target stays the same as CLAUDE.md: *"feel like Anthropic's Earth demo."* This spec is about closing the gap between the current CSS-gradient planets and that bar, without breaking the zero-3D-library architecture unless we explicitly opt in (Phase 4).

---

## 0. Current state (baseline facts)

| Area | Today | File |
|---|---|---|
| Planet | Pure CSS: radial-gradient sphere + SVG `feTurbulence` surface/clouds + tilted ring + orbiting moon | `src/app/landing/landing.component.css:2108–2361` |
| Pulsar | Radial-gradient orb, 3 keyframe animations, cursor-reactive via CSS vars | `src/styles.css:532–606` |
| Starfield | 2D canvas, 60–140 particles, DPR-aware (capped 2×), parallax + ripples + constellation lines | `src/index.html:304–635` |
| Mobile strategy | **Kill switch**: ≤768px disables `backdrop-filter`, carousel cycling, all infinite animations | `landing.component.css:1954–2035` |
| Bundle | main.js **5.47 MB raw / ~816 kB gzip** — 125 tool components eagerly declared | `package.json`, app module |
| Breakpoints | Canonical 480/768/1024 in `styles.css`, but landing uses 1080/900/680/480 | `styles.css:1–25` vs `landing.component.css:1836–2035` |
| Reduced motion | Fully handled (CSS + JS guards) — keep as-is | global |

The two structural problems this spec fixes:

1. **Mobile is "dead."** The current ≤768px strategy is animation slaughter — the site that "should never feel dead" feels dead on the device most visitors use. We need a *lite mode*, not an off switch.
2. **Planet realism plateaus.** Gradient + noise gets 80% there; the missing 20% is a real lighting model: a soft terminator, rim atmosphere (Fresnel), ring↔sphere shadowing, and a specular sun glint.

---

## 1. Phase 1 — Planet realism (CSS-first, no new libraries)

All changes in `landing.component.css` (`.cosmic-planet*`) unless noted. These are layer additions/tuning, not a rewrite — the 9-layer z-index stack stays.

### 1.1 Lighting model: pick one sun and obey it
Define a single light direction as CSS vars on `.cosmic-planet` and derive every shadow/highlight from it:

```css
.cosmic-planet { --sun-x: 30%; --sun-y: 27%; } /* matches existing gradient origin */
```

Audit every layer (sphere, surface, clouds, ring, moon, glow) so highlights all originate from `(--sun-x, --sun-y)`. Today the moon's brightness is keyed to orbit phase only — its shading must also flip relative to the sun side.

### 1.2 Terminator (day/night line)
Add a dedicated shadow layer instead of baking darkness into the base gradient:

```css
.cosmic-planet__terminator {
  /* oversized radial gradient offset opposite the sun; soft 12–18% falloff band */
  background: radial-gradient(circle at var(--sun-x) var(--sun-y),
    transparent 0 52%, rgba(2, 6, 18, 0.55) 68%, rgba(1, 3, 10, 0.92) 100%);
}
```

This sits **above** surface + clouds (clouds must darken at night too — that's the #1 realism tell in the current version, where clouds glow uniformly).

### 1.3 Atmospheric rim (Fresnel)
A thin bright arc on the sunlit limb + a faint blue scatter ring on the entire edge:

```css
.cosmic-planet__atmosphere {
  inset: -2.5%;
  border-radius: 50%;
  background: radial-gradient(circle at var(--sun-x) var(--sun-y),
    transparent 60%, rgba(120, 200, 255, 0.0) 70%, rgba(140, 215, 255, 0.35) 84%, transparent 92%);
  mix-blend-mode: screen;
  filter: blur(1.5px);
}
```

Use the existing brand blue (`#5fb6ff` family) so it stays on-palette.

### 1.4 Ring ↔ sphere shadows (the Saturn test)
Two shadows, both currently missing:

- **Sphere's shadow on the ring:** a `conic-gradient` dark wedge masked onto the ring's far half, anchored opposite the sun.
- **Ring's shadow on the sphere:** a thin curved dark band across the lower sphere — an absolutely-positioned ellipse, `transform: rotateX(74deg) rotateZ(-16deg)` matching the ring's existing tilt, clipped to the sphere with `border-radius: 50%` + `overflow: hidden` on a wrapper.

These two shadows are what make a flat ring read as a 3D annulus.

### 1.5 Specular glint + surface depth
- A small, tight white highlight near `(--sun-x, --sun-y)` with `mix-blend-mode: overlay`, pulsing very subtly (opacity 0.18→0.26 over ~14s).
- Second `feTurbulence` octave on the surface SVG at lower `baseFrequency` for continent-scale variation (current single frequency reads as uniform static). Keep both as data URIs — no network requests.
- **Texture seam fix:** `planetSurface` animates `background-position` 0%→200%; verify the SVG noise tiles seamlessly (`stitchTiles="stitch"` on `feTurbulence`) — currently unset, which causes a visible seam every 90s loop.

### 1.6 Moon correctness
- Shade the moon with its own mini terminator pointing at the sun (static gradient is fine).
- Current orbit drops `z-index` and opacity at hard keyframe stops (`62.5%`) — ease `filter: brightness()` over a 6–8% keyframe window so it doesn't "pop" behind the planet.

**Acceptance (Phase 1):** screenshot at 1×/2× DPR shows: visible soft terminator, dark-side clouds, rim glow on sun side only, ring shadow on sphere + sphere shadow on ring, no texture seam over a full 90s loop, no new layout shift (CLS delta 0).

---

## 2. Phase 2 — Mobile: from kill-switch to lite mode

**Principle:** on mobile, keep everything that's compositor-only (`transform`, `opacity`) and cut everything that's paint/layout-heavy (`backdrop-filter`, large blurs, `background-position` animation, per-frame canvas work at full density).

### 2.1 Replace the blanket `animation: none !important` (≤768px)
In `landing.component.css:1954–2035`, replace the nuke with a tiered policy:

| Effect | Desktop | Mobile lite |
|---|---|---|
| Hero carousel | 25s 3D cycle | Keep cycling, but **cross-fade only** (`opacity`, no `rotateY`/`translateX` stack, no `backdrop-filter`) |
| Pulsar | full (beat + hue + wander) | Keep `pulsarBeat` (transform scale only); drop `pulsarHue` (filter) and shrink wander to ±20px |
| Planet | all layers | Keep sphere, terminator, atmosphere, ring, moon orbit. Drop: cloud layer animation (static clouds), `planetGlow` blur pulsing (static blur), surface drift → slow it to 180s instead of removing |
| Starfield canvas | 60–140 particles, lines | ~40 particles, **no constellation lines** (the O(n²) pass), DPR capped at 1.5, ripples kept (they're the touch feedback) |
| Type-on headings | 28ms stagger per char | Keep — it's cheap (CSS animation, one-shot) |
| `backdrop-filter` | glassy cards | Stays off (current behavior is right) — substitute semi-opaque `background-color` per card so glass look survives |

### 2.2 Canvas lite mode (`src/index.html`)
- Add a `lite` flag: `matchMedia('(max-width: 768px)')` OR `navigator.hardwareConcurrency <= 4` OR `navigator.deviceMemory <= 4` (where available).
- In lite mode: particle density halved, skip the connection-line loop, cap DPR at 1.5.
- Add a **frame-time governor**: if average frame time over a rolling 60-frame window exceeds 12ms, drop particle count 20% (floor of 24) — self-tuning instead of device sniffing. Log nothing; just adapt.

### 2.3 Viewport + layout correctness
- Hero: replace `90vh` in `min-height: clamp(600px, 90vh, 900px)` with `90dvh` (fallback line with `vh` first) — fixes the mobile URL-bar jump.
- Add `viewport-fit=cover` to the viewport meta + `env(safe-area-inset-*)` padding on the fixed nav and footer CTA (notched iPhones).
- Touch targets: audit all tappable elements ≥ 44×44px (carousel hint, changelog toggles, social icons are the likely offenders).
- `@media (hover: hover)` guard on every hover-revealed affordance (card tilt, tag-connection lines) — on touch, replace with tap-to-toggle or always-visible state. Nothing may be reachable *only* via hover.

### 2.4 Breakpoint consolidation
Migrate landing's 1080/900/680 queries to the canonical 480/768/1024 tokens (`styles.css:1–25`). One-time mechanical pass; do it in this phase since we're rewriting those media blocks anyway.

**Acceptance (Phase 2):** on a mid-tier Android (or 6× CPU-throttled Chrome): planet + pulsar + starfield all visibly animate; scroll at sustained ≥55fps; Lighthouse mobile TBT < 200ms; no horizontal overflow 320px–768px; every interactive element usable by touch alone.

---

## 3. Phase 3 — Rendering performance + UI polish (both platforms)

### 3.1 Bundle (the single biggest win — 60% of mobile load time)
Migrate the 125 eagerly-declared tool components to `standalone: true` + route-level `loadComponent`. Expected: main.js ~816 kB gzip → ~270 kB gzip. This is already on the CLAUDE.md runway; this spec makes it a blocker for "perfect rendering" because no amount of animation tuning beats 550 kB less JS on first paint.

Mechanical recipe per tool: add `standalone: true` + `imports`, delete from module `declarations`, switch route to `loadComponent`. Batch 10–15 per PR; `npm run analyze` after each batch to confirm the chunk split.

### 3.2 Fonts
Self-host Orbitron + Inter as subset WOFF2 (`@font-face` + `font-display: swap`, preload the two above-the-fold weights). Removes the Google Fonts CDN round-trip (DNS+TLS+CSS+font = ~300–500ms on mobile) and a CLS source.

### 3.3 Paint hygiene
- Verify every infinite animation is compositor-only: `pulsarHue` uses `filter` (paints every frame at desktop sizes — acceptable on desktop, already cut on mobile); `planetGlow` animates `blur()` radius (repaints — replace with two pre-blurred layers cross-fading via `opacity`).
- Keep `content-visibility: auto` sections as-is (already correct); add it to the changelog list items (long list).
- `will-change` audit: only on elements actually animating *now* (hover-applied via class, removed on rest). Permanent `will-change` on many layers = compositor memory pressure on mobile.

### 3.4 UI rendering crispness
- **Half-pixel blur check:** centered elements using `translate(-50%, -50%)` on odd-sized containers render blurry text/borders. Audit pulsar, planet, modal, boot splash; round to whole pixels (`translate3d` with rounded values or even-numbered dimensions).
- Borders/hairlines: use `0.5px` borders only behind `min-resolution: 2dppx` guard; 1px otherwise.
- Gradient banding on the planet's dark side (visible on OLED): add a 2% noise overlay (reuse the existing data-URI turbulence at low opacity, `mix-blend-mode: overlay`) on `.cosmic-planet__sphere`.
- Contrast pass: all text on nebula washes ≥ 4.5:1 (the amber/mint category accents on dark glass are the likely failures).

### 3.5 Images & misc
- OG/preview JPEGs → also emit WebP/AVIF with `<picture>`/`srcset` where rendered in-page; keep JPEG for crawlers.
- `loading="lazy"` + explicit `width`/`height` (or `aspect-ratio`) on every below-fold `<img>` — CLS insurance.
- Tools galaxy page: apply the same lite-mode policy (tilt off on touch, star count halved ≤768px).

**Acceptance (Phase 3):** Lighthouse mobile ≥ 90 perf / ≥ 95 a11y on `/home` and `/tools`; main.js ≤ 300 kB gzip; CLS ≤ 0.02; no blurry text at 1×/1.25×/2× DPR; fonts swap without visible reflow.

---

## 4. Phase 4 (optional, opt-in) — WebGL planet upgrade path

Only if Phase 1 doesn't hit the realism bar after review. Keep it surgical:

- A single lazy-loaded standalone component (`<app-cosmic-planet-gl>`) using **raw WebGL or OGL (~9 kB)** — *not* full Three.js — rendering one sphere with a day/night/normal/cloud shader (same noise generated procedurally in-shader, zero texture downloads).
- Progressive enhancement: render the Phase 1 CSS planet first (also the SSR/prerender output and the reduced-motion/lite-mode fallback); swap in the GL canvas only when `requestIdleCallback` fires, WebGL is available, and not in lite mode.
- Hard budget: ≤ 40 kB gzip for component + shaders, ≤ 2ms GPU frame time at 1080p.

**Decision gate:** side-by-side screenshot review of Phase 1 CSS planet vs. reference before any Phase 4 work starts.

---

## 5. Verification plan (every phase)

1. **Device matrix:** Chrome desktop (1×, 2×), Safari macOS, iPhone Safari (notched), mid-tier Android Chrome, iPad. Each: visual pass + scroll-perf trace.
2. **Lighthouse CI budgets** (add to repo, run on `npm run build`): perf ≥ 90 mobile, TBT < 200ms, CLS < 0.02, main.js ≤ 300 kB gzip (Phase 3 onward).
3. **Visual regression:** Playwright screenshot tests for hero, planet section (at 0s/5s/45s animation timestamps via `animation-delay` freeze), spotlight, footer — at 375px, 768px, 1440px. Catches gradient/mask regressions in Safari, which renders `mask` + `mix-blend-mode` differently.
4. **Reduced-motion audit** after every phase: `prefers-reduced-motion: reduce` must still show a complete, static, *good-looking* page (the existing fallbacks must cover all new layers — terminator, atmosphere, etc., which are static anyway).
5. **Manual "alive" check** on a real phone: tap sparks fire, planet animates, nothing janks. This is the test the kill-switch approach currently fails.

## 6. Sequencing & effort

| Phase | Effort | Risk | Depends on |
|---|---|---|---|
| 1 — Planet realism | 2–3 days | Low (additive CSS layers) | — |
| 2 — Mobile lite mode | 3–4 days | Medium (touches global engine in `index.html`) | — |
| 3 — Perf + polish | 1.5–2 weeks (mostly the standalone migration) | Medium (125 components, mechanical but wide) | — |
| 4 — WebGL planet | 3–5 days | Medium | Gate after Phase 1 review |

Phases 1 and 2 are independent and can run in parallel. Phase 3's standalone migration can start immediately in batches. Phase 4 only on explicit go.
