# Monster abilities and pack auras (S6) — handoff

Branch `mobs`, 2026-10-26. Spec: `docs/design/monsters-abilities.md` §1–§4 (the DM's); campaign S6. Shots in
`docs/handoff/mobs/` (`MOBS_SHOTS=1 PW_PORT=… npx playwright test e2e/td-mobs-shots.spec.ts`).

## What a player gets

- **Every creature family does something besides bite**, each with a readable tell and a counter the Bestiary names
  ("Kill the Ashsinger first." / "Mata primero al Cantaceniza."). Ground tells (≥ 0.6 s, never shorter on a phone):
  Glass Quake, War Stomp and Tide Smash rings round the caster; Drake and Warlord meteors (a ring, a growing shadow, the
  stone falling from the upper left, fire ground after); the Cinder Wraith's Ash Blizzard and the Gloam Witch's Gloam
  Blizzard (pulses on one ring; a Wet Keeper freezes); Little Tempers; Lava Up (three cracks toward the Keeper, bursting
  one after another, then glowing); Ember Breath (a cone); Volley of Three and Molten Fan (lines); Serve the Writ, Lash
  and Root and True Light (a line); Moss Ambush, Tunnel and Low Lantern (a stir where it will rise); Thorn Web and Spore
  Cloud (lasting ground). Body tells (a glow and the words): Scrap Spit, Pack Howl, Shriek, Will-o'-the-Fen, Bone Ward.
  Passives: Crust and Ink Trail (they leave hostile ground), Keep Walking (a Bone Walker stands up once more 1 in 4),
  Scrape (its bite bleeds, twice while you move), the Rootglass Hart's Lowered Antlers (the shipped gap-closer).
- **Raisers.** The **Ashsinger** (orc shaman, Deep Charwood and Badlands, one with every orc camp) sings up to three
  fallen orcs at half life; the **Bone Priest** (Ashen Crypt −1/−2, one a floor) musters two bone dead at 60% and wards
  kin; a Drowned Acolyte in the Drowned Crypts calls a Knight back. Counters: kill the singer first (its death ends the
  song), interrupt it (a stun or a hush in the tell), burn the dead — any fire kill leaves **ash** nothing raises; a
  raised one's second fall is laid to rest. Raised ones pay no XP and drop nothing.
- **Pack auras, D2-style** — all thirteen (Might, Blessed Aim, Conviction, Redemption, Holy Fire/Freeze/Shock,
  Fanaticism, Prayer, Vigor, Thorns, Lightless, Cant-Chorus). A bearer (an Aura Enchanted leader, or a fixed bearer: the
  Orc Warlord's Might, the Bone Priest's Redemption, the Ashsinger's Fanaticism once it has raised one, a Drowned
  Acolyte's Prayer in the Crypts, the Gloam Witch's Lightless) blesses its own pack within 4 tiles. It stands on a sigil
  disc (AuraFx's claimed floor and turning rings, a 7×7 sigil grown ×2, a dashed reach ring), blessed creatures are
  linked to it by three travelling motes and carry a pip by their bar; its plate names the aura ("Grimfang the Hollow ·
  Might"). Kill the bearer and it ends at once; Doom's Unmaking, Hunter's Mark's Strip and Banish the Bearer strip it
  for 6 s (bosses 1/5); the Keeper's own Lantern Aura / Watchfire / Pack Bond halve Lightless / Holy Freeze /
  Conviction. Reduced motion: still disc, solid lines, no motes.
- **Ten new elite affixes**: Lightless, Whispering (+3 Hush a blow), Grave-called, Mirrored (a one-hit copy), Ember-
  hearted, Brutal (every third blow a 2.2B heavy after a red arc), Aura Enchanted (from the zone's list), Multishot
  (ranged only), Shielded by Kin, Vampiric. Packs carry more in higher zones (champions 1 / 2 from 15 / 3 from 35;
  uniques 1–2 / 2–3 / 3–4; +1 Nightmare, +1 Hell, cap 5), with the §4 combining rules.
- **The Keeper feels it**: stun, freeze (4 s immunity after either), root (≤ 2 s), chill, blind (half his blows miss),
  wet, weaken, a shorter light, burns and bleeds; small glyphs over his head say which.
- **Pets and summons roam** (helper `td-roam.ts`): standing still ~1.5 s, raised skeletons, called beasts and the
  Thornstrider's spirit beast stroll and hunt 3–8 tiles out (the spirit beast settles beside him after 14 s); a fighting
  pet goes after what it sees within 8 tiles; with nothing to hunt, the pet comes back, sits and naps, every time.
  Walking off or pressing the pet card's Follow/Fight brings them all back to the formation (12 s at heel).
- **Ground items look like what they are** (helper `td-drop-art.ts`): a dropped item lies as its own icon (sword, axe,
  helm, ring, rune tablet via `runeIcon`, potion, Spellstone, material), in a beam and halo that grow with its rarity.
- Fixed on the way: an elite's tint and the hit flash no longer paint a box over the grass round the creature.

## How it works

| File | What |
|---|---|
| `play/td/td-abilities.ts` | The table (`ABILITIES`: kind, words, tell, cd, reach, B-multiples, statuses, after-ground, raise keys, counter), `tierCd`, the CC rules, the status wire (`encodeStatus`/`decodeStatus`, `STATUS_WIRE`), the wire flags. |
| `play/td/td-pack-aura.ts` | The 13 auras: level `1 + zone/5 (+2/+4)`, `packAuraFx`, looks and sigils, `packAuraPool(land, level)`, `fixedAura`, `landOf`, `halvedBy`. |
| `play/td/td-mobs.ts` | `tryAbility`/`beginAbility`/`releaseAbility`/`interruptCast` (casts ride `m.tell`/`m.aim`, so the sim dodges them and the wire carries them), rings as `DeathBurst`s with `tone`/`st`/`after`, raises as `Call`s from corpses, `hazards`, the Keeper's `kst` and `layOn`, `tickPackAuras` (bless, Keeper-side Conviction/Holy Freeze/Lightless, pulses, Prayer), affix hooks in `hurtMob`/`kill`/the bite, `healBase`, `fxCast` (shots only). |
| `play/td/td-elites.ts` | The new affixes (Aura Enchanted as `aura-<id>`), `affixAllowed`, `affixCount`, `packFollowers`, `rollElite(seed, chance, ctx)`. |
| `play/td/td-ability-fx.ts` | Every picture: rings, falling stones, hazards, cast tells, body tells, ward shards, the bearer's disc (`AuraFx`), mote lines, pips, the Keeper's status glyphs. Ring patches are baked once. |
| `play/td/td-coop.ts`, `play/world/room-world.ts`, `play/social/coop-protocol.ts`, `scripts/social-server.mjs` | The wire: `abilityFlags` in `fl` (bits 8–128: ability 0/1 telling, underground, warded, aura stripped), `bite.st` (statuses, pull/push), a `field` event for hostile ground, raised/mirror kills marked `xp: 0.001` (owe nothing), claims carry their element (a fire kill leaves ash in the room too). |
| `play/td/td-abilities.i18n.ts` | EN + ES: every ability's name and counter, the auras, the affixes, the new creatures. The Bestiary card shows "What it does". |

Room and client run the same code. Monster → Keeper statuses travel in the room's bite; a Keeper's CC on room creatures
is the room's since M4 (protocol 10, `world/room-status.ts`). Hazard statuses are felt from the drawn patch on every screen; damage is the room's.

## Balance (combat-sim, economy-sim green)

- New sim cell: an **Aura Enchanted unique pack** per vocation and level (its aura cycling through the 13, the band's
  affix count, the new pool) — inside 30–75 s and ≤ 10% falls.
- Tuned through it: an affix-heavy unique brings one fewer minion per affix past two (`packFollowers`); Prayer, Moss
  Mending and Redemption heal a share of an elite's *ordinary* life, not its rank's ×9 (`healBase`); Thorns returns at
  most the bearer's own blow; kin support (mend, ward, howl) never targets a boss. Ashsinger and Bone Priest numbers per
  §2.6–2.7 (life like a Firecaller ×0.8; the zone rule re-makes the blow).
- The sim now honours the Keeper's held feet (stun/root) and skips picture-only rings; a kiting NaN (a Keeper exactly on
  a creature) is guarded.

## Not done / next

- Party bosses (§5), world-boss mechanics and floor bosses' party forms (S8+); Consecrate and Grave-Stamp do not exist
  as skills yet (fire, Corpse Burst and Redemption are the raise counters today); Whispering's Margin Note scrap drop
  (an item: left to the items lane); Holy Shock's storm gate waits for weather (`MobSystem.storm`).
- Graftling / Prismling / Ephemeris abilities (§2.5, later lands).
