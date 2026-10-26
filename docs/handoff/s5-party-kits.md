# The healer and the tank to level 30 (S5) and an animation and a sound for every attack (S3)
Built 2026-10-26 on branch `s5` (from main 9c0cb7e2). Design: `docs/design/skills-100.md` §0.4–0.6, §2, §3, §7;
`docs/world/campaign.md` S3 and S5; the DM's ruling `docs/design/skill-book-stand-ins.md`. S3's own notes:
`docs/handoff/s3-anim-sound.md`.

## What a player gets
- **The Lanternwright heals her party.** Hearthlight goes to the lowest ally within 8 tiles (her among them; a tap on
  a Keeper picks it for 3 s), the Hearth Circle mends every ally inside it, the Lantern Ward goes round the lowest
  ally. Both heals carry the party now: 3% more for every level she holds. Allies show a life bar under their plate.
- **New Hearth rows:** Cleanse (18), Rekindle (30), Hearthsong (42).
  - Cleanse lifts every status but Wet from one ally and keeps them off a moment.
  - Rekindle: kneel 3 s where a party member fell (within 30 s). They stand up there at 40% life, their purse comes
    back and the fall's debt is forgiven. A blow breaks the kneel.
  - Hearthsong: a 4 s channel. Every half second she and every ally within 6 tiles mend 3% of their life + 20.
- **The Ashguard tanks.** Creatures go for the Keeper with the most **threat** in reach, and his whole book makes
  twice the threat. New rows:
  - Brand Throw (12): a taunting pull. The blade strikes at 120% of the blow and taunts 3 s, then flies back at 50%.
  - Cinder Skin (12): fire resist, and melee strikers take part of their blow back as fire.
  - Banner of the Watch (24, an aura): allies within 6 take −8% (to −17.5%), and he takes −4%.
  - Second Wind (24): a self-heal.
  - Intercept (30): he dashes to an ally and takes 50% of what it takes, through his own Defense.
  - Hold the Gate (42): he plants himself. −40% for him, and everything within 5 is taunted every 2 s.
- **Every attack and skill** has a Keeper animation, an impact and a synthesised sound (S3). Creature bites have one
  per family. At most 6 hit cues play in any 100 ms. Reduced motion keeps the tells but drops the particles, and
  Low detail gets one-frame impacts.

