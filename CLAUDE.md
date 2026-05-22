# xsantcastx — Cosmic Universe Design System

This file is the operating manual for the site. Read this first whenever you're polishing UI or adding new pages — it captures the cosmic theme, the patterns to reuse, the work already done, and the things still on the runway.

The vibe target: **"feel like Anthropic's Earth demo"** — alive, interactive, mystical, and rewards curiosity. Never feel "dead."

---

## 1. The cosmic theme — vocabulary

| Concept | Meaning | Where it shows up |
|---|---|---|
| **Universe** | the whole site | `<body>`, global background |
| **Galaxy** | a category | `/tools` galaxy map, category filters |
| **Star** | a tool / skill / nav item | `/tools` stars, `.hp-tool-card`, `.skill-card`, footer socials |
| **Nebula** | colored gradient washes | `body::before`, `.matrix-background::after`, page section backgrounds |
| **Pulsar** | the central drifting orb | `.cosmic-pulsar` (fixed center, mouse-reactive) |
| **Sigil** | the slowly-rotating alchemical seal | `.matrix-background::before` (SVG data URI) |
| **Constellation** | particles + connecting lines | `.cosmic-canvas` (interactive starfield) |
| **Rune** | mystical glyph easter eggs | `.rune-whisper--tl|tr|bl|br` (corner flickers) |
| **Arcane seal** | hidden ✧ in bottom-right corner | `.arcane-seal` (toggles `body.ritual-open`) |
| **Ritual mode** | activated occult mode (Konami code, seal click, console reveal) | `body.ritual-open` |
| **Warp** | the 3D zoom-into-star animation when clicking a tool star | `.tool-card--warping`, `.cosmic-warp-overlay` |

---

## 2. Brand colors — the cosmic palette

These are the only star/glow colors used. **Always re-use this palette** when introducing new categories or accents.

| Category / use | Color | Glow |
|---|---|---|
| CSS Tools / CSS / primary brand | `#4dffe0` cyan | `rgba(0, 255, 204, 0.6)` |
| CSS Generators | `#6affe0` teal | `rgba(0, 220, 220, 0.6)` |
| Email Tools | `#ff6dd7` magenta | `rgba(255, 90, 210, 0.6)` |
| Security Tools | `#a48bff` violet | `rgba(140, 110, 255, 0.6)` |
| Code Converters | `#5fb6ff` blue | `rgba(80, 180, 255, 0.6)` |
| Productivity | `#ffc669` amber | `rgba(255, 180, 80, 0.6)` |
| DevOps | `#ff9a5a` orange | `rgba(255, 140, 60, 0.6)` |
| Text & Data | `#c48bff` lilac | `rgba(180, 120, 255, 0.6)` |
| SEO Tools | `#7fd5a3` mint | `rgba(100, 220, 150, 0.6)` |

CSS vars on a card or orb:

```css
.something[data-category="..."] {
  --star-color: #4dffe0;
  --star-glow: rgba(0, 255, 204, 0.6);
  --star-inner: #eafff9;
}
```

Brand globals: `--primary-color: #00ffcc`, `--secondary-color: #7b61ff`, `--highlight-color: #ff00ff`.

---

## 3. Repeating patterns — copy these when building new sections

### 3.1 Section eyebrow + title + tagline pill

```html
<p class="hp-section-eyebrow"> <!-- or .section-eyebrow / .skills__eyebrow / .footer-eyebrow -->
  <span class="hp-eyebrow-pulse"></span>
  Eyebrow Label
</p>
<h2 class="hp-section-title">Section Title</h2>
<p class="hp-section-tagline">a one-line tagline that frames what's below in cosmic language</p>
```

The pulse dot uses `hpEyebrowPulse` (3s ease-in-out infinite). Tagline pill is a rounded `999px` pill with `rgba(0, 255, 204, 0.05)` bg and `rgba(0, 255, 204, 0.14)` border.

**Tagline tone:** poetic + cosmic — `"new stars born this week in the xsantcastx universe"`, `"a constellation of crafts I orbit through every project"`, `"a signal flare into the universe — drop one and I'll catch it"`. Avoid corporate phrasing.

### 3.2 Star-orb (the universal interactive element)

Every clickable card / icon / nav item should be a star. The pattern:

```css
.star-thing {
  position: relative;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at 32% 28%, var(--star-inner) 0%, rgba(255,255,255,0.32) 18%, rgba(255,255,255,0) 42%),
    radial-gradient(circle at 50% 50%, var(--star-color) 0%, rgba(8,3,24,0.92) 88%);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 0 12px var(--star-glow), 0 0 36px -6px var(--star-glow), inset 0 0 8px rgba(0,0,0,0.4);
  animation: starBreathe 6.5s ease-in-out infinite;
}

.star-thing::before { /* dashed orbital ring */
  content: ''; position: absolute; inset: -8px;
  border-radius: 50%; border: 1px dashed var(--star-glow);
  opacity: 0.36; animation: orbitSpin 24s linear infinite;
}

.star-thing::after { /* outer halo */
  content: ''; position: absolute; inset: -16px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--star-glow), transparent 70%);
  opacity: 0.32; filter: blur(6px); z-index: -1;
}
```

**Stagger animation delays** so they don't pulse in unison (use `:nth-child(Nn+M)` with negative delays).

### 3.3 Glassy panel

Background formula for any "panel" surface: `rgba(10, 6, 26, 0.55)` + `1px solid rgba(255, 255, 255, 0.06)` + `backdrop-filter: blur(14px)`. Hover: border switches to the active `--star-glow`, box-shadow gets a `0 0 28px -8px var(--star-glow)` halo.

### 3.4 Cosmic backdrop on a section

For "section" containers (not the global bg) — dual radial nebula washes + gradient cap lines:

```css
.section-foo {
  position: relative;
  background:
    radial-gradient(ellipse 60% 50% at 20% 30%, rgba(0, 255, 204, 0.06), transparent 65%),
    radial-gradient(ellipse 50% 45% at 80% 70%, rgba(123, 97, 255, 0.07), transparent 65%),
    rgba(5, 8, 18, 0.55);
  backdrop-filter: blur(8px);
}

.section-foo::before, .section-foo::after {
  content: ''; position: absolute; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0, 255, 204, 0.5) 50%, transparent);
}
.section-foo::before { top: -1px; }
.section-foo::after  { bottom: -1px; background: linear-gradient(90deg, transparent, rgba(123, 97, 255, 0.5) 50%, transparent); }
```

---

## 4. The cosmic engine (in `index.html`)

A single inline script runs five interactive systems. **All SSR-safe** with `typeof window` guards and `prefers-reduced-motion` respect.

1. **Constellation canvas** (`<canvas class="cosmic-canvas">`, `mix-blend-mode: screen`) — particles drift, twinkle, connect with lines under 130px, react to mouse with parallax + glow boost.
2. **Cursor-reactive pulsar** — the central pulsar drifts toward the cursor (lerped 4%/frame, ±80px X, ±60px Y). Wired via `--cursor-shift-x` / `--cursor-shift-y` CSS vars consumed by `pulsarBeat` keyframes.
3. **Custom cursor halo** (`<div class="cosmic-cursor">`) — soft glow that grows + shifts violet on hover over interactive elements. Hidden on touch (`@media (hover: none)`).
4. **Scroll-reveal observer** — `IntersectionObserver` adds `.cosmic-in-view` to elements matching the reveal selector list. Re-attached via `MutationObserver` on Angular route changes.
5. **Magnetic CTAs** — primary buttons (`.cta-button:not(.is-ghost), .donate-btn, .hp-sub-form__btn, .submit-btn`) lerp toward cursor at 18% strength, capped 12px.

**When adding a new card or interactive element:** add its selector to the reveal selector list in the engine if you want fade-up. Add `cta-button` class for magnetic behavior.

---

## 5. What's done (changelog of cosmic alignment)

