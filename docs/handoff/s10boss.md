# S10: Threat, party forms, and the first world boss (branch `s10boss`, 2026-11-04)

Campaign S10; design `docs/design/monsters-abilities.md` §5, §5.1, §5.3, §6.3; online `docs/design/online.md` §4d.
Base: main 271fb856 + S8 (953b3fe9, thunderstorms). Built: the vocabulary, the ten party forms, **the Antlered Storm**.
**Not built:** the Last Siege (ashfall nights) and the Fogmother (fog + three posts).

## What a player gets
- **The Storm-Struck Oak** at the Greenwood's heart (Verdant Wilds tile 64,24): a split glassy giant with a white spark
  in its split, in a ring of eighteen split stumps (its arena, 10 tiles; nothing else spawns inside). Flat and iso art.
- **The Antlered Storm** (42) rises at the Oak while a thunderstorm holds over the Greenwood, in the room-run world
  only (everyone sees the one creature). Omen + Glim's line on rising; leaves with the weather (no kill, no loot);
  felled, it stays down 2 real hours in that world. +60% life a Keeper near (the party rule). A boss: CC a fifth.
- **Its fight** (party form `antlered-storm`, the arena Wet: lightning ×1.25):
  - 100–60%: Fixate (every 4th bite a 2.5B heavy after a 0.6 s red arc), Sunder, **Lowered Antlers** on the farthest
    (0.6 s ring, 2B), **Strike** (`lum vor dra`): rings r1.5 under three Keepers, 1.2 s tell, 1.6B lightning.
  - 60–30%: **Chain** (Spread rings on everyone), **Tether** healer↔tank (`vor mur`), an Add wave of 8 Canopy Bats
    and 2 Rootglass Harts every 20 s, two strikes.
  - 30–0%: **the Eye** (a faint white ring over the arena), Soak every 10 s (4B split), Burn the Room in lightning
    every 15 s, a mending channel (`vor nyr`) to stun.
- **Crown of the Antlered Storm** (Legendary only, 1 in 10, from it alone; never an open roll): lightning resist and move
  speed on the roll; Lightning Call and Chain of Lamps +3 ranks and 30% harder; in rain or a storm
  the Keeper's lightning chains to one more foe and Wet cannot freeze him. Its card says Used for / Found in.
- **Rumours** in a Wilds thunderstorm: Ilsa Fenn and Teo Alder (the boardwalk trader). EN + ES.
- **The ten floor bosses' party forms** (§5.3, the Seam Eater's §6.1) on Nightmare and Hell with 2+ Keepers.

## The vocabulary (`play/td/td-party-boss.ts`, pure; one implementation each)
Fixate, Sunder, Burn the Room, Brand, Add wave, Interrupt cast, Soak circle, Tether, Spread, plus Strike and Charge.
`PARTY_FORMS` (phases by life share), `partyStep` (timers, rings, burns, brands, the tether, the channel; a Stun, a
Freeze or a Hush stops a channel), `partyBite` (heavy + Sunder on the fixated), `partyCleanse`, `partyHealed` (the boss
learns its healer from heal claims), `partyGuard` (the Oath drops Sunder), `MECH` (every number of §5.1).
- **td-mobs:** `Mob.form` / `Mob.pb`; `updateParty` on the simulating side (room, party host, sim); `partyBite` on the
  boss's blows; rings are bursts with `pb` (pictures; the director settles them); `partyOut` / `partyFx` / `partySeen`;
  `partyCleansed` / `partyHeal` / `partyGuarded`. A floor boss's form wakes when tier ≠ Normal and 2+ Keepers are in
  its arena; a world boss's (`m.form`) always. Solo play is untouched.
- **Threat** is S5's ledger (td-threat): the boss fixes on the top threat; the pip follows it.
- **Marks on the wire:** CoopEvent `mech` (fix, brand, tether, cast, eye, sunder, phase). The room sends them only to a
  client whose `/join` says `mech: true` (an older client would read one as a kill); the relay strips them for older
  clients of a party host; `social-server coopEvent` validates them. Drawn in the ground pass (`td-party-fx.ts`): red
  stepped ring + chevrons under the fixated, an ember sigil under the Branded, the Tether's dotted line (red when out of
  2–6 tiles), the channel's filling ring, the Eye; every mark a few hundred pixels, steady under reduced motion / Low.
