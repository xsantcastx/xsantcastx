# Calm environment + phone performance — handoff (hotfix, 2026-10-26)

Owner: "It's laggy … the environment looks too much. I think it's better how it was before, or maybe a little less."
The new characters, creatures, pets and the aura are unchanged on every setting.

## What a player gets

- **A calmer world (Normal, the default).** Grass folded from six tones onto four quiet ones, fewer clumps and blades,
  the meadow patches gentler; one bloom on about half a flower bed's tiles and only the odd one in open grass; stones
  about a quarter as often; road edges a soft wavering line (no spikes). Trees keep the round clustered crowns but in
  fewer, bigger, softer clusters (`td-flora.ts` `CALM`). Props and water are unchanged.
- **Menu → Settings → Environment detail: Normal / Low.** Low is the old flat ground and the old clean trees with a soft
  shadow, no aura motes, and the canvas at no more than 4/3 device px per CSS px. A device's own choice
  (`localStorage['eclipse-td-detail']`, never the save gateway — like the HUD layout). No choice: Low on a low-end
  device (deviceMemory ≤ 4 or hardwareConcurrency ≤ 4), or after measured slow frames (mean > 22 ms over four seconds,
  once the world has settled) for that session. Never auto in an automated browser.
- **Smooth walking.** Ground chunks bake a row of tiles at a time inside a 3 ms budget after each frame, the ring round
  the view first, nearest first; a chunk in view is never drawn half-painted. Least-recently-drawn cache, 40 chunks.
- **Phone canvas at DPR ≤ 2** (unchanged look: still 3 device px per art px at 1.5 CSS px), opaque context, no
  full-canvas clear each frame (chunks are opaque).

## Root causes (phone profile: 390×844, DPR 3, CPU ×6, headless Chromium)

1. **Canvas raster, not JS.** A trace of the town: of ~4 s, 3.5 s was `Canvas2DResourceProviderSharedImage::
   ProduceCanvasResource` (the canvas flush) and 0.43 s the engine's frame callback. The backing was 2.96 Mpx at DPR 3;
   the engine's own update + draw was 2–4 ms.
2. **Chunk bakes in one frame.** Walking baked a whole 256×256 chunk at once: 37–70 ms (the meadow noise per pixel —
   eight hashes a pixel — was most of it), giving 66–116 ms frames.
3. Creature count (18 Bone Walkers) and the aura were minor: update ≤ 1.1 ms. The volume pass is baked once per sheet.

## Numbers (frame mean / p95 / worst ms; frames over 33 ms; caches Mpx; heap MB)

| Scene | main (aa0680ea) | calm, Normal | calm, Low |
|---|---|---|---|
| Road standing | 30.6 / 35.3 / 49.9, 33/131 | 16.6 / 18.5 / 18.7, 0 | 16.6 / 18.5 / 18.7, 0 |
| Road walking | 34.4 / 49.9 / 68.5, 45/146 (bake 36.5) | 17.9 / 33.3 / 35.3, 3/280 (bake 5.8) | 16.6 / 18.5 / 18.7, 0 |
| Town standing | 38.4 / 50.9 / 66.7, 52/105 | 19.0 / 33.4 / 35.2, 9/211 | 16.6 / 18.5 / 18.7, 0 |
| Town walking | 37.8 / 50.0 / 100.0, 57/133 (bake 57.6) | 18.3 / 33.3 / 48.1, 6/274 (bake 6.2) | 16.7 / 18.5 / 33.3, 0 |
| Harbour walking | 28.3 / 35.3 / 100.2, 37/177 (bake 69.5) | 16.6 / 18.6 / 18.7, 0 | 16.6 / 18.4 / 18.7, 0 |
| Dungeon walking | 40.1 / 51.8 / 66.7, 73/125 | 17.8 / 33.3 / 35.4, 3/281 | 16.6 / 18.5 / 18.7, 0 |
| Hot spot fighting | 41.8 / 51.9 / 66.6, 80/120 | 18.4 / 33.3 / 35.4, 9/273 | 16.6 / 18.4 / 18.7, 0 |
| Hot spot walking | 37.4 / 50.2 / 51.9, 57/134 | 18.4 / 33.3 / 35.3, 4/273 | 16.6 / 18.5 / 18.7, 0 |
| Canvas backing | 2.96 Mpx | 1.32 Mpx | 0.58 Mpx |
| Paint caches / heap | 7.4–9.6 Mpx / 38–54 MB | 9.1–12.8 Mpx / 40–58 MB | 8.6–12.9 Mpx / 40–48 MB |

The caches grew ~3 Mpx (≈ 12 MB) because the ring round the view is now baked ahead; the main canvas shrank 1.6–2.4 Mpx.
Headless Chromium rasterises the canvas in software, so Normal's remaining > 33 ms frames are the raster; a real phone
rasterises on the GPU.

## Tools

- `TD_PERF=1 [TD_CPU=6] [TD_DETAIL=low|normal] [TD_TRACE=<scene>] PW_PORT=… npx playwright test e2e/td-perf-phone`
- `window.__tdArt.perf()` (webdriver only): [update ms, draw ms, ground-bake ms] per frame since the last call.
- `TD_DETAIL=low ART_SHOTS=<prefix> … e2e/td-art-shots`. Shots: `docs/handoff/calm/{before,after,after-low}-*` and
  `side-by-side-{forest,town,closeup}-{desktop,phone}.png`.

## Files

`play/td/td-detail.ts` (the setting), `td-ground.ts` (calm grass, flowers, stones, edges; Low → old painters),
`td-flora.ts` (`CALM` crowns), `td-art.ts` (Low tree; old flower beds thinned), `td-engine.ts` (`chunkAt`, `bakeRows`,
`prefetchGround`, DPR cap, opaque canvas, `watchFrames`), `shared/sound/sound-sheet.component.ts` + `sound.i18n.ts`.

## Not done

- Switching the setting rebakes the view's chunks at once (one ~90 ms frame on a slow phone).
- A new creature kind's sheet is still painted all at once the first time it is seen.