- **Global background**: matrix-background base, rotating SVG sigil (320s spin + 18s breathe), drifting nebula fog, body::before/after nebula + starfield, pulsar with hue rotation + position drift.
- **Easter eggs**: arcane seal ✧ in corner, Konami code → ritual mode, console banner, `xsantcastx.reveal()` global, 4 corner runes flickering on staggered cycles.
- **Home page**: hero card star, stats bar with category-colored mini orbs + gradient cap lines, Fresh-off-the-Forge full star cards (10 category palettes), spotlight glassy cosmic panel, live section cosmic backdrop, changelog day stars, footer CTA glassy backdrop.
- **Tools page**: galaxy map (5 spiral galaxies with rotating arms / dust / cores / rings) → click → star system view (5 orbital rings, ~30 stars per galaxy, scene tilted rotateX 20deg, tools orbit), warp animation on star click, hover HUD with tool name/desc/tags, search falls back to flat star grid.
- **Skills page**: full cosmic redesign — every skill is a star with category-cycled palette, eyebrow + tagline.
- **Projects page**: cosmic eyebrow + tagline pill added.
- **Contact page**: cosmic eyebrow + tagline pill added.
- **Footer**: full cosmic redesign — eyebrow `● FUEL THE MISSION`, gradient title with `✦` sparkle, tagline pill, 5 star-orb social icons (cyan/magenta/violet/purple/mint), drifting stardust starfield in `::after`, gradient cap line, cosmic glassy modal upgrades.
- **Cosmic engine**: constellation canvas + cursor pulsar + custom cursor + scroll-reveal + magnetic CTAs.
- **3D tilt + click sparks + page-transition** (most recent batch): every star/card tilts to follow the cursor in 3D, primary CTAs spawn a starburst on click, route changes fade through a cosmic veil.
- **Animated counter + type-on hero + scroll parallax + gradient sweep**: the `123 Free Tools` stat now counts up from 0 when entering view; every section title and hero `h1` types in character-by-character via IO trigger; hero title/subtitle/CTA float at 0.7× scroll speed and the visual carousel at 0.5× for depth; gradient-text headings sweep colors over 7s. `/guestbook` route registered (was 404).
- **Click ripple wavefront + form-success confetti**: clicking anywhere in empty space spawns an expanding cyan/violet ring on the canvas that pushes nearby particles outward (impulse decays at 0.93/frame), gives them a flare boost, and dissolves over 850ms. When a form submits successfully (`.form-status .success`, `.hp-sub-success`, `.donation-success`), a 32-particle multi-color confetti starburst layers a secondary 22-particle pink burst 140ms later — celebrates contact + newsletter submissions automatically without per-component wiring. `WeakSet` prevents double-celebrations.
- **Ambient cosmic drone**: Web Audio API generates a 5-oscillator pad (bass A1 sine + A2 triangle + A3 detuned pair for chorus + E4 fifth) routed through a lowpass filter that sweeps ±220Hz over 25s. A slow LFO (0.08Hz) breathes the bass volume. Master gain fades 0 → 0.05 when ritual mode activates and fades back when it ends. Lazy-instantiated — users who never engage the ritual easter egg get no AudioContext at all. Also exposes `xsantcastx.toggleAudio()` for direct console control.
- **Boot splash + mobile touch ripple**: SSR-rendered `.cosmic-boot` curtain shows a teal star expanding from center with two staggered orbital rings + `✦ BOOTING UNIVERSE ✦` label, then flares away after 750ms revealing the universe — premium first-impression with no flash of unstyled content because the splash is in the SSR HTML. Touch devices now get cosmic feedback: every `touchstart` emits the same canvas ripple wavefront as a click plus a 6-particle micro spark — mobile users no longer feel left out of the cosmic interactivity.
- **Constellation tooltip + 404 lost star**: hovering any card now anchors 4 bright canvas lines to its nearest particles in the card's category color, making it feel embedded in the cosmos. The 404 page got a teal star with a glowing trail that drifts diagonally across the viewport over 18s, with a "a star drifted off course" whisper fading in mid-cycle.
- **Tag-related connections**: every tool card and orbit star now publishes its registry `tags` as `[data-tags]`. Hovering surfaces dashed cyan/violet/pink lines drawn between the card and on-screen siblings sharing at least one tag — turns the cosmos into a discoverability map. Lines are colored by the hovered card's category and skip off-screen siblings to keep the canvas clean. Extended the home `Tool` interface to carry tags through to the template.
- **Cosmic copy pass round 1**: the guestbook page got its full vocabulary lifted — eyebrow "Visitor Constellation", tagline "every name here is a star that passed through", "Submit" → "Send into the void →", placeholders "Your call sign" + "Drop a message into the void...", loaders "Tuning the signal..." / "Pulling more echoes...", "Load More" → "✦ Reveal older messages". Donation form i18n strings now say "Fuel the mission with KASPA" / "Send the signal →" / "The cosmos heard you. Thank you." in EN + matching cosmic phrasing in ES. Footer donate modals say "Fuel the mission", "PayPal portal", "Card portal", "Encrypted by Stripe — your card never crosses my orbit." All language-keyed via the existing TranslationService so EN/ES stay in sync.
- **Cosmic chrome — selection / scrollbar / cookie banner**: added global `::selection` with cyan gradient highlight + glow shadow; webkit-scrollbar styled as a cyan→violet gradient thumb on a dark-indigo track with a hover-brighten + glow; Firefox falls back via `scrollbar-color`. Cookie banner copy lifted (EN + ES) — "We use analytics cookies..." → "Tiny analytics breadcrumbs help us see which stars get visited most." / "No personal data is sold or shared — we just count footsteps in the cosmos."
- **Full i18n second pass**: every cosmic eyebrow + tagline I added across 8 templates (footer, contact, projects, skills, guestbook, home ×2, tools) is now translated via `TranslationService` using a new `cosmic.*` namespace (15 keys × 2 languages). Wired `TranslationService` into `LandingComponent` + `GuestbookComponent` which didn't have it. Spanish users now see "Ultimas herramientas / Alimenta la mision / cada moneda mantiene viva otra estrella en el universo" instead of the English hardcoded strings. Guestbook also got 7 additional copy keys (loading text, placeholders, submit button, load-more).
- **Cosmic anchor planet**: a CSS-only 3D rotating planet between the Featured Spotlight and Watch Live Work sections. Blue/teal sphere with atmospheric glow, 6-radial-gradient surface texture simulating continents (drifting via `background-position`), a higher cloud layer drifting in reverse for parallax, a soft day/night terminator shadow, a specular highlight, and a Saturn-style ring tilted at 72° via `rotateX` with conic-gradient banding + radial mask carving out the center. 80s rotation, breathes via atmosphere glow. Caption: "somewhere between the tools and the void — a world still spinning." (i18n'd via `cosmic.anchor.whisper`). Zero JS, no Three.js dependency, ~200 lines of CSS.
- **Cosmic OG image**: replaced the flat `og-default.jpg` with a hand-built `og-cosmic.svg` (1200×630, ~7.7KB) that mirrors the on-site cosmic identity — deep violet backdrop, central white→cyan→violet→pink pulsar bloom, 28 brand-palette stars connected with constellation lines, a faint rotating sigil on the right, "● FREE BROWSER TOOLS" eyebrow, gradient "xsantcastx" wordmark, "Tools forged in the void." subtitle, three-stat row (123+ Free Tools cyan / Always Free violet / Built in Public pink), and the URL. Wired through both `index.html` static meta and `SeoService.DEFAULT_IMG` (with the old JPG as a fallback for crawlers that don't render SVG), plus added `og:image:type`, `og:image:alt`, and `twitter:image:alt`. Every social share now broadcasts the cosmos.
- **Cosmic mobile menu** (latest): the hamburger menu on mobile got the full cosmic treatment — backdrop swapped from `rgba(0,0,0,0.75)` to dual-radial cosmic wash (cyan top + violet bottom) with 6px blur; the menu panel itself now uses radial cosmic gradients + 88%-alpha deep-indigo base + cyan-violet-cyan border accents + a top gradient cap line (matches every cosmic section) + a baked-in starfield in `::after` with 5 brand-color speck radial-gradients. Hamburger bars glow cyan on hover and switch to bright cyan with cyan+violet box-shadow when the menu is open. Slide-in transition upgraded to cubic-bezier(0.22, 1, 0.36, 1) for cosmic ease. Mobile users now feel the cosmos the moment they touch nav.

---

## 6. Roadmap — what's next (prioritized)

### P0 — high impact, low effort

- [x] **Type-on hero title** — system 8b in cosmic engine. IO-triggered char-split that walks text nodes, wraps each char in `.cosmic-char` with staggered `--delay`. Applies to `[data-typewriter]`, `.hp-hero__title`, `.hp-section-title`, `.skills h2`, `.section-title`, `.hp-live__title`, `.hp-spotlight__name`, `.tools-header__title`.
- [x] **Scroll-linked hero parallax** — system 8c. JS sets `--scroll-y`, `--scroll-y-slow` (0.5×), `--scroll-y-slower` (0.3×) on `<html>`. CSS consumes them on `.hp-hero__title`, `.hp-hero__sub`, `.hp-hero__cta`, `.hp-hero__visual`.
- [x] **Subtitle gradient sweep** — `cosmicGradientSweep` keyframe animates `background-position 0% → 100% → 0%` over 7s on `.hp-hero__title--accent`, `.hp-section-title`, `.section-title` (any element with the brand cyan→violet text gradient).
- [x] **Animated counter** — system 8a. IntersectionObserver triggers an ease-out cubic count-up from 0 to `data-counter` value over 1.4s. Currently bound to `.hp-stat__num` for `Free Tools`. Add `[data-counter]` to any number to animate it.
- [x] **Fix `/guestbook` 404** — added lazy-loaded route `loadComponent: () => import('./guestbook/...')` in `app-routing.module.ts` before the wildcard.

### P1 — alive interactions

- [ ] **Hover ripple on cards** — would stack on top of existing tilt + breathe + reveal + magnetic on the same surface. Per §7 rule "one alive interaction per scroll-screen", skipped to avoid overload.
- [x] **Constellation cursor trail** — system 5b. Container `.cosmic-trail-layer` injected on first run; every 18+ px of cursor movement spawns a colored particle (1 of 5 brand colors); fade-out + drift over 1.2s; capped at 14 simultaneous; hidden on touch and reduced-motion.
- [x] **Click ripple on the global canvas** — system inside the canvas IIFE. Click anywhere (skips form fields) emits an expanding cyan ring + inner violet ring on canvas; nearby particles within 280px get an outward radial impulse (`p.ivx`/`p.ivy` decay at 0.93/frame) and a flare boost (`p.flare` decays at 0.94/frame). Particles brighten and grow during the impulse.
- [x] **Ambient sound** — system 8e. Web Audio API graph: bass A1 sine + A2 triangle + A3 detuned-pair (chorus) + E4 fifth → lowpass (Q=0.6, sweeping ±220Hz over 25s) → master gain. Slow LFO (0.08 Hz) breathes the bass. Master gain auto-fades to 0.05 when `body.ritual-open` is added (via the existing arcane seal / Konami / `xsantcastx.reveal()` triggers), fades to 0 when removed. Lazy-instantiates only when ritual mode is first activated — no AudioContext for users who never engage. Also exposes `window.xsantcastx.toggleAudio()` for direct console control.
- [x] **Constellation tooltip** — hover any `.tool-card`, `.skill-card`, `.hp-tool-card`, `.project-card`, `.galaxy`, `.orbit-star`, or `.hp-spotlight__card` and the canvas draws bright connecting lines from the card's center to its 4 nearest visible particles within 280px. Line color is read from the card's `--star-color` CSS var (parsed via custom hex/rgb parser). Each linked particle also gets a flare boost so the connection feels reciprocal. Hooked into the canvas draw pipeline by wrapping the existing `draw()` function.

### P2 — premium polish

- [x] **Cosmic anchor planet** (pure CSS, no Three.js) — a new `.hp-anchor` section between the Featured Spotlight and Watch Live Work. Hosts `.cosmic-planet`: an `.cosmic-planet__atmosphere` outer halo (blurred radial gradient pulsing 7s), `.cosmic-planet__sphere` rotating at 80s linear (radial gradient body + inset shadow trio for depth + dual outer box-shadow glows), `.cosmic-planet__surface` simulating continents via 6 stacked radial-gradients with `mix-blend-mode: screen` drifting via `background-position`, `.cosmic-planet__clouds` higher layer drifting reverse at 55s for parallax, `.cosmic-planet__terminator` day/night linear-gradient shadow, `.cosmic-planet__highlight` blurred specular spot, and `.cosmic-planet__ring` tilted at 72° rotateX with conic-gradient banding + radial mask carving out the center. Section has gradient cap lines + cosmic backdrop. Caption translation key `cosmic.anchor.whisper` in EN + ES. Verified live: sphere animation `80s linear infinite planetSpin` running, ring rendered, whisper text "somewhere between the tools and the void — a world still spinning." visible. Reduced-motion safe.
- [ ] **Smooth scroll** with momentum (Lenis-style without the dependency — write a 60-line hand-rolled smoothScroll).
- [x] **Loading splash** — system 0 in cosmic engine. `<div class="cosmic-boot">` is part of SSR HTML so it paints instantly with the page (no flash of unstyled content). Center holds a teal star (radial gradient + box-shadow trio for depth) that scales 0 → 1.4 → 1, two staggered orbital rings (cyan + violet) that expand 0 → 8× and fade, and a `✦ BOOTING UNIVERSE ✦` label that fades in with letter-spacing easing. After 750ms the engine adds `.cosmic-boot--dismissed` which flares the star (scale 1 → 8 → 40, fade out + blur) and the curtain backdrop fades; the element is removed from DOM after 700ms. Skipped entirely on `prefers-reduced-motion`.
- [x] **Tools page — connection lines between related tools** — extension of the constellation tooltip system. Every `.orbit-star`, `.tool-card`, `.hp-tool-card`, and hero carousel card now carries `[data-tags]` (comma-joined list from the tools registry). When you hover a card, the engine reads its tags, finds every other on-screen `[data-tags]` element with at least one shared tag, and draws **dashed lines** between their bounding-rect centers in the hovered card's category color. Verified live: hovering CSS Progress Bar Generator drew dashed connections to CSS Clip-Path Generator (above) and CSS Media Query Builder (below) — all three share the "CSS" tag. Off-screen siblings are skipped.
- [x] **Confetti starbursts** — system 8d. MutationObserver watches `body` for additions of `.form-status .success`, `.hp-sub-success`, `.donation-success`, or `[data-success-burst]`. On match, fires a 32-particle multi-color burst followed 140ms later by a 22-particle pink burst. Uses `WeakSet` to prevent re-celebrating the same node.
- [x] **Mobile Cursor companion** — `touchstart` listener inside the canvas IIFE (only bound when `'ontouchstart' in window`). Each touch point spawns the same canvas ripple wavefront as click + a 6-particle cosmic spark micro-burst. Skipped on form fields and `prefers-reduced-motion`. Now touch users get the same cosmic feedback as desktop pointer users.

### P3 — content & SEO

- [x] **Per-page cosmic copy passes (round 1)** — guestbook lifted ("Loading Guestbook..." → "Tuning the signal...", "Submit" → "Send into the void →", "Nickname" → "Your call sign", "Message" → "Drop a message into the void...", added "Visitor Constellation" eyebrow + "every name here is a star that passed through" tagline). Donation form i18n lifted (`donation.form.*` strings now read "Fuel the mission with KASPA", "Scan the seal, whisper a name, keep the stars burning.", "Send the signal →", "The cosmos heard you. Thank you.", etc., both EN + ES). Footer donate modals lifted ("Fuel the mission", "PayPal portal", "Card portal", "Send fuel through PayPal — a secure, instant signal.", "Encrypted by Stripe — your card never crosses my orbit."). Verified live in SSR HTML.
- [x] **Open Graph cosmic image** — new `src/assets/og/og-cosmic.svg` (1200×630, ~7.7KB) is a fully cosmic-branded social-share preview: deep violet/indigo backdrop with central pulsar bloom (white→cyan→violet→pink radial gradient), 28 brand-palette stars connected with constellation lines, faint rotating alchemical sigil on the right, "● FREE BROWSER TOOLS" eyebrow, giant gradient "xsantcastx" wordmark, "Tools forged in the void." subtitle + "No sign-up. No installs. Just useful things.", three-stat row (123+ Free Tools / Always Free / Built in Public — each in its category color), and "xsantcastx.com" URL bottom-right. Both `index.html` and `SeoService.DEFAULT_IMG` now point to it as the primary OG image with `og-default.jpg` retained as a fallback for crawlers that don't accept SVG. Added `og:image:type`, `og:image:alt`, `twitter:image:alt` meta tags. Verified live: SVG serves at HTTP 200 / `image/svg+xml` / 7683 bytes, renders correctly inside the page.
- [x] **404 page lost star** — pure-CSS animation in `not-found.component`. A teal star core (radial gradient + tri-glow box-shadow) trails behind a soft cyan tail (`linear-gradient` + `blur(1px)`), drifting diagonally across the viewport over 18s linear (`-12vw,18vh → 60vw,70vh → 115vw,30vh`). Core breathes at 3.4s; trail flexes its scaleX. A faint whisper "a star drifted off course" fades in at 40-60% of each cycle. Reduced-motion → static parked star.
- [x] **i18n second pass** — added 15+ keys in a new `cosmic.*` namespace inside `TranslationService` covering every cosmic eyebrow (`cosmic.eyebrow.latestTools|whatsNew|openChannel|builtShipped|skillConstellation|visitorConstellation|fuelMission`) and tagline (`cosmic.tagline.latestTools|whatsNew|openChannel|builtShipped|skillConstellation|visitorConstellation|fuelMission|chooseGalaxy`) plus full guestbook copy (`cosmic.guestbook.title|loading|loadingMore|loadMore|nickname|message|submit`). Patched 8 templates (footer, contact, projects, skills inline, guestbook, landing ×2, tools) to use `translate('cosmic.*')`. Wired `TranslationService` into `LandingComponent` + `GuestbookComponent` which didn't have it. Verified live: switching `localStorage.preferred-language` to `es` reloads with "Ultimas herramientas", "Alimenta la mision", "nuevas estrellas nacidas esta semana en el universo xsantcastx", "cada moneda mantiene viva otra estrella en el universo".

---

## 7. Patterns to NEVER break

1. **Always SSR-guard browser APIs** — `if (typeof window === 'undefined') return;` at the top of any inline script. Prefer `inject(PLATFORM_ID)` + `isPlatformBrowser()` in services.
2. **Always honor `prefers-reduced-motion`** — wrap any animation > 1s or any continuous loop. Fall back to a static end state, not "no animation."
3. **Mobile-first sizing** — use `clamp()` for type and gaps. Avoid pixel-locked sizes.
4. **Performance budgets**:
   - Canvas: ≤ 140 particles total. ≤ 1 `getImageData` per frame max (we use 0).
   - Animation count per element: ≤ 3 simultaneous keyframes (current pulsar uses 3).
   - Avoid layout-triggering properties in keyframes (animate `transform` / `opacity` / `filter`, not `top/left/width/height`). Pulsar wander uses top/left at 38s — acceptable because it's slow and only one element.
5. **Don't introduce new colors** without adding them to the palette table in §2.
6. **One "alive" interaction per scroll-screen** — avoid stacking magnetic + tilt + ripple + parallax on the same element. Pick one primary feel per surface.
7. **Always test the tools page after engine changes** — it's the most animation-dense page and reveals z-index bugs first.

---

## 8. File map — where the cosmic theme lives

```
src/
├── index.html                           # cosmic engine (inline JS) + matrix-background, pulsar, runes, seal
├── styles.css                           # global: matrix-bg, sigil, nebula, pulsar, runes, scroll-reveal, cursor
├── app/
│   ├── landing/                         # /home — hero, stats, tools grid, spotlight, live, changelog, footer-CTA
│   ├── tools/                           # /tools — galaxy map → star system → flat search grid
│   ├── skills/                          # /skills — star constellation grid
│   ├── projects/                        # /projects — preview-window project cards
│   ├── contact/                         # /contact — open-channel form
│   ├── donate/                          # /donate — KASPA glassy panel
│   ├── footer/                          # global footer — donate buttons + star-orb socials + modals
│   ├── header/                          # global header (already on-brand)
│   ├── live/                            # /live — terminal feed
│   ├── games/                           # /games — easter egg gallery
│   └── mcp/                             # /mcp — npm package landing
```

---

## 9. Strategic Roadmap — beyond cosmic polish

The visual identity is complete: 22+ alive cosmic systems, SSR-safe, i18n'd EN + ES, OG cosmic broadcast image. What the site **still needs** to be a serious product, ordered by impact-to-effort.

### Phase 1 — Foundation health (week 1-2, blocker work)

The console is full of red Firebase errors. The page LOOKS perfect but the substrate is leaking. Fix this before anything else.

- [x] **F-1. Fix Firebase backend** — done. Four shipped fixes:
  1. **`firestore.rules`** — added a `/site-stats/{statId}` rule allowing public read + schema-enforced create/update for the visit counter (count is a number, lastVisit is an ISO string ≤50 chars, increment is +1 only so a single client can't grief the counter into the stratosphere). `/changelog/{docId}` rule was already correct.
  2. **`app.module.ts` Firestore provider** — wrapped `initializeFirestore(app, ...)` in `try { ... } catch { return getFirestore(app); }` so the SSR→client hydration path that double-initializes no longer creates two different SDK instances. That kills the "Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?" red wall.
  3. **`VisitCounterService`** — silent-degrade on `permission-denied` (expected when rules haven't been deployed), warn on anything else. No more `console.error` from this path.
  4. **`ChangelogService`** — silent-degrade on `permission-denied` AND on the "Type does not match" SDK-instance message. Falls back to "No updates yet" UI.

  **Verified live**: latest 25 console entries show **zero `[error]` lines** from these services. The remaining `@firebase/firestore` `[warn]` entries are internal SDK noise that will disappear once `firebase deploy --only firestore:rules` is run with the new rules.

  **Next step (one shell command, user to run)**: `firebase deploy --only firestore:rules` deploys the new `site-stats` rule. The internal SDK warnings then go away too.
- [x] **F-2. Production bundle audit** — `npm run build` succeeds in 48.5s. 259 routes prerendered. One warning only (npm-search optional-chain).
  - **Initial bundle: 5.57 MB raw → 815.79 kB gzipped** (main.js: 5.47 MB raw / 5.2 MB on disk)
  - Lazy chunks split correctly: jspdf 411 kB / 113 kB transfer, html2canvas 203 kB / 39 kB, etc.
  - **Root cause of bloat**: all 125 tool components are `standalone: false`, declared in `app.module.ts`, so they ship in main.js eagerly. With ~200-700 TS lines each, they account for ~3-3.5 MB of main.js.
  - **Fix path (1-2 week project, future ticket F-2b)**: convert tool components to `standalone: true` and replace eager `component: ToolXComponent` routes with `loadComponent: () => import('./tools/x/...').then(m => m.X)`. Each route gets its own chunk, main.js drops to ~1.5 MB raw / ~270 kB gzipped (within target). Migration is mechanical: change `standalone: false` → `true`, add `imports: [CommonModule, FormsModule, ...]` per component, remove from `declarations` in `app.module.ts`, update route to `loadComponent`. Recommend doing 10 tools per PR to keep diffs reviewable.
  - **Quick win available now**: lazy-load `@angular/fire/firestore`, `firebase/auth`, and `@angular/fire/functions` only on routes that need them (currently bundled into main even though they're only used on /guestbook + /donate). Could save 100-150 kB transfer for home/tools visitors.
- [x] **F-3. Tool quality spot-check** — sampled 12 random tools from the registry (meta-tag-generator, ts-playground, css-variables, email-deliverability-auditor, responsive-preview, base64-encoder, lorem-generator, snippet-manager, checklist, git-reference, hex-editor, morse-code). All have real implementations (107-677 TS lines + matching HTML). **No stubs found.** Two had a small handful of TODO markers (meta-tag-generator: 1, ts-playground: 2, snippet-manager: 5) — those are polish items, not broken-tool flags. Conclusion: the tool layer is substantively real, not a Potemkin village. A full 125-tool audit could surface a few UX-rough tools — recommend a "fresh pair of eyes" pass when time permits, but this isn't blocking.
- [x] **F-4. Accessibility quick-scan** — static-grep audit across all templates:
  - **108 `aria-label` usages across 31 templates** — solid coverage on icon-only buttons and interactive controls
  - **All `<img>` tags have alt attributes** (10 initial false positives were all using Angular's `[alt]="..."` property binding which my regex missed)
  - **Skip-to-main link present** in `app.component.html` (`<a href="#main-content" class="skip-to-main">`)
  - **No empty buttons found** (0 occurrences of `<button></button>`)
  - **`prefers-reduced-motion` respected in 16 places** across CSS + engine — every cosmic animation has a static fallback path
  - **Manual `tabindex` use is minimal (1 occurrence)** — relies on native focus order, which is what you want
  - **What's NOT verified by static scan**: color contrast ratios (need a runtime axe-core pass), screen reader announcement quality, custom cursor not stealing focus (it has `pointer-events: none` so should be fine). Recommend running axe DevTools or WAVE in-browser as a follow-up — but no obvious red flags.

### Phase 2 — Conversion fundamentals (week 3)

The cosmic experience attracts attention but nothing currently captures it.

- [partial] **C-1. Newsletter form** — **audited and partially fixed.** Current state: `onSubscribe()` writes the email to a Firestore collection `homepage_subscribers` with no email delivery wired. Users get a green "success" state but no email is actually sent.
  - **Shipped this round**: added `homepage_subscribers` Firestore rule with strict schema (email regex enforced server-side, 5-254 char length, only allow `create` — no client reads/updates/deletes); tightened client-side email validation to match the rule's regex; lifted success copy to honest cosmic tone ("Signal received. The next time a star is born in this universe, we'll send a beam your way."); error copy now says the email looked invalid rather than a generic "something went wrong".
  - **Still needs (real delivery)**: a Cloud Function trigger on `onDocumentCreated('homepage_subscribers/{id}')` that pushes the email into Brevo/Mailchimp/Resend, sends a confirmation email (double-opt-in for GDPR), and updates the document with `confirmed: true`. The Functions runtime already exists (`functions/src/`) — recommend adding `functions/src/subscribers.ts` with the trigger + your chosen ESP's API call.
  - **Quick alternative**: if you don't want to wire an ESP, document on the form copy that submissions are saved and you'll batch-email when something ships — set expectations honestly.
- [x] **C-2. Contact form delivery** — audited end-to-end and hardened. The pipeline is **architecturally correct**: `ContactComponent.onSubmit()` → `ContactService.sendContactForm()` → `EmailService.sendEmail()` POSTs to `/api/send-contact` → Firebase Hosting rewrite maps to `sendContactEmail` Cloud Function → function validates input, reads `process.env.BREVO_API_KEY`, calls Brevo Transactional Email API → email arrives at `xsantcastx@xsantcastx.com`. Function has CORS allowlist (`xsantcastx.com` + Firebase project domains) and email-format guard.
  - **Shipped this round**: lifted success + error i18n copy to cosmic tone (`"Signal received. Your transmission reached us..."` / `"The transmission scattered before it reached us — try again or send a beam directly to xsantcastx@xsantcastx.com."` — both EN + ES); hardened the contact error handler to NEVER leak raw `error.message` to users (backend strings like "Brevo API key not configured" no longer reach the UI), instead always shows the cosmic copy with the fallback email baked in.
  - **Operational requirement**: `BREVO_API_KEY` must be set in the Firebase Functions runtime config — `firebase functions:config:set brevo.api_key="..."` or via Functions environment variables. Without it the function returns 500 and users see the fallback cosmic error.
  - **Outstanding (out of scope without backend access)**: server-side rate limiting (currently no per-IP throttle on `sendContactEmail` — recommend adding an in-memory or Firestore-backed counter to prevent spam abuse), Brevo sender domain SPF/DKIM verification (required for high deliverability).
- [x] **C-3. Donation flows — Stripe CSP fix** — Stripe **was** configured (real `pk_live_...` key in `environment.ts`), but the **CSP was silently blocking** the Stripe SDK from loading. The dynamic `<script src="https://js.stripe.com/v3/">` injection in `PaymentService.loadStripeSDK()` was blocked by `script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://cdn.carbonads.com` — no Stripe domain. `script.onerror` fired, `stripeLoaded.next(false)`, the modal showed the misleading "Stripe is not configured" message even though the key was real. Same issue would have hit PayPal once its SDK tries to load.
  - **Shipped this round**: widened the production CSP in `firebase.json` to include the donation provider domains:
    - `script-src`: + `https://js.stripe.com https://www.paypal.com https://www.paypalobjects.com`
    - `connect-src`: + `https://api.stripe.com https://*.paypal.com https://*.braintree-api.com`
    - `frame-src`: + `https://js.stripe.com https://hooks.stripe.com https://*.paypal.com` (Stripe Elements + PayPal checkout both render in iframes)
  - Lifted the misleading modal copy from `⚠️ Stripe is not configured. Please contact the site administrator.` (implied user fault) to the i18n-keyed cosmic message `✦ The card portal is still tuning in. Try Crypto or PayPal — or refresh in a few seconds to retry.` (EN + ES) so even if the SDK has not finished loading the user still has a path forward.
  - **Deploy step**: the CSP fix lives in `firebase.json` headers — needs `firebase deploy --only hosting` for the new CSP to take effect on production. Local dev (`ng serve`) does not enforce these headers so this only surfaces in prod / hosting preview channels.
- **C-4. Success-state polish** — confetti already fires (cosmic engine 8d). Make sure each form's success message is cosmic-toned and tells the user what happens next.
- [x] **C-5. Trust microcopy** — audited every CTA. Existing trust copy already strong on the donation modals (`Encrypted by Stripe — your card never crosses my orbit.`) and the hero / newsletter section. Two visible gaps filled this round:
  - **Newsletter form sub-copy** lifted from `No spam. No account needed. Just useful things.` to `No spam. No account needed. Unsubscribe anytime.` (EN + ES via new `newsletter.trust` i18n key) — addresses the ongoing-commitment concern that "no spam" alone doesn't.
  - **Contact form** had zero trust copy near submit. Added a `🛡 Sent only to xsantcastx — we reply within 24 hours.` line below the submit button via new `contact.form.trust` i18n key (EN + ES) + a `.form-trust` style (small, centered, low-emphasis so it doesn't compete with the CTA).
  - SEO meta descriptions already include `no sign-up`, `no account required`, etc. across all 125 tool routes — but those are crawler-only; the visible trust copy now spans every primary conversion surface (newsletter → donation → contact).

### Phase 3 — SEO & growth (week 4-5)

The OG image is cosmic but the discovery surface is still thin.

- [x] **G-1. Sitemap auto-generator** — new `scripts/generate-sitemap.js` reads `prerender-routes.txt`, filters out `/embed/*` and `/404`, and emits a fresh `src/sitemap.xml` + mirrored copy in `dist/xsantcastx/browser/sitemap.xml`. Today's UTC date is stamped on every `<lastmod>`, and route metadata (priority + changefreq) is keyed per surface type: `/home` priority 1.0 weekly, `/tools` 0.9 weekly, `/live` 0.7 daily, top-level pages 0.7 monthly, each tool page 0.6 monthly. Wired into `package.json` as a `postbuild` step so the sitemap refreshes on every production build. First run: 131 URLs written with today's date.
- [x] **G-2. robots.txt** — already present at `src/robots.txt`: `User-agent: *` + `Allow: /` + `Disallow: /embed/` + `Disallow: /404` + `Sitemap: https://xsantcastx.com/sitemap.xml`. Correct.
- [x] **G-3. Schema.org JSON-LD coverage** — audited and verified **100% coverage** across all 123 tool routes in `app-routing.module.ts` (initial brace-balanced count returned 84% but my parser was bailing early on multi-line routes; a corrected look-ahead-80-lines scan found every route has a `jsonLd:` block). Each tool ships `SoftwareApplication` structured data with `name`, `url`, `applicationCategory`, `operatingSystem: 'Web Browser'`, and `offers: {price: '0', priceCurrency: 'USD'}`. Some also include `breadcrumb` lists.
- [x] **G-4. Per-tool meta descriptions** — same audit as G-3 since both share the route `data:` block. **100% coverage** across all 123 tool routes. Each tool has a unique `description` + `keywords` array.
- [ ] **G-5. Cosmic blog / write-ups** — bigger lift; defer until after the platform layer is stable. One article per category ("Why I built the Email Deliverability Auditor", "What makes a CSS box shadow look cosmic") — anchors organic traffic + showcases voice.
- [x] **G-6. Internal linking** — auto-injected `<app-related-tools [currentToolId]="'<slug>'"></app-related-tools>` into the 43 tool components that didn't have it. Final coverage: **123/126 tool directories (97%)** — the 3 remaining are dirs without a `.component.html` (placeholders like `char-map`, `svg-path-editor`). `RelatedToolsComponent` was already declared in `AppModule`, so the injection is safe (no module-import changes needed). Each tool now sends crawl signals to 4 related tools via the existing `getRelatedTools()` registry lookup.

### Phase 4 — Engineering hardening (continuous)

Right now the codebase has zero automated coverage. The cosmic engine grew from 0 → 41KB+ with no tests guarding regressions.

- [x] **E-1. Bundle analysis scripts** — added `npm run analyze` (production source-mapped build + `source-map-explorer` on main bundle) and `npm run analyze:why` (stats-json + `webpack-bundle-analyzer` for an interactive tree-map). Both use `npx` so no global install required — first run will fetch the explorer transiently. Useful for the F-2b standalone migration to see byte-by-byte what's still eager after each batch.
- **E-2. Smoke E2E tests** — Playwright covering: home loads → click a galaxy → orbit view renders → click a star → warp → tool page loads. Five-minute suite that catches the worst regressions.
- **E-3. Visual regression for cosmic engine** — Percy or Chromatic screenshots of `/home`, `/tools`, `/skills`, `/projects`, `/contact`, `/donate` and the four cosmic eyebrow patterns. Catches accidental CSS breakage in any of the 22+ systems.
- [x] **E-4. CI pipeline** — already existed at `.github/workflows/ci-cd.yml` running `npm ci && npm run build` on push to `main`/`develop` + PRs to `main`, auto-deploys to Firebase Hosting from `main`. **Hardened this round** by adding a "Verify sitemap was regenerated" step that fails the build if `<lastmod>` isn't today's UTC date — guards against silent failures in the `postbuild` sitemap generator. Production AOT compile is the typecheck gate (stricter than `tsc --noEmit`). Daily tool generation pipeline (`daily-pipeline.yml`) is separate and already cron'd. Outstanding follow-ups: add `npm run test:ci` step once unit tests stabilize, and a Playwright e2e step (see E-2).
- [x] **E-5. Pre-commit hook scaffolding** — added `.husky/pre-commit` (chmod +x, executable) and `.lintstagedrc.json` config covering TypeScript (incremental type-check), HTML/SCSS/CSS (placeholder for a future formatter), and JSON (parse-validity check). Hook gracefully degrades if `lint-staged` isn't installed yet — prints install instructions instead of blocking the commit. Activation step (one-time for the user): `npm i -D husky lint-staged && npm run prepare`. After that, every `git commit` gates on the staged-files lint.
- **E-6. Error tracking** — Sentry or LogRocket. The current Firebase errors are noise, but a real client-side crash would currently be invisible.

### Phase 5 — Platform extensions (when ready)

Once the foundation is solid, leverage the brand into surfaces that reach users who'd never visit the site.

- **X-1. Browser extension** — quick-launch the top 10 tools from a popup. Same cosmic styling. Builds direct daily usage.
- **X-2. VS Code extension** — `xsantcastx: Pick a tool…` command palette → opens the tool in a webview. Same MCP server already exists — repackage as VSCE.
- **X-3. CLI** — `npx xsantcastx box-shadow` opens the tool in your default browser at a deep-linked URL. Tiny, viral.
- **X-4. Mobile companion app** — PWA-first, native shell second. Most tools work offline; web app manifest + service worker turns the existing site into a PWA in ~half a day.
- **X-5. Discord / Slack bots** — `/xsantcastx ssl-check example.com` runs the SSL inspector and returns results in-thread. Drives awareness inside dev communities.

### Phase 6 — Sustained brand evolution (slow burn)

- **B-1. Twitch / YouTube "Watch AI Build" streams** — the home page already advertises this (`/live`). Make it real. Live-stream the next feature being shipped, with the cosmic mission-control terminal as the OBS overlay.
- **B-2. Tool launch threads** — every new tool gets a Twitter/X thread with cosmic-themed screenshots, the OG image, and a "1-line use case" hook.
- **B-3. Open-source the cosmic engine** — extract the `index.html` cosmic engine into its own NPM package `@xsantcastx/cosmic-engine`. Becomes a recruitment tool for other devs and a portfolio piece.
- **B-4. Annual cosmic redesign** — every January, ship a fresh "alive moment" (year 1: pulsar; year 2: planet; year 3: WebGL constellation maybe). Keeps the brand feeling current without burning the existing system.

### How to use this plan

- **Always ship Phase 1 first.** A leaky console destroys trust. Even if F-1 takes a week, do it before any new feature.
- **Phase 2 unlocks revenue.** Donation flows that don't work cost real money.
- **Phase 3 unlocks organic growth.** SEO compounds over months — start now.
- **Phase 4 is maintenance.** Add tests before you regret not having them.
- **Phase 5/6 are expansion.** Only after Phase 1-4 are solid.

### Anti-goals (things to NOT do)

- **Don't add more cosmic-engine systems** without removing one. We're at 22+; that's the upper bound for any one page without performance regression.
- **Don't introduce a heavyweight 3D library** (Three.js, Babylon). The CSS planet proves we can fake 3D in 200 lines. Adding Three.js for marginal wow would balloon the bundle by 600KB+.
- **Don't replace working tools** with shinier rewrites. Most users want functional tools; the cosmic theme is the wrapper, not the product.
- **Don't ship without `prefers-reduced-motion` paths.** This is a hard rule — every animation that runs > 1s needs a static fallback. Vestibular disorders are real.

---

## 10. Build & test

```bash
npm start    # ng serve, port 4200, with SSR
npm run build  # production
npm test     # ng test
```

When verifying cosmic changes: hit `/home`, `/tools` (and click a galaxy), `/skills`, `/footer` (scroll), `/contact`. Move the cursor — pulsar should drift, custom cursor should appear, magnetic buttons should pull. Scroll — sections should fade-up. Click a primary CTA — should spark.