- **Room (`room-world.ts`):** `weatherBoss` (rise at the landmark in its weather, leave with it, cooldown after a
  fall), `formedBossDef` (world-bosses.ts: its life ×125, blows ×4.2, boss rank, its gap-closer handed to the form, its
  materials), boss scaling includes formed bosses, Cleanse / heal claims reach the form, marks per viewer.

## Director pass (2026-11-04)
- **The boss reads as a world boss:** the Hart drawn ×3 (HD/iso) or ×2 (flat; ×3 filled the view), integer
  nearest-neighbour round its feet (`worldBossScale` / `mobScale`; its plate, its pick and its tells follow), with the
  Oak's glass-vein cyan and white sparks flickering at its antler tips (steady on Low / reduced motion).
- **Telegraphs:** party rings are drawn by `drawPartyRing` over the rain and the plates (`drawPartyOver`, both views):
  a blow to step out of (Strike, Lowered Antlers, the heavy, Burn the Room) is saturated red-orange with a 2-px dark
  outline and a 25% fill growing over its tell; a Soak is gold, Spread storm blue. On the wire the ring's kind is the
  burst's `el` (`pbhit`, `pbsoak`, `pbspread`). The Tether is a 2-px line with a dark outline. A red arrow over the
  fixated Keeper's head and an ember one over the Branded, beside their floor marks.
- Not done (nice-to-haves): the place title card's size and timing; the Crown's Used-for on two lines.

## Balance (combat-sim, `--storm`; part of `--check`)
The room's own set-up: a MobSystem with no Keeper of its own, all four as `others`, the boss's AI and form real; the
healer is a real Lanternwright MobSystem (S5); damage is each calling's sustained dps as claims (the Warlock's fire on
the whole Add wave at 60% each); rings dodged 80%; a stun lands on a channel 85%; a fixated non-tank keeps 60% of his
damage (he backs off as it swings); the tank's guard 0.55 (Oath + Banner). 16 runs a cell:
| Cell | wins | time to kill | fallen |
|---|---|---|---|
| party of four (one per calling) | **100%** | **295 s** | 0.1 |
| no tank | 0% | — | 1.9 |
| no healer | 0% | — | 3.0 |
| no AoE (Warlock) | 0% | — | 3.0 |
| solo (each calling) | 0% | — | 1.0 |
Bands: four ≥ 70% in 180–360 s; without a role ≤ 30%; solo ≤ 15%. The S5 party cells now meet the Cinder
Sovereign's and the Ink Abbess's Nightmare party forms (they interrupt and cleanse): full party falls 13% / 13%, clears
88% / 88%; no healer falls 100% (bands hold).

## Deploy (the owner)
**Hearth redeploy needed** (room-world, td-mobs, td-party-boss, social-server `mech`, social-world). Hearth first,
then the client. No rules, no functions.

## Tests
- `scripts/social-s10.test.mjs` (added to CI's node line): rises at the Oak in a storm with its omen and form, marks
  only to `mech` clients, leaves with the weather, the 2 h cooldown, the vocabulary's numbers.
- Karma `td-party-boss.spec.ts` (soak split, channel/stun, tether snap, spread overlaps, Wet strike).
- E2E `e2e/td-s10boss.spec.ts` (hook `__tdS10`: the Oak, the form's rings and marks, desktop + 390×844, the Crown's card).
- `check-meaning.js` reads a world boss's loot as its unique's source.

## Not done / gaps
- **The Last Siege and the Fogmother.** Their spec is untouched in monsters-abilities §6.2, §6.4.
- **The room runs no tiers**, so the floor bosses' party forms wake only where a screen simulates a Nightmare/Hell
  fight (a party host, the sim). When the room learns tiers they wake there too, unchanged.
- Gale / the Dry Cloak clearing the arena's Wet (§6.3's "real uses") are not wired: the arena is Wet throughout.
- A Brand on the healer herself cleanses only through an ally claim (a self-Cleanse is not told to the room).
- The fixate pip is on the floor under the Keeper, not on the boss's plate (the plate is DOM; the floor reads on phones).
- Phase names (`phase` marks) are sent but not shown; the Stormglass Antler material is not built (no use yet).
- "Worldbound" is not built (everything is tradable, owner 2026-10-27).
- The e2e photographs the form on this screen (`__tdS10`); the room path is covered by the node test, not a two-browser e2e.
