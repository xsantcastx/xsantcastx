# S9: every calling's book to level 50 (handoff)
Built 2026-11-03 on branch `s9rows` (from main a4a2435d). Design: `docs/design/skills-100.md` §0.4, §0.6, §1–§4, §7, §8
step 4; `docs/world/campaign.md` S9 (and S5's waiting Thornstrider rows); the DM's rulings in
`docs/design/skill-book-stand-ins.md`.

## What a player gets
Nineteen new rows, each with six marks (two branches of three, one star), its Keeper animation, a cast and a hit cue
(S3's kit) and its own pixel picture:
- **Warlock.** *Rime Lance* (30, Shadow: a piercing lance of rime that Chills), *Raise Grave-Mage* (30, Bone: the Ashen
  Bastion's war-mages stand back and cast bolts of your lead page's element, cold when Rime Lance leads), *Kiln Breath*
  (42, Ember: a channelled cone of flame, mana a second, you walk at 40%), the *Ossuary Golem* (50, Bone: one bone golem
  that strikes round itself and taunts, built from the fresh dead near you).
- **Ashguard.** *Pyre Strike* (36, Brand: leap, overhead blow, fire ring, stun) and the *Watchquake* (50, Ash: a stamp
  that stuns and Hushes everything in reach, breaking casts).
- **Lanternwright.** *Moth Dust* (6, S5's wait), the *Moth Swarm* (30), *Chain of Lamps* (36, lightning that leaps and
  Shocks) and *Glim's Margin* (50: reveals the burrowed and Mirrored, crits more on the revealed, Margin Note points at a
  hidden cache once a day through the Seek).
- **Thornstrider.** *Hunter's Mark* (6), *Pinning Shot* (12), *Feral Leap* (18), *Call the Rain* (18) — S5's waiting rows —
  and *Heartseeker* (24), *Fogwalk* (30), *Thornrain* (42), *Lightning Call* (42), the *Elder Beast* (50). Thorn Shot's
  B3 *Mark-Seeker* now seeks the Marked (its stand-in swap).
- **New statuses** (§0.4): **Shock** (next hit taken +20%, the spark jumps once), **Wet** on creatures (a cold hit freezes,
  lightning chains), **the Mark** (+% from you and your beasts, a leaf over the head). Glim's reveal draws cream corners.

## How
- Data: `td-skills.ts` (Warlock), `td-ashguard-skills.ts`, `td-lantern-skills.ts`, `td-thorn-skills.ts`; names/lines in
  `world/hud.i18n.ts` (Warlock + the new var labels), `td-ashguard.i18n.ts`, `td-lantern.i18n.ts`, `td-thorn.i18n.ts`;
  marks in `td-marks.ts` (56 new flags), their names and lines in `spellbook/book.i18n.ts` (EN + ES; "Cheap" is *Frugal*).
- Fight: `td-mobs.ts` — `LATE_ROWS` → `useLateSkill`; `tickLate` (Kiln's channel, Heartseeker's draw, Pyre's charge,
  delayed strikes, the Mark, the Margin); `lateZone` (cloud, fog, moths, thornrain, thorny ground); `lateHitMult` (Mark,
  Shock, Melting, Nailed, Itching, Grave-Frost); `lateMinion*` (Grave-Mage, Golem, Elder Beast are `Minion.kind`s; only
  plain skeletons count against Raise Skeleton's cap and go to the room as kin); `rimeHit`, `lateArrowHit`.
- Sky: the engine sets `mobs.stormSky` / `mobs.skyFog` from the weather (outdoors). `mobs.storm` (pack-aura pool) is left alone.
- Kit: `td-skill-kit.ts` (19 entries); a new `rain` cast cue (`combat-cues.ts`, `sound-director.ts`).
- FX: `td-late-fx.ts` (zones, ground, air, state), hooked into `td-engine.ts`; `drawRaised` draws the mage (lantern), the
  golem (×2) and the elder (the called beast ×1.5, moss and antlers). **Low**: a third of the pieces, one tone, no
  drifting particles; **reduced motion**: still frames, the lightning flash off.
- Room: `world/ally-claims.ts` accepts Chain of Lamps' and the Moth Swarm's heals and Pyre Strike's ward.

## Departures (for the DM's eye)
- Hunter's Mark speaks *thar un vesh*: the shipped Rootwalk already speaks *thar vesh* (words are unique).
- The Mark's +% is yours and your beasts' (the room does not yet carry it to the party's claims); Fogwalk hides you only
  (allies' fog and PvP hiding wait for M3); Glim's Margin's +crit is yours.
- The Golem, the Grave-Mages and the Elder Beast are solo summons (not room kin): online, room creatures neither bite nor
  answer their taunts. skills-100.md calls the Golem "solo only".
- Elder Beast grows your **called** beast (Call of the Wilds) and refuses with "No called beast to grow" otherwise; its
  life is 60% of yours (the called beasts have no life of their own).
- Kiln Breath's Melting is "+% of your fire" on the foe (creatures carry no fire resist); Kiln Seal and Funeral Pyre are
  Flame Walls at a share of the Flame Wall's / the Golem's numbers.
- Wind = a thunderstorm (there is no wind weather yet).

## Balance (combat-sim, every band green, 81 s)
- New **L50 cell** (`LEVELS` 5…60 with 50) and the **L50 party cell** vs the Ink Abbess on Nightmare: full party falls 0%,
  no healer 75% (≥ 70%), no tank 0%.
- Sim paths take the rows past 40 (Rime Lance, Raise Grave-Mage; Chain of Lamps, Moth Swarm, Glim's Margin; Hunter's
  Mark, Thornrain), and bars hold Rime Lance, Chain of Lamps and Hunter's Mark. L5–L40 cells are unchanged to the decimal.
- L50 creature TTK: Warlock 2.2 s, Ashguard 2.5, Lanternwright 1.8 (band 2–5, ±15%: the margin is thin — her light bites
  the L50 dead ×1.5), Thornstrider 2.9.

## Tests
- `td-truth.spec.ts`: a probe for each of the 19 rows measuring every number its card quotes (×3 configs).
- `td-truth-marks.spec.ts`: 76 rows; every new mark's numbers, riders and a probe for each of its named rules.
- Class specs: counts, the cant's new roots `vor` / `rim`, the sky's spells may speak `vor`.

## Deploy
**The hearth must be redeployed** (td-mobs, ally-claims are in its bundle), hearth first, then the client. No functions,
no rules, no social-server.mjs.
