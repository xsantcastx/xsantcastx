# Skill Book stand-ins: the DM's ruling (2026-10-26)

Source: `docs/handoff/skill-book.md` "Stand-ins" and `src/app/play/td/td-marks.ts` (branch `skillbook`). The builder
counts 61; the handoff's list names 58 marks, and all 58 are ruled on here. The builder must name the other three
(`grep` the stand-in flags in `td-marks.ts` against this file); each takes the same test below.

**The test.** A stand-in is canon forever (a) if it is a complete, honest solo effect that fits the mark's name. It
is replaced now (b) if it contradicts its own name or does nothing. It is kept for now and swapped when a system
lands (c). In every (c) the mark keeps its name, and the swap *adds* the group effect; it never removes the solo one
unless stated.

**Rule for (c) swaps.** The builder of the named S-task owns the swap. It changes `td-marks.ts` and the `book.fx.*`
line, and moves the mark off this list. No saved mask changes (a mark is a bit, not a number).

## Systems and who ships them
| System | Task | Notes |
|---|---|---|
| Ally targeting, ally heals and wards | **S5** | skills-100.md §3 "Ally targeting" |
| Rain, Wet, Fog | **S4** | the Wet status; fog for the Lamp marks |
| Thunderstorm strikes | **S8** | Storm Trap |
| Raisers, fire-to-ash, Consecrate, Grave-Stamp, pack auras, elite affixes | **S6** | `MobDef.ability` kinds, new affixes |
| Threat (taunt, no-threat heals) | **S10** (Ashguard ×2 written in S5) | |
| The Hush-rate multiplier | **S5**, added by this ruling | see "New work" |

## Warlock
- **Aura of Embers A3 Hearth-Heat** (your fire +8% while it runs): (c) S5. Keep; the aura also lifts allies' fire +8%
  inside its reach.
- **Aura of Embers B2 Ash to Ash** (kill by the aura: 2 mana): (a). Wording: "A foe the aura kills gives you 2 mana."
- **Cinder Rain B3 Dry Season** (+30% on Burning foes): (c) S4. Keep +30%; add "Rain and Wet never cost this fire its
  strength." Dry Season is named for the weather it ignores.
- **Flame Wall B2 Firebreak** (foes in fire walk 40% slower): (a). A firebreak holds things back. Wording: "Foes
  crossing the wall walk 40% slower."
- **Raise Skeleton A2 Ash-Bone** (blows Burn): (a). Burn 2 s at 20%.
- **Raise Skeleton A3 Captain of the Dead** (x2 life and blow, no taunt): (b). The Captain taunts: every 6 s it
  taunts foes within 4 tiles for 1.5 s (the `taunt` status exists). In a party its threat is halved (S10 reads it).
- **Raise Skeleton B2 From Ash Too** (+1 raised a cast): (c) S6. Keep +1. When fire-to-ash ships, the mark lets you
  raise from a corpse that fire burned; the +1 stays.
- **Corpse Burst B3 Lay to Rest** (Hush only): (c) S6. Keep the 1 s Hush; add "a burst corpse cannot be raised."
- **Bone Armor B3 Shared Bones** (your raised take 50% less): (c) S5. Keep; add "an ally within 6 tiles gets a copy at
  50%." The skeletons are kin first.
- **Bone Storm A2 Pierce** (Bleed; spears already pierce): (b). Replace the Bleed with: each foe a spear has already
  passed through takes +10% from the next, up to +30%. The name now matches the work.
- **Bone Storm B3 Spiralling** (second fan at 50%): (a).
- **Drain Life B3 Share the Cup** (your raised drink): (c) S5. Keep; add "50% of the heal goes to the lowest ally
  within 6 tiles."
- **Siphon A3 Siphon Kin** (your raised drink): (c) S5. Keep; add the lowest ally within 6.
- **Siphon B1 Reach** (+1 heal; the aura has no radius): (c) S5. Keep +1; when the aura gets a 4-tile radius for
  allies, Reach is +1 tile.
