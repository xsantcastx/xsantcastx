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

## Stand-ins (for the Dungeon Master to re-canon)
These skills-100.md effects need systems that do not exist yet: allies' heals, threat, rain and Wet, the Hush rate, pack
auras, raisers. Each mark keeps its name but carries the nearest solo effect. The book's line says exactly what it does.
- **Aura of Embers**:
  - A3 Hearth-Heat: your fire +8% while it runs;
  - B2 Ash to Ash: a kill by the aura gives 2 mana.
- **Cinder Rain** B3 Dry Season: +30% on Burning foes.
- **Flame Wall** B2 Firebreak: foes in the fire walk 40% slower.
- **Raise Skeleton**:
  - A2 Ash-Bone: blows Burn;
  - A3 Captain: ×2 life and blow, no taunt;
  - B2 From Ash Too: +1 raised a cast.
- **Corpse Burst** B3: Hush only.
- **Bone Armor** B3 Shared Bones: your raised take 50% less.
- **Bone Storm**:
  - A2 Pierce: Bleed (the spears already pierce);
  - B3 Spiralling: a second fan at 50%.
- **Drain Life** B3 and **Siphoning** A3: your raised drink.
- **Siphoning** B1 Reach: +1 heal (the aura has no radius).
- **Ember Curse** B2 Mark of Ash: a cursed foe's death gives mana.
- **Dark Ward** B3: it bursts as it breaks.
- **Weaken**:
  - A2: all your hits;
  - B3: +4 s.
- **Doom** A3 and **Banish** A3: strip an elite's first affix, 10 s.
- **Whirl** A3: +20% walk while it turns.
- **Shield Bash** B2: a stun splash.
- **Shield Oath** A3: a block heals 2%.
- **Watch Cry** A2: +5% guard.
- **Ash Stride** A2: struck foes Burn.
- **Watchfire**:
  - A2: +25% regen;
  - B1: +15% Defense.
- **Vow** A3: a 5% life steal during it.
- **Kindle**:
  - A3: heals you;
  - B2: +10% on the dead.
- **Flash**:
  - A3: +1 s stun;
  - B3: heals you.
- **Lantern Aura**:
  - A2 and A3: you;
  - B2 Fog-Lamp: +1 light;
  - B3: the dark-born take +15%.
- **Shutter**:
  - A2: noticed 2 tiles later;
  - A3: the dark-born leave you be;
  - B1: −0.5 s (the floor).
- **Dawn** B3: inside is Hushed.
- **Hearthlight**:
  - A3: heals again at 60%;
  - B1 Long Reach: +10% heal.
- **Hearth Circle** B3: no chill inside.
- **Lantern Ward** B3: it bursts as it breaks.
- **Lamp-Wisp** A2, **Beacon** A2 and B2: you.
- **Thorn Shot** B3: +15% on Bleeding foes.
- **Command**:
  - A3: the commanded foe bites 20% weaker;
  - B3: it takes +10% from you.
- **Pack Bond**:
  - A2: 20% less taken while bonded;
  - A3: +5% guard and bite.
- **Call of the Wilds**:
  - A2: bites Chill;
  - B3: bites leap at 50%.
- **Stampede** B3: you heal 2% a beast.
- **Snare** B3: +0.5 s root.
- **Bramble** B3: Stun 1 s.
- **Rootwalk**:
  - A3: 15% less taken;
  - B3: the Hush cannot rise while it runs.

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

## The S2 hook
Each active row's Spellstone button (`brow__stone`, marked `S2 HOOK` in `skill-book.component.html`) opens **today's**
inscribing card under the row. That is the pouch, keyed `skill@rank`, through the HUD's `stoneView` / `inscribeStone` /
`beltStone`. While changes are pending it asks for Accept first. S2 turns it into a satchel stone that records the row's
marks (skill-book.md §4). Stone casts carry no book marks today (`MobSystem.markMask`).

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
