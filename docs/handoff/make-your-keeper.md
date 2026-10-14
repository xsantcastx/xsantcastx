# Make your Keeper — handoff

Owner, 2026-10-14: "everybody is playing the same character and can't be modified, i equip items everything
seems the same, i equip weapon they are really bad equipped". ROADMAP item 2. Lore: `docs/world/lore-addendum.md`,
"The Glass of Becoming".

## What a player gets

- **A pixel Keeper of their own** (Terraria-style: 48×48 art pixels drawn at 4×, one dark outline, crisp pixels).
  It replaces the painted rig Keeper for the player in the world, on the paper doll (`/character`, the Character
  place) and in the creator preview. Other Keepers at the Hearth get a stable random look from their id, so nobody
  looks the same.
- **Make your Keeper** (the Glass of Becoming): live animated preview wearing what you wear now (stand → run → swing),
  a name, nine ‹ › choices — build (slight/sturdy/broad), skin (10), hair style (8) and colour (11), eyes (3) and
  colour (6), face mark (5), tunic and trousers/trim colour (12 each) — "Surprise me", and ONE primary button,
  **Become this Keeper**. Phone-first, every control 44 px. Reached from the Places list (☰ on phones) on every
  area, always.
- **New saves**: when the tutorial ends in this tab, /play opens the Glass once (the world pauses).
  **Existing saves**: one gentle nudge — a lit dot on Places until the list is opened once, where the Glass entry
  says "The Glass of Becoming remembers a face you never chose." Never again after that.
- The chosen **name** labels the health bar (instead of "Keeper").
- **Gear that shows on the body** — every worn slot is a layer, drawn in order (cape → back arm + off-hand → back
  leg → torso + chest piece → front leg + coat skirt + boots → belt, charm beads, pendant → head, face, hair, head
  gear → weapon → front arm → hand):
  - weapon: 15 kinds read from the item's name (sword, greatsword, dagger, axe, pickaxe, hammer, mace, staff,
    wand, bow, crossbow, spear, halberd, sickle, tongs), each a pixel sprite with its own size, **grip point**,
    resting angle and swing (slash over the top, thrust, draw, cast with a tier-coloured flare). The front arm and
    weapon are drawn live, so the swing follows the attack window smoothly; the run swings the arm with the stride.
  - off-hand: shield, tome, orb/mirror, lantern, scroll — or the tool (pickaxe/axe/sickle/staff) held in the back hand.
  - head: helm (crest at rare+), hood, crown, circlet. chest: plate (pauldrons), coat, robe, mantle (a cape that
    trails while running). hands: gauntlets/wraps. legs: greaves or belt. feet: boots. trinket: pendant. charms: beads.
  - colours: the item's realm style (`STYLE_COLORS`) + its tier trim (`RARITY_TRIM`, the loot-beam ladder); epic and
    above catch light at the tip.

## How it works

| File | What |
|---|---|
| `shared/keeper-look/keeper-look.model.ts` | the look, palettes, coerce, merge (later edit wins whole; made/prompted only grow), random/seeded looks, ‹ › stepping. Import-free (cloud-save imports the merge). |
| `shared/keeper-look/keeper-gear.ts` | item → layer kind, weapon sprite specs (size, grip, idle angle, swing style), `holdPose` (arm + weapon angles per action/attack progress), `gripTransform`/`gripPoint`. Pure. |
| `shared/keeper-look/keeper-paint.ts` | `KeeperPainter`: cached outlined body frames (idle ×4, run ×8, jump, fall, attack ×2, hurt, dodge, rest, death) + live front arm and weapon; `still()` for portraits. |
| `shared/keeper-look/worn-gear.ts` | equipped items → `KeeperGear` (reads each definition's style). |
| `shared/keeper-look/keeper-look.service.ts` | the only writer of `godforge-keeper-look` (gateway + LocalSaveRegistry; synced `progress/keeper-look`, covered by the existing `progress/{docId}` rule). |
| `shared/keeper-look/keeper-maker.component.*`, `keeper-look.i18n.ts` | the creator (lazy, in the place panel); EN + ES. |
| `play/engine/engine.ts` | `setKeeperLook(look, gear)`; `drawKeeper(..., painter)` draws the pixel Keeper (player + peers) before the sheet/rig paths. |
| `play/side-scroller.component.*` | `pushKeeper` on the HUD tick (canvas `data-keeper-look` / `data-keeper-gear`), `openKeeperMaker`, the Places entry, the nudge dot, the name on the vitals. |
| `shared/rpg/equipment-panel.component.*` | the doll image is the player's painted Keeper (data URL, `data-keeper`), pixelated. Sockets untouched. |
| `shared/onboarding/onboarding.service.ts` | `finishedHere`: the tutorial ended in this tab → offer the Glass once. |

Per frame the player costs one cached blit, one weapon blit and ~30 small rects; frames are built once per look/gear
change. The painted sprite-sheet path (`sprite-manifest`) still exists but the pixel Keeper wins for every Keeper.

## Tests

- `keeper-look.model.spec.ts` (coerce, names, merge, sync registry, stepping, random/seeded), `keeper-gear.spec.ts`
  (every wearable definition gets a kind, grip lands on the hand at any angle, tip along the angle, slash/bow/spear
  arcs, run cycle, frames, and pixel diffs: a look, a weapon and a helm each change the painting).
- `e2e/play-keeper-look.spec.ts` (desktop + 390×844): nudge → Places → Glass → choices change the preview → keep →
  canvas look key + save + name; equip a maul + helm → gear key names both layers, the preview's pixels change;
  survives reload. `play-first-session` now keeps the offered look after the tutorial.

Screenshots (`docs/handoff/make-your-keeper/`, refreshed by `KEEPER_SHOTS=1` on the keeper-look spec): `old-painted-keeper-*` (before), `before-phone` (default pixel
Keeper + nudge dot), `maker-*` (the Glass with a custom Keeper in a maul and helm), `after-*` (in the world).

## Not done / next

- Remote Keepers' *chosen* looks need the presence payload to carry the look (room server change); today peers get
  a seeded look.
- The doll's item sockets still float over the figure (owned by the inventory declutter pass); with gear on the body
  they could go.
- Per-item art layers: a commissioned layer can replace any kind later through the art manifest; none exist yet.
