# Eclipse Realms — the Design Bible (D2 × Tibia × our lore)

Owner, 2026-10-21: *"lets try to design this game like if it was d2 with tibia and our lore, like mechanics ideas for
spells and stuff any inspo, dark and scary mysterious and cozy"*.

This file is the **design direction for mechanics**: pillars, the lore spine as acts, every vocation's spells, the
systems around them (eclipse, light, dread, death, runes, companions), items, world pacing and what to build next.
It builds on, and never overrides:

| Doc | Owns | This bible's relation |
|---|---|---|
| `docs/design/vision.md` | the north star: *a cozy pixel-art Tibia* | wins over this file when they disagree |
| `docs/design/loot-and-combat.md` | numbers for items, drops, families, champions, auras, difficulty | numbers here are sketches; that file + `economy-sim` stay the truth |
| `docs/design/skill-trees.md` | the Warlock's 21 shipped skills, ranks, tiers | §4.2 keeps every shipped skill and adds words, synergies, two tier-5 spells |
| `docs/design/effects-spec.md` | pixel-only effects, element palettes, layers, budget | every visual here obeys it; new palettes are marked *proposal* |
| `docs/design/leveling.md` | the 1–10,000 curve, milestones | untouched; §8 notes the milestone Gold rows need re-pricing |
| `docs/design/world-map.md` | continents, towns, floors | §9 reads hunting grounds off it |
| `docs/world/world-and-cast.md`, `lore-addendum.md` | story spine, cast, Glim, pets, eclipse lore | §3 restages the story onto continents; nothing contradicted |

**Legend.** † = a name or idea invented here (lore is pre-approved; the owner reviews it in play). Everything else is
already in canon or code. **S/U/L** = *Source / Use / Lore tie* — the owner's rule that everything needs meaning; every
system in this file carries one. Numbers are sketches in the house formulas (`value(rank) = base + grow·(rank − 1)`;
creature HP ≈ 30 + 12.5·level) and get tuned in `scripts/economy-sim.mjs` before they ship.

**Notes in flight (2026-10-21).** Passive forge gold is being removed; **Gold now drops from monsters D2-style**;
**move speed grows with level Tibia-style**. This bible assumes both.

---

## 1. Pillars — what the game *feels* like

### 1.1 The one feeling

> **Dark outside, warm inside.** The world past the lamplight is frightening, old and not fully explained. The town,
> the hearth, the house, Glim on your shoulder and the pet at your heel are *safe*, and you feel that safety precisely
> because of what is out there. The eclipse is the question nobody in town can answer.

Cozy is not the absence of dread. **Cozy is the contrast to dread.** Every scary thing we add must have a warm thing
that answers it, and every warm thing should be warmer because the dark is close.

| Dread (outside) | Answer (inside) | Where it lives |
|---|---|---|
| the dark beyond Glim's light; things that only exist in it | the lit town, lantern posts, your hearth | §5.3 light |
| the eclipse: noon goes black, the dead stir | the inn, the bell, Sera Quill writing it down calmly | §5.2 phases |
| crypts that don't stay closed, whispering grave-goods | Sexton Aldous Wren cleanses them, sweeps, counts twice | §6.5–6.6 |
| a fall in a deep floor | you wake by a hearth, whole; the town noticed you were gone | §5.8 death |
| the Hush rising on floor −5 | a cooked meal, a nap, Glim humming | §5.4 dread, §9.5 cozy loops |
| the Unbound Pattern's perfect, single answer | Glim's map that keeps its blanks honest | §3 lore |

### 1.2 Design rules for "scary but cozy"

1. **Suggest, never show all of it.** A shape at the edge of the light, a sound from below, a footprint that isn't
   yours. The scariest pixel is the one you *almost* saw. (Tibia's black tiles; D2's Tristram at night.)
2. **No jump-scares, no gore.** Dread is built from silence, darkness, wrongness and anticipation. Bones are bleached
   and tidy; blood is never pooled. Reduced-motion players lose movement, never information.
3. **The world explains itself in fragments.** Notes, tally marks, a keeper's half-sentence. Never a lore dump.
4. **Every dread has an exit.** A hearth within reach, a light you can make, a way up. Arrival tiles are safe (the
   eight-tile rule in `world-map.md`).
5. **Never punish curiosity.** Opening the strange door costs a little risk, never the save.
6. **Warmth is mechanical, not just visual.** Towns heal, rest builds bonus, food buffs, companions help.

### 1.3 What we take from Diablo II

| D2 thing | Our version | Status |
|---|---|---|
| The loot chase: rarity colours, beams, a filter | the 7-rung ladder, pixel beams, Gold drops | shipped (`loot-and-combat.md` §2, effects-spec loot pass) |
| Three skill trees, ranks 1–20, tiers by level | Warlock: Ember / Bone / Shadow | shipped (`skill-trees.md`) |
| **Synergies** (a rank in one skill feeds another) | §4.1 synergy rule, per-skill table | **new** — `SkillDef.syn` |
| Uniques, **sets**, **runewords**, sockets | uniques + Socket Words shipped; **sets new** (§7.4) | partial |
| Act bosses, town-and-wilderness rhythm | continents as acts (§3.3), capital as the act town | world shipped; act framing new |
| Champion / unique packs with affixes | `champions.ts` rolls them for the side view | **port to top-down** (§5.7) |
| Horadric Cube | **Kael's Quench**† (§7.6) | new |
| Mercenaries | **Pyre Watch sworn-swords**† (§5.9) | new |
| Normal / Nightmare / Hell | `difficulty.model.ts` | shipped (side view); top-down later |
| Magic Find, perfect rolls | MF affix, Perfect/Flawless | shipped |

### 1.4 What we take from Tibia

| Tibia thing | Our version | Status |
|---|---|---|
| Hand-made world with floors | the continents, +3…−6 floors | shipped (growing) |
| Hunting grounds by level | §9.1 table per continent | shipped (levels 1–50) |
| Vocations | Warlock + three proposed (§4.3–4.5) | 1 of 4 |
| **Spell words** (`exori vis`) | **the Seam-Cant**† — spoken pixel line over the head (§4.0) | new |
| Runes (SD, UH) made from blanks + soul | **Spellstones**† (§5.1) — avoids clashing with Forge runes | new |
| Soul points | **Soul** from kills (§5.1) — feeds Spellstones; Soul Harvest already exists | new resource |
| Stamina | **Hearthwarmth**† — rested bonus only, never a penalty (§5.10) | new |
| Death penalty + blessings | **The Cold Hearth**† + five **Hearth Blessings**† (§5.8) | new (today a fall costs nothing) |
| Houses | town houses for rent + Homestead (§9.4) | Homestead shipped; town houses new |
| Quests with keys, level doors | §9.3 key ring, level doors, levers | new |
| Rare creature drops as trophies | §7.8 **trophy drops**† | new |
| `exiva` tracking | **Lumvesh**† "seek" spell (§4.0, §5.5) | new |
| Light as a thing you manage (torches, utevo lux) | §5.3 light | partial (Glim lights, darkness exists) |

### 1.5 What we reject, on purpose

