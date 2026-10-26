# The Skill Book (S1)

Built 2026-10-26 on branch `skillbook`. Design: `docs/design/skill-book.md` §1–3 and §6.1–6.2, `docs/design/skills-100.md`
§0.2–0.3 and §6. Screenshots: `docs/handoff/book/book-desktop.png` (1280×800), `docs/handoff/book/book-phone.png` (390×844).

## What a player gets
- **K opens a book**: one page per tree, plus the Common page. Each skill is one row: its rank `r 7/20`, a brass **[+]**,
  and (on actives with a rank) the Spellstone button. Under the row sit **six marks**, in two branches: Edge (A) and Craft (B).
- **Marks**:
  - each one costs 1 point;
  - A2 and B2 need rank 5, A3 and B3 need rank 10;
  - a branch is taken in order;
  - the two thirds are **stars**, and a row takes one, never both. Taking the other star asks first: "Swap … ? The point moves."
- **Staged.** Every [+] and mark is pending until **Accept**. Accept is one save write. **Cancel** reverts. The foot shows
  Unused points, Accept and Cancel, or Reset book when nothing is pending. Closing with changes pending asks first (X, K
  and Escape all do).
- **Rows open on the level ladder.** A rank in a row needs one rank in any earlier row of the page. Rows that open with
  the page (level 1) need none.
- **Hover cards.** A row's card shows the Cant words, cost, "Now (rank n)", "Next rank", synergies, the sky's hand and
  what lifts its damage. A mark's card shows its branch and step, its line built from its effects, its need, and the
  star rule or "Was the passive …". On a phone the first tap picks a mark and opens its card as a bottom sheet; the
  card's Take, or a second tap, takes it.
- **Keys tab.** It holds keys 1–4 and the running aura: today's key picker, moved here.
- **Phones (≤760 px).** One page, scrolling inside its own window. The foot stays put. Every control is 44 px or more.

## The ten folded passives
Each passive is now a mark, and its own numbers run at its row's rank while the mark is held (td-tree `rankOf`):

| Passive | Mark | Number |
|---|---|---|
| Ember Mastery | Ember Bolt A3★ | +1.5% a rank |
| Soul Harvest | Bone Spear B1 | 8 mana a kill; Soul +1 per 5 Bone Spear ranks |
| Skeleton Mastery | Raise Skeleton A1 | +10%, then +1% a rank |
| Life Tap | Dark Ward A2 | on the ward's cast, 10% life becomes 15 (+1/rank) mana; never the last life |
| Hold the Line | Shield Oath A1 | +20%, then +1% a rank |
| Ember Blood | Watchfire A1 | 3%, then +0.1% a rank |
| Last Light | Lantern Ward A3★ | unchanged |
| Moth-Kin | Lamp-Wisp A1 | +10%, then +1.5% a rank |
| Wild Heart | Pack Bond A1 | +10%, then +1.5% a rank |
| Heartwood | Thorn Shot A1 | +5%, then +1.5% a rank (tuned) |

Synergies that named a folded passive now read its row:
- Ember Brand ← Watchfire
- the Vow ← Shield Oath
- Barbed Shot ← Thorn Shot
- Command and the Stampede ← Pack Bond

Three became self-synergies and are dropped: Shield Oath, Lamp-Wisp and Dark Ward.

## The save and the migration
- **Shape.** `KeeperSkillTree` gains `nodes` (a 6-bit mask a row, A1=1 … B3=32), `book: 2`, and `rebound` (set until the
  note is read).
