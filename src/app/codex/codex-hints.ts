/**
 * codex-hints.ts — what a locked achievement is allowed to tell you.
 *
 * The registry already carries a `description`, but a description is a
 * *confession*: "Created a box shadow with 5+ layers" is the answer written out.
 * Showing it on a locked card would turn the wall into a checklist and the site
 * into a chore. So a locked card shows the hint instead, and only flips to the
 * description once the thing has actually been found.
 *
 * Rules the hints follow:
 *   1. Gesture at the act, never name the tool or the exact threshold.
 *   2. Stay inside the Eclipse Realms voice — this is a codex, not a tooltip.
 *   3. Be solvable. A hint nobody can act on is just a locked door with a poem
 *      on it, and the point is for people to go and try something.
 *
 * Any egg without an entry here falls back to `genericHint()`, which is vague
 * but honest — better a dull hint than a crash or an empty card if an egg lands
 * in the registry before its hint does.
 */
import { EASTER_EGGS } from '../shared/easter-eggs/easter-egg.service';

export const EGG_HINTS: Record<string, string> = {
  // ── Global ────────────────────────────────────────────────────────────────
  'konami': 'Up, up, and the rest of it. The oldest incantation in the trade still opens things.',
  'night-owl': 'The realm is thinnest in the hours nobody admits to being awake for.',
  'speed-demon': 'Pass through five doors before a single minute closes behind you.',
  'explorer': 'Walk the whole length of the first hall before you leave it.',
  'codex-archivist': 'You are already here. The record notices when it is opened.',
  'trials-first': 'There is a hall of gates. Standing in front of them is enough.',
  'forge-self-aware': 'Somewhere in the Godforge there is a sheet with your own name on it.',
  'cloud-eternal-archive': 'Your progress transcends devices. The Godforge remembers across all realms.',

  // ── The six chains ────────────────────────────────────────────────────────
  // Each gestures at the character rather than at their last step. Naming the
  // objective would turn a five-part story into a checklist, and the whole
  // point of a chain is that you meet somebody before you know what they want.
  'npc-aureth-chain': 'Somebody in the light has been asking for you by a name you have not used yet.',
  'npc-verrin-chain': 'The one who waits in the Umbral counts to something. Finish the counting.',
  'npc-kael-chain': 'The Keeper will tell you what happened to the eye. He has conditions.',
  'npc-archivist-chain': 'There is an entry in the record with your handwriting and the wrong date. Close it.',
  'npc-merchant-chain': 'Spend enough and the shelf is no longer the interesting part of the shop.',
  'npc-nameless-chain': 'It asked three times. Nobody has ever answered the third.',

  // ── The combo ladder ──────────────────────────────────────────────────────
  // These gesture at rhythm rather than at a number, per rule 1 — naming the
  // count would turn the whole ladder into a checklist with a stopwatch.
  'combo-rapid-strike': 'Strike the ember, then strike it again before the last one has finished.',
  'combo-forge-frenzy': 'Keep the hammer falling long past the point it stops being a habit.',
  'combo-century-forge': 'A hundred without a pause. The anvil starts to notice.',
  'combo-relentless': 'Hold the rhythm until the realm leans in at the edges.',
  'combo-millennium-strike': 'A thousand unbroken. Somewhere underneath, something answers.',
  'combo-eclipse-breaker': 'Forty minutes of not stopping. The light gives out before you do.',
  'combo-first-sun': 'There is a number the counter cannot go past. Reach it in one breath.',
  'combo-forbidden-count': 'Between five hundred and a thousand there is a count nobody says aloud. Pass through it.',

  // ── The Ambient Forge — presence, not pursuit ─────────────────────────────
  'idle-patient-one': 'The flame gives to whoever is still watching it. A hundred of anything is a start.',
  'idle-forge-meditation': 'Half an hour. Do not look away, and do not go anywhere.',
  'idle-vigil': 'Five hundred, gathered a minute at a time. There is no faster road to it.',
  'idle-eternal-flame': 'Two thousand. At this rate that is a season of afternoons.',
  'idle-never-sleeps': 'Be watching when one day becomes the next.',
  'idle-forge-striker': 'A thousand blows. The flame counts every one.',
  'idle-obsidian-hammer': 'Ten thousand. Nobody arrives here by accident.',

  // ── The Godforge Market — spending, not finding ───────────────────────────
  // Six that are earned rather than hidden. The hints say what kind of effort
  // reaches them without naming the number, because on three of these the
  // number *is* the whole secret.
  //
  // The two strike-count achievements this release would otherwise have added
  // are deliberately absent: 'idle-forge-striker' and 'idle-obsidian-hammer'
  // above already pay out at a thousand and ten thousand strikes, and the
  // Market's flame drives the same counter. Two cards for one act would be two
  // wrong numbers on the wall.
  'forge-first-purchase': 'The ember in the corner is not the only thing that takes coins.',
  'forge-investor': 'A handful of the furnace ladder, in any combination you like.',
  'forge-market-mogul': 'Three times a handful. The price climbs 15% every time you say yes.',
  'forge-artifact-collector': 'Essence buys permanence. Own enough permanence to make a shelf.',
  'forge-complete-collection': 'Every shelf, empty. Nothing left in the case with a price on it.',
  'forge-click-frenzy': 'The ember pays eight times a second at most. Spend a whole minute finding out.',

  // ── The Rune Forge ── the hints name the price, never the odds. A hint that
  // says "one in two thousand" turns a run of bad luck into a grievance; one
  // that says "keep striking" leaves it a run of bad luck.
  'rune-first': 'Ten thousand Gold on the anvil buys one answer. Any answer counts.',
  'rune-collector': 'Ten different answers. The anvil repeats itself far more than it surprises you.',
  'rune-master': 'Twenty different answers. By here you know the common five by their colour alone.',
  'rune-complete-set': 'Every rune the Archivum has a name for. Including the one it will not say aloud.',
  'rune-first-word': 'Runes are not the point. Runes in the right order are the point.',
  'rune-word-scholar': 'Three words held at once. The runes each one takes do not come back.',
  'rune-void-voice': 'Something in the table does not want to be found. Keep striking anyway.',
  'rune-breath-of-void': 'Six runes. One of them is the one that does not want to be found, and one of them you will need twice.',

  // ── Lore Scrolls ── the hints point at the anvil without naming the odds.
  'scroll-lore-hunter': 'The anvil turns up more than metal. The better the rune, the likelier the page.',
  'scroll-full-codex': 'Twenty-four of them can be worked for. The twenty-fifth is blank, and only one rune has ever read it.',
};

/**
 * Fallback for an egg with no authored hint. Deliberately unhelpful about the
 * *how* and specific about the *where* — enough to send someone to the right
 * door without opening it for them.
 */
export function genericHint(toolTitle?: string): string {
  return toolTitle
    ? `Something in ${toolTitle} responds to an input nobody would type by accident.`
    : 'The realm is keeping this one to itself. For now.';
}

export function hintFor(eggId: string, toolTitle?: string): string {
  return EGG_HINTS[eggId] ?? genericHint(toolTitle);
}

/**
 * Ids present in EGG_HINTS that no longer match a registered egg. Nothing in the
 * app reads this — it exists so the unit test can fail loudly when an egg is
 * renamed and its hint is left behind pointing at nothing.
 */
export function orphanedHintIds(): string[] {
  const live = new Set(EASTER_EGGS.map(e => e.id));
  return Object.keys(EGG_HINTS).filter(id => !live.has(id));
}

/** Registered eggs with no authored hint — they fall back to `genericHint()`. */
export function unhintedEggIds(): string[] {
  return EASTER_EGGS.filter(e => !EGG_HINTS[e.id]).map(e => e.id);
}
