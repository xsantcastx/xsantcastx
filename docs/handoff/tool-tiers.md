# Tool tiers: forged tools swing faster, and the stats say so

Owner report (2026-10-13): "I equipped a pickaxe and mining speed is still the
same, should it be faster? How do I see my character's stats?"

## What was wrong

- Every Keeper had an invisible tier-I Pickaxe/Axe/Sickle floor
  (`provisionalToolTiers`), so a forged Pickaxe I changed nothing.
- `toolTiers()` reads the best tool *held* (bag or worn); equipping was never
  relevant, and nothing said so.
- The swing cooldown was a fixed 0.52 s for everything.

## What changed

**Starter tools are real items** (owner: zero players, "everything needs a
meaning"). `skills/tool-items.ts` adds `starter-pickaxe`, `starter-axe`,
`starter-sickle` ("Worn Pickaxe" …): tier I, soulbound, no rolls, worth 0. The
/play host (`ensureStarterTools` in `side-scroller.component.ts`) gives each
Keeper one of each under a fixed instance id (`starter-<family>:v1`), so it can
never mint a second copy, and gives a lost one back. It never evicts: skipped
when the satchel is full. The invisible floor is gone (`provisionalToolTiers`
now only lends blade/staff from a held weapon). Art: stand-in aliases in
`art/art.ts`.

**Swing pace (Terraria "use time")** — `skills/tools.ts`:

| Tool held (effective tier)  | Seconds per dig/gather swing |
|-----------------------------|------------------------------|
| Worn (starter) / none       | 0.52                         |
| Forged tier I               | 0.46                         |
| Forged tier II              | 0.40                         |
| Forged tier III             | 0.35                         |
| Forged tier IV              | 0.31                         |

The pace follows the *effective* tier, so a Pickaxe III at Mining 1 swings like
a Pickaxe I. `toolTiers().swing` carries it; the host passes it as
`engine.setTools({ swing })`. The engine (`swingFor`) applies it to delve cell
swings (`strikeCell`, a held J) and gathering-node swings (`workSite`), using the
tool that actually bit. Combat swings stay 0.52. Paces are clamped to
[0.25, 0.52]. Power is unchanged (`1 + (tier − min) / 2`).

**No reward exploit.** Delve Mining pay is still one booked op per 2.5 s (the
seam's breath, `delve-reward.ts`); gathering nodes still pay once per regrowth.
Faster swings open rock sooner, not more XP. Proved in
`scripts/seamworks-engine.test.cjs` (60 s of digging at 0.52 vs 0.31: paid XP
within one breath; two minutes at a sapling: the same harvests).

**Readable stats** (keys in `skills/tools.i18n.ts`, namespace `toolStat.*`, EN+ES):

- Item cards: the /play satchel slip, Quick Inspect (`entity-resolver`), and the
  Crafting Bench recipe head show power, pace, what the tier opens, and "Works as
  tier N until <Skill> L" when the skill cap bites, plus "Tools work from your
  satchel — no need to equip." Tools no longer offer "Wear" in the satchel.
- Character → Stats gets a **Tools** block (`skills/tool-stats.component.ts`,
  inside `hub-stats`): per family the effective tier, power and pace.
- /play: "Character & stats" is the last entry of the top bar's Places menu
  (the ☰ on phones — the same list), and opens the Character page in the place
  panel on its Stats tab. A separate top-bar button was tried and dropped: it
  wrapped the desktop top bar at 960 px and shifted `.top-actions .quiet`
  order that specs rely on. The satchel (I) still carries its own compact sheet.
- The canvas carries `data-swing-pickaxe` (the pace handed to the engine) for
  e2e.

## Tests

- Node: `scripts/seamworks-engine.test.cjs` — pace table + caps; swings per tier
  in 10 s of digging; combat stays 0.52; delve paid XP capped; gathering
  harvests capped.
- Karma: `skills/tool-stats.component.spec.ts`, `skills/skills.spec.ts`.
- e2e: `e2e/play-tool-tiers.spec.ts` — fresh save holds the Worn Pickaxe (0.52),
  crafts Pickaxe I, pace 0.46 without equipping, slip + Character & stats lines;
  the phone ☰ entry.

## The level sharpens the tool (2026-10-13)

Owner: "this needs to also reflect the level — higher level, better mining and
speed; remember we also level up."

Each gathering skill sharpens its tool family (`TOOL_SKILL`, now in
`skills/tool-level.ts`, re-exported from `tools.ts`): Mining → pickaxe,
Woodcutting → axe, Foraging → sickle, Enchanting → staff. On top of the tier:

- **Swing** = tierSwing × (1 − 0.25 × (L − 1) / 98), floored at 0.25 s
  (`levelSwing`; the engine clamps to the same [0.25, 0.52]). The staff is the
  exception: it works by its blast, whose cooldown is fixed, so Enchanting
  sharpens its power only.
- **Power** = tierPower × (1 + 0.5 × (L − 1) / 98). `toolTiers().power` carries
  the multiplier per family; the host passes `setTools({ power })`; the engine
  clamps it to [1, 1.5] and `toolFor(node, tiers, allowed, power)` multiplies
  the tier's damage. Cell and node HP go fractional; the existing `> 1e-3`
  break test and `crackStage` (a health ratio) already handle that.
- Combat is unchanged (swing 0.52, damage from the loadout).

| Tier \ Mining level | 1 | 20 | 50 | 99 |
|---|---|---|---|---|
| Worn | 0.52 s · ×1 | 0.495 · ×1.10 | 0.455 · ×1.25 | 0.39 · ×1.5 |
| I    | 0.46 · ×1 | 0.438 · ×1.10 | 0.403 · ×1.25 | 0.345 · ×1.5 |
| II   | 0.40 · ×1.5 | 0.381 · ×1.65 | 0.35 · ×1.88 | 0.30 · ×2.25 |
| III  | 0.35 · ×2 | 0.333 · ×2.19 | 0.306 · ×2.5 | 0.262 · ×3 |
| IV   | 0.31 · ×2.5 | 0.295 · ×2.74 | 0.271 · ×3.13 | 0.25 (floor) · ×3.75 |

(Power is against a tier-I node.)

**Rewards stay capped.** Delve Mining pay is one booked op per 2.5 s and a
gathering node pays once per regrowth, so a higher level opens rock in fewer
swings, not more XP per minute. `scripts/seamworks-engine.test.cjs`: 60 s with
a Pickaxe IV at Mining 1 vs 99, every break a fresh cell — 191 vs 226 swings,
95 vs 113 breaks, paid XP 48 vs 46 (cap 50); two minutes at a sapling at
Woodcutting 1 vs 99 — 4 harvests each. Swings-to-break at levels 1/20/50/99:
Scorched basalt 4/4/4/3, Cinder vein 3/3/3/2, Heartstone (Pickaxe III, from
Mining 20) 6/6/5/4.

**What the player sees** (keys in `tools.i18n.ts`, EN+ES):

- Satchel slip, Quick Inspect, Crafting Bench recipe card and Character →
  Stats → Tools: above level 1 the split (`toolPaceLines()`) —
  "Power ×1.81 (tool ×1.5 · Mining 42 +21%)", "Swing 0.36 s (tool 0.40 ·
  Mining 42 −10%)". At level 1 the plain lines stay.
- Level-up banner: `LevelUpEvent.tool` (`levelGain`) adds "Mining 42: swings
  0.3% faster, hits 0.5% harder" (Enchanting: "your staff hits 0.5% harder").
  The banner lives in the app shell, so it fetches `tools.i18n.ts` with a
  dynamic import on the first such line; `tool-level.ts` is the only eager
  addition.
- Canvas: `data-swing-pickaxe` (effective pace) and `data-power-pickaxe`
  (effective power vs a tier-I node).

Tests: node (`tool level:` ×2, `delve: a higher Mining level…`, `combat is
unchanged…`, `rewards per minute…`), Karma (`tool-stats.component.spec.ts`
Mining 42 split, `level-up.service.spec.ts` tool line), e2e
(`play-tool-tiers.spec.ts` Mining 42: 0.47 s / ×1.21 and the split lines).
