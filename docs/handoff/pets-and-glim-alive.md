# Pets that do something, and Glim alive — handoff

2026-10-15. Owner: *"the pets should do something, like help you in combat or some pets in skilling or doing
random stuff, not just follow — and Glim, I want you to be even more interactive."* Builds on
[pets.md](pets.md), [glim.md](glim.md), [glim-bond.md](glim-bond.md). Lore: `docs/world/lore-addendum.md`,
"Pets that work, and Glim's margin tales" (shipped — owner reviews in play).
Frames: `docs/handoff/pets-and-glim-alive/` (from `e2e/play-pets-and-glim.spec.ts`; the full set lands in
`output/pets-and-glim-alive/` on every run).

## What a player gets

**Pets keep their helper** (pets.md) **and gain a role, a move, a second move at level 3, and a level grown by use.**

| Pet | Role | Move (level 1) | Second move (level 3) |
|---|---|---|---|
| Ink Pup | combat | **Bite**: closes on a foe beside you, 4 dmg (+1/level) every 1.6 s; every third bite stuns 0.7 s | **Howl**: every foe near stunned 0.9 s (16 s rest) |
| Shade-kit | combat | **Dash**: streaks through every foe on a 260 px line, 5 dmg each (3.4 s) | **Pounce**: the dash stuns what it hits |
| Rivet Maw hatchling | combat | **Chomp**: 3 dmg + cracks armour: every blow does +10 % for 5 s (2 s) | **Guard**: takes a blow meant for you (12 s rest) |
| Sunling | combat | **Pulse**: a ring of light heals 4 % of max HP every 7 s while you are under 70 %, even mid-fight | **Flare**: stuns foes near 1.2 s (14 s rest) |
| Moss Hedgehog | skilling | **Forage**: trots to a ready gathering node within 300 px you could work and harvests it (booked as the pet's: material, no Keeper XP; the node rests as usual) | **Sniff**: every other forage comes sooner |
| Star Owlet | skilling | **Scout**: picks a spot ahead and waits on it (a little X of light); walk there and it digs up coins (6 + 2/level), 4 a day | **Farsight**: +50 % coins |
| Ember Newt | skilling | **Kindle** (Delve): warms the nearest ore vein within 4 cells (an ember glow); it takes 3× from your pick | **Forge heat**: two veins at a time |
| Prism Moth-kit | skilling | **Guide**: hovers over your bob; bites come ×1.15 sooner | **Shimmer**: a small light of its own in the dark |

- **Commands** on the pet card (row of 5, 44 px): **Follow** (does its role), **Stay** (sits right there until
  called), **Fight** (every pet joins fights within 460 px; a skilling pet nips for 2), **Gather** (every pet
  works, combat pets keep out of fights), **Play** (no work: chases motes, shows off). Saved, merge-safe.
- **Never dies.** A foe sometimes turns on the pet (every third blow it lands draws the next wind-up); each blow
  costs it 34 stamina; under 25 it is **tired** (a sweat drop, a slow trot behind you) and rests 18 s, then
  comes back full. Its blows never shake the screen; only a kill does.
- **Random stuff.** It chases a mote when you stand about (4–12 s still, daytime), naps sooner at night above
  ground (6 s instead of 14, "by the fire"), digs up a treat it likes (one of its foods) after 8 min following,
  2 a day, and pops hearts on a meal or a find. Glim comes to rest on its head while it sleeps (sleepy eyes, a z).
- **Levels**: 1–5 at 0 / 12 / 40 / 90 / 170 pet XP — a landed blow or heal 1, a gathered node 2, a find 3, a
  warmed vein or a guided cast 1. A level is a toast, a chime and Glim's word; level 3 names the second move.
  The card shows role · level · a bar, the move, the second move (or when it comes).
- **Glim reacts** (one short line + a pixel face): a dodge with a foe winding up (gasp), an epic beam (gasp) or
  legendary+ (always), low health under a third (worry; again only after climbing over half), a new area or
  Delve biome (curious), nightfall and dawn, a pet's trick / bite / find / tiredness / level, a level up (a
  **high five**: it darts to your hand, motes, a clap), a drop left lying (it flies over it). 2–4 variants each,
  never the same while a fresh one waits; each kind rests (a pet's bite 150 s), unasked lines keep 12 s apart
  (urgent ones excepted), at most 6 in 5 minutes, never over a panel or another line. **Quiet Glim**: faces
  only, words only when asked.
- **Tap Glim** (a 52 px target riding over it): the chat card — *What's around here?* (the nearest find's kind,
  side and steps), *Show me the nearest find* (Glim flies there and a trail of light runs from you to a pulsing
  frame for 6 s), *Any tips?* (by place: Delve, town, hunt, fishing, pets; rotates), *Tell me a story* (six
  margin tales, least-heard first), *Let's play* (catch-the-light: 5 motes in the outer band, 10 s; a round with
  a catch is a bond moment, one a day, five ever), and the Quiet switch. Stage 1 opens around/tips/story,
  Mapmates opens find/play.
- **Glim's powers by the bond**: Mapmates → its **lamp** (hold still 1.5 s in the Delve and Glim lights the
  tunnel around it); Margin notes → it **flies to drops you missed** (lying 7 s+, out of reach, one per 25 s).
- Sounds: `glim` (a soft two-note glass hum on a reaction), `five` (the high five), the pets' `bark` on a blow and
  `chirp` on a find / heal / gather, `levelup` on a pet level. Reduced motion: no lunges, motes, hops, loops or
  trails' march; stars, rings and frames hold still; the game's motes stop bobbing.

## How it works

