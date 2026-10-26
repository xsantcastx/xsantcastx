# The room's creatures fight the Keepers' summons — handoff

Branch `minions`, 2026-10-26 (from S5). The owner: "the monsters aren't attacking my minions".

**Cause.** Since M3 the room runs every area's creatures, and a Keeper's summons lived only on its own screen. The room's
MobSystem had every Keeper as prey (`others`) but no summons, so its creatures went for Keepers only. Before M3 the
screen's own MobSystem ran the creatures and fought its `minions`; a member screen (`replica`) runs no creature AI, so
nothing on it bit them either. Solo and offline were never broken (the screen's own MobSystem still fights them).

**What a player gets.** A Warlock's raised skeletons draw the room's creatures again, online, party or not: a creature
steps into a skeleton standing in front of its Warlock, a skeleton that out-damages the Keeper holding a creature takes
it, and a Captain of the Dead's taunt turns it on the Captain. The room bites them; the owner's screen shows each bite
and the skeleton falls only when the room says so. Everyone in the area sees another Keeper's skeletons, their life
dropping and their fall (they were party-only before).

**How.**
- `play/td/td-threat.ts`: summons on the ledger as `<owner>/<id>` (`kinKey`; solo `/k3`); `pickKin` (after the Keeper
  pick): a summon that out-threatens the pick (×1.1 to take it from a holder), or one nearer than the pick by
  MINION_DRAW that guards the Keeper it would go for (or nobody has threat). A summon's blows are its own threat; its
  owner gets none (the raised hold what they hit). Used by the screen and the room alike.
- `play/td/td-mobs.ts`: `MobSystem.kin` (others' summons, the room fills it), prey/taunt/bite/charge/shot paths for them
  (`biteKin` → `CoopLink.kinBite`), `kinBitten` (the screen applies the room's word), `blowKin` (a skeleton's blow names
  it: solo threat, and the claim's `k`), the Captain's taunt names the Captain, `kinGuard` (Shared Bones, ≤ 50%).
- `play/world/room-kin.ts` (new, bundled): `weighKin` — only `skel` (the only summon with life; pets, beasts, wisps,
  the Beacon and Glim never had any and stay pictures); count ≤ `kinCap(level)` (Raise Skeleton's cap at the most rank
  the level allows + 2 for gear); within `KIN_LEASH` of the owner by the room's record; life ≤ `kinMaxHp(level)`
  (raisedStats at the most spell power, Mastery ×1.3, a Captain ×2); after the first word the life is the room's (the
  owner's number lowers it, or raises it ≤ 25% of its most a second); a summon the room felled is refused 2 min.
- `play/world/room-world.ts`: `kin(from, pals, g)`, `kinBite` (a `{k:'kin', to, p, d, i?, x?}` event to the owner
  only, ahead of its other events), claims' `k` (threat to the summon, only one the room holds), a `raise-skeleton`
  taunt names the owner's nearest summon, `leave` forgets them, `kinNow`, `kinStats`.
- Wire: `/join` says `kin: true` (protocol 10 sessions on a room with `weighKin`). The screen then posts its companions
  list with `kin: 1` (and `g`, Shared Bones) even alone in the area; `social-server.mjs` gives it to the room and
  relays it to everyone in the world area (blocks honoured). `CoopHit.k` names the summon. Without `kin: 1` (an older
  screen) `/coop/pals` takes the old party path, so the room never bites what a screen cannot apply.
- Client: `td-coop.ts` (`roomHosted`, `kinOn`, the `kin` event), `td-engine.ts` (`setRoomKin`, pals sent to the room,
  `minionPalId`), `social-room.ts` (`kin`, gating), the side scroller sets it from the snapshot.

**Protocol stays 10.** Old clients keep working until they refresh: they never say `kin`, so their summons stay their
party's pictures, exactly as before. A new client on the old hearth sees `kin` absent and sends nothing new.

**Deploy (owner):** the hearth only (`social-server.mjs`, `social-world.mjs`, `world-sim-build.mjs` + the bundle). No
Functions, rules or hosting header change.

**Tests.** Node `scripts/social-m4.test.mjs` (+5: valid / too many / forged life / too far / dead; bites and the fall;
summon threat, out-threaten and the Captain's taunt; over HTTP with the relay; an older screen). Karma
`td-threat.spec.ts` (+3: pickKin, the room switching to a summon that out-threatens and biting it, a Captain's taunt
solo). e2e `e2e/td-world-kin.spec.ts` (two browsers: Bryn's skeletons bitten by a room wolf, felled, Aster sees it).

**Not done.** Raise Grave-Mage and the Ossuary Golem are designed (skills-100.md) but not in the game — add them to
`KIN_DEFS` when they ship. A party host outside the room (protocol 4, now only where the room does not run) still does
not bite party members' summons. Pets are never bitten (they have no life anywhere).