| Rejected | Why | What we do instead |
|---|---|---|
| Grind walls (a level that takes days) | the curve already caps a level at ~4.5 h (`leveling.md`) | new continents keep pace |
| Full-loot or item-loss death (Tibia red skull, D2 hardcore) | kills the cozy contract | gold purse + XP debt, recoverable, blessable |
| Stamina *penalties* | punishes the player for playing | Hearthwarmth is a bonus only |
| Real money anywhere, pay-to-win, loot boxes for cash | owner rule: **Gold only** | Gold sinks: blessings, rent, Quench, fares |
| FOMO timers | owner rule (Sera's ledger: a missed eclipse counts the same next time) | eclipses recur; seasons return |
| Random filler world | vision: hand-drawn | generators only fill a region's inside |
| Gore, jump-scares | §1.2 | suggestion, silence, light |
| Big menus for small things | vision | hover cards, one-button stations (`stations-must-be-dummy-simple`) |

---

## 2. Tone kit — how dread and coziness are built, concretely

| Lever | Dread setting | Cozy setting | Tech |
|---|---|---|---|
| Light | radius shrinks; edges dither to black | lanterns pool warm cream `#fff2a8`; windows glow | `td-engine` `darkness`, Glim light |
| Palette | desaturated, cold edge `#140c1c` outlines | warm wood/parchment `_cozy.css` tokens | effects-spec rule 2 |
| Sound | the realm tune drops an octave, longer silences; a single far bell | inn murmur, kettle, crackle | sound director cues |
| Motion | something still that should move; something moving that shouldn't | idle pets, townsfolk routines | living world |
| Text | notes in a shaky hand, half-erased | keepers' jokes, Glim's annotations | i18n EN + ES |
| Space | long corridors, black water, low ceilings | small rooms, beds, a table set for two | hand maps |

**The three horror verbs** we use (and only these): *watch* (something sees you first), *follow* (something keeps
pace outside the light), *remember* (an item or place knows something about you). **The three cozy verbs**: *rest*,
*tend* (pet, garden, hearth), *share* (the Hearth chat, a bowl at the inn).

---

## 3. Lore spine — the eclipse, the Keeper, Glim, and the continents as acts

### 3.1 The eclipse (the central mystery)

Canon: every fifth day the moon mirror crosses the sun for eight hours; noon goes black; Eclipse Glass is caught in
the rock; the realm it leans on shifts each time. Story canon: the Godforge *let go* along a line five Keepers drew; four
signed the lock, Kael refused; the erased witnesses grew into the **Unbound Pattern**.

What the player should slowly come to suspect (never stated outright until Act V):

1. **The eclipse is not weather. It is the seam breathing.** Every eclipse, the line the five Keepers drew opens a
   hair, and what was erased leans through: the dead stir, maps redraw, items whisper.
2. **The moon mirror is a piece of the lock.** The shard in Sera's Mirror Slate still faces the sky it broke under.
3. **The dark remembers what light was told to forget.** Things that exist only in the dark (§5.3) are the erased
   witnesses — not evil, *unrecorded*. Some are hostile because being forgotten hurts.
4. **You are the sixth tally mark.** The fresh mark in the Magma Halls is dated tomorrow.

### 3.2 The cast who carry it (all existing)

| Who | Role in the mechanics | Dread / cozy job |
|---|---|---|
| **The Keeper** (you) | the vocation; the sixth mark | carries light into the dark |
| **Glim**, the Margin-Light | light, pointing, hints, the Atlas, **Lumvesh** seek (§5.5), dims near false things | the cozy anchor that goes into the dark with you |
| **Kael**, the Broken Flame | Rune Forge; **Kael's Quench** (§7.6); act-break scenes | knows more than he says |
| **Sexton Aldous Wren** | cleanses cursed grave-goods (§6.5); the Barrow's key ring | sweeps graves that won't stay closed |
| **Sera Quill** | the Eclipse Ledger; eclipse phase forecasts | calm observation against panic |
| **Edrin Kade** | potions; Hearth meals (§9.5) | the warm counter |
| **Captain Brannoc Vey** | Pyre Watch sworn-swords (§5.9); Ashguard trainer | soldiers at the gate |
| **The Merchant** | Gold sinks, trophies bought | has been down there before |
| **The Archivist** | silences whispering items (§7.7); notes | the margins are where honest writing happens |

### 3.3 The continents as acts (D2 structure, our story inside)

The story in `world-and-cast.md` (Prologue → Five Witnesses → Fivefold Lock) was staged in the side-view Delve. In the
one world it moves onto the continents. **Each continent is an act**: a capital as the act town, wilderness by level,
dungeons by floor, an **act boss** at the bottom of the act's deepest dungeon, and one Witness chapter.

| Act | Continent | Levels | Act town | The dread | Act boss (deepest floor) | Mid bosses (exist) | Witness |
|---|---|---|---|---|---|---|---|
| Prologue | **Ember Isle** | 1–8 | Basalt Seamworks | the Hushed Barrow's graves don't stay closed; the beacon's light goes *down* | **The Ember Warden** (Ember Mine −3) | — | — |
| I | **Infernal Reach** | 8–30 | Pyrehold | something deep is drinking the forges' heat; the caldera smoke leans east "like it's listening" | **The Cinder Sovereign** (Molten Deep −6) | Magma Tyrant, Ashbone Dragon, Anvil-Warden | Ash (ch. 3 *The Price of a Seam*) |
| II | **Verdant Wilds** | 15–40 | Rootglass | the forest regrows *wrong* — copied shapes, a tree that wears a lantern | **The Graft Crown**† *placement* (Rootcradle −6, below the Rootwyrm) | Mossbound Colossus, Elder Rootwyrm | Thorn (ch. 5) |
| III | **Umbral Marches** | 25–50 | Gloamhaven | the fog thins round lanterns — and round *something else* that carries one | **The Mirror Parliament** (Ink Deeps, below Drowned Crypts −6) | the Ink Abbess | Veil (ch. 4, the twist) |
| IV | **Celestial Peaks** | 35–60 | Meridian | the stars are in the wrong places on the old charts — or the charts are right | **The Perihelion Engine** (Orrery Vault) | †Frostfang Matriarch | Drift (ch. 2) |
| V | **Luminous Expanse** | 45–70 | Dawnspire | noon that never ends; shadows that point the wrong way | **The Pale Refrain** (Sunken Palace −6) | †the Mirror Labyrinth's Echo | Glint (ch. 1) |
| Finale | **The Godforge threshold** | 70+ | the Seamworks (home, changed) | the Unbound Pattern offers the complete map | **The Unbound Pattern** | the Seam Eater (rises during eclipses, §5.2) | all five |

Bosses named in bold without † are canon (Bible chapter threats or shipped `td-mobs.ts`). Order note: the Bible's
chapter order was Luminous-first; in the one world the Keeper meets them in **level order**, and the Witness journal
records them in whatever order they are found — the twist (ch. 4, Umbral) still lands mid-game.

**The Seam Eater's second rising** (Bible ch. 3) becomes a **recurring eclipse event**: on an eclipse leaning on the
Infernal, after Act I, slag rises up the Ember Mine shaft and the Seam Eater assembles in the Seamworks' lower yard.
The town bell rings; townsfolk go indoors (living world); the Homestead gate is never harmed. S/U/L: *source* the
eclipse cycle; *use* a shared world boss with the boss table's best drops; *lore* "That wasn't all of it."

### 3.4 Mystery threads (what pulls the player deeper)

Every thread is already seeded in a shipped line; this table says how it pays off.

| Thread | Seed (shipped) | Clues the player finds | Pays off |
|---|---|---|---|
| **The sixth tally mark** | `roots-keepers-tally`, `magma-unsigned` | a tally scratched in every act boss's room, one more each act; the last is fresh | Finale: you carve it, or leave it blank (Glim's choice echo) |
| **Who brews the Rejuvenations?** | potions lore: "the deep things carry it, as if someone keeps handing it down" | stoppered flasks on shelves in floors nobody reached; a cork stamped with a lamp | †**The Lamplighter Below** — a sixth Keeper's apprentice who never came up, still tending lamps for whoever comes next; met in Act III; becomes a Homestead visitor |
| **Something drinks the forges' heat** | Forgewife Ysolde Marr | frost-glass in the Glass Halls; cold anvils in the Glass Foundry | the Cinder Sovereign was banking the heat to keep the seam shut; killing it warms Pyrehold but the seam breathes harder next eclipse |
| **The smoke leans east** | Scholar Odette Pryor | the smoke points at the Verdant; at the Umbral during an Umbral eclipse | it leans toward whatever the next eclipse will lean on — Odette becomes a forecaster (a second source for §5.2) |
| **Graves that don't stay closed** | Sexton Aldous Wren | grave-goods that whisper (§7.7); a grave with your name's first letter | the Barrow's dead are the first lock's erased witnesses; cleansed goods "go to sleep" |
| **The sea is warmer** | Old Netter Pell | Mirrorfin bite further south each season | the Burning Sea is the Godforge's cooling bath; it is warming as the seam opens |
| **The map that changes at night** | Glim's dashed blanks; Verrin's door "for someone the shadows already know" | Nightroads (§5.3), a Gloamhaven door that exists only by dark | the Atlas has a night page; Glim admits it draws what the dark *remembers*, not what is there |
| **Glim's first lamp** | Glim's margin tales, the "C." easter egg | — | unchanged; the finale egg stays as written |

**Fragmentary notes** (the delivery system): every dungeon floor holds 1–3 **Margin Notes**† (a parchment on the
floor, a pixel glint). Each is 1–3 lines, in one of five hands (the five Keepers), sometimes crossed out. Collected in
the Codex → Lore. S/U/L: *source* hand-placed on maps; *use* a Codex page count, an Atlas pin, and three notes in one
hand open a hidden door (§9.3); *lore* the five Keepers' own descent, written on the way down.

---

## 4. Spells & mechanics — the big section

### 4.0 The Seam-Cant†: spell words

Tibia's spells are spoken (`exori vis`); the words float over the caster. Ours are the **Seam-Cant**†, the tongue the
Seamworks scribes used to inscribe runes on basalt. It has **roots** (what) and **shapes** (how), so players learn it,
guess new words, and feel clever.

| Root | Means | | Shape | Means |
|---|---|---|---|---|
| **vael** | fire, ember | | **-sha** | a bolt, a point, one target |
| **osk** | bone, the dead | | **-orum** | a ring, a nova, all around |
| **nyr** | shadow, the unseen | | **-dra** | falling, rain, from above |
| **lum** | light, lamp | | **-mur** | a wall, a line |
| **hesk** | hearth, warmth, mending | | **-ka** | on the self, a ward |
| **thar** | thorn, root, the wild | | **-teth** | calling, raising, a summon |
| **brann** | oath, iron, the watch | | **-vesh** | seeking, finding |
| **ul** | the eclipse, the seam | | **-un** | undoing, ending, a curse |

**How it plays.** Casting shows the words as a pixel speech line over the Keeper's head for 1.2 s, in the spell's
element body tone (effects-spec palette), outlined in `#140c1c`. Optional (Settings: *Speak spells*, default on).
The words are also **typeable** in the chat line — typing `vael orum` casts Hellfire Nova if it is learned and ready
(the Tibia feel, and an accessibility path for keyboard players). Glim translates a word the first time you hear it
("*vael orum* — fire, all around. Subtle.").
S/U/L: *source* each `SkillDef` gets a `words` field; *use* feedback, typed casting, a Codex → Cant page that fills as
you learn; *lore* the cant is how the first five Keepers wrote their lock — the final spell (§4.6) is a sentence in it.

Monsters speak it too: Orc Firecallers chant `vael dra` before raining fire; the Ink Abbess murmurs `nyr orum`
before her ink wave — **a readable tell in words** alongside the ground cone.

### 4.1 Synergies (D2) — the rule

`SkillDef.syn?: { from: SkillId; per: number; what: 'dmg' | 'radius' | 'dur' | 'count' }[]` — each rank in `from`
adds `per` % to this skill's `what`. Rules: a synergy only counts **bought** ranks (never the free rank 1 of the kit,
so the starting Warlock is unchanged); synergies never stack past +100 % on one var; the Spellbook card lists "Gets
+X% from: …" with live numbers. This is the cheapest way to make every point feel like it matters.

### 4.2 The Warlock (shipped vocation) — *the hearth-witch who walks the dark*

Fantasy: the Warlock keeps a small fire burning inside, and spends it. Fire is warm and frightening at once; bone is
the dead made useful (Kael: "every rune in here was somebody's bad week made useful"); shadow is the eclipse's
language. **Trainer**: †Old Mother Cindle at the Ember Inn's back room (Seamworks) — a retired Warlock who knits.

**Shipped skills, with words, synergies and their dread/cozy note** (numbers stay as in `skill-trees.md`):

