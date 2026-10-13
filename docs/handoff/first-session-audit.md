# First-session audit: a brand-new player's first five minutes

Date: 2026-10-13. Branch `worktree-agent-a534a7a255ebea4e2`.

## How it was played

A Playwright script played a **true first visit** against a fresh production
build (`ng build` → `scripts/serve-preview.js`, own port `PW_PORT=4296`), at
**390×844** (touch, mobile UA) and **1280×800**. Storage was cleared from
`/robots.txt`, so nothing had booted the app (see the memory note on first
visits); the only thing set was `sessionStorage['visit-counted']`, so the audit
did not bump the live visit counter.

The player landed on `/`, went through the tutorial taking the door it marks
"Do this first", then pressed the navbar's **Play**, and tried to reach, in
order: the **first purchase**, the **first hunt kill**, the **first craft** and
the **first Delve dig**. For each it recorded time, steps, what (if anything)
on screen pointed at it, dead ends, jargon, and controls covered by other
widgets (an `elementFromPoint` hit test at each control's centre, which is
where a tap lands).

That script is now the permanent spec `e2e/play-first-session.spec.ts`
(following the new goal line instead of the Places list; see the end).

## Findings

Severity: **Critical** = a goal cannot be reached; **High** = reachable only by
luck or prior knowledge; **Medium** = friction a new player will feel;
**Low** = polish.

