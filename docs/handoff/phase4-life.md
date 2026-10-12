# Handoff: Phase 4 "Life" (keepers, townsfolk, realm atmosphere)

All visual. Nothing here reads or writes combat, loot or economy state.

## What shipped

| File | Role |
|---|---|
| `src/app/play/world/life.ts` | Pure data and logic: keepers per town, realm palettes, keeper placement, wander segments, `TownsfolkCrowd`, `KeeperChatter`, `onScreen` culling |
| `src/app/play/world/life.i18n.ts` | Name tags and chatter, EN + ES (lazy table, registered by the side-scroller) |
| `src/app/play/engine/town-life.ts` | Draws keepers and townsfolk: `NPC_RIG` + `poseNpc` idle/walk, placeholder figures, name tags, speech bubble |
| `src/app/play/engine/atmosphere.ts` | `ambientLayer()`: one particle layer per realm |
| `src/app/play/engine/engine.ts` | Wires it in: `life.enter` on area entry, `life.update` in the fixed step, `life.draw` after stations, keeper click opens its station, realm layer replaces the warm motes outside delves |
| `scripts/seamworks-engine.test.cjs` | 6 new tests (placement, i18n/canon, wander bounds, culling + chatter + facing, engine wiring, atmosphere cap/static) |

## Keepers

| Town | Station | Keeper | Art key (unpainted) |
|---|---|---|---|
| Infernal | Material Vendor | Buyback Clerk | `npc-material-vendor-figure` |
| Infernal | Crafting Bench | Bench Smith | `npc-bench-smith-figure` |
| Infernal | Rune Forge | **Kael** | `npc-kael-figure` |
| Infernal | Enchanting Table | Enchanter | `npc-enchanter-figure` |
| Luminous | Market | **The Merchant** | `npc-merchant-figure` |
| Luminous | Waystone (the court) | **Aureth** | `npc-aureth-figure` |
| Umbral | Gambler | Croupier | `npc-croupier-figure` |
| Umbral | Exchange | Exchange Broker | `npc-exchange-broker-figure` |
| Umbral | Unrecorded Corridors passage | **Verrin** | `npc-verrin-figure` |
| Celestial | Codex | **The Archivist** | `npc-archivist-figure` |
| Celestial | Leaderboards | Chart Clerk | `npc-chart-clerk-figure` |
| Verdant | Sanctum | Expedition Steward | `npc-expedition-steward-figure` |
| Verdant | Quest Board | Board Herald | `npc-board-herald-figure` |
| Verdant | Arena Gate | Arena Gatekeeper | `npc-arena-gatekeeper-figure` |
| Verdant | Trials Gate | Trials Warden | `npc-trials-warden-figure` |
| Verdant | Skills Lodge | Lodge Warden | `npc-lodge-warden-figure` |

- **Role keepers have titles, never personal names.** Names for the invented roles are not approved (`docs/art-commissions/01-second-wave.md`). Seven of these roles are new: Bench Smith, Enchanter, Chart Clerk, Board Herald, Arena Gatekeeper, Trials Warden and Lodge Warden. The owner should confirm them or merge them into the cast.
- **Canon keepers only say canon lines.** Their English is taken word for word from `DIALOGUE` in `npc.model.ts`, and a test enforces it. Role keepers' lines describe what the station really does.
- **Art keys end in `-figure`.** The bare `npc-kael` key is the menu portrait, and a portrait stood on the floor would be a bust at full height. When a full-figure still is imported under one of these keys, `artFor()` resolves it and `NPC_RIG` bends it with the same `poseNpc` motion the placeholder uses. Sprite *sheets* (`Sprites/NPCs/`, `spriteFor()`) are not read yet. When they land, add a sheet path in `TownLife.figure()`.
- Townsfolk keys: `townsfolk-<realm>-figure` (also unpainted).

## Behaviour

- **Placement:** each keeper tries its preferred side of its station, then the other side, then steps out up to 80 px. It never stands on any station's footprint (plus a 10 px gap) or on another keeper.
- **Idle:** breath, a weight shift and a glance. The keeper turns to face the Keeper within 320 px, narrowing through edge-on as it turns. Away from the Keeper it faces its station.
- **Chatter:** one line when the Keeper comes within 170 px. It rearms after the Keeper goes past 300 px *and* 20 s have passed, and it rotates through the keeper's lines. The bubble lasts 5.5 s and wraps to at most three lines. Without `translate` (tests) chatter is silent and name tags use their English.
- **Interaction:** clicking a keeper opens its station. E/walk-up still uses the station.
- **Townsfolk:** infernal 3, luminous 4, umbral 2, celestial 3, verdant 3 (cap 4). Each has one open-floor segment: the town minus every station footprint and keeper (18 px clearance), and west of `safeX` where monsters roam. A walker stops short of the Keeper instead of walking through. The crowd is deterministic per town. Nothing allocates after entry, and figures outside the camera are not drawn.
- **Atmosphere** (towns and their hunting grounds; delves keep their own motes):
  - infernal: rising embers and drifting ash
  - luminous: light shafts and dust motes
  - umbral: ink motes with amethyst cores
  - celestial: twinkling star glints
  - verdant: falling leaves and rising spores

  Each layer draws at most 40 particles. Under reduced motion every layer is frozen in place: a still scene, not an empty one.

## Not verified

- **No in-browser look yet.** The placeholder silhouettes, name-tag heights against the stall awnings, and bubble placement were checked only through tests and the type check. Play `/play` and walk each town.
- The `-figure` art keys are not in `ART_PENDING` (`shared/art/art.ts`, outside this branch's scope). Add them there if the pending-art gate should list them.

## What to check by playing

1. Walk the Seamworks from spawn to the waystone:
   - the Buyback Clerk, Bench Smith, Kael and Enchanter stand beside their stalls
   - each one greets you once as you approach
   - each one turns to face you
2. Turn on reduced motion. Figures stand still, the bubbles still show, and the embers freeze in place.
3. Visit all five towns. Check each realm's particles, and that the townsfolk never stand on a stall.
4. Click a keeper's body: the station panel opens.
5. Switch the language to ES: name tags and chatter change.
