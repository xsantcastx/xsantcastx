/**
 * delve-inscription-lore.ts — what the walls of the Delve actually say.
 *
 * Keyed by inscription id rather than stored on the inscription itself, so
 * the Delve engine can own the list (ids, biomes, placement) and this file can
 * own the words without the two branches editing the same rows.
 *
 * Canon this is written against (Eclipse Realms docs/03-lore-and-design):
 *  - the Godforge is the primordial engine, not a workshop; its fracture made
 *    the Eclipse and scattered its workings as runes, artifacts and rifts;
 *  - a Keeper recovers lost runes and can safely carry Godforge fragments,
 *    and earns authority through craft and restraint, never by destiny;
 *  - the Void is unbound possibility, never a sixth realm;
 *  - the Nullthorn Staff was grown from a cutting of the World-Root's shadow,
 *    the inverse tree that grows downward beneath the Godforge;
 *  - Kael is the fifth Keeper and the only one who stayed.
 * Nothing here names an unapproved faction, antagonist or ending.
 *
 * Only the Codex imports this file, so the text ships in its lazy chunk.
 */

export interface InscriptionLore {
  title: string;
  text: string;
}

export const DELVE_INSCRIPTION_LORE: Readonly<Record<string, InscriptionLore>> = {
  // ── Root Hollows: the World-Root's shadow ────────────────────────────────
  'roots-inverse-tree': {
    title: 'The Tree That Grows Down',
    text:
      'Above the Godforge the World-Root reached for light. Below it, its shadow reached for the fracture, ' +
      'and found it first. Every root in these hollows is growing toward the same crack.',
  },
  'roots-cutting-mark': {
    title: 'A Cut, Healed Over',
    text:
      'Someone took a cutting here with a careful hand and sealed the wound with ink. ' +
      'The shadow-root did not die. It grew a thorn where the blade had been, and the thorn points back at whoever cut it.',
  },
  'roots-keepers-tally': {
    title: 'Tally of the Descent',
    text:
      'Five marks, scratched at Keeper height. Four are crossed through. ' +
      'The fifth has been gone over so many times the stone is worn smooth around it.',
  },

  // ── Basalt Caverns: Kael's abandoned forge-mines ─────────────────────────
  'basalt-kaels-mark': {
    title: 'The Seam Oath',
    text:
      'Take only what the seam gives. Leave the heat where it lies. Mark every tunnel you open, ' +
      'so the next Keeper knows what it cost. Signed with a hammer-mark, not a name.',
  },
  'basalt-seam-ledger': {
    title: 'Ledger of the Old Seam',
    text:
      'Cinder by the cartload, slag by the ton, and one line in a different hand: "Seam closed. Too close to the crack." ' +
      'Below it the same hand has started a tally and never finished it.',
  },
  'basalt-sealed-pocket': {
    title: 'Four Names in the Wall',
    text:
      'Four names are cut into the basalt and four are struck out, deep enough to break the chisel. ' +
      'Beneath them, fresh and shallow: "I stayed." The heat in this wall does not come from the rock.',
  },

  // ── Glowcap Grotto: light seeping through the fracture ───────────────────
  'grotto-light-through-the-crack': {
    title: 'Where the Light Leaks',
    text:
      'The glowcaps do not make their light. They drink it from a crack in the ceiling ' +
      'that should open onto rock and opens onto something brighter. Touch the crack and your fingers come away warm.',
  },
  'grotto-tally-marks': {
    title: 'Prices, in Chalk',
    text:
      'A neat column of prices, one per basket of glowcaps, each a little higher than the last. ' +
      'At the bottom, a note: "Every customer remembers the light. None of them remember who sold it to them."',
  },
  'grotto-drowned-lamp': {
    title: 'A Morning, Kept',
    text:
      'Carved around a cluster of glowcaps, in letters older than the cavern: ' +
      '"This is what morning looked like, before the Eclipse. Keep it lit." Someone has kept it lit.',
  },

  // ── Magma Halls: the fracture itself ─────────────────────────────────────
  'magma-the-fracture': {
    title: 'The Line It Broke Along',
    text:
      'A seam of runic light runs through the floor, perfectly straight, through rock that should have split any other way. ' +
      'This is where the Godforge gave. Stand on it and every rune you carry turns to face the same direction.',
  },
  'magma-warden-oath': {
    title: 'Instructions to the Warden',
    text:
      'Guard the fragment. Do not use it. Do not let it be used by anyone who wants to. ' +
      'If a Keeper comes who only wants to carry it home, let them pass, and test them all the way to the door.',
  },
  'magma-unsigned': {
    title: 'Unsigned',
    text:
      'The deepest inscription has no author and no date. It is a single tally mark, and a second one beside it, ' +
      'cut while you were reading the first.',
  },
};
