# Monsters' abilities, auras, affixes and party bosses (design)

Kept by the Dungeon Master. Written 2026-10-26 (design pass, branch `dm-design`). Builders implement from this page.
It extends `docs/design/loot-and-combat.md` §4, §5, §7 and §10 and `docs/design/design-bible.md` §5.7; where they
disagree, this page wins for creature abilities and auras, and canon.md wins for names and lore.

Owner asks this answers (2026-10-26): monsters each get special abilities (D2-style resurrection, flame attacks,
meteors, blizzards, AoE smash); auras shared through a pack (Blessed Aim, Conviction, Redemption and the like), made to
look good for the coming graphics upgrade; some bosses must need a healer, AoE and a tank, MMO-style, so people play
together.

Companion pages: `skills-100.md` (the Keepers' side: statuses, taunts, heals, the nodes that answer these abilities),
`world-acts.md` (weather, the zones these creatures live in, PvP), `skill-book.md`.

**Units.** A tile is 16 art px (the shipped Cold Aura's 48 px is 3 tiles). **B** is the creature's own blow at its
zone level: the `dmg` pair after `atZoneLevel` and the tier, the same roll its bite uses. "2B" means twice that roll.
Cooldowns are in seconds. `BOSS_TELL` = 0.6 s, `CALL_TELL` = 0.6 s (shipped, `td-mobs.ts`).

---

## 1. Rules every ability obeys

1. **The telegraph rule.** Anything that can deal more than 25% of a Keeper's life at the creature's own level (zone
   level, Normal) gets a **ground tell of at least 0.6 s** (`BOSS_TELL`), drawn on the ground layer under every
   creature, in the ability's element tones, with the two-tone front closing in as the shipped breath cone does. Phones
   keep the floor: no tell is ever shorter than 0.6 s on a touch device, even under Extra Fast. Smaller abilities get a
   **body tell** instead: a 0.4 s glow on the caster and its words over its head.
2. **Every ability has a counter** a Keeper can learn from the Bestiary card, and the card says it in one line ("Step
   out of the ring", "Kill the Ashsinger first", "Burn the dead"). Three counter kinds, at least one per ability:
   *move* (step out, break line of sight, close the distance), *interrupt* (a stun, Freeze, Hushed or Taunt during the
   cast cancels it and starts its cooldown at half), *prepare* (resist the element, cleanse the status, burn corpses).
3. **Words are tells.** A creature that casts speaks its Seam-Cant over its head when the tell starts (ember text;
   shade and eclipse creatures `#d8c0ff`, as the Seam Eater's). The words follow canon §6.1, including the two roots
   this pass adds: **vor** (the sky, weather, storm) and **rim** (cold, frost, ice). A Keeper who knows the Cant knows
   what is coming: *dra* falls from above, *orum* is a ring, *mur* a line, *teth* raises.
4. **Scaling.** An ability's damage is in multiples of B, so it rises with the zone level and the tier exactly as the
   bite does (Nightmare ×1.6, Hell ×2.2). Radii, cooldowns and counts do **not** change with level. The tier adds
   cadence instead: on Nightmare every ability's cooldown is ×0.85, in Hell ×0.7; tells never shorten.
5. **Crowd control on bosses** lasts 1/5 (design-bible §4.7, the shipped rule), and a boss's cast is interrupted only
   by a Stun, Freeze or Hushed that lands during its tell (then the cooldown starts at half). Taunt on a boss sets top
   threat, it does not cancel a cast.
6. **No ambush.** Dark-born never ambush (canon §2). No ability starts from off screen; a creature must have the Keeper
   in sight for the tell to begin. A burrowed or hidden creature shows a ground tell (a stir in the moss, ink rings)
   before it rises.
7. **No gore.** Stains are rust-brown and dry; bones are bleached and tidy; nothing bleeds red. Bleed shows as a
   red-brown pip and dust.
8. **Every dread has an exit.** No ability roots a Keeper longer than 2 s, chains CC without a 4 s immunity after a
   Freeze or Stun, or follows a Keeper into a town's safe ground.
9. **Statuses** are the one table in `skills-100.md` §0 (Burn, Chill, Freeze, Shock, Wet, Bleed, Root, Stun, Blind,
   Weaken, Taunt, Mark, Hushed). A creature applying one uses those numbers.

---

## 2. Creature abilities by family

New ability fields on `MobDef` (data, so the Bestiary reads it): `ability: { kind, words, tell, cd, ... }`. The kinds
are a short list a builder implements once and reuses:

| Kind | What it is | Reuses |
|---|---|---|
| `raise` | brings back a fallen creature of the listed keys from a corpse within r | td-corpse, the summon path (`CALL_TELL` sigil) |
| `wave` | a cone or line of an element that travels | the breath code (`ranged.kind 'breath'`) |
| `drop` | rings fall from above after a tell (meteor, hail, ink rain) | the Seam Rend ring code (`rend`) |
| `field` | a lasting area on the ground (fire, ice, ink, web, spores) | Flame Wall's ground strip |
| `smash` | a ring round the caster after a wind-up | the gap-closer's `slam` |
| `leap` / `charge` | the shipped gap-closer, given to ordinary creatures | `MobDef.charge` |
| `ward` | shields or heals kin | new: an absorb on a creature |
| `burrow` | sinks and rises under the Keeper | new: a hidden state with a ground stir |
| `aura` | a pack aura (§3) | `shared/loot/auras.ts` math |

### 2.1 Maw (constructs that kept their teeth)

| Creature | Ability | Words | Tell | Effect | CD | Counter | VFX | SFX |
|---|---|---|---|---|---|---|---|---|
| `rivet-maw` (1) | **Scrap Spit** | — | 0.4 s body (jaw rattles) | a rivet shot, 4 tiles, 0.6B, straight line | 6 | step aside | a grey pixel rivet, two sparks on hit | a tinny *tink* |
| `cinder-bailiff` (3) | **Serve the Writ** | *brann sha* | 0.6 s: a parchment line on the ground from it to the Keeper | the hook pulls the Keeper 2 tiles toward it and Chills 2 s | 10 | break the line (step sideways out of it) | a cream parchment ribbon unrolling, a wax seal stamp on the Keeper | paper snapping, a stamp thud |
| `obsidian-golem` (14) | **Glass Quake** (smash) | — | 0.8 s: a ring r2.5 cracks outward in black glass | 1.6B physical in r2.5, Stun 0.8 s | 9 | step out of the ring | black shards jump from the floor, a white rim flash | a deep crack, glass tinkling down |
| `slag-crawler` (21) | **Crust** (field) | — | none (it leaves it as it walks) | its trail hardens behind it for 6 s; a Keeper on the crust is Chilled (the slag holds his boots) | passive | walk around the trail | a dull orange crust that greys as it cools | a crackle under foot |

### 2.2 Beast

| Creature | Ability | Words | Tell | Effect | CD | Counter | VFX | SFX |
|---|---|---|---|---|---|---|---|---|
| `ash-wolf` (1) | **Pack Howl** | — | 0.5 s: the wolf lifts its head | every wolf within 6 tiles +20% speed for 4 s; a wolf alone does not howl | 15 | kill the first wolf that howls | grey breath rings rising | a soft rising howl, others answer quietly |
| `lava-hound` (10) | **Ember Breath** (wave) | *vael sha* | 0.6 s cone (3 tiles, 50°) | 1.2B fire, Burn 4 s at 0.15B/s | 7 | step out of the cone; fire resist | the stepped ember cone, a short tongue of flame | a hiss that turns to a roar |
| `canopy-bat` (15) | **Shriek** | — | 0.4 s body (wings flare) | Blind 1.5 s in r2 | 12 | step out of r2; a Lanternwright's Cleanse ends Blind | a white ring, three sound arcs | a high thin shriek, dampened (never loud) |
| `moss-stalker` (17) | **Moss Ambush** (burrow) | — | 0.8 s: the moss under the Keeper stirs in a r1 ring | rises under the Keeper: 1.5B and Root 1 s | 14 | step off the stir | moss tufts lifting, then the stalker's back breaking the green | a wet rustle |
| `rootglass-hart` (24) | **Lowered Antlers** (charge) | — | 0.6 s lane (the shipped charge tell) | crosses 5 tiles, 1.8B, knock back 1 tile | 8 | step aside in the tell | the antlers ring white, a glass streak | a glass chime, hooves |

### 2.3 Ember (fire that kept going)

| Creature | Ability | Words | Tell | Effect | CD | Counter | VFX | SFX |
|---|---|---|---|---|---|---|---|---|
| `cinder-imp` (2) | **Little Tempers** (drop) | *vael dra* | 0.6 s: two small rings r0.75 near the Keeper | each 0.8B fire | 8 | step out | two sparks falling with a stepped tail | two pops and a giggle |
| `ember-drake` (18) | **Drake Meteor** (drop) | *vael ul dra* | 1.0 s: one ring r2 at where the Keeper stood | 2.2B fire in r2, leaves fire ground r1.5 for 3 s at 0.2B/s | 14 | step out of the ring | a stone with a fire tail from the upper left, the nova scorch | a falling whistle, a deep thump |
| `glass-sentinel` (24) | **Molten Fan** (wave) | *vael mur* | 0.6 s: a 3-shot fan line | three shots of 0.9B fire | 9 | step between the lines | orange glass drops, cooling grey where they land | a hiss of molten glass |
| `lantern-wisp` (28, dark-born) | **Will-o'-the-Fen** | *lum vesh* | 0.5 s body (the flame brightens) | blinks 3 tiles toward the Keeper, then Burn 3 s at 0.2B/s on its next bite | 10 | stand in a light (wisps shy from the Keeper's light ring) | a flame trail dotted on the ground | a soft whoomph |

### 2.4 Shade (cold of the dark)

| Creature | Ability | Words | Tell | Effect | CD | Counter | VFX | SFX |
|---|---|---|---|---|---|---|---|---|
| `cinder-wraith` (12) | **Ash Blizzard** (drop, small) | *rim vor dra* | 0.8 s: a pale ring r2 round the Keeper | 4 hail pulses over 2 s, each 0.5B cold and Chill | 12 | leave the ring | grey-blue flakes falling, ash mixed in | a whistle of wind, a shift-bell hummed |
| `ink-hound` (32) | **Ink Trail** (field) | *nyr mur* | none (it leaves it) | where it ran stays ink for 5 s: Chill and the Hush +2/s | passive | do not cross; light dries it (Hearth Circle, Beacon) | black pawprints that never dry, a sheen | a wet pat |
| `mire-lurker` (25) | **Low Lantern** (burrow) | — | 1.0 s: a small light bobs on the water where it will rise | rises: 1.8B, pulls 1 tile | 16 | do not walk to the low light | a lure lantern, the lurker's shoulders rising | a bubble, a slurp |

### 2.5 Graft and prism and orrery (legacy families, kept for later lands)

| Creature | Ability | Words | Tell | Effect | CD | Counter | VFX | SFX |
|---|---|---|---|---|---|---|---|---|
| Graftling (later, Wrong Wood) | **Copy** | *thar teth* | 0.6 s: a grey outline beside it | makes a copy at half life that dies in one hit; Glim dims beside the copy | 15 | follow Glim | a grey outline filling in | a soft click |
| Prismling (later, Luminous) | **Refract** (wave) | *lum mur* | 0.6 s: a light line | 1.2B lightning along a line that bends once off a wall | 10 | stand off the line | white light, a rainbow edge | a glass ping |
| Ephemeris Leech (later, Celestial) | **Slow the Hour** | *ul ka* | 0.6 s: a clock ring r2 | Chill 3 s | 12 | step out | brass hands turning on the ground | a ticking that slows |

### 2.6 Bone (the Ashen Bastion's garrison)

| Creature | Ability | Words | Tell | Effect | CD | Counter | VFX | SFX |
|---|---|---|---|---|---|---|---|---|
| `bone-walker` (6) | **Keep Walking** | — | none | at 0 life, 1 in 4 rise once more after 2 s at 30% life unless the corpse is burnt or broken | passive | burn the corpse (any fire hit), Corpse Burst, Consecrate | the bones tidy themselves upright | a dry rattle |
| `bone-archer` (8) | **Volley of Three** | — | 0.6 s: three thin lines | three arrows, 0.7B each, 20° apart | 9 | step between | bone-white shafts | a creak and three thrums |
| `ash-ghoul` (9, night) | **Scrape** | — | none | its bite Bleeds 3 s at 0.15B/s | passive | stand still (Bleed doubles while moving) | grey ash puffs | a scratch |
| **Bone Priest** (new, 15–25, Ashen Crypt) | **Muster the Dead** (raise) | *osk teth* | `CALL_TELL` sigil over each corpse, plus 1.0 s chant | raises up to 2 fallen bone creatures within 6 tiles at 60% life | 8 | kill the priest first; burn corpses; interrupt the chant | an ember sigil on each corpse, bones assembling neatly | a low two-note chant, bones clicking into place |
| **Bone Priest** | **Bone Ward** (ward) | *osk ka* | 0.4 s body | absorbs 3B on one kin within 5 tiles for 6 s | 10 | Dispel (Warlock's Doom node, Thornstrider's Mark node) | four bone shards circling the warded one | a hollow knock |

**Bone Priest** (new creature, `bone-priest`, bone family, ranged caster, keeps 5 tiles off). Ashen Crypt −1 and −2,
one per room at most, never in the Hushed Barrow. Lore line (EN): "The Bastion's chaplain swore to keep the watch
mustered. He still calls the roll, and the roll still answers." ES: "El capellan del Bastion juro mantener la guardia
formada. Aun pasa lista, y la lista aun responde."

### 2.7 Orc (the Cinder clans)

| Creature | Ability | Words | Tell | Effect | CD | Counter | VFX | SFX |
|---|---|---|---|---|---|---|---|---|
| `cinder-orc` (10) | **War Stomp** (smash, small) | — | 0.6 s: ring r1.5 | 1.2B physical, Stun 0.6 s | 10 | step out | dust ring, cinders kicked up | a stamp and a grunt |
| `orc-firecaller` (13) | **Lava Up** (field) | *vael dra* | 0.8 s: three ember cracks open in a line toward the Keeper | the cracks burst one after another (0.2 s apart), 1.0B fire each in r1, then glow 2 s at 0.2B/s | 9 | step sideways out of the line | cracks splitting, lava bubbling up | the coals answering: a low hum, three pops |
| **Ashsinger** (new, 12–18) | **Sing Them Up** (raise) | *vael osk teth* | `CALL_TELL` sigil on each corpse plus a 1.0 s song | raises up to 3 fallen orcs (cinder-orc, orc-firecaller; never a Warlord, never another Ashsinger) within 6 tiles at 50% life; one raise a corpse | 7 | kill the Ashsinger first; burn the dead (any fire turns a corpse to ash); interrupt the song | a sigil, then the orc lifted by a rope of cinders | a drum, a sung phrase in the Cant |
| **Ashsinger** | **Flee to Song** | — | none | runs 6 tiles from the Keeper when he is within 2 tiles (once per 8 s) | 8 | Root, Chill, Freeze, a Snare line | — | a yelp, quick drumming |
| `orc-warlord` (16) | **Might** (fixed aura, §3) | *brann orum* | always on | its pack: Might | — | kill the Warlord | §3 Might visual | the drums keep time |
| `orc-warlord` | **Warlord's Meteor** (drop) | *vael ul dra* | 1.2 s: one ring r2.5 | 2.5B fire in r2.5 | 16 | step out | a burning boulder called down | a war horn, then the thump |

**Ashsinger** (new creature, `ashsinger`, orc family, ranged, keeps 5 tiles off, hp like `orc-firecaller` ×0.8, blow
×0.6). The Deep Charwood (13–16) and the Obsidian Badlands (15–18), one with every orc camp of three or more. It is the
D2 Fallen Shaman: the reason to dive the back line. Lore (EN): "The clans bury no one. The Ashsinger sings them back up
instead, and charges the family for the verse." ES: "Los clanes no entierran a nadie. El Cantaceniza los levanta
cantando y le cobra el verso a la familia."

### 2.8 Verdant (the wood that forgets)

| Creature | Ability | Words | Tell | Effect | CD | Counter | VFX | SFX |
|---|---|---|---|---|---|---|---|---|
| `vine-lasher` (21) | **Lash and Root** | *thar mur* | 0.6 s: a vine line 4 tiles | 1.2B, Root 1 s | 9 | step aside | a green whip unrolling | a crack of a vine, bees humming |
| `thorn-weaver` (28) | **Thorn Web** (field) | *thar orum* | 0.8 s: a web ring r2 sketched in pale lines | a web r2 for 6 s: inside, Chill and arrows cannot reach out (Blind for shots) | 14 | burn it (any fire hit clears it); step out | a pale web, thorn knots | a creak of rope |
| `rootgnaw` (19) | **Tunnel** (burrow) | — | 0.8 s: a soil stir ring r1 | rises under the Keeper: 1.4B, knock up 0.5 s (a Stun) | 12 | step off the stir | soil and roots lifting | a gnawing scratch |
| `sporecap` (23) | **Spore Cloud** (field) | — | 0.6 s body (the cap swells) | a cloud r2 for 6 s: inside, Weaken 15%; fire on the cloud bursts it (design-bible §4.7: 2× the cloud's remaining dps) | 11 | burn it, or walk out | green-gold motes, a slow swirl | a soft cough |
| `drowned-acolyte` (33) | **Moss Mending** (ward) | *thar hesk ka* | 0.6 s: a green ring under one kin | heals kin within 4 tiles 6% of their life a second for 3 s | 12 | interrupt; kill acolytes first; Weaken does not stop it | green motes climbing | a hum, a drip |

### 2.9 Umbral (the drowned abbey's people)

| Creature | Ability | Words | Tell | Effect | CD | Counter | VFX | SFX |
|---|---|---|---|---|---|---|---|---|
| `drowned-knight` (38) | **Tide Smash** (smash) | *brann dra* | 0.8 s: ring r2 with a water edge | 2.0B physical, Wet 5 s, knock back 1 tile | 10 | step out | a water ring, foam, a shield rim flash | a slam and a splash |
| `drowned-acolyte` (in the Umbral crypts) | **Call the Watch** (raise) | *osk brann teth* | `CALL_TELL` sigil plus 1.0 s prayer | raises one fallen Drowned Knight within 6 tiles at 50% life ("they have not been told to stand down") | 10 | kill the acolyte; Consecrate; burn the corpse | a lamp lowered over the knight, water rising off him | a prayer under water: a bubbled two-note |
| `gloam-witch` (42) | **Gloam Blizzard** (drop) | *rim vor dra* | 1.0 s: ring r3 round the Keeper's spot | 6 pulses over 3 s, 0.6B cold each, Chill; a Wet Keeper is Frozen on the first pulse | 14 | leave the ring; cleanse Wet; fire resist does nothing, cold resist does | ink-dark snow with pale edges | wind, and her lantern's glass ticking |
| `gloam-witch` | **True Light** | *lum nyr vesh* | 0.6 s: a lantern beam line | the beam strips the Keeper's light for 4 s (light radius −2 tiles) | 18 | break line of sight | an ink-coloured beam | a lantern shutter clicking |

---

## 3. Monster auras (D2's pack auras)

**The rule.** One aura per pack. The bearer is the pack's leader (a unique), a champion pack's first copy, or a fixed
aura-bearer (the Orc Warlord's Might). It blesses its **own pack only** (its followers, and the bearer), never other
packs and never Keepers, within **4 tiles** of the bearer. Kill the bearer and the aura ends at once for everyone. A
pack aura uses the same names and effects as the Keepers' auras (`shared/loot/auras.ts`), with its own pack
coefficients (the table below, scaled by zone level, never by a worn item), so a card that says "Might"
means one thing in the whole game.

**Aura level.** `aura level L = 1 + floor(zone level / 5)`, +2 on Nightmare, +4 in Hell, max 20. The table quotes L.

| Aura | Effect on the blessed pack | At zone 10 (L3) | At zone 40 (L9) | Visual (graphics upgrade) | Sound |
|---|---|---|---|---|---|
| **Might** | +15% + 5%/L blow | +30% | +60% | red-orange sigil disc (a raised fist in the D2 ring), red motes | low drum on each pulse |
| **Blessed Aim** | +20% + 5%/L hit chance (the Keeper's dodge share cut) and their shots fly 20% faster | +35% | +65% | gold sigil (an eye over an arrow), gold motes drawn as dashes | a bowstring creak |
| **Conviction** | −(10 + 3/L) to every Keeper resist while he stands in the reach, max −60 | −19 | −37 | violet sigil (a broken shield), motes falling inward | a hollow downward chime |
| **Redemption** | each pack death in reach heals the rest 5% + 1%/L of their life (and lays the corpse to rest, so it cannot be raised) | 8% | 14% | white sigil (a rising wing), a mote flies from the corpse to each one healed | a soft bell |
| **Holy Fire** | 0.3B + 0.05B/L fire to Keepers in reach every 1.5 s | 0.45B | 0.75B | ember sigil, flames ringing the disc | a crackle pulse |
| **Holy Freeze** | Keepers in reach are Chilled (−30% → −50% at L10+) | −30% | −30% | pale-blue sigil, frost rim on the reach ring | a cold hiss |
| **Holy Shock** | 0.2B to 0.6B + 0.05B/L lightning to Keepers in reach every 1.5 s; Wet Keepers take the Wet bonus | 0.35B–0.75B | 0.65B–1.05B | yellow sigil, sparks arcing the ring | a crackle |
| **Fanaticism** | attack speed +15% + 3%/L, max 60%; their walk +10% | +24% | +42% | orange sigil, motes spinning fast | a quick drum roll |
| **Prayer** | heals the pack 1% + 0.2%/L of their life a second | 1.6% | 2.8% | soft green sigil (a hand), green motes rising | a hum |
| **Vigor** | walk +12% + 2%/L, max 40%; never slowed below −30% | +18% | +30% | teal sigil (a wing), motes streaming backward | wind |
| **Thorns** | returns 30% + 10%/L of melee damage taken to the striker (physical) | 60% | 120% | brown-green sigil of thorns, the ring barbed | a scratch on each return |
| **Lightless** (ours) | the Keeper's light (and Glim's) shrinks 1 tile + 0.1/L inside the reach; the dark layer opens there | −1.3 | −1.9 | a black disc, its rim a ring of dark pixels; motes are *missing* pixels | silence: the ambience ducks 6 dB inside it |
| **Cant-Chorus** (ours) | the pack's abilities' cooldowns −20% − 1%/L (max −40%); their words hang longer | −23% | −29% | a cream disc with Cant letters circling it, each blessed creature's words echo over it | a whispered chorus of the pack's words |

**How it is shown.** The bearer stands on a pixel **sigil disc** (16×16 art grown ×2, in the aura's colour, turning
one step every 0.5 s), with a dashed reach ring at 4 tiles. Every blessed creature gets a thin **linked mote line**:
three motes travel from the bearer's disc to it, so a Keeper can see who gives the pack its strength. Each blessed one
carries a small sigil **pip** beside its life bar (the shipped mark pip). The bearer's name plate says the aura
("Grimfang the Hollow · Might"). Reduced motion: the disc is still, the lines are solid, no motes.

**Counters.**
- Kill the bearer (the mote lines point to it).
- **Strip an aura**: the Warlock's **Doom** node *Unmaking* and the Thornstrider's **Hunter's Mark** node *Strip* end a
  pack aura for 6 s (bosses 1/5). The Lanternwright's **Banish** on the bearer of a dead pack ends it for 6 s.
- A Keeper's own aura of the opposite kind halves it: the Lantern Aura halves Lightless; the Watchfire halves Holy
  Freeze's slow; Pack Bond halves Conviction on the Thornstrider and his beast.
- Pull: walk the pack out of the bearer's reach (the followers chase, the bearer keeps distance only if ranged).

**Which auras a zone's packs may roll** (Aura Enchanted packs and uniques; a fixed bearer keeps its own):

| Land / band | Auras |
|---|---|
| Ember Isle 1–10 | none below 5; then Might, Vigor, Prayer (gentle) |
| Infernal Reach 8–30 | Might, Holy Fire, Fanaticism, Blessed Aim, Conviction (from 20), Thorns (Forge of the Four only) |
| Verdant Wilds 15–40 | Prayer, Thorns, Vigor, Blessed Aim, Holy Shock (thunderstorm only), Redemption |
| Umbral Marches 26–50 | Holy Freeze, Lightless, Redemption, Conviction, Cant-Chorus, Prayer |
| Celestial / Luminous (later) | Holy Freeze, Holy Shock, Conviction, Fanaticism / Holy Fire, Blessed Aim, Cant-Chorus |
| Realms | any |

**Fixed aura-bearers** (always carry it, with or without a pack): Orc Warlord (Might), Bone Priest (Redemption), the
Ashsinger (Fanaticism, only while it has raised one), Drowned Acolyte in the Drowned Crypts (Prayer), Gloam Witch
(Lightless).

---

## 4. Elite and champion affixes

**Kept as shipped** (`td-elites.ts`, numbers unchanged): Extra Strong (×1.5 blow), Extra Fast (×1.6 walk, bites
×1.3 sooner), Stone Skin (takes 60%), Cursed (−25 every resist, +15% taken, 4 s), Fire Enchanted (fire blows ×1.25;
bursts r26 px 0.6 s after it falls, ring first), Cold Aura (cold blows; −30% step within 3 tiles), Spectral Hit (each
blow a random element ×1.2), Mana Burn (blows take 14 mana), Teleport (blinks beside a Keeper 4+ tiles off, 0.45 s
wind-up, every 5 s), Lightning Enchanted (lightning blows ×1.2), Eclipse-touched (×1.1, eclipse only, loot +1 step).

**New** (design-bible §5.7, plus four):

| Affix | Does | Tell | Pip colour |
|---|---|---|---|
| **Lightless** | snuffs light in r3 round it, Glim's too (the Lightless aura's numbers at the zone's L, its own body only) | a black halo pixel ring | `#140c1c` with a cream rim |
| **Whispering** | each blow +3 Hush (the Hush is off below 10 and on Ember Isle: there it does nothing); its kill drops a Margin Note scrap (lore, 1 in 3) | its name flickers | `#d8c0ff` |
| **Grave-called** | at half life raises 2 Bone Walkers at its level − 2 (`CALL_TELL` sigils) | bone pip | `#e8e0cc` |
| **Mirrored** | at spawn makes one copy that dies in one hit and deals 0.5B; Glim dims beside the copy (canon tell) | violet pip | `#b06bff` |
| **Ember-hearted** | bursts 1 s after it falls: 2B fire in r2, its ring on the ground first (bigger and later than Fire Enchanted; never both) | an ember heart ticking on its chest | `#ff6a3d` |
| **Brutal** | every third blow is a heavy 2.2B with a 0.6 s ground tell (a red arc in front) | red pip | `#c2402a` |
| **Aura Enchanted** | the pack carries one aura from its zone's list (§3) | the aura's own sigil | the aura's colour |
| **Multishot** | ranged creatures only: each shot is three, 15° apart, each 0.6B | three dots | `#ffe36d` |
| **Shielded-by-kin** | while a follower stands within 3 tiles it takes 50% less; the link shows as a pale line to the nearest follower | a small shield | `#9db8a8` |
| **Vampiric** | heals 25% of the damage its blows deal | a rust-brown droplet (never red) | `#8a4b3a` |

**Combining.**
- Never two element affixes (Fire/Cold/Lightning Enchanted, Spectral Hit), as shipped; Ember-hearted counts as fire.
- Never Lightless with Aura Enchanted Lightless. Never Multishot on a melee creature. Never Grave-called on a
  non-bone creature outside the Ashen Crypt and the Hushed Barrow (it calls the dead the place holds).
- Never more than one of Teleport and Extra Fast on a creature in zones below 15 (a starter must be able to walk away).
- **Affixes by zone band**: champion packs carry 1 affix below 15, 2 from 15, 3 from 35; unique leaders carry 1–2
  below 15, 2–3 from 15, 3–4 from 35. Nightmare +1, Hell +1 (cap 5). Aura Enchanted, when rolled, takes one slot.
- Eclipse-touched is added on top (it never uses a slot), as shipped.

**Loot.** Unchanged ranks (`lootRank`): champion Gold ×4, 2 rolls at 45%; unique Gold ×6, 3 at 60%; elite gear floors
at magic; a unique leader always leaves one magic-or-better piece. Each affix beyond the first adds +5% to the item
chance of the pack's rolls (an affix-heavy pack is worth fighting), and an Aura Enchanted bearer drops a **rune** one
tier above its zone's tier at 1 in 40 (still within the difficulty's rune cap, canon §6.2).

---

## 5. Party bosses: roles, threat and the mechanic vocabulary

**The rule.** Every **floor boss on Normal stays soloable** (the combat-sim bands hold: 60–150 s at its level, ≤ 30%
falls). Roles are required only by **party bosses**:
- the **world bosses** (§6), always;
- the **Realm bosses** (realms-endgame.md §3.4), always;
- the **party form** of each act and floor boss on **Nightmare and Hell** (§5.3). A solo Keeper on Nightmare or Hell
  meets the solo form (today's fight); a party of 2+ in the area meets the party form. The party life rule stays
  (`coopBossLife`, +60% per member), the party form adds mechanics instead of more life.

**Threat** (shared decisions): threat = damage dealt ×1 (the Ashguard's whole book ×2) + healing done ×0.5, split
across the foes in combat with the one healed; a Taunt jumps the taunter to top threat +10% for its duration. A boss
attacks the top threat unless a mechanic names someone else. In a party a small red pip on the boss's plate shows whose
portrait it is fixed on. Solo play has no threat at all.

### 5.1 The mechanic vocabulary (one implementation each)

| Mechanic | What happens | Who answers | Fails how |
|---|---|---|---|
| **Fixate** | the boss picks the top-threat Keeper; its bite is 1.0B and every 4th bite is a heavy 2.5B (0.6 s red arc) | the tank holds it, the rest stand behind | a squishy with top threat eats the heavy |
| **Sunder** | each bite on the fixated one adds a Sunder stack (−8% Defense, 10 s, max 5); at 5 the next bite is ×2 | the tank uses Shield Oath / Vow at 4 stacks; a second tank taunts (two Ashguards) | the tank falls |
| **Burn the Room** (raid-wide) | every 20 s, everyone in the arena takes 0.8B of the boss's element and a Burn/Chill 6 s at 0.2B/s | the healer: Hearth Circle, Cleanse, Hearthlight | three of these without heals fall a party |
| **Brand** | one random non-tank Keeper is Branded: 0.3B a second for 8 s unless Cleansed | the healer's Cleanse | the Branded falls |
| **Add wave** | at 75%, 50%, 25% life, 4–8 creatures at the boss's level − 4 pour in from two doors | AoE: the Warlock, the Ashguard's Whirl, Volley | the adds swarm the healer |
| **Interrupt cast** | a 2.5 s channel with its words over the boss and a bar; it heals the boss 10% or summons an elite pack | anyone with a Stun / Freeze / Hushed (Shield Bash's Concussion node, Barbed Shot's Hushing Barb node, Pinning Shot, Watchquake, Rime Lance's Deep Chill freeze, Blinding Flash on the dead) | the boss heals |
| **Soak circle** | a ring r1.5 that bursts after 3 s for 4B split among everyone standing in it; empty, it bursts for the whole room | two or more Keepers step in (the tank and a healthy one) | nobody soaks, everyone is hit |
| **Tether** | two Keepers are tied by a line; if they stand more than 6 tiles apart the line snaps for 2B each, closer than 2 the line burns 0.2B/s | the pair keeps 2–6 tiles | both are hit |
| **Spread** | everyone is marked with a ring r1.5; overlapping rings burst for each other | everyone spreads | the healer loses a stack of people |

**Lore rule.** A mechanic is the boss's *reason* made visible: the Anvil-Warden's Sunder is the hammer on the anvil,
the Ink Abbess's Brand is a line she writes in your name. Each mechanic's tell has words.

### 5.2 Party sizes and rewards
Party bosses are tuned for **4** (one tank, one healer, two damage) and fair for 3. Each member who fought rolls their
own loot (shipped). A party form adds **one extra roll** for every member and a **Party Mark** item (a small brass token,
stacking) that the Realm vendor takes later (realms-endgame §3.6). No reward needs a party form below level 30.

### 5.3 The floor bosses' party forms (Nightmare and Hell)

| Boss (level) | Phase 1 (100–60%) | Phase 2 (60–25%) | Phase 3 (25–0%) | Roles it tests |
|---|---|---|---|---|
| **Ember Warden** (8) | Fixate; leap on the farthest Keeper every 8 s (shipped leap, now targeting the farthest) | **Bank the Forge**: it stands at its forge and channels 2.5 s (Interrupt) or heals 10% | Burn the Room every 15 s (fire) | tank, interrupt, healer |
| **The Uncounted** (7) | Fixate; the forty dead lurch (shipped charge) | **Count Me**: Spread rings on everyone; the Uncounted copies itself into one shade per Keeper that fixates that Keeper (0.5B, die in 3 hits) | Add wave of Bone Walkers from the graves (6) | spread, AoE |
| **Anvil-Warden** (18) | Fixate + **Sunder** (the hammer on the anvil) | Interrupt **Strike the Oath** (2.5 s): summons an Extra Strong Bailiff pack | Soak circle every 12 s (the anvil comes down) | tank swap, interrupt, soak |
| **Magma Tyrant** (20) | Fixate; charge (shipped) | **Crown Pour**: 3 lava fields r2 that stay for the rest of the fight (Burn), arena shrinks | Burn the Room (fire) every 15 s + Add wave (lava hounds ×4) | healer, AoE, movement |
| **Ashbone Dragon** (25) | Fixate; breath fan on the tank (step behind) | **Tether** two Keepers (the ash binds a promise); Bone Priests ×2 at the doors (Interrupt their Muster) | **Bone Storm**: Spread rings, fan breaths on the 2 farthest | tank, interrupt, spread |
| **Cinder Sovereign** (30) | Fixate + Sunder (fire) | **Bank the Heat**: one Keeper Branded with Sovereign's Brand (Cleanse), Add wave | **What the Fire Remembers**: every 20 s Burn the Room; soak the falling crown (Soak circle r2) | all four roles |
| **Mossbound Colossus** (34) | Fixate; slam (shipped) | **Root the Shrine**: Roots on the healer and one other 2 s (dispelled by Cleanse) while Vine Lashers rise (Add wave) | Soak circles under the heart | healer, AoE, soak |
| **Elder Rootwyrm** (40) | shard fan on the tank; burrow tell under the farthest | **The Cradle Coils**: Tether pairs; Drowned Acolytes heal it (kill / interrupt their Moss Mending) | Burn the Room (physical, rootglass splinters) + Spread | tank, interrupt, healer |
| **Ink Abbess** (50) | Fixate; the ink wave (shipped) | **She Writes Your Name**: Brand on two Keepers (Cleanse both), Lightless pack of Ink Hounds | **Last Prayer**: Interrupt every 2.5 s channel or she heals 10%; Spread rings | healer, interrupt, AoE |
| **Seam Eater** (20/30/40/55 rifts) | see §6.1 | | | |

The solo form of each stays exactly as shipped. The party form keeps the solo kit and adds the phase mechanics.

---

## 6. World bosses

**Common rules.**
- A world boss is open-world, rises only on its trigger (weather, hour, eclipse), stands at a fixed **arena** with a
  readable edge (a ring of stones, a ruined wall), never chases past 14 tiles (the Seam Eater's leash), never steps on
  safe ground, and leaves with the weather (no kill, no loot) if not felled.
- **Cooldown per world**: once it falls, it cannot rise again in that world for its cooldown (real time), whoever felled
  it. The room (online M1+) owns the cooldown; offline single play keeps it per save.
- **Announcement**: when its trigger starts, Glim says a line, and the land's NPCs carry a rumour line for the next hour
  (both EN + ES below). The Atlas marks the arena with a pulsing glyph while it stands.
- **Always party bosses** (§5): a solo Keeper at its level falls (the sim band: a solo Keeper at level ≤ 15% wins, a
  party of four at level wins ≥ 70%). Hunting XP follows its life before the party factor, as the shipped bosses.
- **Loot**: boss rank (3 rolls, 2-step shift) + one extra party roll each; materials; its unique at the odds below
  (each member rolls). Its uniques are **worldbound**: they can be traded once (the first trade binds), so a guild can
  gear its healer.

### 6.1 The Seam Eater (shipped; its party form)

Kept: rises under an eclipse at each continent's rift (20, 30, 40, 55), Void Breath, Seam Rend, the half-life call,
the Seamstitch Grips (1 in 8). It already gates Nightmare and Hell solo; the solo form stays.

**Party form** (2+ Keepers in its area; shipped +60% life a member stays):
- *Phase 1 (100–60%)*: Fixate on top threat; Void Breath aimed at the tank; Seam Rend rings on the two others.
- *Phase 2 (60–30%)*: **Stitch** (`ul mur`): Tether two Keepers with a seam-thread for 10 s (keep 2–6 tiles);
  the half-life call becomes an Add wave of 4 Eclipse-touched shades.
- *Phase 3 (30–0%)*: **The Tear Widens** (`ul orum`): Burn the Room in arcane every 15 s; a Soak circle drops on the
  tank every 12 s (the tear trying to close on someone).
- Roles: tank, healer, AoE, soak.

### 6.2 The Last Siege (Infernal Reach, the Obsidian Badlands, level 32)

**Lore.** When the Ashen Bastion fell, its siege tower was still rolling toward the Cinder clans' camps. Nobody told it
the war had ended, so it kept going, one turn of the wheel a night, for longer than the years have been counted. The
dead garrison that rides it never stopped loading the catapult. It is not angry. It is late. (Ties: the Ashen Bastion,
canon §1.3 item 10; the Ossuary Watch; the Ashguard calling quest, campaign #10.)

**Spawn rules.** Ashfall weather (world-acts.md) **at night** over the Reach. The tower rolls out of the badlands'
northern ash flats along a fixed track toward the Ashen Bastion's ruin; it stands for the length of the ashfall window.
**Cooldown: 3 real hours per world.**
- Glim (EN): "The ash is falling the wrong way. Something big is rolling through it, toward the Bastion." ES: "La
  ceniza cae al reves. Algo grande rueda entre ella, hacia el Bastion."
- Rumour, Captain Brannoc Vey (EN): "If you see the tower, Keeper, do not salute it. It will take that as orders." ES:
  "Si ves la torre, Guardian, no la saludes. Lo tomara como una orden."
- Rumour, Pyrehold innkeeper (EN): "Ashfall tonight. My grandmother said the Bastion's tower comes out in it. My
  grandmother said a lot of things." ES: "Ceniza esta noche. Mi abuela decia que la torre del Bastion sale con ella. Mi
  abuela decia muchas cosas."

**Arena.** A 24×16-tile stretch of the ash flats, bounded by the old siege trench (a readable wall line). The tower is
a 6×8-tile body that **moves 1 tile every 4 s** along its track; it cannot turn.

**Fight (~32, life as a world boss at 32 by the Seam Eater curve ×0.9).**
- *Phase 1 (100–65%)*: **The Garrison Rides**: two Ossuary Watch crossbows on the tower fire Blessed-Aim volleys
  (3 bolts, 0.8B) at the top threat; the tower's ram swings in front (Fixate + Sunder on whoever stands at the ram).
- *Phase 2 (65–30%)*: **Load the Catapult** (`brann vael dra`): every 10 s, three meteor rings r2.5 (1.0 s tell, 2.5B
  fire) land on the healer's side of the arena; **Add wave** of Bone Walkers and a Bone Priest climb down the ladders
  every 25 s (Interrupt the Priest's Muster).
- *Phase 3 (30–0%)*: **The Last Turn**: the tower speeds up (1 tile a second); Burn the Room in fire every 15 s; a Soak
  circle under the ram every 12 s. If it reaches the Bastion's ruin it stops, the garrison salutes, and it leaves (no
  kill): "The war is over. It knows now." That is the exit.
- Roles: tank at the ram, healer for the burns, AoE for the ladders, someone to interrupt.

**Loot.** Boss rank + party roll; cinder ore ×4, infernal heartstone ×2; an **Ossuary Watch badge** (quest item, 1 in 3,
used by campaign #11 Barrow Door 2).

**Unique: The Wall That Kept Walking** (shield, item level 32, 1 in 10).
- +40% block chance (GEAR_CAPS block 50), +18% Defense, +25 fire resist, +12% attack damage.
- *Its own line*: "While you have not moved for 2 s, you and party members within 3 tiles take 15% less damage."
- Lore (EN): "It held the line so well that it carried the line with it." ES: "Sostuvo la linea tan bien que se la llevo
  consigo."
- Look: a tall wooden siege-mantlet with iron bands, ash-grey, one Watch badge nailed in the middle.
- Found in: the Last Siege (Obsidian Badlands, ashfall nights). Used for: the tank's shield.

### 6.3 The Antlered Storm (Verdant Wilds, the Greenwood, level 42)

**Lore.** The oldest Rootglass Hart stood under the tallest tree of the Greenwood when the first thunderstorm after the
Lock struck it. The lightning stayed. The hart is the storm now, or the storm is the hart; the Canopy Wardens say it is
the wood remembering it was once wild weather before it was a wood. It is not cruel. It goes where the thunder goes.
(Ties: the wood forgets what it is, Act II; Ilsa Fenn's Canopy Wardens; the Thornstrider's sky skills.)

**Spawn rules.** **Thunderstorm** weather over the Verdant Wilds, any hour; it rises at the **Storm-Struck Oak** (a new
landmark: a split, glassy giant tree at the Greenwood's heart). **Cooldown: 2 real hours per world.**
- Glim (EN): "Every strike is landing in the same place. The Greenwood's oldest tree. Something is standing up there."
  ES: "Cada rayo cae en el mismo sitio. El arbol mas viejo del Bosque Verde. Algo se esta levantando alli."
- Rumour, Canopy Warden Ilsa Fenn (EN): "When the antlers ring, don't stand near anything taller than you. That
  includes me." ES: "Cuando suenen las astas, no te quedes junto a nada mas alto que tu. Eso me incluye."
- Rumour, a Rootglass boardwalk trader (EN): "My cousin saw it once. Said it was beautiful. Said it twice, slowly." ES:
  "Mi prima lo vio una vez. Dijo que era precioso. Lo dijo dos veces, despacio."

**Arena.** A 20-tile circle round the Oak, marked by a ring of split stumps; the storm keeps everything **Wet** inside.

**Fight (~42).**
- *Phase 1 (100–60%)*: Fixate; **Lowered Antlers** charge on the farthest (0.6 s lane, 2.0B); **Strike** (`lum vor
  dra`): lightning rings r1.5 (1.2 s tell) under three Keepers every 8 s, 1.6B lightning (Wet: +25% and chains).
- *Phase 2 (60–30%)*: **Chain**: Spread rings on everyone (a strike that touches two jumps between them); **Tether**
  the healer to the tank (the storm reaches for whoever mends); an Add wave of Canopy Bats (8) and two Rootglass Harts.
- *Phase 3 (30–0%)*: **The Eye**: the storm's eye opens over the Oak; Soak circle every 10 s (a bolt meant for the
  tree, 4B split); Burn the Room in lightning every 15 s. The Thornstrider's **Gale** blows the rain off in r6 for 6 s (no Wet there), and the Lanternwright's Cleanse with
  the Dry Cloak node lifts Wet from one Keeper: real uses for both callings.
- Roles: tank, healer (Wet hurts), AoE for the bats, someone with weather control eases it.

**Loot.** Boss rank + party roll; verdant sap ×4, world-root bark ×3, a **Stormglass Antler** (material, 1 in 2:
Enchanting Table input later).

**Unique: Crown of the Antlered Storm** (helm, item level 42, 1 in 10).
- +30% lightning damage (as spell damage for staves, attack damage for bows, the item family's rule, loot-and-combat
  §3.6), +3 to lightning skills (GEAR_CAPS skill ranks 3), +30 lightning resist, +10% move speed.
- *Its own line*: "In rain or a thunderstorm, your lightning chains to one more foe, and Wet cannot slow you."
- Lore (EN): "The hart wanted to be a tree. The tree wanted to be the storm. Neither asked the antlers." ES: "El ciervo
  queria ser arbol. El arbol queria ser la tormenta. Ninguno pregunto a las astas."
- Look: a circlet of glassy rootglass antlers with a faint white spark running along them.
- Found in: the Antlered Storm (the Greenwood, thunderstorms). Used for: lightning builds (the Thornstrider's sky tree,
  the Lanternwright's Chain of Lamps and Lamp-Lightning node).

### 6.4 The Fogmother (Umbral Marches, the Black Meres, level 54)

**Lore.** When a fen lantern gutters, the fog it was holding back does not leave. It settles. Over a long time it
settled into a shape on the Black Meres: tall, patient, wrapped in the sisters' grey habits that the water took when the
abbey went under. She is what the fog keeps of everyone it has ever hidden. She hums the abbey's evening psalm in the
wrong key, because she only ever heard it through water. She is not the thing the fog thins round (that is another
story, and another lantern); she is only the fog, remembering. (Ties: the Drowned Abbey, the Lamplighters, Old
Corvane's lanterns; she never answers the Second Lantern question.)

**Spawn rules.** **Fog** weather over the Umbral Marches **at night**; she rises from the middle of the Black Meres
where three old lantern posts lean with their lights out. Lighting all three posts (a Keeper with a light standing at
each for 3 s) before she rises *prevents* her that window, and the posts stay lit until dawn: a choice, and an exit.
**Cooldown: 4 real hours per world.**
- Glim (EN): "The fog over the meres is getting thicker in one place. It's not thicker. It's standing." ES: "La niebla
  sobre las lagunas se espesa en un punto. No se espesa. Se esta poniendo de pie."
- Rumour, Old Corvane (EN): "Three posts on the Black Meres went out tonight. I have lit them since I was a boy. Mind your
  lamp out there." ES: "Esta noche se apagaron tres postes en las Lagunas Negras. Los encendia desde que era nino.
  Cuida tu farol ahi fuera."
- Rumour, Gloamhaven fishmonger (EN): "Fog's singing again. If she sings your name, she's only read it off your boat."
  ES: "La niebla vuelve a cantar. Si canta tu nombre, solo lo ha leido en tu barca."

**Arena.** The meres' widest pool and its reed islands: 22×22 tiles, shallow water (Wet underfoot), the three posts at
its edge. Light matters: each post a Keeper lights during the fight is a fixed light (r4) she will not stand in.

**Fight (~54).**
- *Phase 1 (100–65%)*: Fixate; **Wrap** (`vor nyr mur`): a grey line from her to the tank, Chill 3 s; **Lightless**
  aura (her own, L12) round her; ordinary fog everywhere (sight −40%).
- *Phase 2 (65–30%)*: **She Sings Your Name**: Brand on the healer and one other (Cleanse); **Gloam Blizzard** rings
  r3 over the two farthest (Freeze the Wet); Add wave of Drowned Knights raised by two Drowned Acolytes (Interrupt the
  Call the Watch).
- *Phase 3 (30–0%)*: **Settle**: the fog thickens in the room (sight 3 tiles) except in lit posts' rings; Burn the
  Room in cold every 15 s; Soak circle on the tank every 12 s. Lighting all three posts in phase 3 cuts her damage by
  25% ("the lanterns remember what she forgot"): the Lanternwright's calling moment.
- Roles: tank, healer (cold and Brand), AoE for the knights, a light-bearer.

**Loot.** Boss rank + party roll; umbral ink ×5, nightglass ×3, inkstone ×2, a **Sister's Grey Thread** (material, 1 in
2).

**Unique: The Psalm Heard Through Water** (amulet, item level 54, 1 in 10).
- +25% healing done, +20% cold resist, +20% lightning resist, +40 mana, +15% cast speed (GEAR_CAPS cast speed 40).
- *Its own line*: "Your heals on a Keeper standing in fog or darkness also give them 4 s of +1 light radius and remove
  Chill."
- Lore (EN): "She sang it wrong for so long that it became a different hymn, and that one works." ES: "Lo canto mal
  durante tanto tiempo que se volvio otro himno, y ese si funciona."
- Look: a small grey stone bell on a waxed cord, beaded with water that never dries.
- Found in: the Fogmother (the Black Meres, foggy nights). Used for: the healer's amulet.

---

## 7. Build order (for the builder)

| # | Task | Size | Depends on |
|---|---|---|---|
| 1 | `MobDef.ability` + the kinds `wave`, `drop`, `smash`, `field` (reusing breath, rend, slam, Flame Wall) and the tell rule; Bestiary card's counter line (EN + ES) | M | — |
| 2 | Abilities for every shipped Ember Isle and Reach creature (§2.1–2.7 minus new creatures) | M | 1 |
| 3 | `raise` kind on td-corpse + the **Ashsinger** and **Bone Priest** (new creatures: profiles, art, i18n, spawns); fire-to-ash and Consecrate counters | M | 1 |
| 4 | Monster auras: the bearer's sigil disc, mote lines, pips; Aura Enchanted affix; fixed bearers; zone lists | M | — |
| 5 | The new affixes (Lightless, Whispering, Grave-called, Mirrored, Ember-hearted, Brutal, Multishot, Shielded-by-kin, Vampiric) and the per-band counts | M | 4 |
| 6 | Verdant and Umbral abilities (§2.8–2.9) | M | 1, 3 |
| 7 | Threat table + the mechanic vocabulary (Fixate, Sunder, Burn the Room, Brand, Add wave, Interrupt, Soak, Tether, Spread) on the room-hosted boss (td-coop host) | L | online M2 |
| 8 | Party forms for the ten floor bosses on Nightmare/Hell | L | 7, skills-100 heals/taunts/cleanse |
| 9 | Weather-triggered world bosses: The Antlered Storm first (thunderstorm is the first weather built), then the Last Siege (ashfall), then the Fogmother (fog + posts); their uniques | L each | 7, world-acts weather |
| 10 | combat-sim: abilities and auras in the real fight; new bands for party forms (a party of four sim) | M | 2–8 |

Sim bands to add: an at-level creature with its ability still dies in 2–5 s and falls a Keeper ≤ 2%; an Aura
Enchanted unique pack stays inside 30–75 s; a party form at its level with 4 sim Keepers (one per calling) wins
≥ 70% in 3–6 min; a solo Keeper against a party form wins ≤ 15%.