- **Pure and lossless.** `keeper-look.model` `rebindTree` runs on read for any tree without `book: 2`:
  - ranks in the ten folded passives go back to Unused, and the marks are not taken for the player;
  - a free folded rank (the Warlock kit's Soul Harvest) is dropped;
  - a key holding Life Tap is emptied;
  - every other rank stays.
- **Merge-safe.** The tree's clock is kept, so the newer tree still wins whole (`mergeKeeperLook`). Reading twice
  refunds nothing twice. `book: 2` reaches the save on the next write through the gateway: Accept, Reset, or reading
  the note.
- **The note.** It shows once, only to Keepers who had spent points on the old board: "Your book has been rebound … N unused."
- **No rank is lost.** `clampTree` enforces level, points, the top rank and the marks' rules: rank, order and one star.
  When the level is over its points, the deepest row's marks give back first. It does **not** enforce the "earlier row"
  rule. That rule is the buying rule (`rankBlock`), so an old save whose Bone Armor stood on the free Soul Harvest keeps
  its ranks. Spec: `td-tree.spec.ts` "the Skill Book's migration".

## The marks in the fight
Data and grammar are in `play/td/td-marks.ts`. There is one record per mark: `pct`, `add`, `set`, `cd`, `mana`, `rider`,
`fold`, and named `flag` rules. The book's line is built from those same effects (`markPhrases` → `book.fx.*`), so the
words are the behaviour. The fight reads them in four places:
- `castVars` / `castCd` / `manaCost`: the numbers;
- `td-mobs` `hitFoe(…, src)`: every hit knows its skill, which drives the riders, absorb, heal and jumps;
- `markKill`: what a kill sets off;
- `mk(id, flag)`: about 100 rules, each read once.

New statuses on a creature:
- burn (`scorch*`): its share of the hit each second;
- chill: −30% pace and attacks;
- blind: half its blows miss;
- hush: no shots, no ground attack, no charge, and a wind-up in progress is cancelled;
- fear: it runs away;
- sunder stacks;
- a stripped elite affix.

`td-engine` `walkSpeed` multiplies by `mobs.markPace`. `inHearth` also counts the marks that hold the Hush.

`td-truth-marks.spec.ts` checks all 288 marks: the numbers against the fight, every rider landing, every fold, and one
probe per named rule. A rule with no probe fails.

## Stand-ins: the DM's ruling
The ruling is `docs/design/skill-book-stand-ins.md` (branch `dm-marks`, merged here).

**Applied now (b):**
- Captain of the Dead: every 6 s it taunts foes within 4 tiles for 1.5 s.
- Bone Storm A2 Pierce: each foe a spear has passed through makes it strike the next +10% harder, up to +30%. This
  replaces the Bleed.
- Swift Shutter: the toggle has no cooldown and costs no mana.
- No Shadow: it is the `hearth` flag now. While the dawn holds, the Hush cannot rise.
- Wolf, Bear or Hart: the calls come in turn.
  - The wolf's bites Chill 1 s.
  - The bear bites 40% harder. Called beasts cannot be hit, so "×1.4 life" would do nothing; this needs the DM's eye.
  - The hart gives you and it +30% walk.
- Doom A3: the strip lasts 6 s.
- Dark Ward B3: the burst is 40% of the absorb, within 2 tiles.
- Watchfire B1 is renamed Tempered Fire / Fuego templado.
- All 21 Spanish names are fixed.
- Wording from the (a) rulings: Ash to Ash reads "A foe it kills gives you N mana"; Firebreak reads "Foes crossing the
  wall walk 40% slower".

**Kept for their S-tasks (c), 34 of them:** see the ruling. S5's 23 are done (2026-10-26, `docs/handoff/s5-party-kits.md`).

**The 3 marks the earlier list missed** (the same test applies to each):
1. Banish B3 Lay Them All. skills-100.md says the unmaking "ends every raise channel within 4 tiles"; it now only
   Hushes them 2 s. This waits for S6's raisers.
2. Dawn at Noon A2 Healing Sun. "Allies inside regenerate 1.5%/s" covers only you today (S5).
3. Hearth Circle A2 Warded Ground. "Allies inside take −10%" covers only you today (S5).

Smaller departures in the same spirit, not counted:
- Hearthlight B3 Hearth Bond and Pack Bond B2 Fur and Leaf are yours only.
- Meteor A3 Twin Impact lands on the same spot, not a tile off.
- Stampede A3 Return Charge runs a second time the same way, not back.

## Marks on creatures the room runs (M3, protocol 9)
When the room (or a party host) runs the creatures, this Keeper's blows become claims (`/coop/hits`). The room
applies the damage, bounded by the Keeper's budget (`world/keeper-budget.ts`: 4× the sim's dps; the marked build's dps
is at most +13% over `REF_DPS`, at L60).

