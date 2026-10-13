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