| Skill | Words | Synergy (new) | Dread / cozy / mystery |
|---|---|---|---|
| Ember Bolt (passive) | *vael sha* | +4% dmg per rank of Ember Mastery (already ×) | the staff's heartbeat; the first light you throw into the dark |
| Hellfire Nova | *vael orum* | +5% dmg / rank Aura of Embers | a ring of warmth that is also a ring of fire |
| Aura of Embers | *vael ka* | +3% radius / rank Hellfire Nova | the ground round you is claimed and warm; cold things flinch from it |
| Cinder Rain | *vael dra* | +6% dmg / rank Hellfire Nova | embers falling out of the dark — you can't see where they started |
| Flame Wall | *vael mur* | +8% dur / rank Cinder Rain | a line you draw that the dark will not cross |
| Ember Mastery (passive) | — | — | — |
| Meteor | *vael ul dra* | +5% dmg / rank Flame Wall, +5% / rank Cinder Rain | the only Ember spell that uses the eclipse root: a piece of the sky falls |
| Bone Spear | *osk sha* | +5% dmg / rank Bone Storm | a rib of the dead thrown like a promise |
| Raise Skeleton | *osk teth* | +1 max per 5 ranks Skeleton Mastery (already) | they rise from *your* kills — they are yours, they never turn |
| Soul Harvest (passive) | — | feeds **Soul** (§5.1) | the dead pay their toll in mana |
| Corpse Burst | *osk un* | +6% dmg / rank Bone Spear | the fresh dead don't get to rest yet |
| Skeleton Mastery (passive) | — | — | — |
| Bone Armor | *osk ka* | +5% absorb / rank Raise Skeleton | four shards circling the chest, clicking softly |
| Bone Storm | *osk orum sha* | +4% dmg / rank Bone Spear | — |
| Drain Life | *nyr hesk* | +4% dmg / rank Aura of Siphoning | a red thread; warmth stolen back from the cold |
| Ember Curse | *vael un* | +5% dps / rank Weaken | the ground under them smoulders |
| Dark Ward | *nyr ka* | +6% absorb / rank Life Tap | a hex of violet pixels that cracks as it saves you |
| Aura of Siphoning | *nyr hesk ka* | +4% heal / rank Drain Life | — |
| Weaken | *nyr un* | +4% radius / rank Ember Curse | — |
| Life Tap | *hesk un* | — | your own warmth turned into the dark's currency; never the last life |
| Doom | *nyr un ul* | +6% dmg / rank Weaken, +4% / rank Ember Curse | a ticking pale skull over one head; everyone near it knows |

**Two new tier-5 spells** (the empty cells in `skill-trees.md`):

| | **Ossuary Knight**† (Bone, tier 5, ← Bone Storm) | **Small Eclipse**† (Shadow, tier 5, ← Doom) |
|---|---|---|
| Words | *osk brann teth* | *ul nyr orum* |
| Does | raises one armoured dead knight (max 1) from the freshest corpse: life 300 (+40/rank), blow 20–30 (+4/+6), **taunts** creatures within 3 tiles for 2 s every 8 s; lasts until killed | for 6 s (+0.2 s/rank) a disc r3 (+0.05) round the Keeper goes **eclipse-dark**: creatures inside lose sight beyond 2 tiles (ranged ones stop shooting), Shadow spells inside deal +25% (+2%/rank), and **things of the dark become visible** (§5.3) |
| Cost | 40 mana · 30 s | 35 mana · 20 s |
| Visual | violet sigil 0.4 s, bones knit, a pixel helm closes last with a clank; eyes two `#b06bff` pixels | the ground disc steps to `#140c1c` at 70%, the ring dithers in shadow tones, a pale eclipse corona (cream/violet ring, 1 px) hangs over the Keeper |
| Synergy | +10% life per rank of Skeleton Mastery | +5% dur per rank of Weaken |
| Why | a guard who walks at your back — protective, frightening to everyone else | you *carry an eclipse*: the scary thing becomes your tool, and it reveals what is hidden |
| S/U/L | trees · a tank for solo play · the Ashen Bastion's garrison, who swore to "stand the watch past death" | trees · crowd control + secret-finding · Doom's makers learned it watching the moon mirror |

### 4.3 The Lanternwright† (proposed vocation 2) — *the one who carries the light in*

Fantasy: support / healer / anti-undead. Lanterns, moths and the hearth. The vocation **Glim was made for** — it is
the Archivist's order of lamp-keepers (canon: the Archive "recommends Mothlight to apprentices"). Trainer: Tomas Rill,
the Court's lantern keeper (canon cast). Weapon: a lantern-staff (off-hand: a lantern). Attribute: Spirit.
Trees: **Lamp** (light as weapon), **Hearth** (mending, wards, safe ground), **Moth** (Glim-bond, companions).
Element palette: *Lamp* — proposal, reuses the shipped `LEVEL_UP` tones (cream core `#fff2a8`, lantern glow, brass edge).

| Tier | Spell | Words | Does (rank 1 → growth) | Visual | Synergy | Why it's dread / cozy / mystery |
|---|---|---|---|---|---|---|
| 1 | **Kindle** (passive attack) | *lum sha* | lantern mote 7–11 holy-fire (+2/+3), ×2 vs undead and dark-born | a cream mote with a brass tail | +4% / rank Lamp Mastery | the dead hate small lights |
| 1 | **Hearthlight** | *hesk ka* | heal 30 (+6) over 3 s, self + pet + minions within 3 | stepped warm glow rising from feet | +5% / rank Hearth Circle | the first spell that makes the dark feel survivable |
| 1 | **Lantern Aura** | *lum ka* | your light radius +2 tiles (+0.1); creatures in it −10% dmg | the floor in reach steps to warm tint | +2% radius / rank Kindle | your light is a *place*, like the aura rules say |
| 2 | **Moth Swarm** | *lum teth* | 4 (+0.2) lamp-moths orbit 6 s, each 5 dmg/s to whatever they touch | 4 one-pixel moths, wings 2-frame | +6% / rank Glim's Errand | Glim's wild kin answer you |
| 2 | **Unveil** | *lum vesh* | 8 s: reveals dark-born, Nightroad doors and hidden levers within 6 tiles (+0.2); revealed creatures take +15% | a ring of cream dashes running outward | +5% dur / rank Lantern Aura | the mystery verb: *see what was hidden* |
| 3 | **Hearth Circle** | *hesk orum* | drop a 3-tile hearth ring for 10 s: allies inside regen 4/s (+1), **the Hush can't rise** inside (§5.4), creatures entering are slowed 20% | a pixel campfire + a ring of warm stones | +4% / rank Hearthlight | a tiny safe room you carry — the cozy-under-pressure spell |
| 3 | **Glim's Errand** (Moth tree) | *lum vesh teth* | Glim flies to the nearest unrevealed thing (secret, chest, rare spawn) within 20 tiles and marks it 30 s | Glim's flight + trail (shipped) | — | Glim is a teammate, not a cursor |
| 4 | **Banish** | *lum un* | 50–80 holy (+9/+13) to one target; an undead under 25% life is **unmade** outright (bosses: +50% instead) | a white-hot column, 3 frames, pixels falling up | +6% / rank Kindle | the dead that don't stay closed finally rest |
| 4 | **Lantern Ward** | *lum hesk ka* | absorbs 50 (+10) for 12 s; when it breaks, it flashes: nearby creatures are blinded 2 s | a brass lantern frame round the Keeper | +5% / rank Hearth Circle | — |
| 5 | **Last Light** | *lum hesk ul* | once per 10 min: on a fatal blow, you stay at 1 life, full light radius ×2, 3 s invulnerable | the screen edges go cream, Glim flares | — | the Lanternwright never goes fully dark |
| 5 | **Dawn at Noon** | *lum ul orum* | a 4-tile disc of daylight 8 s: inside it, it is *day* (no dark-born, eclipse modifiers off); 60–90 holy to dark-born crossing in | the disc steps up to near-white at its core, a sun-ring of 12 pixels | +5% / rank Unveil | the inverse of Small Eclipse — the two vocations answer each other |

S/U/L: *source* the vocation pick in the Keeper maker (`VOCATIONS`), trainer at Tomas Rill; *use* the support fantasy
and duo play; *lore* the Archive's lamp-keepers, Glim's own order.

### 4.4 The Ashguard† (proposed vocation 3) — *the watch that holds the gate*