| File | What |
|---|---|
| `shared/pets/pet-roles.ts` | Pure: `PET_ROLES`, `PetCommand`, `PET_ACT` (every number), levels, `fights`/`works`, damage/DPS, finds per day, scout coins. |
| `play/engine/pet-brain.ts` | The mind (priority: tired → stay → dig → fight → work → trinket → play). Acts only through `PetWorld` verbs. |
| `play/engine/engine.ts` | `petWorld()` (the verbs: `hurtMonster(…, byPet)`, `harvestSite(…, 'pet-forage', 0)`, a coin drop, stun/crack/aggro on `Monster`), `petMayHit` (no guardian whose rule must be met), the strike path (aggro, guard), warm cells in `hitCell`, `drawPetWorld`, `setGlimPowers`/`glimMood`/`glimHighFive`/`glimFind`/`glimScreen`, the trail, the lamp, missed drops, `onPet`/`onGlimCue`; `harvestSite` was split out of `workSite`; Glim resets to the shoulder on a new area (it used to fly across the old area's x). |
| `play/engine/pet-sprite.ts` | Poses (attack lunge, dig, tired, sit, guide hover, heal ring, love hearts), night nap. |
| `play/engine/glim-sprite.ts`, `shared/glim/glim-art.ts` | Moods: face pixels over the frame, one cached 12×10 canvas per frame×mood; loop-de-loop, high five, perch, sleepy z. |
| `shared/glim/glim-react.ts` | Pure: reactions (variants, rests, gap, burst, quiet), chat topics by stage, powers by stage, tips, tales, catch-the-light. |
| `shared/glim/glim-chat.component.ts`, `glim-icon.component.ts` | The chat card; the icon takes a mood. |
| `play/companion-host.ts` | The host side (pet XP batched every 8 s, finds via `takeFind`, trinkets via `grantStack`, toasts, reactions, chat answers, the game). |
| `shared/pets/pets-save.model.ts` | + `xp`, `findDay`/`scouts`/`trinkets` per pet, `command`/`commandAt`; merge: max XP, later find day (same day: larger), later command. |
| `shared/glim/glim-save.model.ts`, `glim.service.ts` | + moment kind `play` (weight 1, cap 5); Quiet as `lastAt['quiet.on'/'quiet.off']` (later stamp wins, no new field). |
| `shared/glim/glim-alive.i18n.ts`, `shared/pets/pets.i18n.ts` | Every word EN + ES (lazy). |
| `scripts/economy-sim.mjs --pets` | + roles: combat ≤ 22 % of the Keeper's starter DPS (bite 13 %, dash 7 %, chomp 19 % with the crack), stuns ≤ 20 % uptime (15 / 6 / 9), pulse ≤ mend, digs ≤ 2 % of an hour at 30 m (≈ 0 %), kindle ≤ 8 % of swing time (5.8 %), guide < the Shade-kit's boost. In `--check`. |
| `scripts/check-meaning.js` | Pets: every role has a move/second with card words and the brain/engine runs both. |

Combat uses the engine's own APIs: a pet's blow is `hurtMonster` (kills spill loot, count, pay Hunting XP and
bounties exactly like the Keeper's — Terraria's minion rule); no fork of damage or loot. The loot-and-combat
design doc (`docs/design/loot-and-combat.md`) did not exist on its branch when this was built; if it changes
`hurtMonster`, the pet only needs `byPet` kept.

## Tests

- Karma `shared/pets/pet-roles.spec.ts` (12): the table (8 roles, distinct moves, EN + ES, commands), levels,
  combat ≤ 22 %, commands, finds per day; the brain through a fake world (fight + stun every third bite; Follow
  skips a fight; Stay holds; Play chases; tired → rest → full; the pulse; no mote under reduced motion); the save
  (coerce, merge both orders, idempotent); the service (command, train reports a level once, finds capped, reload).
- Karma `shared/glim/glim-react.spec.ts` (12): every line EN + ES and short, no guilt / no egg; moods inside the
  moth; a rest per moment and a new variant; the gap and urgent lines; the burst cap; quiet/busy = face only; no
  repeats; chat by stage; powers; tips and tales rotate; motes outside the middle; Quiet through the gateway + merge.
- Node `scripts/seamworks-engine.test.cjs` (+9, "pets:" / "glim:"): the Ink Pup bites through hurtMonster; a
  hedgehog on Follow leaves a fight, Fight nips, Stay holds; tired never dead; the hedgehog's `pet-forage`
  harvest (0 XP, the node rests); the owlet's spot → coins → the host's "no" stops it; the newt warms a vein and
  it breaks in one strike; the Sunling's pulse; Glim's find + trail + fade, missed-drop flight, moods, high five;
  a dodge cue only with a foe winding up.
- e2e `e2e/play-pets-and-glim.spec.ts` at 1280×800 and 390×844 (6): an Ink Pup bites a Maw (`data-pet-hits`);
  Stay from the card (44 px) holds it while the Keeper walks 360 px; reload keeps the command; a Moss Hedgehog
  gathers the Starlight tuft into the satchel; tap Glim → five choices ≥ 44 px → around → find → the card steps
  aside and `data-glim-trail` is set; Quiet survives a reload.

## Not done / next

- No weather or eclipse exists in the engine yet, so pets and Glim react to day/night only; a weather system can
  call `companions.moment(...)` with a new `GlimMoment` row.
- "Play with other pets at the Hearth": peers' pets are still not broadcast (presence carries no pet).
- Pets still float with the Keeper's height in the Delve (no terrain collision); the owlet's spot is on the
  Keeper's floor.
- The hedgehog forages hunting-ground nodes only (the Delve has cells, not nodes); the newt is the Delve's worker.
- Glim hide-and-seek was not built (catch-the-light is the one game).