- **Ember Curse B2 Mark of Ash** (a cursed foe's death gives mana): (a). 3 mana.
- **Dark Ward B3 Ward the Fellowship** (bursts as it breaks): (c) S5. This repeats Lantern Ward B3. Until S5, cut the
  burst to 40% of the absorb within 2 tiles, so the two do not read as one effect. Then add the ally copy at 50%.
- **Weaken A2 Brittle** (weakened foes take more from all your hits): (a). In a party it is "from anyone"; this is
  free once online M2 lands, with no task needed.
- **Weaken B3 Lingering** (+4 s): (a).
- **Doom A3 Unmaking** (strip an elite's first affix, 10 s): (c) S6. Cut to 6 s so Banish's strip stays distinct;
  S6's affixes make it richer.

## Ashguard
- **Whirl A3 Walking Whirl** (+20% walk while it turns): (a).
- **Shield Bash B2 Grave-Stamp** (stun splash): (c) S6. Keep; on a raise channel in reach the stamp breaks it (the
  raiser counter).
- **Shield Oath A3 The Shield Remembers** (a block heals 2%): (a).
- **Watch Cry A2 Rally** (+5% guard): (c) S5. Keep; add "allies within 6 take 10% less for the duration."
- **Ash Stride A2 Ash Trail** (struck foes Burn): (a).
- **Watchfire A2 Warm Ground** (+25% regen): (c) S5. Keep; allies in its reach share the regen.
- **Watchfire B1 Wide Fire** (+15% Defense): (b). The name promises reach and the effect is armour. Rename **Tempered
  Fire / Fuego templado**; keep +15%.
- **Vow A3 Vow for Two** (5% life steal during it): (c) S5. Keep; add "also an ally within 6 (their copy lasts 4 s)."

## Lanternwright
- **Kindle A3 Kindling Light** (heals you): (c) S5. Every 4th flare heals the lowest ally 15% of its hit; you
  count as the lowest ally when alone.
- **Kindle B2 Searching Light** (+10% on the dead): (a).
- **Blinding Flash A3 Consecrate** (+1 s stun): (c) S6. Keep; the lit ground is the raise counter.
- **Blinding Flash B3 Lantern Burst** (heals you): (c) S5. Heals the lowest ally 10% of the hit.
- **Lantern Aura A2 Warm Light** (you): (c) S5. Allies in reach too.
- **Lantern Aura A3 Shield of Light** (you): (c) S5. Allies in reach too.
- **Lantern Aura B2 Fog-Lamp** (+1 light): (c) S4. Keep; in fog the aura also thins it around you (fog is S4's).
- **Lantern Aura B3 Lantern Against the Lightless** (dark-born take +15%): (a).
- **Shutter A2 Quiet Hands** (noticed 2 tiles later): (c) S10. Keep; add "shuttered, your heals make no threat."
- **Shutter A3 Moth Hours** (dark-born leave you be): (c) S5's Hush hook. Keep; add "the Hush rises 50% slower."
- **Shutter B1 Swift Shutter** (-0.5 s, already the floor): (b). Closing the shutter costs 0 mana, and the toggle has
  no cooldown. It was a dead mark.
- **Dawn at Noon B3 No Shadow** (inside is Hushed): (b). Use the `hearth` flag the book already has: "While it holds,
  the Hush cannot rise around you." The stand-in confused a Hush that harms with one that is held back.
- **Hearthlight A3 Twin Lights** (heals again at 60%): (c) S5. Becomes a second ally at 60%; alone, the repeat stays.
- **Hearthlight B1 Long Reach** (+10% heal): (c) S5. Keep +10%; add +2 tiles of reach for the ally pick.
- **Hearth Circle B3 Mend the Mind** (no chill inside): (c) S5. Becomes Cleanse: removes one status from each ally
  entering; chill immunity stays solo.
- **Lantern Ward B3 Self-Ward Too** (bursts as it breaks): (c) S5. The ward also goes on you when cast at an ally;
  the burst stays at 50%.
- **Lamp-Wisp A2 Healing Wisps** (you): (c) S5. Motes heal the lowest ally 1% a mote.
- **Beacon A2 Warm Pole** (you): (c) S5. Allies within 3 of the pole regen 1/s.
- **Beacon B2 Waymark** (you): (c) S5. Allies within 4 of the pole walk 10% faster for the same time.

## Thornstrider
- **Thorn Shot B3 Mark-Seeker** (+15% on Bleeding foes): (c) S5. When Hunter's Mark ships, the shot seeks the
  Marked foe; +15% stays.
- **Command A3 Hold Them** (the commanded foe bites 20% weaker): (a).
- **Command B3 Pack Command** (+10% from you): (c) S6. Every foe of the commanded one's pack within 3 tiles obeys at
  half strength. It needs pack membership.
- **Pack Bond A2 Shared Hurt** (20% less taken while bonded): (a).
- **Pack Bond A3 One Pack** (+5% guard and bite): (a).
- **Call of the Wilds A2 Wolf, Bear or Hart** (bites Chill): (b). Each cast calls them in turn: wolf (bites Chill 1 s),
  bear (x1.4 life), hart (+30% walk speed for you and the beast). The name asks for three beasts; give three.
- **Call of the Wilds B3 Spirit Beast** (bites leap at 50%): (a).
- **Stampede B3 The Herd Remembers** (you heal 2% a beast): (a).
- **Thornroot Snare B3 Mud and Thorn** (+0.5 s root): (c) S4. Keep; a Wet foe in the snare is rooted +1 s.
- **Bramble Trap B3 Storm Trap** (Stun 1 s): (c) S8. Keep; in a thunderstorm the trap calls a strike (the lightning
  is S8's).
- **Rootwalk A3 Rootwalk Party** (15% less taken): (c) S5. Allies within 4 take the same.
- **Rootwalk B3 Mossfoot** (the Hush cannot rise while it runs): (a). It uses the real hearth flag.

## S5's share: done (2026-10-26, branch `s5`, docs/handoff/s5-party-kits.md)
Every (c) mark above marked S5 now reaches allies through the room's ally claims, keeping its solo effect, and the
Hush-rate hook is in (`hushRate`'s `keeper`; Moth Hours 0.5). Healing Sun and Warded Ground (two of the three marks
the earlier list missed) reach allies too. Thorn Shot B3 Mark-Seeker waits for Hunter's Mark (a Thornstrider row).
Departures for the DM's eye: Iron Will (a new Banner mark) shrugs off Weaken and Blind (Keepers carry no Fear or
Taunt); Watchfire Banner's ally share is regen.

## Count
Of the 58 listed: (a) 18, (b) 6, (c) 34. The (c) swaps by task: S5 23 (Moth Hours via the Hush hook), S6 6, S4 3, S8 1, S10 1.

## New work (added to campaign.md)
- **The Hush-rate hook** goes on S5: `hushRate(place)` in `td-dark.ts` takes a multiplier from the Keeper's marks.
  Moth Hours reads it (0.5). No other mark needs it.

## Spanish names to change (house style: no diacritics)
| Mark (EN) | Now | Replace with | Why |
|---|---|---|---|
| Weaken B2, Cinder Cleave B2, Whirl B2, Hearthlight B2, Volley B2, Stampede B2: Cheap | Barato | Frugal | "Barato" is a shop word; the mark spends less mana |
| Ember Brand B2, Shield Oath B2: Cheap Oath | Juramento barato | Juramento frugal | same |
| Doom B2: Cheap Doom | Condena barata | Condena frugal | same |
| Bone Storm B2: Cheap Bone | Hueso barato | Hueso frugal | same |
| Lamp-Wisp B2: Cheap Light | Luz barata | Luz frugal | same |
| Call of the Wilds B2: Cheap Call | Llamada barata | Llamada frugal | same |
| Weaken B1: Wide | Ancho | Radio ancho | one bare adjective, no noun |
| Banish B3: Lay Them All | Acostarlos a todos | Descanso para todos | stilted; also near "Dar descanso" |
| Watch Cry A2: Rally | Reunion | Cerrar filas | Rally is closing ranks, not a meeting |
| Aura of Embers A2: Flareback | Rebrote | Retorno de llama | "Rebrote" means regrowth |
| Flame Wall A2: Caught Alight | Prendido | Presa de las llamas | clashes with "Prendido rapido" |
| Bone Armor A2: Splinter Back | Espalda de astillas | Astillas devueltas | it returns splinters, not a back |
| Bramble Trap A1: Heavier | Mas pesado | Mas pesada | "trampa" is feminine |
| Lamp-Wisp A2: Healing Wisps | Fuegos que sanan | Fuegos fatuos que sanan | the wisp is a will-o'-the-wisp |
| Lamp-Wisp B3: Wisp Ward | Guarda de fuegos | Guarda de fuegos fatuos | same |
| Watchfire B1: Tempered Fire (new EN) | Fuego ancho | Fuego templado | follows the rename above |

That is 21 changes (the six plain "Cheap" rows count each). English names stay as the book has them, except Watchfire B1.