Fantasy: melee knight of the **Pyre Watch** (Captain Brannoc Vey's order, canon). Shield, axe or sword, and oaths
spoken aloud. Vitality-led. Trees: **Oath** (shield, taunt, guard), **Brand** (fire on the blade), **Ash** (endurance,
the "won't fall" tree). The Ashguard is the vocation that makes melee readable in a world of breath-cones and tells.

| Tier | Spell | Words | Does | Visual | Synergy | Why |
|---|---|---|---|---|---|---|
| 1 | **Brand Strike** | *brann vael sha* | next swing +40% (+5%) and 6 fire burn over 3 s | the blade's edge pixels turn ember for one swing | +4% / rank Brand Mastery | the Seamworks smiths' oath: "it will bite before it bends" (Brandoath, canon) |
| 1 | **Shield Oath** | *brann ka* | 6 s: block 30% (+1%) of blows from the front; blocked blows feed **Resolve** | a brass square rim on the shield | +5% / rank Hold the Line | — |
| 1 | **Ash Stride** | *brann sha* | dash 3 tiles to a target, knock back 1 tile | three afterimage frames in ash grey | — | the mobility a melee needs against ranged creatures |
| 2 | **Watch Cry** | *brann orum* | taunt all within 4 tiles for 3 s; you take −15% for 3 s | a ring of brass dashes, a pixel "!" over each taunted head | +6% / rank Shield Oath | protecting the pet and Glim matters |
| 2 | **Cinder Cleave** | *vael mur* | a 3-tile arc, 120% weapon dmg as fire | a stepped ember crescent | +5% / rank Brand Strike | — |
| 3 | **Hold the Line** (passive) | — | below 40% life: +20% Defense (+2%) | the outline thickens 1 px | — | the watch doesn't step back |
| 3 | **Pyre Banner** | *brann teth* | plant a banner 15 s: allies (pet, sworn-sword, minions) within 4 tiles +15% dmg (+1%), creatures are drawn to it | a pixel banner with the Pyre Watch's flame | +4% / rank Watch Cry | a *place* you claim in the dark |
| 4 | **Ember Blood** (passive) | — | 3% (+0.2%) of damage dealt heals you | — | — | — |
| 4 | **Whirl of Cinders** | *vael orum brann* | 2 s spin, 4 hits of 60% weapon dmg as fire in r2 | ember arc pixels round the Keeper, 8 steps | +5% / rank Cinder Cleave | — |
| 5 | **Vow of the Last Watch** | *brann ul ka* | 8 s: you cannot fall below 1 life; when it ends, heal 25% of damage taken during it | the outline goes brass and stays; a bell tone | +5% dur / rank Hold the Line | *stand the watch past death* — the Ossuary Knight's oath, in the living |

S/U/L: *source* trainer Captain Brannoc Vey in Pyrehold (Ember Isle Ashguards start with a Pyre Watch recruit's
axe); *use* melee play, tanking for friends; *lore* the Pyre Watch, the Ashen Bastion's fallen garrison were Ashguards.

### 4.5 The Thornstrider† (proposed vocation 4) — *the one the wild lets through*

Fantasy: ranger / druid of the Verdant, Canopy Warden Ilsa Fenn's line (canon). Bow, traps, beasts, spores. Agility-led.
Trees: **Thorn** (bow and thorns), **Wild** (beast-call, pet synergy), **Rot** (spores, poison over time, the Sporecap's
gift). Poison palette: *proposal* — reuse Life tones with a `#4a3b1c` rot edge (one new edge tone, to be added to
effects-spec rule 2 if approved).

| Tier | Spell | Words | Does | Visual | Synergy | Why |
|---|---|---|---|---|---|---|
| 1 | **Thorn Shot** (passive attack) | *thar sha* | arrow 7–12 (+2/+3), 15% chance to pierce | a 3-px shaft with a green tip | +4% / rank Thorn Mastery | — |
| 1 | **Call of the Wild** | *thar teth* | your pet fights 10 s at ×2 power, any job | the pet's outline goes green, a pixel leaf spiral | +5% / rank Pack Bond | the pet pillar gets a vocation |
| 1 | **Spore Cloud** | *thar dra* | 3-tile cloud 5 s, 6 poison/s (+1), creatures in it −15% accuracy | slow-drifting 2-px spore puffs, sickly green | +5% / rank Rot Mastery | the Sporecaps coughed first |
| 2 | **Briar Snare** | *thar mur* | a 3-tile line of thorns 8 s: roots creatures crossing it 1.5 s (bosses 0.3 s) | thorn pixels pushing up out of the ground | +4% dur / rank Spore Cloud | — |
| 2 | **Volley** | *thar orum sha* | 5 arrows in a fan, 70% each | the fan's shafts, staggered 40 ms | +4% / rank Thorn Shot | — |
| 3 | **Pack Bond** (passive) | — | pet +10% life & dmg (+3%); the pet's trick cooldowns −10% | — | — | the pet you fed and hatted is now a partner |
| 3 | **Rootwalk** | *thar vesh* | 4 s: you pass through bramble, shallow water and webs; creatures lose your track | footprints that fill in with moss behind you | — | the forest closes behind you and opens in front (*Wildstrider* title, canon) |
| 4 | **Blight Arrow** | *thar un sha* | an arrow that leaves its target **rotting**: 40 poison over 6 s (+8); if it dies rotting, a Spore Cloud bursts there | a brown-green rot pip on the target | +6% / rank Spore Cloud | — |
| 4 | **Stag's Calling** | *thar brann teth* | a spectral Rootglass Hart charges 6 tiles, 80–110 (+12/+16), knocks back | a translucent hart, 4-frame gallop, green edge | +5% / rank Call of the Wild | the Rootglass Harts are the Stags grown old (canon) |
| 5 | **Wild Hunt** | *thar ul teth* | 10 s: every creature you've killed in the last 60 s returns as a green shade fighting for you (max 6, 20% their life) | shades in Life palette, 60% opacity | +4% / rank Pack Bond | the scariest thing in the forest is on your side for a moment |

S/U/L: *source* trainer Ilsa Fenn in Rootglass (a Thornstrider may start on Ember Isle — Ilsa's apprentice is posted
at Ashgrove's Woodward's Lodge); *use* ranged play, pet play; *lore* the Canopy Wardens, the Verdant's "shape that returns".

### 4.6 Spells every vocation learns (the Tibia "common spells")

| Spell | Words | Level | Does | S/U/L |
|---|---|---|---|---|
| **Light** | *lum* | 1 | +3 tiles of light for 5 min (stacks with Glim; no stack with itself) | Glim teaches it the first night · dark floors · the first word of the cant |
| **Lumvesh** (Seek) | *lum vesh "<name>"* | 8 | Glim answers with direction + distance band + floor: "The Ink Abbess is very far to the south-east, below you." Works on bosses you've seen, rare spawns, quest items, a friend | the Broken Astral Compass (Glim's Atlas) · finding hunts and friends · `exiva`, in Glim's voice |
| **Hearthward** (Recall) | *hesk vesh* | 5 | 6 s channel (breaks on a hit) → back to the last **lit** hearth | Edrin's tonic recipe for it · exit from any depth · the hearth always knows its own |
| **Mend** | *hesk* | 1 | heal 20 + 5% life, 30 s cd | any trainer · a floor without potions · — |
| **The Cant of Holding**† | *ul brann hesk lum nyr* | finale | the five-root sentence the first Keepers spoke wrong; spoken in the finale with Witness Runes in hand | Act V · the ending · the lock done right: every root kept |

### 4.7 Combat mechanics that make the spells sing

- **Crowd-control rules**: bosses take 20% of root/slow/blind duration; every CC shows a pixel pip on the creature.
- **Readable tells everywhere**: anything that hits for > 25% of the Keeper's life gets a 0.6 s ground tell (shipped
  for boss breaths; extend to elites with *Brutal*).