**What works:**
- Every damage lift reaches the claim: vsStatus, vuln, Sunder, bane, wrath, fireUp, pierceStack and the numbers.
- Burn and bleed riders tick locally as claims.
- Echoes, fields, jumps, shards and Doom bursts are claims too.
- Wards, heals and mana from hits are this Keeper's own.
- A fall the room announces runs the felling skill's kill marks (`coopFell` → `markKill`, via `Mob.lastSrc`).
- `td-truth-marks.spec.ts` checks this case.

**On room creatures since M4 (protocol 10).** Statuses travel beside the blows (`/coop/hits` `st`) and the room lays
them after checking each is legal for the skill and mark by the data (`world/room-status.ts`): chill, fear, blind, hush;
stun, root and taunt (marks, the Captain's, Shield Bash, snares, Watch Cry); Firebreak's and the Hearth Circle's slows;
pulls; Unmaking and Banish the Bearer's strips; burns and bleeds (ticked by the room). Still screen-only: Night
Shroud, Moth Hours and Quiet Hands (they change how creatures notice this Keeper, not the creature), Ember Brand's
ticks (claimed as blows, as before), and an item aura's slow. See `docs/handoff/room-world.md` § M4.

## Balance (combat-sim, every band green)
The refunded passive points buy ranks and marks, so the first run was 15–35% faster. Tuning:
- **A1 and riders**:
  - Ember Bolt A1 +5% (from 10%) and A2 Kindling 8%/s (from 20%);
  - Kindle A1 +5% (from 10%) and Tallow 8%/s (from 15%);
  - Watch Blade A1 +5% (from 10%);
  - Cinder Cleave A1 +10% (from 15%);
  - Banish A1 +5% (from 15%; at +15% it one-shot level-40 dead);
  - Heartwood +5% base.
- **Stars**:
  - Twin Nova 40% (from 60%);
  - Hunter's Rhythm every 5th shot (from 4th).
- **PATHS** (`scripts/combat-sim.mjs`) name each calling's marks and stars:
  - the Warlock takes Splitting Stone (B3) on Meteor;
  - the Ashguard's blade takes Craft after his Cleave;
  - the Lanternwright's wisps take Wisp Ward (B3).

## Spellstones (S2, wired 2026-10-26 by the grid branch)
Each active row's Spellstone button (`brow__stone`) opens its card under the row. **Cut it** emits `cut`, and the HUD
calls `SpellstoneService.cut(skill, rank, marks, mana)` with the row's SAVED node mask. That puts a satchel stone
recording the spell, the rank and the marks in the satchel (docs/design/inventory-grid.md §5). A full satchel refuses
it with the satchel-full line. While changes are pending the card asks for Accept first. A stone casts with its own
marks (`MobSystem.useStone(id, rank, marks)`), whatever the book holds now.

## Files
- `play/td/td-marks.ts`: new; the catalogue and grammar.
- `play/td/td-tree.ts`: book rows, marks, clamp.
- `play/td/td-skills.ts`: castVars / castCd with a mask, manaCost, rowKind, the folds' numbers.
- `play/td/td-mobs.ts`: the wiring.
- `play/td/td-engine.ts`: `markPace`, marks into `setRanks`.
- `play/spellbook/`:
  - `skill-book.component.*`: new, lazy via `@defer`;
  - `book-model.ts`;
  - `book.i18n.ts`: a lazy table, EN + ES.
  - The old `spellbook-page` component is removed.
- `shared/keeper-look/keeper-look.model.ts`: the tree shape, `rebindTree`, `FOLDED_PASSIVES`.
- Specs: `td-truth-marks.spec.ts` (new), and the tree/class specs updated.
- E2e: `td-book.spec.ts` (new; 360×640 and 390×844 touch, desktop). Every old book selector is moved to the
  `play-helpers` book helpers (`bookRow`, `pickSkill`, `learnRanks`, `putOnKey`, `bookAura`). `td-spelltree` and
  `td-book-shots` are removed.

## Not in S1
- the Stones tab and satchel Spellstones (S2);
- the per-row sound and FX kit (skills-100.md §0.6);
- the landscape two-page spread at 0.8 (landscape phones use the one-page layout);
- new rows past the shipped ones (S3, S13).