| # | Sev | Where | Finding | Status |
|---|---|---|---|---|
| 1 | **Critical** | Homestead, phone | The first purchase (Forge Bellows, 15 Gold) could not be bought on a 390 px phone while standing at the Forge: the "Strike the Forge · Interact" prompt sat exactly on its Buy button (Playwright's click was intercepted by `.prompt.armed`; even a forced click landed on the prompt). The Gold list also overlapped the satchel plate, and started folded to a "1 Gold" chip. | **Fixed** |
| 2 | **High** | `/play`, all sizes | Nothing pointed at three of the four first goals. The objective line only knows the Seamworks quest chain ("Find the Cinder Ore deposit…"). The Homestead (the Cookie-Clicker "first building in ~15 s") was the **last of 11** rows in Places, and nothing mentioned the Delve or that the Rivet Maws wait east of the Waystone. | **Fixed**: goal line |
| 3 | **High** | Every first visit | Every brand-new browser got a full-screen "You are visitor number N · BRONZE MILESTONE" card right after the tutorial, blocking every click until dismissed. Cause: with no cached count, "previous" was 0, so the first milestone (crossed long ago) fired for every newcomer. | **Fixed** |
| 4 | **High** | Tutorial step 4 / 5 | The tutorial ended **outside the world**: its "Do this first" door went to the standalone `/sanctum` page ("This place is in Rootglass Canopy · Enter the world"), its other doors to standalone pages, and step 5's "Enter the Godforge" only closed the overlay on the `/world` landing page. The Rune Forge door offered "600 Gold a strike" to a player holding 1 Gold. | **Fixed** |
| 5 | Medium | Seamworks Forge | Jargon: "A first-craft tutorial ember is available after 8 accepted strikes." | **Fixed**: "Keep mining the seam: an ember turns up by your 8th ore." (EN + ES) |
| 6 | Medium | Homestead Gold list | Two "Upgrade … · 5M Gold / Need 4,999,999 more" rows sat **above** the 15-Gold Bellows. | **Fixed**: buildings first |
| 7 | Medium | Delve, phone | The hotbar's Take button sat under the satchel plate (2×3 tally, 170 px tall). | **Fixed**: 3-column tally on phones; hotbar on the floor of the view, above the prompt |
| 8 | Medium | First visit, both sizes | The cookie banner covers the bottom ~150 px of the world (the Interact prompt, Keys, and on desktop the last Places rows, including the Homestead) until answered. | Left: owner call (consent UI) |
| 9 | Medium | Crafting Bench | A fresh save can craft nothing at the bench. "Ready now" says "Nothing on the bench matches that." yet still shows Briarvein Kris (3,000 Gold + Thornroot, Verdant Sap, World-Root Bark from other realms) as the detail. The cheapest bench craft (Torch: 1 Cinder Ore + 1 World-Root Bark + 30 Gold) needs an axe or Delve trunks, and nothing says so. | Left (bench/station kit owner) |
| 10 | Medium | `/play`, phone | The world view is ~380 px tall: the top bar (~140 px) above, and the Hearth chat dock (170 px, always open) plus touch controls below. In the Delve the second touch row overlaps the dock's text. | Left (layout decision) |
| 11 | Low | `/play` HUD | The HUD's own quest lines (objective, prompts, "Return to camp", "Restart hunt", the Satchel tally) are English-only; "Restart hunt" in a town reads as jargon. | Left (only the new goal copy and the two forge lines are EN + ES) |
| 12 | Low | Delve, phone | "+1 Dirt block" loot toasts stack over the hotbar's Take button for ~1.8 s after each dig. | Left |
| 13 | Low | Homestead, phone | The Keeper is drawn translucent while walking into the Homestead; Places → Homestead takes ~4 s of walking with no feedback but the walk. | Left |
| 14 | Info | Tutorial | Desktop: the cookie banner appears a second or two after the tutorial, over its lower edge; on a phone it covers the dots and Skip on step 1 (Begin stays visible). | Left (same as 8) |

### Timings, before (following the Places list, as a careful new player would)

| Goal | 1280×800 | 390×844 | Pointed at by |
|---|---|---|---|
| Into the world (`/` → `/play`) | 9 s, 7 clicks (tutorial → `/sanctum` → navbar Play) | 9 s | the navbar Play only |
| First purchase | 18 s (Places → last row → strike 3 s → buy) | **impossible at the Forge** (finding 1) | nothing |
| First hunt kill | 14–17 s barehanded | 8 s | nothing (objective is about ore) |
| First craft (Basalt Edge) | 41 s (8 mines with the 2.5 s seam recovery) | 30 s | the objective chain (yes) |
| First Delve dig | 7 s once at the shaft | 3 s | a Places blurb only |

### Timings, after (following only the new goal line's "Show me")

| Goal | 1280×800 | 390×844 |
|---|---|---|
| Into the world | 4.5 s, 6 clicks (the tutorial's first door is the world) | 3.9 s |
| Goal 1: buy a building | 23.5 s (incl. ~7 s of walking) | 11.8 s |
| Goal 2: defeat a Rivet Maw | 32 s | 16 s |
| Goal 3: forge the Basalt Edge | 41 s | 33 s |
| Goal 4: dig in the Delve | 37 s (incl. the walk back west) | 34 s |
| All four | **2 min 18 s** | **1 min 39 s** |

The first building lands inside the economy plan's "~15 s of striking" on both
sizes (3 s of striking once at the Forge); the rest is walking.

## What changed

- **Goal line** (`src/app/play/world/first-goals.ts`, copy in the lazy
  `first-goals.i18n.ts`, EN + ES): one row under the top bar,
  "GOAL n OF 4 · <one plain sentence>" and a **Show me** button that walks the
  Keeper there (and uses the place on arrival). Order: buy a Homestead building
  → defeat a Rivet Maw → forge the Basalt Edge → dig in the Ember Delve. It is
  derived from the save on every HUD tick (a building owned, Hunting XP, the
  Edge crafted or Smithing XP, a Delve cell dug), so it never stores anything,
  follows the player if they do things out of order, and is gone for good once
  all four are true. Off the Seamworks floor it points the way back (Homestead
  exit, Delve exit, quarry passage, or the Waystone from another town). Reduced
  motion: the button's glow does not animate. On phones the HUD plates step down
  by the row's height.
- **Homestead on phones**: the Gold list opens by itself for a Keeper who owns
  no building, takes the plates' place full-width, and ends above the Interact
  prompt; buildings are listed above the crafting corner (all sizes).
- **Visitor milestone**: never fires without a cached count (a first visit).
- **Tutorial**: step 4's first door is "Enter the world" (`/play`); the Scout,
  Bench and Market doors open their station in-world (`/play?at=…`); the Rune
  Forge door is gone (its two eager keys pruned); step 5's button enters `/play`.
- **Delve hotbar on phones**: compact satchel tally; hotbar anchored above the
  prompt.
- `DelveSaveService.hasDug(areaId)`: a read that never rolls a seed or writes.

Initial bundle: 1.73 MB before and after (everything new is in the play and
tutorial chunks).

## For the owner to judge

1. **The Rune Forge door** was removed from the tutorial (it was the one door a
   new player could not use). Put it back if the gamble should be advertised on
   day one.
2. **Goal order** is buy → hunt → craft → Delve, as briefed. The Seamworks
   quest chain (ore → blade → Maw → beacon) still runs in the objective line
   beside it; the two agree except that the goal line sends you to the Maws
   before the blade (a bare-handed kill takes ~15 s and the Keeper did not fall
   in any run).
3. **Cookie banner over the world** on first visit (finding 8) and the
   **always-open Hearth chat on phones** (finding 10): both are layout calls.
   Folding the Hearth to a single "Hearth" button on phones would give the
   world ~120 px back.
4. **Nothing to craft at the bench** on a fresh save (finding 9). A starter
   recipe from Seamworks-only materials, or a "Ready now" empty state that
   names the Torch and where bark comes from, would close it.
5. The HUD's quest lines are still English-only (finding 11).

## Re-running

```bash
npx ng build
PW_PORT=4296 npx playwright test e2e/play-first-session.spec.ts --project=chromium
```

The spec: a first visit through the tutorial into `/play`, then only the goal
line's Show me through all four goals until the line disappears (desktop);
the phone layout (goal line above the plates, Gold list open, Bellows Buy button
passes a hit test at its centre under the armed prompt); Spanish copy.