- **Element interplay** (small, memorable): *fire* on a creature standing in a Spore Cloud ignites it (one burst, 2×
  the cloud's remaining dps) · *shadow* on a creature in *Dawn at Noon* deals nothing (light wins) · *cold* on a
  burning creature cancels both and shatters for 30. Three rules, no more.

---

## 5. Systems

### 5.1 Spellstones† and Soul (Tibia runes)

Tibia's runes are consumable spells made from blanks and soul. We call them **Spellstones** so they never clash with
the Forge's 22 runes.

| | |
|---|---|
| **Blank** | a *Basalt Blank*† — 2 from cutting basalt at any mine (a new mining yield), or 5 Gold at a scribe stall |
| **Soul** | a counter, 0–100 (+1 per 20 levels, max 200). +1 for each kill of a creature no more than 10 levels below you (Soul Harvest ranks add +1 per 5 ranks for Warlocks). Shown as a small pale-flame pip by the mana orb |
| **Inscribing** | at the **Rune Forge stall** (every capital has one): Blank + Soul + a spell you know → a stone with charges |
| **Using** | belt slot like potions; any vocation can use any stone; casts at the stone's own level (your level when inscribed) |
| **Lore line** | "The Seamworks scribes cut the cant into basalt because basalt remembers being fire." |

| Spellstone | Made from | Charges | Does |
|---|---|---|---|
| Ember Shard (*vael sha*) | Ember Bolt + 2 Soul | 10 | a bolt at 140% Ember Bolt |
| Nova Stone (*vael orum*) | Hellfire Nova + 5 Soul | 4 | the nova at the inscriber's rank |
| Mending Stone (*hesk*) | Mend or Hearthlight + 3 Soul | 5 | heal 25% life — a real Tibia UH moment |
| Lantern Stone (*lum*) | Light + 1 Soul | 3 | 10 min Light |
| Ward Stone (*nyr ka*) | Dark Ward + 4 Soul | 3 | the ward |
| Waystone Chip (*hesk vesh*) | Hearthward + 8 Soul | 1 | instant recall, no channel |
| Eclipse Stone (*ul nyr orum*) | Small Eclipse + 12 Soul, inscribed **during an eclipse** | 2 | Small Eclipse |

S/U/L: *source* Soul from kills, Blanks from mining (gives the mine a reason past ore); *use* cross-vocation utility,
a Gold sink, a reason to kill near your level; *lore* the cant on basalt.

### 5.2 Eclipse phases (the world clock as a game rule)

The world day is 24 real minutes (`world-clock.model.ts`: 1 s = 1 world minute). Every fifth day an eclipse runs 8 world
hours (8 real minutes) and leans on one realm.

| Phase | When | Spawns | Spells | Loot & XP | Atmosphere |
|---|---|---|---|---|---|
| **Day** | 06–18 | the drawn spawns | Lamp spells +10% | — | full light; townsfolk out |
| **Dusk / Dawn** | 18–20, 04–06 | +1 creature per pack, 50% | — | — | gold glow (`sky.glow`); lanterns light one by one |
| **Night** | 20–04 | **night spawns**: each region has a night table (Ash Wolves → †Ashen Hounds (lvl +3), Lantern Wisps appear on land) | Shadow +10%, Lamp −10% | XP +10% | darkness; Glim's light matters; Nightroads open (§5.3) |
| **Eclipse** | every 5th day, 8 h | **Eclipse-touched**† elites: 1 in 8 creatures gets the *Eclipse-touched* affix (§5.7); the dead rise in every graveyard; the Seam Eater rises (Infernal eclipses, post Act I) | Shadow +25%, Lamp −15%, Small Eclipse doubles its radius | **in the leaning realm**: +1 ladder step for Eclipse-touched kills, Eclipse Glass ×2 (shipped), XP +20% | noon goes black; the four mirror spikes; the tune goes minor (shipped) |

**As built (2026-10-21, `play/td/td-phases.ts`).** Day: Ember spells +10%. Dawn/dusk: 1 spawn in 4 brings a second.
Night: the night tables (by the day creature: Ash Wolf → Bone Walker, Lava Hound → Ash Ghoul, Cinder Orc → Cinder Wraith,
Orc Firecaller → Bone Archer, Moss Stalker → Rootgnaw, Vine Lasher → Sporecap, Mire Lurker → Lantern Wisp, Ink Hound →
Drowned Acolyte; 1 in 3 of those spawns), 2 in 5 spawns bring a second, every wild creature ×1.2 life ×1.1 blow; Shadow
+10%, Ember −10%; XP and Gold +10%. Eclipse: all of night's, and 1 in 8 creatures **Eclipse-touched** (+1 affix, a
champion's numbers, drops one ladder step up, the dark corona); Shadow +25%, Ember −15%; XP +20%, Gold +25%; the dark
turns violet. Spawn rules hold only in the open wilds (never a town's safety, a boss, or a dungeon floor); spell strength
follows the sky everywhere. HUD: a phase plate at the minimap's foot, a warning ribbon 30 minutes before an eclipse, the
Spellbook card's phase line. Not built yet: the Seam Eater's rising (still the L-sized event below), the eclipse-only
graveyard rising, Small Eclipse's doubled radius (no such spell yet), and the leaning realm (the boosts hold everywhere).
The "Lamp" column is the Ember tree until the Lanternwright brings real Lamp spells.

Forecasts: Sera Quill's ledger shows the next eclipse's day and realm; Scholar Odette Pryor's smoke (§3.4) shows the
leaning realm a day early. S/U/L: *source* `world-clock` + `eclipse.model.ts`; *use* a reason to plan a hunt, the
night as a different place; *lore* the seam breathing.

### 5.3 Light and darkness as a resource

Today: `td-engine` has `darkness` from the sky, dark floors (`level.dark`), Glim's light, pets with the `light` job,
and loot that lights itself. This makes light a **thing you manage** without ever making the player helpless.

| Light source | Radius | Lasts | S/U/L |
|---|---|---|---|
| Glim (always) | 4 tiles (+ bond level) | forever | the companion · the floor is never fully black · Glim is a lamp |
| Light spell / Lantern Stone | +3 | 5 / 10 min | §4.6 · deep floors · the first word of the cant |
| **Torch** (placeable, †) | 3, on the ground | 10 min | 1 wood + 1 Lampfish Oil · mark a route, a safe corner · Glim calls torches its "notes" (canon) |
| **Eclipse Torch** (shipped item) | 5 | 20 min | burns Eclipse Glass · eclipse hunts · the mirror's flare |
| Lantern-light pet (Ember Newt, Prism Moth-kit) | +2 | while out | shipped job | — |
| Lit hearths, lantern posts | 4–6 | fixed | hand-placed | towns and safe rooms |

**Things that exist only in the dark** (outside every light radius; a light falling on them makes them vanish or
flee — the core *mystery* mechanic):

| Dark-born† | Where | What it does | Why it matters |
|---|---|---|---|
| **Unrecorded** (shapes) | dark floors, the Umbral at night | stand still at the edge of light; step back as light approaches; never attack | the player's first "did I see that?" — they drop **Margin Notes** when caught in Unveil |
| **Hollow Footsteps** | Hushed Barrow, Ashen Crypt | footprints appear behind the Keeper outside the light | dread only; following them backward leads to a hidden alcove |
| **Nightroads** | three per continent | boardwalks, stairs, a door that are only *there* at night or in darkness | the map that changes at night; secret hunts and chests |
| **Shade-bound chests** | deep floors | visible only in darkness; opening one in light fails | rewards *turning your light off* — the bravest cozy choice |
| **The Lamplighter's lamps** | unreached floors | a lit lamp nobody lit | the Rejuvenation thread (§3.4) |

Rule: **dark-born never ambush.** Hostile creatures stay drawn on the spawn tables; dark-born are the *mystery* layer.
Small Eclipse, Unveil and *Dawn at Noon* are the vocation spells that interact with them.

**As built (2026-10-21, `play/td/td-dark.ts` rules, `td-dark-layer.ts` run time).** *Unrecorded*: on any dark floor, and
in the open after dark (never in a town's safety), a hooded pixel shape stands just past the edge of every light (the
Keeper's, Glim's, a lantern-pet's, torches and hearths), at most 2 at once, one every 20–40 s (8–16 s at Hush 60+, when
they also stand closer). A light coming within 14 px makes it step straight back; light falling on it makes it leave
and fade (+5 Hush). They never move toward the Keeper, never touch, never block. *Hollow Footsteps*: now and then
while the Keeper walks in the dark, a 5–9 s spell of pale prints appears on his own trail just past his light (≤ 12,
4.5 s each). *Shade-bound chests*: five, hand-placed in Ember Mine 2, the Ashen Crypt 2, the Forge of the Four 2, the
Root Hollows 2 and the Drowned Crypts 2; shown only while the light on them is low (no Light spell or light relic
burning, no lantern-pet out, no torch reaching it — Glim's own light is low enough). Opening one in light says "Only
the dark can see it". Each pays three of the floor's Gold piles and a champion-rank roll of the floor's own creature
(at least one magic-or-better piece, two at most), once a session. *Nightroads*: three on Ember Isle — Ashwater Lake,
the Hushed Barrow's sea jetty, the steps below the Ember Shrine — plank ways over water, there only at night or under
an eclipse (a faint trace at dusk; a 2.5 s fade, at once under reduced motion), each to a small stone nook with a
wet page of lore (EN + ES). A road never vanishes under the Keeper: it stays while he stands on it or its nook.
Not built: Margin Notes from Unveil (no Unveil yet), following prints back to an alcove, the Lamplighter's lamps,
torches as placeables, Nightroads on the other continents, persistence of opened chests past the session.

### 5.4 The Hush† — dread, cozy-safe

A soft **dread meter** (0–100), shown as a thin pale band under Glim's portrait, never a number.

| Rises | Falls |
|---|---|
| +1 / 10 s on dark floors (−3 and below), ×2 at night, ×3 under an eclipse | −10 / s inside any lit hearth ring, town, house |
| +5 when a dark-born steps out of your light | −2 / s inside your own Hearth Circle (Lanternwright) or by a placed torch |
| +3 when you read a Margin Note | −20 for a Hearth meal; −30 when Glim hums (tap Glim, once per floor) |

| Hush | Omens (sound and sight only) | Effect |
|---|---|---|
| 0–29 | none | — |
| 30–59 | a far bell; the realm tune thins | **+5% Magic Find** ("the dark pays") |
| 60–89 | footsteps outside the light; Glim's points flicker; a shape in the fog | +10% MF, +10% XP; dark-born approach closer |
| 90–100 | the edge of the screen dithers inward 2 px; something whispers your name in the cant | +15% MF, +15% XP; **a Hush-walker†** (a single elite) may hunt you — kill it for a guaranteed rare+ and a Margin Note, or go back to the light |

Rules: the Hush **never** damages, never takes items, never blocks a menu; it is *off* below level 10 and on Ember
Isle; a setting (*Quiet dark*) caps it at 59 for players who want no omens. S/U/L: *source* depth + phase; *use* a
risk-for-reward dial the player controls with light; *lore* the erased witnesses lean closer when you are alone.

**As built (2026-10-21).** Session state only (a mood of this outing, never saved). Rises on dark floors at
0.04 + 0.03 × floor per second (floor 1 ≈ 7 min to 30, floor 6 ≈ 2½ min), ×1.5 at night, ×2 under an eclipse; in the
open 0.05/s at night, 0.1/s under an eclipse; a raised light halves the rise. Falls 10/s in a town, a lit building or
a lit hearth's ring, 2/s by a torch or lamp, 0.5/s in daylight. +5 when a shape is unveiled, +3 for a Nightroad's page.
Pays Magic Find +5/+10/+15 and Hunting XP ×1/×1.1/×1.15 by band (30/60/90); a shy chest's roll takes the MF too.
Omens, sound and sight only: band 1 a far bell every 45–75 s; band 2 bell, a flicker of the light, a whisper (small
pixel text at the light's edge, eight lines) every 22–40 s; band 3 adds the cant whispering "Keeper" and the screen's
edge dithering inward 2 art pixels. HUD: a thin pale band on a timber plate under the minimap's phase plate (desktop
and phone), notched at 30/60/90, cream → violet, flickering on an omen (a still violet edge under reduced motion),
never a number. Setting: Menu → Sound → *The Hush*: Full · Quiet (≤ 59, the bell at most) · Off; saved with the sound
settings through the gateway. Not built: the Hush-walker, Glim's hum and Hearth meals lowering it.

### 5.5 Seeking (exiva)

**Lumvesh** (§4.6). Distance bands: *beside you* (< 5 tiles), *near* (< 30), *far* (< 120), *very far*; direction in 8
points; floor *above / below / here*. Glim flies a short leg in that direction. It names nothing it hasn't seen. S/U/L:
the Atlas compass · finding rare spawns and friends · Glim's needle points at the nearest omitted fact (canon Codex).

**As built (2026-10-21, `play/td/td-seek.ts`).** Light and Seek sit on a fourth Spellbook tab, **Common** (every
vocation's page; ranks bought with the same points). *Light* (`lum`, level 1, free in the kit): +3 tiles (+0.1 a rank) to
the Keeper's own light and Glim's for 300 s (+15 a rank); spoken again it starts over. *Seek* (`lum vesh`, level 8): the
fallen purse first, else the nearest boss (every boss in its hall, by the maps' own stairs: the Ember Warden is three
floors under the Seamworks) or a task giver with a task to hand in; `lum vesh <name>` typed seeks that one (or
"purse"). Glim flies a leg that way, three lamp-toned chevrons walk out from the Keeper with a stair mark for the floor,
and Glim says it: "Glim: Something great is far to the north-west, below you." (a boss not yet in the Bestiary is
*something great*); another continent is "across the sea". Not built: rare spawns and friends as targets, the
Broken Astral Compass, a minimap mark.

### 5.6 Curses and blessings

| | Curse (on the Keeper) | Blessing |
|---|---|---|
| **Sources** | Gloam Witches' ink, Cursed elites (shipped mod), cursed grave-goods (§7.5), the Ink Abbess | Hearth Blessings (§5.8), shrines in each capital, Sera's ledger marks, a Hearth meal |
| **Shape** | a violet pip on the portrait with a timer; one line of what it does | a warm brass pip |
| **Examples** | *Inkstained*: −25 all resists 6 s · *Lightless*: Glim's light −2 · *Named*: the Hush +1/s · *Grave-cold*: −20% regen | *Hearthbound*: wake at your hearth with nothing lost · *Kindled*: +1 light · *Well Fed*: +regen |
| **Cures** | Mend Stone, Lanternwright's Hearthlight, any hearth, Sexton Wren | — |

### 5.7 Elite packs and affixes (D2 champions in the top-down world)

`shared/loot/champions.ts` already rolls champion (blue) and unique (gold, named from the Seamworks tally-books) packs
with mods for the side view. **Port `rollPack` to `td-mobs.ts` spawns** and add packs of 3–5 (gap §12.4).

| Affix | Shipped? | Does | Tell |
|---|---|---|---|
| Extra Fast / Extra Strong / Stone Skin / Fire·Cold·Lightning Enchanted / Cursed | yes | `loot-and-combat.md` §5 | name pip |
| **Lightless**† | new | snuffs light in r3 round it (Glim's too) | a black halo pixel ring |
| **Whispering**† | new | +Hush on hit; drops a Margin Note | its name flickers |
| **Grave-called**† | new | at half life raises 2 Bone Walkers (summon sigil, CALL_TELL) | bone pip |
| **Mirrored**† | new | spawns one copy that dies in one hit; Glim dims beside the copy (canon tell) | violet pip |
| **Ember-hearted**† | new | bursts on death after 1 s: fire r2 | an ember heart pixel ticking |
| **Brutal**† | new | every 3rd blow is a heavy, ground-telegraphed 0.6 s | red pip |
| **Eclipse-touched**† | new, eclipse only | +1 affix, +1 ladder step on drops, corona outline | pale corona |

### 5.8 Death and the hearth — The Cold Hearth† + Hearth Blessings†

Today a fall costs nothing (`td-engine.hurt` → wake in the square). Tibia's death is the heart of its tension; ours
must keep tension and keep cozy.

| On a fall | Rule |
|---|---|
| **Wake** | at the last **lit hearth** (an inn hearth, your house, a Hearthstone† you lit in a dungeon's safe room) — not the square |
| **Purse** | a share of carried Gold (5% Normal) is left where you fell as the **fallen purse** (shipped as `LootService.fall` in the side view); walk back and it comes home; fall again first and the old purse is lost |
| **Ember debt** | 10% of the XP your current level needs becomes a debt; while in debt, half of each kill's XP pays it off. **You never lose a level, never lose an item, never lose a skill rank.** |
| **The hearth's welcome** | a 3-minute *Chilled* (−10% move speed) — and the innkeeper has a line for it ("Sit. Soup first.") |
| **Under level 20** | nothing at all (the Rookgaard rule; Glim: "You fell. I didn't let the map forget you.") |

**Hearth Blessings** (Tibia's blessings): five, one per realm, bought at each capital's shrine for Gold (price ×
level, a real sink). Each removes 20% of the purse share and the debt; all five = a fall costs only the walk. A fall
consumes them all. S/U/L: *source* shrines in Pyrehold, Rootglass, Gloamhaven, Meridian, Dawnspire (one per Witness);
*use* the Gold sink that the new monster-Gold economy needs, tension without loss; *lore* "each realm keeps a fire for
the Keeper — the first five didn't come home, so the realms decided the sixth would."

**Shipped (2026-10-21, top-down).** `shared/hearth/` (rules, save `godforge-hearth` per character, service, shrine)
and `play/td/td-hearth.ts`. A hearth stands in every capital and village (10 across the four continents), placed on
open ground beside the arrival square; E lights it (pixel fire, Glim's sparks, "the hearth at Pyrehold takes your
flame") and the last one lit is the wake point. A fall goes dark, wakes the Keeper beside that hearth (life and mana
full) and shows what it cost: the tier's share of the purse lies where they fell as a leather pouch with an ember
beam (`LootService.fall`, `td:<continent>|<level>`; walk over it and it comes home), and an Ember debt of 10% of the
level's XP (capped at one level's worth) that half of each kill pays off, shown under the mana plate (a tag under the
orbs on a phone) and on the sheet. Under level 20 a fall costs only the walk. The four capitals have a Hearth Shrine
beside the hearth selling all five blessings (Pyre Ember, Rootglass Sap, Gloam Lantern-wick, Meridian Star-salt,
Dawnspire Morning) until Meridian and Dawnspire are built: one minute of a hunt at the Keeper's level each
(`huntGold(level, 60)`: 256 Gold at 20, 576 at 40, 2,016 at 100), 20% off the purse share and the debt each, all
consumed by a fall that costs anything. `economy-sim --hearth` holds the bands. Not yet: the 3-minute *Chilled*
welcome and the innkeeper's line (the wake card says "Sit. Soup first."), Hearthstones in dungeon safe rooms.

### 5.9 Companions — the fourth pillar

| Companion | Role | Shipped? | Grows by | Dread/cozy |
|---|---|---|---|---|
| **Glim** | light, pointing, hints, Seek, dims near false things, cheers | yes (`td-pets.ts`, `glim/`) | the bond (canon) | the warmth you carry into the dark |
| **Pet** (8) | one job each: fetch, fight, mend, light | yes | feeding, doing; tricks at 4, hats at 10 | never dies; naps |
| **Raised dead** (Warlock) | skeletons, the Ossuary Knight | yes / new | Skeleton Mastery | yours; they never turn |
| **Pyre Watch sworn-sword**† (D2 mercenary) | a hired guard, one at a time: *Watchman* (melee taunt), *Ember Archer* (ranged), *Ash-Sister* (heals 2/s) | new | levels with you; wears one weapon + one armour you give | they **fall and come back** at the hearth after 2 min (no death fee, no rehire); each has a name and 6 lines |
| **Homestead visitors** | Witness characters who move in after their chain | canon (§5 of world-and-cast) | — | someone at home when you get back |

Rule for every companion: **they never die permanently, never cost real money, never nag.** The sworn-sword's hire is
Gold (Captain Vey's fee), the Pyre Watch is canon, and a Warlock can't have a sworn-sword *and* an Ossuary Knight (one
"guard" slot) — keeps the screen readable (effects-spec budget).

### 5.10 Hearthwarmth† (stamina, inverted)

Each real hour away from the game, or resting in your house, fills 30 min of **Warmth** (max 4 h). While hunting with
Warmth: +50% XP, a warm ember pip by the portrait. When it runs out, nothing bad happens — the bonus just stops. S/U/L:
*source* time and the house bed; *use* a reason to come back that is never a penalty; *lore* "you hunt better on a
night's sleep and a full belly" (Edrin).

---

## 6. Cursed and corrupted things

### 6.1 Eclipsing an item† (D2R corruption, our way)

At an **Eclipse Altar**† (one per continent, in its dungeon's deepest safe room), during an eclipse only, place a rare+
item and 3 Eclipse Glass. **Once per item, ever.** The item is never destroyed.

| Roll | Outcome |
|---|---|
| 30% | gains one **eclipse affix** (from a small pool: +1 to a skill tree; +10% damage at night; +2 light; Shadow resist; +3 Soul per kill-streak) with its own frozen grade |
| 25% | +1 socket (to the base's max) |
| 25% | the item's **eclipse line** is revealed: a flavour line + a +5% to its implicit |
| 15% | "the glass looked away": nothing, and the item is marked *Witnessed* (+5% sell, a pale corona on its card) |
| 5% | the item becomes **Cursed** (§6.2) — it keeps every stat and gains one strong bonus and one curse |

Never rerolls existing affixes (the frozen-grade rule, `item-rolls-carry-a-frozen-grade`). S/U/L: *source* Eclipse
Glass (shipped); *use* end-game gambling with no loss of the item; *lore* the mirror's flare writes on what it touches.

### 6.2 Cursed items (grave-goods)

**Grave-goods**† drop only in crypts and barrows (Hushed Barrow, Ashen Crypt, Drowned Crypts) — 1 in 12 rare+ drops
there. A cursed item is strong and costs something:

| Item (example) | Bonus | Curse | Lore |
|---|---|---|---|
| *Sexton's Lost Cowl* (head) | +2 light, +15% vs undead | *Named*: Hush +1 / 10 s | "The Sexton counted it twice." |
| *Ossuary Signet* (trinket) | +1 Raise Skeleton max | your skeletons whisper; townsfolk step away from you | the Ashen Bastion's last captain's ring |
| *Drowned Bell-Rope* (off-hand) | +20% Shadow dmg | every 30 s a far bell; creatures within 10 tiles hear it | rung for the abbey that sank |
| *Gravewarden's Boots* (feet) | +12% move speed | *Grave-cold*: −20% regen at night | they walked the graves at night for forty years |

A cursed item **can be worn, taken off and sold** freely (cozy: no trapped slot). Sexton Aldous Wren will **cleanse**
one for Gold: the curse goes, the bonus halves, and the item gains the line "*Laid to rest.*" — a choice, not a fix.

---

## 7. Items

### 7.1 The rarity ladder (shipped — matched exactly)

| Rung | Body tone (`--cozy-loot-*`) | D2 reading | Affixes | Beam |
|---|---|---|---|---|
| common | `#d8d2c2` | Normal | 0 | glint only |
| uncommon | `#6fd36a` | Magic | 1 | 10 px |
| rare | `#5aa8ff` | Rare | 2 | 18 px |
| epic | `#b46bff` | D4 purple | 3 | 28 px |
| legendary | `#ff9a3c` | Unique gold | 4 | 38 px |
| mythic | `#ffd25a` | Set / ancient | 5 | 44 px |
| singular | `#ff6dd7` | Runeword-grade | 5 | 48 px |

Uniques drop at authored rarity with the four-pixel crown. Requirements (level + attribute) as in `loot-and-combat.md`
§3.4. Nothing here changes the ladder.

### 7.2 Boss uniques† (fixes gap §12.6: boss loot is generic)

Each act and mid boss gets **one** named unique at a 1-in-6 (normal) chance, only from that boss.

| Boss | Unique | Slot | Signature | Lore line |
|---|---|---|---|---|
| The Ember Warden | **Warden's Last Ember** | trinket | +2 light; Ember Bolt +1 rank | "It kept the mine lit after the miners left." |
| The Magma Tyrant | **Tyrant's Crucible** | off-hand | Meteor cooldown −2 s | a crucible that never cools |
| The Anvil-Warden | **Hammer of the First Watch** | weapon | Brand Strike +2 ranks; +20% vs constructs | "Four smithies. One hammer they all agreed on." |
| The Ashbone Dragon | **Ashbone Phylactery** | trinket | Raise Skeleton +1 max; your skeletons breathe fire once each | the dragon kept its last heat in a bone |
| The Cinder Sovereign | **Crown of the Banked Coal** | head | +15% fire; your fire leaves embers that light 1 tile for 10 s | it banked the heat to keep the seam shut |
| The Mossbound Colossus | **Mossbound Heart** | chest | +life regen ×2 standing still | "It stood so long the moss gave it a heartbeat." |
| The Elder Rootwyrm | **Splinterbow of the Rootcradle** | weapon (bow) | Volley +2 arrows | splinters of rootglass that remember the tree |
| The Ink Abbess | **The Abbess's Censer** | off-hand | each spell cast trails ink: −10 resist on hit, 3 s | she swung it over the drowned for a hundred years |

**As built (2026-10-21, `shared/rpg/boss-uniques.ts`, fight in `td-mobs.ts` relics).** All eight gold, rolled as any gear
of their slot at the boss's level; each drops from its boss alone (never the Gambler, never an open unique roll), and
shows on the card (*Used for* / *Found in · 1 in N*) and the boss's Bestiary card (*Keeps*). Signatures as shipped,
fitted to the Warlock's real spells: Warden's Last Ember (1 in 6) +2 light, Ember Bolt +1 rank · Tyrant's Crucible (1 in
7) Meteor −2 s · Hammer of the First Watch (1 in 7) Hellfire Nova +2 ranks, +20% on constructs (maw/prism families,
golems) · Ashbone Phylactery (1 in 8) +1 skeleton at once, each skeleton's first blow a breath of fire (3×) · Crown of
the Banked Coal (1 in 10) +15% fire, the staff's bolts leave their foe smouldering 5/s for 3 s · Mossbound Heart (1 in 8)
+2 life/s, all regeneration ×2 standing still · Splinterbow of the Rootcradle (1 in 9) Bone Storm +2 spears, Bone Spear
+3 tiles · The Abbess's Censer (1 in 10) every hit stains with ink: +10% from every hit for 3 s (creatures have no
resists in the fight yet). Gear's extra ranks stop at rank 20.

### 7.3 Socket Words (runewords — shipped, extended)

Socket Words (`socket-words.ts`, 21 words, many with auras) are our runewords. Two extensions:

- **Cant Words**†: words that grant a *spell on an event* (D2 "level 5 X on striking"), named in the cant.
  e.g. **Osk-Teth** (Shade · Ash · Hollow, staff): 8% to raise a skeleton on kill · **Lum-Orum** (Glint · Pulse ·
  Ember, armour): 10% when struck to cast a Kindle ring · **Thar-Mur** (Thorn · Drift · Veil, boots): Briar Snare
  behind you on dodge.
- **Eclipse Words**†: a word whose **last rune is set during an eclipse** gains an *eclipse line* (+1 to its aura's
  level, or the Small Eclipse corona on cast). Same runes, set at a different hour, make a different item — the most
  *mysterious* crafting rule we have, and it ties every word to the world clock.

Witness Runes stay **not socketable** (canon: quest evidence, not currency).

### 7.4 Sets† (mythic-tier "ancient" drops)

| Set | Pieces | Where it drops | 2-piece | 3-piece | Full | Lore |
|---|---|---|---|---|---|---|
| **The Ossuary Watch** | helm, chest, shield, boots | Ashen Crypt (−1, −2) | +10% Defense | +1 Ossuary Knight / Watch Cry rank | your raised dead / your taunt carry a Pyre Watch banner aura (+10% dmg) | the Ashen Bastion's garrison kit |
| **Garb of the Drowned Abbey** | hood, robe, censer-chain, sandals | Drowned Crypts | +15% Shadow | Hush +50% gain, MF +20% | Small Eclipse costs no mana at night | what the abbey's sisters wore under the water |
| **Rootcradle Vestments** | circlet, wrap, bracers, greaves | Overgrown Temple −4…−5 | +life regen | +2 Pack Bond / pet +20% | your pet is twice its size and takes 50% less | the moss-priests kept them |
| **The Lamplighter's Things** | lantern, coat, gloves, ring | dark-only chests (§5.3), one per act | +2 light | +10% MF in darkness | your light reveals dark-born (passive Unveil) | someone keeps leaving them for you (the Rejuvenation thread) |

Set pieces show a **set ribbon** pixel and a green-brass card band (cozy tokens); the card lists the bonuses greyed
until met. Code: new `set-items.ts` next to `unique-items.ts`, bonuses summed in `equippedTotals`.

### 7.5 Sockets

D2 rules: sockets by base and item level (iL 1–14: max 2; 15–29: 3; 30+: 4; shields and staves +1). Sockets come
from the drop roll, an **Eclipse** roll (§6.1), or **Kael's Quench** (§7.6). Runes in **armour** give resists, in
**weapons** the rune's weapon line (shipped D2 rule).

### 7.6 Kael's Quench† (the Horadric Cube)

At Kael's anvil in the Seamworks (and the Rune Forge stall in each capital), drop items into the quench-tub, press
**Quench**. One button, a recipe list on hover (stations stay dummy-simple).

| Recipe | In | Out |
|---|---|---|
| Rune up | 3 same Forge runes | 1 of the next tier (where the Forge allows) |
| Socket a normal | a common weapon/armour + 1 Ash + 1 Thorn + Gold | the same base, max sockets |
| Re-mint a rare | 3 rare items + 1 Sigil | a new rare at the average item level (new grades, nothing back-filled) |
| Blank Spellstones | 5 basalt + 1 Ember | 5 Basalt Blanks |
| Cleanse-and-keep | a Cursed item + Eclipse Glass ×5 | keep the curse *and* reveal a hidden eclipse line (Kael's riskier way) |
| Trophy mount | a trophy drop (§7.8) + wood | a house decoration |

S/U/L: *source* Kael (canon); *use* deterministic crafting against drop luck, a material sink; *lore* "Every rune in
here was somebody's bad week made useful."

### 7.7 Whispering items†

1 in 40 legendary+ drops is **Whispering**: its card has a faint violet edge and the line *"It is saying something."*

| Stage | Trigger | Happens |
|---|---|---|
| 0 | dropped | one cant word shows on the card, half-erased |
| 1 | 100 kills of the item's **listened family** (bone, shade, ember…) while worn | a second word; a hidden affix appears (frozen grade at reveal) |
| 2 | worn through an eclipse | the third word; the full sentence translates (Glim reads it aloud); the item gains +1 to a skill |
| 3 | a Margin Note in the same hand as the sentence | the item names who it belonged to — one of the erased witnesses — and gains a final line |

The cost: while a Whispering item is worn the Hush rises 25% faster. The Archivist will **silence** it (the item stops
growing, stays at its stage, the Hush cost goes). S/U/L: *source* drops; *use* an item that grows with you (D2's
"Hellfire Torch" feeling); *lore* the erased witnesses speaking through what they touched.

### 7.8 Trophy drops† (Tibia rare creature drops)

Every creature has one **trophy** at 1 in 500–2,000 (bosses 1 in 50): *Lava Hound Tooth*, *Ink Pup's Collar* (Ink
Hound), *a Thorn Weaver's Spindle*, *the Abbess's Veil*, *an Ashbone Scale*. A trophy is decor (mount it on a house
wall via Kael's Quench) and a Codex entry; selling it to the Merchant pays well. S/U/L: *source* the kill; *use*
house decorating, bragging on the Hearth chat; *lore* each has a one-line Bestiary addendum.

---

## 8. Economy notes (Gold only)

- **Gold drops from monsters** (in flight): coin piles on the ground, D2-style, `coins: [min, max]` in `td-mobs.ts`
  already. With passive income gone, the **milestone rows that pay "N min of income"** (`keeper-milestones.ts`) need
  re-pricing to flat Gold by level — flagged for the economy owner.
- **Sinks this bible adds**: Hearth Blessings, sworn-sword hire, Spellstone blanks, Kael's Quench, Sexton's cleansing,
  house rent, ship fares, torches. **Sources it adds**: trophies, boss uniques (sell), Eclipse Glass (Sera's ledger).
- **Move speed with level** (in flight): Tibia-style, so the walk between hunts gets shorter as you grow; keep the
  `GEAR_CAPS.moveSpeed` 40% cap on *gear* and let level add a separate small curve (e.g. +0.1% / level to 200).

---

## 9. World & pacing

### 9.1 Hunting grounds by level (from `td-mobs.ts` and `world-map.md`)

| Level | Continent | Ground (floor) | Creatures (level) | Boss |
|---|---|---|---|---|
| 1–4 | Ember Isle | the coast and roads | Ash Wolf (1), Rivet Maw (1), Cinder Imp (2), Cinder Bailiff (3) | — |
| 4–8 | Ember Isle | Ember Mine −1…−3; Slagstone Cave; the Hushed Barrow | Bailiffs, Imps, Bone Walkers (6) | **The Ember Warden** (8) |
| 8–14 | Infernal Reach | Cinder Steppe, Charwood; Ashen Crypt −1 | Lava Hound (10), Cinder-clan Orc (10), Bone Walker/Archer/Ash Ghoul (6–9), Cinder Wraith (12), Orc Firecaller (13) | — |
| 14–20 | Infernal Reach | Obsidian Badlands, Deep Charwood; Forge of the Four −1…−3; Molten Deep −1…−3 | Obsidian Golem (14), Orc Warlord (16), Ember Drake (18) | **The Anvil-Warden** (18), **The Magma Tyrant** (20) |
| 20–30 | Infernal Reach | Molten Fields; Ashen Crypt −2; Molten Deep −4…−6 | Slag Crawler (21), Glass Sentinel (24) | **The Ashbone Dragon** (25), **The Cinder Sovereign** (30) — *Act I* |
| 15–24 | Verdant Wilds | Greenwood, Fernglades; Root Hollows −1…−3 | Canopy Bat (15), Moss Stalker (17), Rootgnaw (19), Vine Lasher (21), Sporecap (23) | — |
| 24–40 | Verdant Wilds | Deep Wilds; Overgrown Temple −1…−5 | Rootglass Hart (24), Thorn Weaver (28), Drowned Acolyte (33) | **Mossbound Colossus** (34), **Elder Rootwyrm** (40); †Graft Crown (−6, ~45) — *Act II* |
| 25–38 | Umbral Marches | Gloaming Fen, Deep Fen; Drowned Crypts −1…−2 | Mire Lurker (25), Lantern Wisp (28), Ink Hound (32), Drowned Knight (38) | — |
| 38–55 | Umbral Marches | Black Meres; Drowned Crypts −3…−6; the Ink Deeps | Gloam Witch (42), †Drowned Choir (45), †Ink Wraith (48) | **The Ink Abbess** (50); †Mirror Parliament (~55) — *Act III* |
| 35–60 | Celestial Peaks (unbuilt) | high passes; Frostfang Caverns; Orrery Vault | †Frost Lynx, †Star-Eater Owls, †Orrery Sentinels | †Frostfang Matriarch; Perihelion Engine — *Act IV* |
| 45–70 | Luminous Expanse (unbuilt) | dunes, mirror oases; Sunken Palace; Mirror Labyrinth | Prism Foragers, Afterimage Moths (eclipse), †Glass Jackals | Pale Refrain — *Act V* |

Rule (from `leveling.md`): monster XP scales with level through HP; a new ground must keep `HP ≈ 30 + 12.5·level`.

### 9.2 Dungeon floors — the shape every dungeon follows

| Floor | Job | Has |
|---|---|---|
| entrance (0) | a threshold | a lit hearth or brazier, a sign, the cant carved over the door |
| −1 | the teaching floor | the dungeon's creatures one at a time; a Margin Note |
| −2…−(n−1) | the hunt | packs, an elite pack, a locked door (§9.3), a dark-only chest |
| a safe room (one per dungeon) | rest | a **Hearthstone**† to light (becomes your wake point), an Eclipse Altar on the deepest |
| bottom | the boss | the tally mark, the boss's trophy and unique, a way back up |

### 9.3 Hidden doors, keys and quest chains (Tibia)

- **The key ring**: keys are items with numbers and names (*Barrow Key 3*, *Abbey Cellar Key*), kept on a key ring
  (one inventory slot). A door shows its number on hover.
- **Level doors**: a door that only opens at level N, with a line ("The Pyre Watch admits no one under 20.").
- **Lever puzzles**: two to four levers, the order in a Margin Note on another floor.
- **Hand doors**: a door that opens when you carry three Margin Notes in one Keeper's hand.

**First chain — *The Sexton's Count*†** (Ember Isle, level 5–8, S/M): Sexton Aldous Wren counts the graves twice;
the second count is one higher. → Find the open grave at night (Nightroad path) → follow the Hollow Footsteps backward
to a sealed vault → take *Barrow Key 1* from a Bone Walker elite → the vault: a sixth grave with no name and a tally
mark → reward: *Sexton's Lost Cowl* (cursed, §6.2) **or**, if you bring it back, he cleanses it free and gives you the
Barrow's lantern (+1 light, a house decoration). Teaches night, dark-born, keys, curses and choice in 20 minutes.

### 9.4 Houses

- **Town houses**†: every capital has 4–8 drawn houses for rent (Gold per week, paid from the Vault automatically; if
  rent lapses, the house locks — **nothing inside is ever lost**). A house has a bed (Hearthwarmth ×2), a hearth
  (a wake point), walls for trophies, a chest.
- **The Homestead** (shipped plot) stays the free home; town houses are the Tibia "I live in Gloamhaven now" feeling.
- Decorating uses the existing furniture/crafting stations; trophies mount on walls.

### 9.5 Cozy loops — the rest between dreads

| Loop | Verb | Gives | Ties |
|---|---|---|---|
| **Cooking**† (Hearth meals) | cook at any hearth: fish + herb + a stall ingredient | *Well Fed* 30 min (+regen, −Hush), one meal per realm | fishing (Mirrorfin, Lampfish Oil), Moonwake Bloom |
| Fishing | shipped | fish, crates (the Ember Newt), Lampfish Oil for torches | §5.3 |
| Pet care | shipped (feed, tricks, hats) | stronger pet | Pack Bond |
| Decorating | Homestead + houses | Hearthwarmth bonus, trophies | §7.8 |
| Town tasks | shipped (`town-tasks`) | XP, Gold, a keeper's line | each act town |
| The inn | sit at a table | Glim tells a margin tale; −Hush; a song at night | the Ember Inn, the Salted Ember |
| The Eclipse watch | stand at a ledger post during an eclipse | Sera's ledger pays | shipped |

The rhythm we want per session: **town → hunt (dread rises) → a safe room or the hearth (warmth) → deeper → home.**
D2's town-and-wilderness rhythm, with Stardew's evening.

---

## 10. Roadmap — the 15 highest-impact things to build next

Ordered so each ships something the owner can **see in play**. Size S ≈ a day, M ≈ 2–4 days, L ≈ a week+. ★ = quick win.

| # | What | Size | Files / systems it touches | Visible result |
|---|---|---|---|---|
| 1 ★ | **Spell words** (the Seam-Cant): `words` on every `SkillDef`, a pixel speech line over the Keeper on cast, Codex → Cant page; monsters chant before big casts | S | `td-skills.ts` (`words`), `td-engine.ts` (speech line next to the existing `say`/bubble painter), i18n, `side-scroller.component` Spellbook | every cast says *vael orum* over your head |
| 2 ★ | **Synergies**: `SkillDef.syn`, read in `skillVars`, shown on the Spellbook card | S | `td-skills.ts`, `td-tree.ts`, Spellbook | "+18% from Hellfire Nova" on cards; points feel connected |
| 3 | **Elite packs in the top-down world**: port `rollPack` + mods, packs of 3–5, the new affixes (Lightless, Grave-called, Brutal, Mirrored) | M | `shared/loot/champions.ts`, `td-mobs.ts` spawn + draw (name pips), `td-fx.ts` | blue/gold named packs with pips; better drops |
| 4 ✓ | **Eclipse phases as rules** (shipped 2026-10-21, §5.2 as built): night spawn tables, Eclipse-touched elites, phase modifiers to spell power/XP/loot | M | `world-clock.model.ts` (`Sky`), `td-engine.setSky`, `td-mobs.ts` spawn tables, `drop-tables.ts` | night feels different; the eclipse is an event you plan for |
| 5 ✓ | **The Cold Hearth + Hearth Blessings** (shipped 2026-10-21, §5.8): wake at the last lit hearth, fallen purse in top-down, Ember debt, five shrines | M | `td-engine.hurt`, `LootService.fall`, `keeper-level.service` (debt), capital maps (shrine stalls) | a fall *means* something; a Gold sink for the new economy |
| 6 ✓ | **Lumvesh (Seek) + Light spell** (shipped 2026-10-21, §5.5 as built) | S | `td-skills.ts` (common spells), `td-world.ts` (find a mob/boss by id), Glim flight (`td-engine` glimFlight) | "The Ink Abbess is very far to the south-east, below you." |
| 7 ✓ | **Light as a resource + dark-born** (shipped 2026-10-21 but torches, §5.3 as built): torches, Unrecorded shapes, Hollow Footsteps, dark-only chests, 3 Nightroads on Ember Isle | M | `td-engine` darkness/light, `td-art.ts`, `maps/*.ts` (night-only tiles), `eclipse.model` items | the first "did I see that?" moment |
| 8 | **The Sexton's Count** chain + key ring + Margin Notes | M | `shared/town-tasks`, `maps/` Hushed Barrow, a `notes` collection in `collection.model.ts` | a 20-minute spooky quest on the starter island |
| 9 ✓ | **Boss uniques** (8 named; shipped 2026-10-21, §7.2 as built) | S–M | `rpg/unique-items.ts`, `drop-tables.ts` boss path, item icons | every boss has a reason to farm it |
| 10 | **Spellstones + Soul** | M | new `shared/spellstones/`, belt (`potions` pattern), mining yield (Basalt Blank), Rune Forge stall | Tibia runes; mines and kills both matter |
| 11 | **Cursed grave-goods + Sexton cleansing** | S–M | `unique-items.ts` (cursed flag), loot card, Sexton's dialogue | strong-but-strange items with a choice |
| 12 | **Sets** (4) | M | new `rpg/set-items.ts`, `equippedTotals`, item card band | a mythic chase with goals |
| 13 | **Kael's Quench** (6 recipes) | M | new `shared/quench/`, Kael's station UI (one button) | deterministic crafting; sockets |
| 14 ✓ | **The Hush** (shipped 2026-10-21, §5.4 as built; the Hush-walker still to come) | M | HUD band under Glim, `td-engine` tick, settings | depth feels deeper; a risk dial |
| 15 | **Second vocation: the Ashguard** (then Lanternwright, Thornstrider) | L | `keeper-look.model.ts` `VOCATIONS`, `vocation-look.ts`, `td-skills.ts` trees, `td-mobs.ts` melee path | a second way to play |

**Also queued (not top 15):** Whispering items (M), Eclipsing items at altars (M), town houses (L), Pyre Watch
sworn-swords (M), Hearth meals / cooking (M), Hearthwarmth (S), trophy drops (S), the two Warlock tier-5 spells (S each),
the Seam Eater eclipse event (L), Eclipse Words (S once eclipses are rules).

**Why this order.** 1–2 make the existing 21 spells *feel* like D2 and Tibia at once for almost no cost. 3–4 make the
world dangerous and alive at the hunt level. 5 gives tension and the Gold economy a sink right when monster Gold lands.
6–8 deliver the *mysterious* pillar on the starter island where every player sees it. 9–13 deepen the loot chase.
14–15 are the big ones, built on everything before them.

---

## 11. Checklist for anything new (paste into a PR)

- [ ] **Source / Use / Lore tie** written (Found in / Used for on the card; `check:meaning` passes).
- [ ] Pixel only, element palette, ground/air layers, ≤ 60% over a creature, reduced-motion still (effects-spec).
- [ ] Dread answered by warmth somewhere within reach (§1.1); never item loss, never real money.
- [ ] Every big hit has a tell; every CC shows a pip; bosses take 20% CC.
- [ ] i18n EN + ES; new namespaces checked against the i18n gate (backticked filenames gotcha).
- [ ] Numbers through `economy-sim` (`--loot`, `--combat`, `--leveling`) before shipping.
- [ ] Stations: one plain button, cost shown, everything else behind Details.
