# Item icons — every piece its own picture

Owner, 2026-10-21: "items … they all are looking the same — I believe assets are for the future? … or could we be
improving that?" Decision: improve now, procedurally, in the creatures' and Keeper's pixel style; hand-made art can
replace any icon later through the same lookup.

## The painter (`src/app/shared/art/gear-icons.ts`)

- **32 × 32 art px**, four tones lit from the upper left, a selective 1-px outline (a dark of the bordering colour on
  the lit top-left edge, the art-bible floor `#140a1f` on the shadow side) — the rules of `td-mobs.ts` and
  `keeper-front.ts`. Output is an SVG of crisp rects in a data URI: pure, cached by key, identical under SSR.
- **Base** (`GEAR_BASES`, one painter each): sword, greatsword, dagger, axe, mace, hammer, staff, wand, spear, bow,
  crossbow, pickaxe, sickle, shield, tome, helm, hood, crown, circlet, plate, robe, coat, gloves, boots, legs, belt,
  ring, amulet, trinket, charm, rune, potion, material.
- **Realm**: the item's own materials from `item-icons.ts ITEM_ICONS` (main, second, accent ramps), else the realm kit
  (infernal basalt/ember, luminous gold/sun, umbral violet, celestial midnight/brass, verdant rootwood/moss, void).
- **Rarity** = ornament: common plain; uncommon a trim band in the realm's metal; rare a set gem; epic filigree, a rune
  line on blades, a bigger stone, a plume; legendary a soft halo in the loot colour; mythic and singular sparkles and a
  wider halo.
- **Seed** = the instance id: blade profile (straight, leaf, tapered, broad, curved), fuller, guard wings, pommel, axe
  span and double bit, mace flanges/spikes/studs, staff head (claw, crook, shard), shield shape and device, helm form
  (great, open, winged), hood peak, crown points, pauldrons, hem, cuffs, boot height, knee guards, ring cut, amulet
  shape, gem colour from the realm's stones. The same drop always paints the same; two drops rarely match.

## Where it is wired

`material-catalog.ts itemArt(item)` asks `item-base.ts gearLookOf(item)` first, so every surface that shows a
GameItem through `itemArt` gets it: the Satchel cells, the paper-doll wells, the hover/pinned card (`.d2tip__icon`,
shown at exactly 2×), Delve chests, the Vault, the enchanting bench, the hub bank and the Exchange.

Kept on their 16-px icon (`item-icons.ts`), on purpose: materials, consumables and potions, runes, and the uniques and
charms whose kind has no painter (tongs, anvil fragments, an hourglass, a compass, a lens, a spool…) — their own shape
says what they are better than a generic base would. Ground loot in the top-down world is still the engine's glowing
drop marker.

## Replacing one with hand-made art

Paint it, import it through `scripts/import-assets.py` (never hand-write an `assets/` path), and return its
`artFor()` entry from `itemArt` before the painter for that definition id. Tests: `gear-icons.spec.ts`;
screenshots: `e2e/td-item-card-shots.spec.ts` → `docs/handoff/cozy-ui/item-icons-grid.jpg`, `item-card-req.jpg`.