## Threat (skills-100.md §0.5, `play/td/td-threat.ts`)
- Each creature keeps a ledger: `Mob.threat` (a Map by Keeper id, `''` = this screen's own Keeper).
- **What makes threat:**
  - damage ×1;
  - the Ashguard's book ×2;
  - a heal ×0.5, split over the creatures that already hold the healed one on their ledger;
  - a Taunt sets the taunter to the top +10% for as long as it holds.
- **Picking (`pickByThreat`):** among the Keepers it can see within its notice, the creature takes the one with the
  most threat. With nobody on the ledger it takes the nearest, as before. A challenger must clear the current one by
  10% (no flicker). The raised (skeletons) still step into its face.
- The screen's MobSystem (solo or a party host) and the room's (`room-world.ts`) run the same code.
  - Claims carry the skill (`CoopHit.s`) when it is the Ashguard's, so the room doubles it.
  - A Keeper's own life heals make threat in the room (`selfHealed`).
  - A fall wipes the fallen one's threat.
- **Measured (party sim):** the Ashguard takes 94% of the boss's blows.

## Ally effects through M4's claims (`play/world/ally-claims.ts`)
- **The wire.** The screen sends `a: AllyClaim[]` with its `/world/life` claims: `heal | ward | cleanse | rekindle |
  bond | aura`, each naming its skill. The room answers each one with what it moved, or why it refused.
- **The room checks (`allyLegal`, `RoomWorld.allies`):**
  - the skill can do that kind of thing to an ally (`ALLY_SKILLS`, with each row's tops);
  - the healer has reached the row's level;
  - the healer is within reach by the room's record (+2 tiles of slack);
  - heals stay within `allyHealBudget(level)` over 3 s (80 + 40·L a second), and the target takes at most 60% of its
    life a second from all healers together (`KeeperLife.allyHeal`);
  - at most 24 claims a second;
  - Rekindle only works on a Keeper the room saw fall within 95 s. The healer must be within 4 tiles of where it fell,
    and can Rekindle at most once per 50 s.
- **What lands on the target:**
  - A heal lands on the life the room keeps. Wards and cleanses are the target's screen's to hold: its soaks are
    claims the room bounds, as for a self-ward.
  - Guard auras cut the target's bites in the room (`guardOn`). Only the cut auras do: the Banner, the Gate, the Rally,
    Warded Ground and Rootwalk Party.
  - An Intercept bond hands the tank his share in the room (`bondsOn`).
  - The target's screen mirrors all of it through the snapshot's `ally` events (`MobSystem.allyLaid`, `allyCut`).
- **The room's snapshots also carry:**
  - `al`: the life of the Keepers near, which feeds the healer's pick and the plate bars;
  - `ally` events.
- **An older room.** `/join` says `allies: true` when the room weighs them. Without that, the screen never sends `a`.

## The 34 (c) stand-ins: the S5 share (23), done
Each mark keeps its solo effect and adds the ally one; every one is in `td-truth-marks.spec.ts`:
- **Hearth-Heat:** allies in the aura's reach burn +8%.
- **Shared Bones and Ward the Fellowship:** a 50% ward copy goes on the lowest ally within 6.
- **Share the Cup and Siphon Kin:** the lowest ally within 6 gets its share. Siphon's Reach adds +1 tile.
- **Rally:** allies within 6 take −10% while the cry holds.
- **Warm Ground:** allies in the Watchfire's reach share its regen.
- **Vow for Two:** an ally copy for 4 s. The room holds that ally on its last point.
- **Kindling Light, Lantern Burst and Healing Wisps:** they heal the lowest ally (the Keeper, when alone).
- **Warm Light and Shield of Light:** they reach allies in the aura.
- **Moth Hours:** the **Hush-rate hook**. `hushRate(place)` takes `keeper`, and the shutters closed read 0.5.
- **Twin Lights:** a second ally at 60%; when alone, the old repeat.
- **Long Reach:** +2 tiles of reach.
- **Mend the Mind:** each ally that enters has one status lifted.
- **Self-Ward Too:** cast on an ally, the ward lands on the caster too, at 50%.
- **Warm Pole and Waymark:** they reach allies near the pole and the Keeper.
- **Rootwalk Party.**
- The handoff's three missed marks: **Healing Sun** and **Warded Ground** now reach allies. **Lay Them All** waits
  for S6, as ruled.
- **Not done:** Thorn Shot B3 Mark-Seeker needs Hunter's Mark, a Thornstrider row outside this kit.
- **Departures, for the DM's eye:**
  - Iron Will lets you and your allies shrug off **Weaken and Blind**. Keepers carry no Fear or Taunt today.
  - Watchfire Banner's ally share is the Banner's regen.
  - Cleanse's ranks lengthen its grace by 0.1 s a rank instead of cutting its cooldown. A rank cannot change a
    cooldown today.

## Balance (combat-sim, every band green)
- **The party cells.** `--party` runs them alone; they are also part of `--check`. A level-30 tank, healer and
  Warlock face the Cinder Sovereign (L30) on Nightmare: Nightmare is where the party forms live (monsters-abilities
  §5.3), and on Normal the party never needs a healer.
- **Results (24 runs):**
  - full party: falls **0%**, clears 100% in ~365 s;
  - no healer: falls **100%**;
  - no tank: falls 0%. A kiting Warlock in front and a healer is enough here; the "needs a tank" cell waits for S10's
    party forms.
- **Bands:** `partyNoHealer ≥ 70%`, and the full party ≤ `bossDeath` (30%).
- S3's impact spark used `Math.random()`, which moved the seeded dice and broke two Ashguard bands. It now jitters
  from the clock instead.

## Deploy (the owner, once, from merged code)
**The hearth must be redeployed** (the bundle carries `ally-claims.ts` and `td-threat.ts`). Use protocol 10's commands
in `scripts/social-deployment.md`. Hearth first, then the client. No functions, no rules.

## Tests
- **Karma:**
  - `td-threat.spec.ts`: the ledger, threat targeting, the tank holding the healer clear, Hearthlight's pick, the
    mirrored guards, Rekindle, the room life;
  - `td-truth.spec.ts`: the 9 new rows probed;
  - `td-truth-marks.spec.ts`: 57 rows, every new and swapped mark probed;
  - `td-ashguard` / `td-lantern` (the new counts);
  - S3's `td-skill-kit` and `combat-cues`.
- **Node:** `scripts/social-m4.test.mjs` +4. The room weighs ally heals (reach, skill, level, budget, the wire); Rekindle
  (window, place, cooldown, forged share); the Banner and the bond in the room; threat on a room creature (×2, the
  10% hold, heal ×0.5, the Watch Cry).
- **E2E:** `e2e/td-world-s5.spec.ts`, two browsers. A healer heals her mate and both see it (≤ 1.9 s, the HoT's first
  tick included). A tank holds the creature off the healer: over 6 s her life is untouched and his is not.
