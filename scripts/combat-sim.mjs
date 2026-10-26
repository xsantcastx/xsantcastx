#!/usr/bin/env node
/**
 * Eclipse Realms combat simulator — time to kill, deaths, potions, XP and Gold an hour, per vocation and level.
 *
 * It runs the REAL fight: src/app/play/td/td-mobs.ts (MobSystem, MOBS), td-skills (fightStats, the skills), the
 * trees (td-tree buyRank), the item affixes (item-affixes rollAffixes), the elites (td-elites), the Seam Eater
 * (td-seam), the difficulty tiers (difficulty.model) — transpiled here with the repo's own TypeScript, the same pure
 * modules the Karma truth harness (td-truth*.spec.ts) drives. Only the Keeper's hands are modelled here: where he
 * stands, which key he presses, when he drinks, whether he steps out of a telegraphed attack, and the Thornstrider's
 * beast (the engine owns pets). So the sim cannot drift from the game: change a creature, a skill or an affix and
 * the table moves with it.
 *
 *   node scripts/combat-sim.mjs              # the table: every vocation × 5/10/20/30/40/60, every boss, the Seam Eater
 *   node scripts/combat-sim.mjs --check      # assert the bands (docs/design/loot-and-combat.md §13); exit 1 on a miss
 *                                            # (24 seeded runs a cell, deterministic, ~10 s: in CI and the gate)
 *   node scripts/combat-sim.mjs --quick      # 8 runs a cell, fewer Seam rows (a fast look while tuning)
 *   node scripts/combat-sim.mjs --runs=40    # seeded runs per cell
 *   node scripts/combat-sim.mjs --json       # the raw numbers
 *   node scripts/combat-sim.mjs --dps        # each vocation's sustained damage a second on one creature, by level
 *   node scripts/combat-sim.mjs --trace=warlock,30,ink-hound[,nightmare] [--pack=unique]
 *                                            # one fight: the Keeper built, the outcome, damage dealt and taken by source
 *   node scripts/combat-sim.mjs --patch=what-if.json   # try numbers without editing the game (see --patch below)
 *
 * The Keeper (docs/design/loot-and-combat.md §13 "the simulated Keeper"):
 *  - gear: the eight gear wells rolled at item level = his level through the real rollAffixes, each in its class-
 *    appropriate family (loot-and-combat.md §3.6: a wand and a focus for the casters, a blade and a shield for the
 *    Ashguard, a crossbow and a quiver for the Thornstrider; armour and a ring for all); magic everywhere below 10, then
 *    rare in the weapon, head, chest and trinket and magic in the rest; each well the best of three drops for his
 *    vocation, weighed by his own damage family (a player keeps the better piece);
 *  - attributes: every point he has (keeperAttributePoints): 45% Spirit, 40% Vitality, 15% Energy (Ashguard and
 *    Thornstrider: Agility, to its 30-point cap, then Vitality);
 *  - skill points along PATHS below through buyRank (tiers, prerequisites, points), the bar and aura from what he
 *    holds;
 *  - a belt of 8 health and 8 mana potions of his level's tier; he drinks under 40% life / 20% mana (2 s apart);
 *  - on Nightmare and Hell he comes geared for the tier (TIER_LEAD levels above the Seam Eater, rare / epic gear with
 *    resists first, a belt of TIER_BELT + TIER_BELT);
 *  - he steps out of half the telegraphed attacks (a boss's breath tell, a Rend ring, a Fire-Enchanted burst): DODGE;
 *  - a ranged vocation (all but the Ashguard) backs away, circling, from a creature slower than him that comes within
 *    KITE (Tibia's kiting); the Ashguard walks in and stands;
 *  - TRAVEL seconds between pulls on a hunt (leveling.md's 240 kills an hour).
 */
import { createRequire } from 'node:module';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const require = createRequire(import.meta.url);
const ts = require('typescript');

// ── Loading the game's own modules ───────────────────────────────────────────────────────────────────────────────

const cache = new Map();
/** Transpile a .ts module (and its relative imports, recursively) and evaluate it as CommonJS. */
function load(rel) {
  const file = resolve(ROOT, rel);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const req = name => {
    if (!name.startsWith('.')) return require(name);
    let p = resolve(dirname(file), name);
    if (!p.endsWith('.ts')) p = existsSync(`${p}.ts`) ? `${p}.ts` : `${p}/index.ts`;
    return load(p.slice(ROOT.length + 1));
  };
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  return module.exports;
}

const MOBS_M = load('src/app/play/td/td-mobs.ts');
const SK = load('src/app/play/td/td-skills.ts');
const TREE = load('src/app/play/td/td-tree.ts');
const MARKS = load('src/app/play/td/td-marks.ts');
const ELITE = load('src/app/play/td/td-elites.ts');
const SEAM = load('src/app/play/td/td-seam.ts');
const MELEE = load('src/app/play/td/td-melee.ts');
const THORN = load('src/app/play/td/td-thorn.ts');
const PETS = load('src/app/play/td/td-pets.ts');
const AFFIX = load('src/app/shared/rpg/item-affixes.ts');
const DIFF = load('src/app/shared/loot/difficulty.model.ts');
const POT = load('src/app/shared/potions/potions.model.ts');
const KL = load('src/app/shared/skills/keeper-level.ts');
const MILE = load('src/app/shared/skills/keeper-milestones.ts');
const HUNT = load('src/app/shared/skills/hunting.ts');
const ZONE = load('src/app/play/td/td-zones.ts');
const PTS = load('src/app/shared/keeper-look/skill-points.ts');
const { MOBS, MobSystem } = MOBS_M;
const TILE = load('src/app/play/td/td-art.ts').TILE;

// ── Arguments ────────────────────────────────────────────────────────────────────────────────────────────────────

const argv = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
// --patch=<file.json>: a what-if, applied to the loaded tables before anything runs (never written back):
// { "skills": { "<id>": { "vars": {…}, "grow": {…}, "cd": n, "mana": n } }, "mobs": { "<id>": { "hp": n, "dmg": [a, b], … } } }
if (argv.patch) {
  const p = JSON.parse(readFileSync(resolve(process.cwd(), String(argv.patch)), 'utf8'));
  for (const [id, d] of Object.entries(p.skills ?? {})) {
    const sk = SK.SKILLS[id];
    if (!sk) throw new Error(`--patch: no skill ${id}`);
    for (const [key, v] of Object.entries(d)) sk[key] = v && typeof v === 'object' && !Array.isArray(v) ? { ...sk[key], ...v } : v;
  }
  for (const [id, d] of Object.entries(p.mobs ?? {})) { if (!MOBS[id]) throw new Error(`--patch: no creature ${id}`); Object.assign(MOBS[id], d); }
}
const QUICK = !!argv.quick;
const RUNS = Number(argv.runs) || (QUICK ? 8 : 24);
const HUNT_SECS = QUICK ? 900 : 1800;

// ── Seeded randomness (the fight rolls through Math.random: it is swapped for a seeded one per run) ──────────────────

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const realRandom = Math.random;
function seeded(seed, fn) { const r = mulberry(hash(String(seed))); Math.random = r; try { return fn(r); } finally { Math.random = realRandom; } }

// ── The simulated Keeper ─────────────────────────────────────────────────────────────────────────────────────────

export const VOCATIONS = ['warlock', 'ashguard', 'lanternwright', 'thornstrider'];
export const LEVELS = [5, 10, 20, 30, 40, 60];
/** Share of telegraphed attacks (a breath's tell, a Rend ring, a burst's ring) the Keeper steps out of. */
export const DODGE = .5;
/** Seconds between one kill and the next pull on a hunt: walking to it, picking the loot (leveling.md §1's 240 kills an hour at a 3 s kill). */
export const TRAVEL = 12;
/** A ranged Keeper backs away from a slower creature that comes within this (art px; 2¼ tiles). */
export const KITE = 36;
/** Seconds a fall costs on a hunt: the walk back from the hearth to the purse. */
export const FALL_SECS = 60;
const BELT = 8;
/** A Keeper who comes for a Nightmare or Hell boss comes with a full belt (the potion stacks he would carry). */
const TIER_BELT = 16;
/** --trace: damage dealt by its floating number's colour (which skill). */
const TALLY = argv.trace ? {} : null;
const WALK = 74; // td-engine SPEED, art px a second

/**
 * Where each vocation spends its skill points (in order; each [skill, rank] is bought up to that rank before the next,
 * a skill whose level or "a rank above it" is not open yet is passed over until it is). D2's habit: the basic attack and
 * one main spell first, their synergies after. The Skill Book's marks (td-marks, skill-book.md) read `skill#slot`
 * (one point each, as soon as the row's rank allows): the main row's A1 → A2 → its star, then the basic attack's, then
 * the second row's (skills-100.md §7) — each calling's stars named here, so the sim reads the build players will copy.
 */
export const PATHS = {
  warlock: [['ember-bolt', 4], ['hellfire-nova', 3], ['ember-bolt#a1'], ['cinder-rain', 1], ['flame-wall', 1], ['meteor', 1], ['meteor#a1'],
    ['ember-bolt', 10], ['hellfire-nova', 8], ['ember-bolt#a2'], ['ember-bolt#a3'], ['hellfire-nova#a1'], ['meteor', 8], ['meteor#a2'],
    ['ember-bolt', 20], ['meteor', 10], ['meteor#b1'], ['meteor#b2'], ['meteor#b3'], ['hellfire-nova', 10], ['hellfire-nova#a2'], ['hellfire-nova#a3'],
    ['meteor', 20], ['hellfire-nova', 20], ['aura-embers', 20]],
  ashguard: [['watch-blade', 4], ['watch-blade#a1'], ['ember-brand', 2], ['cinder-cleave', 3], ['cinder-cleave#a1'], ['aura-watchfire', 2], ['aura-watchfire#a1'], ['whirl-of-cinders', 1],
    ['watch-blade', 10], ['cinder-cleave', 10], ['cinder-cleave#a2'], ['ember-brand', 8], ['whirl-of-cinders', 8],
    ['shield-oath#a1'], ['watch-blade#b1'], ['watch-blade#b2'], ['watch-blade#b3'], ['watch-blade', 20], ['cinder-cleave', 20], ['whirl-of-cinders', 20], ['ember-brand', 20], ['aura-watchfire', 20]],
  lanternwright: [['kindle', 4], ['kindle#a1'], ['hearthlight', 2], ['lamp-wisp', 3], ['lamp-wisp#a1'], ['banish', 1], ['banish#a1'], ['beacon', 1],
    ['kindle', 10], ['kindle#a2'], ['banish', 8], ['lamp-wisp', 8], ['dawn-at-noon', 1], ['kindle', 20], ['banish', 20], ['banish#a2'],
    ['dawn-at-noon', 10], ['dawn-at-noon#a1'], ['lamp-wisp', 20], ['lamp-wisp#b1'], ['lamp-wisp#b2'], ['lamp-wisp#b3'], ['dawn-at-noon', 20]],
  thornstrider: [['thorn-shot', 4], ['thorn-shot#a1'], ['barbed-shot', 3], ['barbed-shot#a1'], ['volley', 2], ['pack-bond', 2], ['pack-bond#a1'],
    ['thorn-shot', 10], ['thorn-shot#a2'], ['thorn-shot#a3'], ['barbed-shot', 8], ['call-of-the-wilds', 1], ['command', 5], ['command#a1'], ['stampede', 1],
    ['thorn-shot', 20], ['barbed-shot', 20], ['barbed-shot#a2'], ['stampede', 10], ['volley', 10], ['command', 10]],
};
/** The bar each vocation wants, best first; the first four it holds a rank in go on the keys. */
const BARS = {
  warlock: ['meteor', 'hellfire-nova', 'ember-curse', 'dark-ward', 'drain-life'],
  ashguard: ['cinder-cleave', 'whirl-of-cinders', 'ember-brand', 'shield-oath', 'ash-stride', 'shield-bash'],
  lanternwright: ['banish', 'lamp-wisp', 'hearthlight', 'dawn-at-noon', 'beacon', 'blinding-flash', 'lantern-ward'],
  thornstrider: ['barbed-shot', 'volley', 'command', 'stampede', 'call-of-the-wilds', 'thornroot-snare'],
};
/** What each stat is worth to any vocation when it picks the better of its drops (its own damage family below). */
const WANT_ALL = {
  critChance: 2, life: 1.5, defense: 1, lifeRegen: 1, manaRegen: .6, mana: .4,
  fireResist: .6, coldResist: .5, lightningResist: .3, arcaneResist: .6, allResist: 1.5, moveSpeed: .4, magicFind: 0, xpBonus: 0, goldFind: 0,
};
/** §3.6: each calling wants its own family — the casters Spell Damage, the fighters Martial Damage and their weapon's own. */
const WANT_BY = {
  warlock: { spellDamage: 3, castSpeed: 2, skillRanks: 3 },
  lanternwright: { spellDamage: 3, castSpeed: 2, skillRanks: 3 },
  ashguard: { attackDamage: 4, attackSpeed: 3, minDamage: 2, maxDamage: 2, lifeLeech: 1.5, blockChance: 1.5 },
  thornstrider: { attackDamage: 3, attackSpeed: 2, minDamage: 2, maxDamage: 2, pierceChance: 1 },
};
/**
 * §3.6: the class-appropriate gear each wears in its weapon and off-hand wells (the one-handed build every class can):
 * the Warlock a wand and a focus, the Lanternwright a wand and the lantern, the Ashguard a blade and a shield, the
 * Thornstrider a crossbow and a quiver. Armour and rings are every calling's.
 */
const GEAR_FAMILY = {
  warlock: { weapon: 'caster', 'off-hand': 'focus' },
  lanternwright: { weapon: 'caster', 'off-hand': 'focus' },
  ashguard: { weapon: 'martial', 'off-hand': 'shield' },
  thornstrider: { weapon: 'bow', 'off-hand': 'quiver' },
};
const familyFor = (voc, slot) => GEAR_FAMILY[voc]?.[slot] ?? AFFIX.DEFAULT_FAMILY[slot];
const SLOTS = ['weapon', 'head', 'chest', 'hands', 'legs', 'feet', 'off-hand', 'trinket'];
const RARE_SLOTS = new Set(['weapon', 'head', 'chest', 'trinket']);

/**
 * On Nightmare and Hell he gears for the tier, as D2 asks: rare in every well (epic in Hell), each the best of ten
 * drops, resists weighing heavily and the foe's own element most.
 */
const RESIST_WANT = { fireResist: 4, coldResist: 4, lightningResist: 4, arcaneResist: 4, allResist: 8 };
function rollGear(level, seed, resist = null, tierRarity = 'rare', voc = 'warlock') {
  const base = { ...WANT_ALL, ...WANT_BY[voc] };
  const want = resist ? { ...base, ...RESIST_WANT, [`${resist}Resist`]: 16 } : base;
  return seeded(`gear|${seed}|${level}|${resist ?? ''}`, r => {
    const total = {}, weapon = {};
    for (const slot of SLOTS) {
      const rarity = resist === null ? (level >= 10 && RARE_SLOTS.has(slot) ? 'rare' : 'uncommon') : tierRarity;
      let best = null, bestScore = -1;
      for (let k = 0; k < (resist === null ? 3 : 10); k++) {
        const where = { slot, affixFamily: familyFor(voc, slot) };
        const { stats } = AFFIX.rollAffixes(where, rarity, level, r);
        let score = 0;
        for (const [key, v] of Object.entries(stats)) { const hi = AFFIX.affixRange(key, { family: where.affixFamily, slot }, level, rarity)[1] || 1; score += (want[key] ?? 0) * v / hi; }
        if (score > bestScore) { bestScore = score; best = stats; }
      }
      for (const [key, v] of Object.entries(best)) total[key] = (total[key] ?? 0) + v;
      if (slot === 'weapon') Object.assign(weapon, best);
    }
    // The milestones' passives (keeper-milestones passiveBonus) ride on the gear totals, as the HUD hands them in.
    for (const [key, v] of Object.entries(MILE.passiveBonus(level))) total[key] = (total[key] ?? 0) + v;
    return { total, weapon };
  });
}

function attributes(voc, level) {
  const n = MILE.keeperAttributePoints(level);
  const quick = voc === 'ashguard' || voc === 'thornstrider';
  const third = Math.round(n * .15);
  const agi = quick ? Math.min(30, third) : 0, ene = quick ? 0 : third;
  const spi = Math.round(n * .45);
  return { vit: n - spi - agi - ene, ene, spi, agi };
}

function skillTree(voc, level, path = PATHS[voc], barOf = BARS[voc]) {
  let tree = { spent: {}, free: [], at: 0 };
  for (let guard = 0; guard < 400; guard++) {
    let bought = false;
    for (const [step, want] of path) {
      const [id, slot] = step.split('#');
      if (slot) {
        // A mark: taken once, as soon as the row's rank and the points allow.
        if (TREE.marksOf(tree, voc, id) & MARKS.MARK_BIT[slot]) continue;
        const next = TREE.buyMark(tree, voc, id, slot, level);
        if (next) { tree = next; bought = true; break; }
        continue;
      }
      if (TREE.rankOf(tree, voc, id) >= want) continue;
      const next = TREE.buyRank(tree, voc, id, level);
      if (next) { tree = next; bought = true; break; }
    }
    if (!bought) break;
  }
  const ranks = TREE.effectiveRanks(tree, voc), bought = TREE.boughtRanks(tree, voc), marks = TREE.effectiveMarks(tree, voc);
  const bar = barOf.filter(id => (ranks[id] ?? 0) > 0).slice(0, 4);
  return { ranks, bought, marks, bar, aura: SK.defaultAura(voc), spent: TREE.pointsSpent(tree), earned: PTS.skillPointsEarned(level) };
}

export function keeper(voc, level, tier = 'normal', seed = 0, resist = null, role = null) {
  const gear = rollGear(level, `${voc}|${seed}`, resist, tier === 'hell' ? 'epic' : 'rare', voc);
  const stats = attributes(voc, level);
  const fight = SK.fightStats(level, stats, gear.total, voc, DIFF.DIFFICULTIES[tier].resistPenalty);
  // S5: a party role builds its book its way (PARTY_PATHS), the bar and the aura with it.
  const tree = role ? skillTree(voc, level, PARTY_PATHS[role].path, PARTY_PATHS[role].bar) : skillTree(voc, level);
  if (role && PARTY_PATHS[role].aura && (tree.ranks[PARTY_PATHS[role].aura] ?? 0) > 0) tree.aura = PARTY_PATHS[role].aura;
  return { voc, level, tier, gear, stats, fight, tree, potTier: POT.dropTier(level) };
}

/**
 * S5's party (skills-100.md §7 `--party`, campaign.md S5): the tank and the healer build their books for the party —
 * the Ashguard into the Oath (the Shield Oath, the Watch Cry, Brand Throw) under the Banner, the Lanternwright into
 * the Hearth (Hearthlight, the Hearth Circle, the Lantern Ward). The damage is the Warlock's own hunting build.
 */
export const PARTY_PATHS = {
  tank: {
    path: [['watch-blade', 4], ['watch-blade#a1'], ['shield-oath', 4], ['shield-oath#a1'], ['watch-cry', 3], ['cinder-cleave', 3], ['brand-throw', 3],
      ['banner-of-the-watch', 5], ['banner-of-the-watch#a1'], ['shield-oath', 10], ['shield-oath#a2'], ['watch-cry', 8], ['watch-cry#a1'],
      ['brand-throw', 6], ['banner-of-the-watch', 10], ['banner-of-the-watch#a2'], ['watch-blade', 10], ['cinder-cleave', 10], ['intercept', 1], ['shield-oath', 20]],
    bar: ['watch-cry', 'shield-oath', 'brand-throw', 'cinder-cleave'],
    aura: 'banner-of-the-watch',
  },
  healer: {
    path: [['hearthlight', 6], ['hearthlight#a1'], ['hearth-circle', 4], ['hearth-circle#a1'], ['kindle', 3], ['lantern-ward', 3], ['hearthlight#a2'],
      ['hearthlight', 12], ['hearth-circle', 10], ['hearth-circle#a2'], ['cleanse', 1], ['lantern-ward', 8], ['lantern-ward#a1'], ['rekindle', 1], ['hearthlight', 20], ['hearth-circle', 20]],
    bar: ['hearthlight', 'hearth-circle', 'lantern-ward', 'cleanse'],
    aura: 'lantern-aura',
  },
};

// ── One fight ───────────────────────────────────────────────────────────────────────────────────────────────────

const POTION = kind => tier => POT.POTIONS.find(p => p.kind === kind && p.tier === tier);

/**
 * A MobSystem with the Keeper's build in it, standing at (0, 0) on open ground. `state` carries life, mana and the
 * belt between the fights of a hunt.
 */
function arena(k, state) {
  const keeper = { x: 0, y: 0, face: 1 };
  const life = { hp: state?.hp ?? k.fight.maxHp, xp: 0, gold: 0, kills: 0, taken: 0, struck: 0 };
  const host = {
    options: {
      onKill: e => { life.xp += Math.round(HUNT.huntingXpFor(e.hp) * (e.xp ?? 1)); life.kills++; },
      rollLoot: () => [], onLoot: g => { life.gold += g.coins ?? 0; return true; },
    },
    walkable: () => true, levelId: () => 'sim', player: () => keeper,
    hurtPlayer: n => { life.hp -= n; life.taken += n; if (TALLY) { const who = sys.mobs.filter(m => Math.hypot(m.x - keeper.x, m.y - keeper.y) < 24).map(m => m.def.id).join('+') || 'shot/burst'; TALLY[`taken:${who}`] = (TALLY[`taken:${who}`] ?? 0) + n; } }, healPlayer: n => { life.hp = Math.min(k.fight.maxHp, life.hp + n); },
    swung: () => undefined, playerHp: () => life.hp,
    dash: (x, y) => { keeper.x = x; keeper.y = y; }, seek: () => false, say: () => undefined,
  };
  const sys = new MobSystem(host);
  sys.vocation = k.voc;
  sys.setTier(DIFF.DIFFICULTIES[k.tier]);
  sys.setRanks(k.tree.ranks, k.tree.bought, k.tree.marks);
  sys.aura = k.tree.aura && sys.rank(k.tree.aura) > 0 ? k.tree.aura : null;
  const f = k.fight;
  sys.keeperMaxHp = f.maxHp; sys.maxMana = f.maxMana; sys.mana = state?.mana ?? f.maxMana;
  sys.power = f.power; sys.regen = f.regen; sys.agility = f.haste; sys.castSpeed = f.castSpeed; sys.crit = f.crit;
  // §3.6 (td-engine setKeeperBuild): Life Steal, Pierce, Block, the beast's share of the damage %, a caster's +Spells.
  sys.leech = f.leech; sys.gearPierce = f.pierce; sys.gearBlock = f.block; sys.damagePct = f.damagePct; sys.gearRanks = f.ranks;
  sys.defense = f.defense; sys.keeperLevel = k.level; sys.resists = f.resists; sys.pace = 1 + f.levelPace;
  // Hands (shared/rpg/item-hands.ts): every Keeper here wears the one-handed build every class can — a weapon beside an
  // off-hand (rollGear rolls all eight wells): the Ashguard's blade and shield, the Warlock's wand, the Lanternwright's
  // wand and lantern, the Thornstrider's crossbow and quiver. The two-handed path trades the off-hand's affixes for
  // TWO_HAND_MULT on the basic attack; the weapon's own +min–max rides on the blade (Ashguard) and the arrow (Thornstrider).
  // §3.6: the weapon's own +min–max Damage is the Ashguard's blade's and the Thornstrider's arrow's.
  const w = k.gear.weapon;
  if (k.voc === 'ashguard') sys.weaponSwing = MELEE.weaponSwing({ minDamage: w.minDamage ?? 0, maxDamage: w.maxDamage ?? 0, hands: 1, kind: 'melee' });
  if (k.voc === 'thornstrider') sys.weaponSwing = MELEE.weaponSwing({ minDamage: w.minDamage ?? 0, maxDamage: w.maxDamage ?? 0, hands: 1, kind: 'bow' });
  sys.elites = false; sys.levelGap = true;
  // Every blow or shot that reaches him (before a ward or Defense drinks it): a kiting Keeper must still be struck.
  { const bite = sys.biteKeeper.bind(sys); sys.biteKeeper = (raw, ...rest) => { if (raw > 0) life.struck++; return bite(raw, ...rest); }; }
  if (TALLY) { const step = sys.stepDash.bind(sys); sys.stepDash = (m, dt) => { step(m, dt); if (!m.dash) { const d = Math.hypot(m.x - keeper.x, m.y - keeper.y); TALLY[d <= MOBS_M.CHARGE_HIT ? 'charge:landed' : 'charge:missed'] = (TALLY[d <= MOBS_M.CHARGE_HIT ? 'charge:landed' : 'charge:missed'] ?? 0) + 1; } }; }
  if (TALLY) { const hurt = sys.hurtMob.bind(sys); sys.hurtMob = (m, n, c, k) => { if (m.hp > 0) TALLY[c] = (TALLY[c] ?? 0) + Math.min(n, m.hp); return hurt(m, n, c, k); }; }
  return { sys, keeper, life, walk: WALK * (1 + f.moveHaste) * (1 + f.levelPace) };
}

/** Bring an encounter to life `dist` px east of the Keeper. */
function spawn(sys, enc, dist) {
  const def = enc.def;
  const at = Math.min(dist, Math.max(40, (def.sight ?? 120) - 12));
  if (enc.pack) return sys.spawnPack(`enc`, def, at, 0, enc.pack);
  // A pull of `count` (a wild pack of the zone's ordinary creatures, td-world: one to three), side by side.
  if (enc.count > 1) return Array.from({ length: enc.count }, (_, i) => sys.place(`enc${i}`, def, at + (i % 2) * 14, (i - (enc.count - 1) / 2) * 16));
  return [sys.place('enc', def, at, 0)];
}

const DEFENSIVE = new Set(['dark-ward', 'bone-armor', 'shield-oath', 'lantern-ward', 'watch-cry']);

/**
 * Fight until every creature (and whatever they call) is down, the Keeper falls, or `max` seconds pass.
 * Returns the seconds, whether he fell, the potions drunk, the life he lost, and the XP and Gold the kills paid.
 */
export function fight(k, enc, seed, state = null, max = 600, party = null) {
  return seeded(`fight|${seed}`, rand => {
    const A = arena(k, state), { sys, keeper, life } = A;
    party?.setup(A);
    const belt = state?.belt ?? (k.tier === 'normal' ? { hp: BELT, mana: BELT } : { hp: TIER_BELT, mana: TIER_BELT });
    const used = { hp: 0, mana: 0 };
    const first = spawn(sys, enc, 80);
    const dt = .04, f = k.fight, hpPot = POTION('health')(k.potTier), manaPot = POTION('mana')(k.potTier);
    const decided = new WeakSet();
    let t = 0, potCd = 0, gcd = 0, sip = null, dodge = null, start = life.hp;
    // Ranged vocations kite what is slower than them (KITE); the circling side is picked once a fight.
    const kiter = !sys.melee, orbit = rand() < .5 ? 1 : -1;
    let chaser = null;
    // The Thornstrider's beast (the engine's spirit beast; td-thorn, td-pets): it runs to his foe and bites.
    const beast = k.voc === 'thornstrider' ? { cd: .8, nips: 0, stamina: 100, restT: 0, level: THORN.spiritLevel(k.level) } : null;
    const near = r => sys.mobs.some(m => Math.hypot(m.x - keeper.x, m.y - keeper.y) <= r);
    for (; t < max; t += dt) {
      if (!sys.mobs.length && !sys.calls.length) break;
      if (life.hp <= 0) break;
      if (party?.step(A, dt, t)) break;
      // Aim: the nearest creature.
      if (!sys.target || sys.target.hp <= 0 || !sys.mobs.includes(sys.target)) {
        let best = null, bd = Infinity;
        for (const m of sys.mobs) { const d = Math.hypot(m.x - keeper.x, m.y - keeper.y); if (d < bd) { bd = d; best = m; } }
        sys.target = best;
      }
      sys.attacking = true;
      const foe = sys.target;
      // A telegraph: a boss's breath winding up, rings opening, a burst's ring — he steps out of DODGE of them.
      for (const m of sys.mobs) if (m.tell > 0 && m.aim && !decided.has(m.aim)) {
        decided.add(m.aim);
        if (rand() < DODGE) { const a = Math.atan2(keeper.y - m.y, keeper.x - m.x) + (rand() < .5 ? 1 : -1) * Math.PI / 2; dodge = { x: keeper.x + Math.cos(a) * 34, y: keeper.y + Math.sin(a) * 34 }; }
      }
      // (A raise's sigil or a mending ring is a picture: nothing to step out of.)
      const fresh = sys.bursts.filter(b => !decided.has(b) && !b.fx);
      if (fresh.length) {
        fresh.forEach(b => decided.add(b));
        if (rand() < DODGE) {
          let best = null, score = -Infinity;
          for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, x = keeper.x + Math.cos(a) * 40, y = keeper.y + Math.sin(a) * 40;
            const s = Math.min(...sys.bursts.filter(b => !b.fx).map(b => Math.hypot(b.x - x, b.y - y) - b.r));
            if (s > score) { score = s; best = { x, y }; }
          }
          dodge = best;
        }
      }
      // Feet: out of a telegraph, else into reach of the target.
      // Stunned, frozen or rooted by a creature's ability (S6): his feet stay where they are, as the engine's do.
      const step = A.walk * (1 - sys.chill) * (sys.held ? 0 : 1) * dt;
      if (dodge) {
        const dx = dodge.x - keeper.x, dy = dodge.y - keeper.y, d = Math.hypot(dx, dy);
        if (d <= step) { keeper.x = dodge.x; keeper.y = dodge.y; dodge = null; } else { keeper.x += dx / d * step; keeper.y += dy / d * step; }
      } else if (kiter && (chaser = sys.mobs.find(m => m.def.speed * ZONE.gapPace(ZONE.levelGap(k.level, m.def.level)) < A.walk * .85 && Math.hypot(m.x - keeper.x, m.y - keeper.y) < KITE))) {
        // A ranged Keeper keeps a slower creature off him: he backs away round it (circling, so he stays near the fight).
        const ax = keeper.x - chaser.x, ay = keeper.y - chaser.y, d = Math.hypot(ax, ay) || 1;
        const vx = ax / d + (-ay / d) * orbit, vy = ay / d + (ax / d) * orbit, n = Math.hypot(vx, vy) || 1;
        keeper.x += vx / n * step; keeper.y += vy / n * step;
      } else if (foe) {
        const want = sys.melee ? sys.range - 2 : sys.range - 10, dx = foe.x - keeper.x, dy = foe.y - keeper.y, d = Math.hypot(dx, dy);
        if (d > want) { const s = Math.min(step, d - want); keeper.x += dx / d * s; keeper.y += dy / d * s; }
        keeper.face = dx < 0 ? -1 : 1;
      }
      // Hands: one key at a time (a human's pace), the bar's skills when they make sense.
      gcd -= dt;
      if (gcd <= 0 && foe) {
        for (const id of k.tree.bar) {
          if ((sys.cooldowns[id] ?? 0) > 0 || sys.mana < sys.manaOf(id)) continue;
          if (DEFENSIVE.has(id) && (!near(4 * TILE) || sys.ward > 0 || sys.blockT > 0 || sys.lampWard > 0 || sys.bone > 0 || sys.guardT > 0)) continue;
          if (id === 'hearthlight' && life.hp > f.maxHp * .7) continue;
          if (id === 'life-tap' && (sys.mana > f.maxMana * .3 || life.hp < f.maxHp * .6)) continue;
          if (sys.useAbility(id) === null) { gcd = .4; break; }
        }
      }
      // The belt.
      potCd -= dt;
      if (potCd <= 0 && life.hp < f.maxHp * .4 && belt.hp > 0 && hpPot) { belt.hp--; used.hp++; potCd = POT.POTION_COOLDOWN; sip = { hp: (sip?.hp ?? 0) + hpPot.amount, mana: sip?.mana ?? 0, t: POT.POTION_POUR_SECS }; }
      else if (potCd <= 0 && sys.mana < f.maxMana * .2 && belt.mana > 0 && manaPot && k.tree.bar.length) { belt.mana--; used.mana++; potCd = POT.POTION_COOLDOWN; sip = { hp: sip?.hp ?? 0, mana: (sip?.mana ?? 0) + manaPot.amount, t: POT.POTION_POUR_SECS }; }
      if (sip) {
        const q = Math.min(1, dt / sip.t);
        life.hp = Math.min(f.maxHp, life.hp + sip.hp * q); sys.mana = Math.min(f.maxMana, sys.mana + sip.mana * q);
        sip = q >= 1 ? null : { hp: sip.hp * (1 - q), mana: sip.mana * (1 - q), t: sip.t - dt };
      }
      if (f.lifeRegen > 0) life.hp = Math.min(f.maxHp, life.hp + f.lifeRegen * dt);
      // The beast.
      if (beast) {
        const sent = sys.commanded, prey = sent ?? foe;
        sys.beast = prey ? { x: prey.x - 10, y: prey.y } : { x: keeper.x, y: keeper.y };
        if (Math.hypot(sys.beast.x - keeper.x, sys.beast.y - keeper.y) > sys.v('pack-bond')['radius'] * TILE) sys.beast = { x: keeper.x + 8, y: keeper.y };
        beast.cd -= dt; beast.restT -= dt;
        if (prey && beast.restT <= 0 && beast.cd <= 0 && Math.hypot(prey.x - keeper.x, prey.y - keeper.y) <= THORN.THORN_PET.commandReach) {
          const blow = PETS.petBlow('bite', true, beast.level), hit = sys.petBite(prey, blow.dmg, 1);
          beast.cd = THORN.thornPetRest(blow.rest, prey === sent);
          if (hit.landed && !hit.killed && ++beast.nips % 3 === 0) {
            beast.stamina -= sys.bonded ? THORN.bondShare(34, sys.v('pack-bond')['guard']) : 34;
            if (beast.stamina < 25) { beast.stamina = 100; beast.restT = 18; }
          }
        }
      }
      sys.update(dt);
    }
    // The Gold still lying about comes in (the pull reaches 8 tiles; the sim does not walk to it).
    for (const g of sys.drops) life.gold += g.coins ?? 0;
    const died = life.hp <= 0 || !!party?.fell, cleared = !sys.mobs.length && !sys.calls.length && !died;
    const dealt = first.reduce((a, m) => a + m.def.hp - Math.max(0, m.hp), 0);
    return { secs: t, died, cleared, used, dealt, taken: life.taken / k.fight.maxHp, struck: life.struck, hpLost: Math.max(0, start - life.hp), hp: Math.max(0, life.hp), mana: sys.mana, belt, xp: life.xp, gold: life.gold, kills: life.kills };
  });
}

// ── Encounters ──────────────────────────────────────────────────────────────────────────────────────────────────

const ALL = Object.values(MOBS);
const NORMALS = ALL.filter(d => (d.rank ?? 'normal') === 'normal');
export const BOSSES = ALL.filter(d => d.rank === 'boss' && d.id !== SEAM.SEAM_ID).sort((a, b) => a.level - b.level);
/**
 * The world's zones (td-zones.ts ZONES) with who lives in each, read off the game's own maps: every continent's region
 * tables (and its graveyard's Bone Walkers) and every hand-drawn floor's legend. A Keeper hunts where the zone's fixed
 * band holds his level (owner 2026-10-21: D2's zone levels), and the creatures come at the zone's level, re-made by
 * the game's own atZoneLevel — never at his.
 */
export const HUNT_ZONES = (() => {
  const out = [];
  for (const f of readdirSync(resolve(ROOT, 'src/app/play/td/maps'))) {
    if (!f.endsWith('.ts') || f.includes(' ')) continue;
    for (const v of Object.values(load(`src/app/play/td/maps/${f}`))) {
      if (!v || typeof v !== 'object') continue;
      if (v.mobs && v.names && v.map) {
        for (const [region, t] of Object.entries(v.mobs)) {
          const z = ZONE.zoneOf(ZONE.regionZone(v.id, region));
          if (z && t?.types?.length) out.push({ id: ZONE.regionZone(v.id, region), band: z.band, types: [...new Set(t.types)] });
        }
        const g = ZONE.zoneOf(ZONE.graveyardZone(v.id));
        if (g && v.places.some(p => p.kind === 'graveyard')) out.push({ id: ZONE.graveyardZone(v.id), band: g.band, types: ['bone-walker'] });
      } else if (v.rows && v.legend && v.id) {
        const z = ZONE.zoneOf(v.id), types = new Set();
        for (const [ch, e] of Object.entries(v.legend)) if (e.mob && v.rows.some(r => r.includes(ch)) && (MOBS[e.mob]?.rank ?? 'normal') === 'normal') types.add(e.mob);
        if (z && types.size) out.push({ id: v.id, band: z.band, types: [...types] });
      }
    }
  }
  return out;
})();
/** The zones whose band holds `level` (the highest zone's, for a Keeper past all of them). */
function zonesAt(level) {
  const at = HUNT_ZONES.filter(z => level >= z.band[0] && level <= z.band[1]);
  if (at.length) return at;
  const top = Math.max(...HUNT_ZONES.map(z => z.band[1]));
  return HUNT_ZONES.filter(z => z.band[1] === top);
}
/** A creature of `id` as a zone raises it at `level` (td-zones atZoneLevel). */
const atZone = (id, level) => ZONE.atZoneLevel(MOBS[id], level);
/** The ordinary creatures a Keeper hunts at a level: every kind of every zone that holds it, at that zone's level for the spawn. */
function huntPool(level) { return [...new Set(zonesAt(level).flatMap(z => z.types))].map(id => atZone(id, level)); }
/** The creatures "at his level" the time-to-kill bands are read on: the kinds of his level's zones, at exactly his level. */
const atLevel = level => huntPool(level);
/** Levels a zone holds (a level-60 Keeper outlevels the world: his row is shown, not banded). */
const banded = level => HUNT_ZONES.some(z => level >= z.band[0] && level <= z.band[1]);
function packOf(rank, seed) {
  return seeded(`pack|${seed}`, r => rank === 'unique'
    ? ELITE.makePack('unique', ELITE.rollAffixes(r, r() < .3 ? 1 : r() < .64 ? 2 : 3), 'Sim the Leader', 2 + Math.floor(r() * 3))
    : ELITE.makePack('champion', ELITE.rollAffixes(r, 1), null, 1 + Math.floor(r() * 3)));
}

/** An Aura Enchanted unique pack (S6): its aura the i-th of the thirteen, the rest of its affixes rolled for the band. */
const PACK_AURA = load('src/app/play/td/td-pack-aura.ts');
function auraPackOf(def, level, seed, i) {
  return seeded(`aura|${seed}`, r => {
    const o = { level, ranged: !!def.ranged, bone: def.id.startsWith('bone'), fresh: true };
    const n = ELITE.affixCount('unique', r, o), aura = PACK_AURA.PACK_AURA_IDS[i % PACK_AURA.PACK_AURA_IDS.length];
    const rest = ELITE.rollAffixes(r, n - 1, o).filter(a => ELITE.affixAllowed(a, [`aura-${aura}`], o));
    const affixes = [`aura-${aura}`, ...rest];
    return ELITE.makePack('unique', affixes, 'Sim the Bearer', ELITE.packFollowers('unique', 2 + Math.floor(r() * 3), affixes.length));
  });
}

// ── Measurements ────────────────────────────────────────────────────────────────────────────────────────────────

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
const median = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
/**
 * The interquartile mean: the mean of the middle half of the runs (7–18 of 24). A time band reads this, not the
 * median — the runs of a cell often fall in two clusters (a pack with or without its follower in the arc), and a
 * median sitting in the gap between them flipped on a two-tick change anywhere in the fight (2026-10-22).
 */
const iqm = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), lo = Math.floor(s.length / 4), hi = Math.max(lo + 1, s.length - lo); return mean(s.slice(lo, hi)); };

/** Many seeded attempts at one encounter, each with a freshly rolled Keeper (his gear varies run to run). */
function attempts(voc, level, tier, encOf, runs, resist = null) {
  const out = [];
  for (let i = 0; i < runs; i++) {
    const k = keeper(voc, level, tier, i, resist);
    out.push(fight(k, encOf(i), `${voc}|${level}|${tier}|${i}`));
  }
  const won = out.filter(r => r.cleared);
  return {
    ttk: iqm(won.map(r => r.secs)), ttkMedian: median(won.map(r => r.secs)), ttkMean: mean(won.map(r => r.secs)),
    death: out.filter(r => r.died).length / out.length, timeout: out.filter(r => !r.died && !r.cleared).length / out.length,
    hpPots: mean(out.map(r => r.used.hp)), manaPots: mean(out.map(r => r.used.mana)),
    /** Life lost in the fight, in whole bars of his life (a kiting Keeper must still lose some to every boss). */
    taken: mean(out.map(r => r.taken)),
    /** Blows and shots that reached him (before his ward), a fight. */
    struck: mean(out.map(r => r.struck)),
  };
}

/**
 * A hunt: the level's creatures one after another (an elite pack 1 in 16, as the world rolls them), life and mana
 * carried from fight to fight, TRAVEL seconds between (the Keeper mends 6 a second after 4 s unhurt, td-engine
 * MEND_PER_SEC), resting when under 60% life, FALL_SECS on a fall. Returns XP, Gold and kills an hour, and deaths.
 */
function hunt(voc, level, secs, seed, lift = 0) {
  const k = keeper(voc, level, 'normal', seed);
  const zones = zonesAt(level + lift), f = k.fight;
  return seeded(`hunt|${voc}|${level}|${lift ? `${lift}|` : ''}${seed}`, r => {
    let clock = 0, xp = 0, gold = 0, kills = 0, deaths = 0, pots = 0, n = 0;
    let state = { hp: f.maxHp, mana: f.maxMana, belt: { hp: BELT * 4, mana: BELT * 4 } };
    while (clock < secs) {
      // A zone that holds his level, one of its kinds, at the zone's level for this spawn (td-zones zoneLevel).
      const z = zones[Math.floor(r() * zones.length)], key = `${seed}|${n}`;
      const def = atZone(z.types[Math.floor(r() * z.types.length)], lift ? level + lift : ZONE.zoneLevel(z.band, key));
      const pack = ELITE.eliteEligible({ level: def.level, rank: def.rank, safe: false }) ? ELITE.rollElite(`${seed}|${level}|${n}`) : null;
      const res = fight(k, { def, pack }, `hunt|${voc}|${level}|${seed}|${n++}`, state);
      clock += res.secs; xp += res.xp; gold += res.gold; kills += res.kills; pots += res.used.hp + res.used.mana;
      if (res.died) { deaths++; clock += FALL_SECS; state = { hp: f.maxHp, mana: f.maxMana, belt: res.belt }; continue; }
      // Between pulls: the walk to the next, mending; a rest when life is low.
      let hp = res.hp + f.lifeRegen * TRAVEL + Math.max(0, TRAVEL - 4) * 6, wait = TRAVEL;
      if (hp < f.maxHp * .6) { const need = f.maxHp * .9 - hp; wait += need / (6 + f.lifeRegen); hp = f.maxHp * .9; }
      clock += wait;
      state = { hp: Math.min(f.maxHp, hp), mana: Math.min(f.maxMana, res.mana + f.regen * wait), belt: res.belt };
    }
    const h = clock / 3600;
    return { xph: xp / h, goldh: gold / h, killsh: kills / h, deathsh: deaths / h, potsh: pots / h, deaths };
  });
}

function cell(voc, level, runs) {
  const tier = 'normal', pool = atLevel(level);
  // Each run meets one of the creatures a Keeper of this level hunts (huntPool), in turn.
  const pick = i => pool[(i + hash(`${voc}|${level}`)) % pool.length];
  // Packs only rise from creatures of level 3 or more (td-elites eliteEligible), so a pack is one of those.
  const packs = pool.filter(d => ELITE.eliteEligible({ level: d.level, rank: d.rank, safe: false }));
  const pickPack = i => (packs.length ? packs : pool)[(i + hash(`${voc}|${level}`)) % (packs.length || pool.length)];
  const id = `${pool.length} kinds, L${Math.min(...pool.map(d => d.level))}–${Math.max(...pool.map(d => d.level))}`;
  return {
    normal: { id, ...attempts(voc, level, tier, i => ({ def: pick(i) }), runs) },
    champion: { id, ...attempts(voc, level, tier, i => ({ def: pickPack(i), pack: packOf('champion', `${voc}|${level}|${i}`) }), runs) },
    unique: { id, ...attempts(voc, level, tier, i => ({ def: pickPack(i), pack: packOf('unique', `${voc}|${level}|${i}`) }), runs) },
    // S6 (monsters-abilities.md §4): an Aura Enchanted unique pack with the zone band's affix count, the new affixes in
    // the pool — its aura cycling through the thirteen, so every one is fought somewhere in the table.
    aura: { id, ...attempts(voc, level, tier, i => { const def = pickPack(i); return { def, pack: auraPackOf(def, level, `${voc}|${level}|${i}`, i) }; }, runs) },
    hunt: (() => { const hs = Array.from({ length: QUICK ? 2 : 4 }, (_, i) => hunt(voc, level, HUNT_SECS, i)); return { xph: mean(hs.map(h => h.xph)), goldh: mean(hs.map(h => h.goldh)), killsh: mean(hs.map(h => h.killsh)), deathsh: mean(hs.map(h => h.deathsh)) }; })(),
  };
}
function bossCell(voc, def, runs) {
  return { id: def.id, level: def.level, ...attempts(voc, def.level, 'normal', () => ({ def }), runs) };
}
/**
 * The Seam Eater at `level`, met by a Keeper TIER_LEAD[tier] levels above it (owner 2026-10-21: Nightmare and Hell are
 * a wall, not impossible — on them he comes higher and in resist gear for its arcane).
 */
export const TIER_LEAD = { normal: 0, nightmare: 5, hell: 15 };
/** The Seam Eater's levels: each continent's rift's, fixed (td-zones SEAM_LEVELS). */
const SEAM_AT = [...new Set(Object.values(ZONE.SEAM_LEVELS))].sort((a, b) => a - b);
function seamCell(voc, level, tier, runs) {
  const def = SEAM.seamEaterAt(MOBS[SEAM.SEAM_ID], level), k = level + TIER_LEAD[tier];
  return { level, keeper: k, tier, ...attempts(voc, k, tier, () => ({ def }), runs, tier === 'normal' ? null : 'arcane') };
}

/**
 * The level gap (owner 2026-10-21: "If I'm level 20 vs a 40 I should get one-shot"; td-zones LEVEL_GAP): a Keeper of
 * `level` against `gap`-levels-higher creatures of the zones that hold that level, `count` at a time.
 */
/**
 * Hunting above his level: GAP_HUNT.secs on the hunt among creatures `lift` levels above him (the zone's own kinds, a
 * pack now and then, life and belt carried, as hunt()), the share of those hunts in which he falls at least once.
 */
export const GAP_HUNT = { lift: 5, secs: 900 };
function plusCell(voc, level, lift, runs) {
  const hs = Array.from({ length: Math.max(4, Math.round(runs / 2)) }, (_, i) => hunt(voc, level, GAP_HUNT.secs, 100 + i, lift));
  return { death: hs.filter(h => h.deaths > 0).length / hs.length };
}
/** A gap fight lasts at most this (a creature at his level falls in 2–5 s: this is a dozen times that and more). */
// ── The party (skills-100.md §7 `--party`; campaign.md S5) ──────────────────────────────────────────────────────

const THREAT = load('src/app/play/td/td-threat.ts');
/** The party's level and its boss: the floor boss nearest that level, its life lifted for three Keepers (td-coop rules). */
export const PARTY_LEVEL = 30;
const PARTY_BOSS = () => BOSSES.reduce((a, b) => (Math.abs(b.level - PARTY_LEVEL) < Math.abs(a.level - PARTY_LEVEL) ? b : a));
const PARTY_LIFE = n => 1 + .6 * (n - 1);
/** The tier the party meets it on (argv --party-tier; Nightmare is where the party forms live, monsters-abilities §5.3). */
const PARTY_TIER = String(argv['party-tier'] ?? 'nightmare');
/** Where the healer and the damage stand behind the tank (art px, along the line from the boss through him). */
const PARTY_BEHIND = { heal: 34, dps: 70 };
/**
 * One party fight: the tank is the arena's Keeper (the real MobSystem: his kit, his threat ×2, the boss's targeting by
 * threat), the damage and the healer are the room's other Keepers (`others`: the boss may turn on them). The damage
 * deals its calling's sustained dps as claims (threat ×1). The healer is a second real MobSystem with the tank and the
 * damage as its allies: her Hearthlight, Hearth Circle and Lantern Ward pick the lowest and go out as ally claims,
 * which land here (life, wards) with their threat (×0.5, split). `healer: false`: nobody heals but the belt.
 */
function partyRun(seed, { healer = true, tank = true, tier = PARTY_TIER } = {}) {
  const L = PARTY_LEVEL, def0 = PARTY_BOSS();
  const n = 1 + (healer ? 1 : 0) + (tank ? 1 : 0);
  const def = { ...def0, hp: Math.round(def0.hp * PARTY_LIFE(n)) };
  // Without a tank the damage stands in front (the warlock as the arena's Keeper); with one, the Ashguard does.
  const front = tank ? keeper('ashguard', L, tier, seed, null, 'tank') : keeper('warlock', L, tier, seed);
  const kHeal = keeper('lanternwright', L, tier, seed, null, 'healer');
  const kDps = keeper('warlock', L, tier, seed + 100);
  const dpsRate = PARTY_DPS[L] ??= mean([0, 1, 2].map(s => dps('warlock', L, s)));
  const mates = {};
  const mate = (id, k) => ({ id, k, hp: k.fight.maxHp, max: k.fight.maxHp, x: 0, y: 0, down: false });
  if (healer) mates.heal = mate('heal', kHeal);
  if (tank) mates.dps = mate('dps', kDps);
  let hsys = null, hostH = null, dpsT = 0, fell = false, othersStruck = 0;
  const party = {
    get fell() { return fell; },
    setup(A) {
      const { sys } = A;
      // The others' bites land on their own life through their own guard (the room's KeeperLife cut, td-skills incomingDamage).
      sys.coop = {
        bite: (to, from, dmg, type) => {
          const m = mates[to];
          if (!m || m.down) return;
          if (dmg > 1) othersStruck++;
          const atk = from?.def.level ?? L, raw = dmg * ZONE.gapHurt(ZONE.levelGap(m.k.level, atk));
          m.hp -= SK.incomingDamage(raw, type, m.k.fight.defense, atk, m.k.fight.resists);
          if (m.hp <= 0) { m.down = true; fell = true; }
        },
        killed: () => undefined, claim: () => undefined,
      };
      if (healer) {
        const me = mates.heal;
        hostH = {
          options: { onKill: () => undefined }, walkable: () => true, levelId: () => 'sim', player: () => me,
          hurtPlayer: n => { me.hp -= n; }, healPlayer: n => { me.hp = Math.min(me.max, me.hp + n); }, swung: () => undefined,
          playerHp: () => me.hp, dash: () => undefined, seek: () => false, say: () => undefined,
        };
        hsys = new MobSystem(hostH);
        hsys.vocation = 'lanternwright';
        hsys.setRanks(kHeal.tree.ranks, kHeal.tree.bought, kHeal.tree.marks);
        hsys.aura = kHeal.tree.aura;
        const f = kHeal.fight;
        hsys.keeperMaxHp = f.maxHp; hsys.maxMana = f.maxMana; hsys.mana = f.maxMana; hsys.power = f.power; hsys.regen = f.regen; hsys.castSpeed = f.castSpeed;
        hsys.keeperLevel = L; hsys.defense = f.defense; hsys.resists = f.resists;
      }
    },
    step(A, dt) {
      const { sys, keeper, life } = A;
      const boss = sys.mobs.find(m => m.def.id === def.id) ?? sys.mobs[0];
      // The others stand behind the front Keeper, on the line from the boss.
      const ax = boss ? keeper.x - boss.x : -1, ay = boss ? keeper.y - boss.y : 0, d = Math.hypot(ax, ay) || 1;
      for (const m of Object.values(mates)) { const b = PARTY_BEHIND[m.id]; m.x = keeper.x + ax / d * b; m.y = keeper.y + ay / d * b + (m.id === 'heal' ? 8 : -8); }
      sys.others = Object.values(mates).filter(m => !m.down).map(m => ({ id: m.id, x: m.x, y: m.y }));
      // The damage: its sustained dps, claimed twice a second (threat ×1 on the boss's ledger).
      if (mates.dps && !mates.dps.down && boss && boss.hp > 0) {
        dpsT += dt;
        if (dpsT >= .5) { sys.applyClaim(boss, dpsRate * dpsT, 'dps', false, 'fire'); dpsT = 0; }
      }
      if (hsys && !mates.heal.down) {
        const me = mates.heal, frontId = 'front';
        hsys.allies = [{ id: frontId, x: keeper.x, y: keeper.y, h: Math.max(0, life.hp), m: front.fight.maxHp }, ...(mates.dps && !mates.dps.down ? [{ id: 'dps', x: mates.dps.x, y: mates.dps.y, h: mates.dps.hp, m: mates.dps.max }] : [])];
        // Her hands: the Hearth first when two are hurt or the front is low, Hearthlight on the lowest, the Ward on the front.
        const share = a => a.h / a.m, low = Math.min(...hsys.allies.map(share), me.hp / me.max);
        const hurt = hsys.allies.filter(a => share(a) < .9).length + (me.hp / me.max < .9 ? 1 : 0);
        hsys.gcd = (hsys.gcd ?? 0) - dt;
        if (hsys.gcd <= 0) {
          const tryCast = id => (hsys.rank(id) > 0 && (hsys.cooldowns[id] ?? 0) <= 0 && hsys.mana >= hsys.manaOf(id) && hsys.useAbility(id) === null);
          if ((share(hsys.allies[0]) < .6 && tryCast('lantern-ward')) || ((hurt >= 2 || share(hsys.allies[0]) < .7) && tryCast('hearth-circle')) || (low < .85 && tryCast('hearthlight'))) hsys.gcd = .4;
        }
        if (me.hp < me.max * .4 && !me.sipped) { me.hp = Math.min(me.max, me.hp + (POTION('health')(kHeal.potTier)?.amount ?? 0)); me.sipped = 8; }
        if (me.sipped > 0) me.sipped -= dt;
        hsys.update(dt);
        // Her claims land: heals on life (and their threat, ×0.5 split over what fights the healed), wards round the front.
        for (const c of hsys.allyOut.splice(0)) {
          if (c.k === 'heal') {
            if (c.to === frontId) { const n = Math.min(c.n, front.fight.maxHp - life.hp); life.hp += n; THREAT.healThreat(sys.mobs, '', 'heal', n); }
            else if (mates[c.to] && !mates[c.to].down) { const m = mates[c.to], n = Math.min(c.n, m.max - m.hp); m.hp += n; THREAT.healThreat(sys.mobs, c.to, 'heal', n); }
          } else if (c.k === 'ward' && c.to === frontId) sys.allyLaid({ a: 'ward', by: 'heal', s: c.s, n: c.n, t: c.t });
        }
      }
      return fell;
    },
  };
  const r = fight(front, { def }, `party|${seed}|${healer}|${tank}`, null, 600, party);
  return { ...r, fell: r.died, healerUp: !mates.heal?.down, held: r.struck / Math.max(1, r.struck + othersStruck) };
}
const PARTY_DPS = {};
/** The party cells: the full party, and the party without its healer (and without its tank), over `runs` seeds. */
function partyCell(runs) {
  const one = o => { const out = []; for (let i = 0; i < runs; i++) out.push(partyRun(i, o)); return { fell: out.filter(r => r.fell).length / out.length, ttk: iqm(out.filter(r => r.cleared).map(r => r.secs)), cleared: out.filter(r => r.cleared).length / out.length, held: mean(out.map(r => r.held)) }; };
  return { boss: PARTY_BOSS().id, level: PARTY_BOSS().level, full: one({}), noHealer: one({ healer: false }), noTank: one({ tank: false }) };
}

const GAP_SECS = 60;
function gapCell(voc, level, gap, count, runs) {
  const pool = huntPool(level + gap);
  const pick = i => pool[(i + hash(`${voc}|${level}|${gap}`)) % pool.length];
  const out = [];
  for (let i = 0; i < runs; i++) {
    const k = keeper(voc, level, 'normal', i);
    out.push(fight(k, { def: pick(i), count }, `gap|${voc}|${level}|${gap}|${count}|${i}`, null, GAP_SECS));
  }
  // One ordinary blow of each kind (its blow's middle, or its shot's) landing on him through his Defense and resists, as
  // a share of his life: what a single blow does.
  const blow = mean(pool.map(def => seeded(`blow|${voc}|${def.id}`, () => {
    const k = keeper(voc, level, 'normal', 0), A = arena(k), m = A.sys.place('b', def, 400, 0);
    const p = def.ranged && !def.dmg ? def.ranged.dmg : def.dmg, before = A.life.taken;
    A.sys.biteKeeper((p[0] + p[1]) / 2, MOBS_M.mobHits(def), m);
    return (A.life.taken - before) / k.fight.maxHp;
  })));
  const died = out.filter(r => r.died);
  return {
    death: died.length / runs, won: out.filter(r => r.cleared).length / runs, blow,
    /** Blows that reached him before he fell (the deaths only). */
    blows: median(died.map(r => r.struck)),
    /** His damage a second on such a creature against one of his own level (the gap's to-hit and damage cut). */
    dealt: mean([0, 1, 2].map(s => dps(voc, level, s, level + gap))) / mean([0, 1, 2].map(s => dps(voc, level, s, level))),
  };
}

// ── The bands (docs/design/loot-and-combat.md §13) ──────────────────────────────────────────────────────────────

export const BANDS = {
  normal: [2, 5], champion: [15, 40], unique: [30, 75], boss: [60, 150], seam: [120, 240],
  /**
   * The Ashguard's floor on a pack band, × the band's: his blade strikes the whole arc, so he clears a pack in about
   * half the ranged vocations' time — his identity (owner 2026-10-21, skill-trees.md), not a bug to tune away.
   */
  ashPackFloor: .75,
  /** Death-rate ceilings: a creature at his level (near never), a pack, a first attempt at a boss / the Seam Eater. */
  normalDeath: .02, packDeath: .1, bossDeath: .3, seamDeath: .3,
  /** S5: without its healer, the party falls to the floor boss at least this often (skills-100.md §7). */
  partyNoHealer: .7,
  /** A kiting ranged Keeper is struck at least this many times a boss fight (no boss can be walked away from). */
  kitedStruck: 4,
  /** The Seam Eater on Nightmare (a Keeper 5 levels above it) and Hell (15 above), both in resist gear. */
  // Design targets are 35% / 50% first-try deaths; the bands allow +5 points of sampling noise (24 seeded runs a cell:
  // one fight more or less moves a cell ~4 points, and CI's runner landed one cell at 13/24).
  seamTierDeath: { nightmare: .4, hell: .55 },
  /** Vocations' time to kill one foe (a creature at level, each boss), each within ±25% of the four's mean. */
  spread: .25,
  /**
   * The level gap (td-zones LEVEL_GAP): a level-20 Keeper against a level-40 creature falls to 1–2 of its blows, does at
   * most a fifth of his usual damage and never wins; fifteen minutes' hunting among creatures five levels up fells
   * him in 25–50% of the hunts, the four vocations' mean (each 5–75%: a run of noise wide, as CI asks): a threat, survivable.
   */
  gap: { oneShotBlows: 2, oneShotWin: .05, oneShotDealt: .2, plus5Death: [.25, .5], plus5Each: [.05, .75] },
  /** Hours to reach a level on the hunt, against leveling.md §1 ("content at pace": 0.6 / 5.8 / 14 h): [low, high]. */
  hours: { 10: [.4, 1], 30: [4, 8], 50: [10, 18] },
};
/** The sim's tolerance on a time band (seeded noise; a cell a hair outside is still a pass): ±15%. */
const SLACK = .15;
const inBand = (v, [lo, hi]) => v >= lo * (1 - SLACK) && v <= hi * (1 + SLACK);

/** Hours to reach `to` from level 1, integrating XP an hour across the sampled levels (log-linear between them). */
function hoursTo(xphAt, to) {
  const pts = LEVELS.map(L => [L, xphAt[L]]);
  const at = L => {
    if (L <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (L <= pts[i][0]) { const [a, x] = pts[i - 1], [b, y] = pts[i], q = (L - a) / (b - a); return Math.exp(Math.log(x) + q * (Math.log(y) - Math.log(x))); }
    return pts[pts.length - 1][1];
  };
  let h = 0;
  for (let L = 1; L < to; L++) h += (KL.keeperXpForLevel(L + 1) - KL.keeperXpForLevel(L)) / at(L);
  return h;
}

// ── Run ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The Keeper's sustained damage a second on one creature that neither bites nor dies (30 s of the real fight loop). */
export function dps(voc, level, seed = 0, foeLevel = level) {
  const k = keeper(voc, level, 'normal', seed), def = atLevel(foeLevel)[0];
  const dummy = { ...def, hp: 1e9, dmg: [0, 0], rate: 999, ranged: undefined, speed: 0, sight: 999 };
  const r = fight(k, { def: dummy }, `dps|${voc}|${level}|${seed}`, null, 30);
  return r.dealt / r.secs;
}
if (argv.dps) {
  console.log('Sustained DPS on one creature over 30 s (the real fight loop: mana, potions, the beast)');
  for (const voc of VOCATIONS) console.log(`  ${voc.padEnd(14)} ${LEVELS.map(L => `L${L} ${Math.round(mean([0, 1, 2].map(s => dps(voc, L, s))))}`).join('  ')}`);
  console.log(`  creature life ${LEVELS.map(L => `L${L} ${Math.round(mean(atLevel(L).map(d => d.hp)))}`).join('  ')} (the hunted kinds' mean)`);
  process.exit(0);
}
if (argv.party) {
  // --party: the S5 party cells alone (a tank, a healer and the damage against a floor boss at PARTY_LEVEL).
  const c = partyCell(RUNS);
  console.log(`Party at L${PARTY_LEVEL} vs ${c.boss} (L${c.level}), ${RUNS} runs: falls · cleared · time to kill`);
  for (const [k, x] of Object.entries({ full: c.full, 'no healer': c.noHealer, 'no tank': c.noTank })) console.log(`  ${k.padEnd(10)} ${Math.round(x.fell * 100)}% · ${Math.round(x.cleared * 100)}% · ${Number.isFinite(x.ttk) ? x.ttk.toFixed(0) : '—'} s · the front Keeper took ${Math.round(x.held * 100)}% of the blows`);
  process.exit(0);
}
if (argv.trace) {
  // --trace=<vocation>,<level>,<creature id>[,<tier>]: one fight, its Keeper and its outcome.
  const [voc, L, id, tier = 'normal'] = String(argv.trace).split(',');
  // The Seam Eater on Nightmare / Hell: <level> is the Eater's; the Keeper comes TIER_LEAD above it in resist gear.
  const seam = id === SEAM.SEAM_ID, lead = seam ? TIER_LEAD[tier] : 0;
  const k = keeper(voc, Number(L) + lead, tier, Number(argv.seed ?? 0), seam && tier !== 'normal' ? 'arcane' : null);
  // An ordinary creature comes at the Keeper's level, as a zone holding his level raises it (td-zones atZoneLevel).
  const def = seam ? SEAM.seamEaterAt(MOBS[id], Number(L)) : (MOBS[id].rank ?? 'normal') === 'normal' ? atZone(id, Number(argv.foe ?? L)) : MOBS[id];  // --foe=<level>: the creature's own level (the gap)
  console.log(JSON.stringify({ fight: k.fight, stats: k.stats, gear: k.gear.total, bar: k.tree.bar, aura: k.tree.aura, ranks: Object.fromEntries(Object.entries(k.tree.ranks).filter(([, n]) => n)) }));
  console.log(fight(k, { def, pack: argv.pack ? packOf(String(argv.pack), 'trace') : undefined, count: Number(argv.count ?? 1) }, 'trace'));
  console.log('damage by colour', TALLY);
  process.exit(0);
}

const t0 = Date.now();
const levels = QUICK ? [5, 10, 20, 30, 40, 60] : LEVELS;
const table = {};
for (const voc of VOCATIONS) {
  table[voc] = { levels: {}, bosses: [], seam: [] };
  for (const L of levels) table[voc].levels[L] = cell(voc, L, RUNS);
  for (const b of BOSSES) table[voc].bosses.push(bossCell(voc, b, RUNS));
  table[voc].gap = { oneShot: gapCell(voc, 20, 20, 1, RUNS), plus5: [20, 30].map(L => ({ level: L, ...plusCell(voc, L, GAP_HUNT.lift, RUNS) })) };
  for (const L of QUICK ? [20, 40] : SEAM_AT) for (const tier of ['normal', 'nightmare', 'hell']) table[voc].seam.push(seamCell(voc, L, tier, RUNS));
}
// S5: the party cells (a tank, a healer and the damage against a floor boss at L30, on Nightmare).
const party = partyCell(QUICK ? 6 : 12);
const secs = (Date.now() - t0) / 1000;

const fmt = (n, d = 1) => Number.isFinite(n) ? n.toFixed(d) : '—';
const pct = n => Number.isFinite(n) ? `${Math.round(n * 100)}%` : '—';
const k1 = n => Number.isFinite(n) ? (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${Math.round(n)}`) : '—';

if (argv.json) { console.log(JSON.stringify(table, null, 1)); process.exit(0); }

const fails = [];
const say = argv.check && !argv.verbose ? () => undefined : console.log;
say(`Combat sim · the real MobSystem · ${RUNS} seeded runs a cell · dodge ${DODGE * 100}% of tells · ${fmt(secs, 0)} s\n`);
say('Per level: time to kill (s, interquartile mean) · death rate · potions (life+mana) · hunt XP/h · Gold/h · kills/h');
say('voc            L   creatures hunted    normal         champion pack   unique pack     hunt XP/h  Gold/h  kills/h  falls/h');
for (const voc of VOCATIONS) for (const L of levels) {
  const c = table[voc].levels[L];
  const row = x => `${fmt(x.ttk).padStart(5)}s ${pct(x.death).padStart(4)} ${fmt(x.hpPots + x.manaPots).padStart(3)}`;
  say(`${voc.padEnd(14)} ${String(L).padStart(2)}  ${c.normal.id.padEnd(18)} ${row(c.normal)}  ${row(c.champion)}  ${row(c.unique)}  ${k1(c.hunt.xph).padStart(8)}  ${k1(c.hunt.goldh).padStart(6)}  ${fmt(c.hunt.killsh, 0).padStart(6)}  ${fmt(c.hunt.deathsh, 2).padStart(6)}`);
}
say('\nBosses at their level, Normal: time to kill (s, interquartile mean) · first-attempt death rate · potions · life lost (bars) · blows that reached him');
say(`${'boss'.padEnd(20)} L   ${VOCATIONS.map(v => v.padEnd(22)).join('')}`);
for (let i = 0; i < BOSSES.length; i++) {
  say(`${BOSSES[i].id.padEnd(20)} ${String(BOSSES[i].level).padStart(2)}  ${VOCATIONS.map(v => { const b = table[v].bosses[i]; return `${fmt(b.ttk, 0).padStart(4)}s ${pct(b.death).padStart(4)} ${fmt(b.hpPots + b.manaPots).padStart(3)} ${fmt(b.taken, 1).padStart(3)} ${fmt(b.struck, 0).padStart(3)} `; }).join('')}`);
}
say('\nThe Seam Eater (Normal: the Keeper at its level; Nightmare +5 and Hell +15 levels, in resist gear): time to kill (s, interquartile mean) · death rate');
for (let i = 0; i < table.warlock.seam.length; i++) {
  const s = table.warlock.seam[i];
  say(`  L${String(s.level).padEnd(3)} K${String(s.keeper).padEnd(3)} ${s.tier.padEnd(10)} ${VOCATIONS.map(v => { const x = table[v].seam[i]; return `${v.slice(0, 5)} ${fmt(x.ttk, 0).padStart(4)}s ${pct(x.death).padStart(4)}`; }).join('   ')}`);
}
const xphAt = voc => Object.fromEntries(levels.map(L => [L, table[voc].levels[L].hunt.xph]));
say('\nHours to reach a level on the hunt (leveling.md §1 "content at pace": 10 → 0.6 h, 30 → 5.8 h, 50 → 14 h)');
for (const voc of VOCATIONS) say(`  ${voc.padEnd(14)} ${[10, 30, 50].map(L => `L${L} ${fmt(hoursTo(xphAt(voc), L), 1)} h`).join('   ')}`);

say(`\nThe level gap: a level-20 Keeper vs a level-40 creature (falls · blows taken · wins · his damage vs at level), and hunting five levels up (share of ${GAP_HUNT.secs / 60}-minute hunts with a fall)`);
for (const voc of VOCATIONS) {
  const g = table[voc].gap;
  say(`  ${voc.padEnd(14)} L20 vs L40: a blow ${pct(g.oneShot.blow)} of his life · falls ${pct(g.oneShot.death)} in ${fmt(g.oneShot.blows, 0)} blow(s) · wins ${pct(g.oneShot.won)} · deals ${pct(g.oneShot.dealt)}   ${g.plus5.map(p => `L${p.level} hunting L${p.level + GAP_HUNT.lift}: falls in ${pct(p.death)} of hunts`).join('   ')}`);
}

say(`\nThe party at L${PARTY_LEVEL} on ${PARTY_TIER} vs ${party.boss} (L${party.level}): falls · cleared · time to kill`);
for (const [k, x] of Object.entries({ full: party.full, 'no healer': party.noHealer, 'no tank': party.noTank })) say(`  ${k.padEnd(10)} ${pct(x.fell)} · ${pct(x.cleared)} · ${fmt(x.ttk, 0)} s`);

// ── The check ──
// S5 (campaign.md): a level-30 Lanternwright keeps a level-30 Ashguard alive against the floor boss; without her the
// party falls in at least 70% of the runs (the boss needs a healer).
if (party.full.fell > BANDS.bossDeath) fails.push(`the L${PARTY_LEVEL} party (tank, healer, damage) falls to ${party.boss} ${pct(party.full.fell)} of the time (≤ ${pct(BANDS.bossDeath)})`);
if (party.noHealer.fell < BANDS.partyNoHealer) fails.push(`the L${PARTY_LEVEL} party without its healer falls to ${party.boss} only ${pct(party.noHealer.fell)} of the time (≥ ${pct(BANDS.partyNoHealer)})`);
for (const voc of VOCATIONS) for (const L of levels.filter(banded)) {
  const c = table[voc].levels[L];
  if (!inBand(c.normal.ttk, BANDS.normal)) fails.push(`${voc} L${L}: a creature at his level takes ${fmt(c.normal.ttk)} s (band ${BANDS.normal.join('–')} s)`);
  if (c.normal.death > BANDS.normalDeath) fails.push(`${voc} L${L}: a creature at his level kills him ${pct(c.normal.death)} of the time`);
  const pack = band => voc === 'ashguard' ? [band[0] * BANDS.ashPackFloor, band[1]] : band;
  if (!inBand(c.champion.ttk, pack(BANDS.champion))) fails.push(`${voc} L${L}: a champion pack takes ${fmt(c.champion.ttk)} s (band ${pack(BANDS.champion).join('–')} s)`);
  if (!inBand(c.unique.ttk, pack(BANDS.unique))) fails.push(`${voc} L${L}: a unique pack takes ${fmt(c.unique.ttk)} s (band ${pack(BANDS.unique).join('–')} s)`);
  if (c.aura && !inBand(c.aura.ttk, pack(BANDS.unique))) fails.push(`${voc} L${L}: an Aura Enchanted unique pack takes ${fmt(c.aura.ttk)} s (band ${pack(BANDS.unique).join('–')} s)`);
  for (const [what, x] of [['champion pack', c.champion], ['unique pack', c.unique], ['pack that bears an aura', c.aura ?? { death: 0 }]]) if (x.death > BANDS.packDeath) fails.push(`${voc} L${L}: a ${what} kills him ${pct(x.death)} of the time (≤ ${pct(BANDS.packDeath)})`);
}
for (const voc of VOCATIONS) table[voc].bosses.forEach(b => {
  if (!inBand(b.ttk, BANDS.boss)) fails.push(`${voc}: ${b.id} (L${b.level}) takes ${fmt(b.ttk, 0)} s (band ${BANDS.boss.join('–')} s)`);
  if (b.death > BANDS.bossDeath) fails.push(`${voc}: ${b.id} (L${b.level}) kills a first attempt ${pct(b.death)} of the time (≤ ${pct(BANDS.bossDeath)})`);
});
// No boss can be kited forever: a ranged Keeper who keeps walking away is still struck (owner 2026-10-21; the melee
// bosses' gap-closers, td-mobs MobDef.charge).
for (const voc of VOCATIONS.filter(v => v !== 'ashguard')) table[voc].bosses.forEach(b => {
  if (!(b.struck >= BANDS.kitedStruck)) fails.push(`${voc} kites ${b.id} (L${b.level}): struck ${fmt(b.struck)} times a fight (≥ ${BANDS.kitedStruck})`);
});
for (const voc of VOCATIONS) table[voc].seam.forEach(s => {
  if (s.tier !== 'normal') return;
  if (!inBand(s.ttk, BANDS.seam)) fails.push(`${voc}: the Seam Eater L${s.level} on Normal takes ${fmt(s.ttk, 0)} s (band ${BANDS.seam.join('–')} s)`);
  if (s.death > BANDS.seamDeath) fails.push(`${voc}: the Seam Eater L${s.level} on Normal kills ${pct(s.death)} of first attempts (≤ ${pct(BANDS.seamDeath)})`);
});
// Nightmare and Hell: a wall, not impossible — beaten by a geared Keeper above the Eater's level (TIER_LEAD), and
// never softer than Normal at the Eater's level.
for (const voc of VOCATIONS) for (const s of table[voc].seam.filter(x => x.tier !== 'normal')) {
  const cap = BANDS.seamTierDeath[s.tier];
  if (!(s.death <= cap)) fails.push(`${voc}: the Seam Eater L${s.level} on ${s.tier} (a level-${s.keeper} Keeper in resist gear) kills ${pct(s.death)} of first attempts (≤ ${pct(cap)})`);
  const n = table[voc].seam.find(x => x.level === s.level && x.tier === 'normal');
  if (!(s.death >= n.death || s.ttk > n.ttk)) fails.push(`${voc}: the Seam Eater L${s.level} on ${s.tier} is softer than on Normal`);
}
// Vocations within ±25% of each other on a single foe: each one's time against the four's mean, per level and boss.
const spread = (label, xs) => {
  const m = mean(xs.map(x => x[1]));
  for (const [v, x] of xs) if (Number.isFinite(x) && Math.abs(x / m - 1) > BANDS.spread + SLACK / 2) fails.push(`${label}: ${v} ${fmt(x)} s vs the vocations' mean ${fmt(m)} s (±${pct(BANDS.spread)})`);
};
for (const L of levels.filter(banded)) spread(`L${L} creature`, VOCATIONS.map(v => [v, table[v].levels[L].normal.ttk]));
BOSSES.forEach((b, i) => spread(`${b.id}`, VOCATIONS.map(v => [v, table[v].bosses[i].ttk])));
for (const voc of VOCATIONS) for (const [L, band] of Object.entries(BANDS.hours)) {
  const h = hoursTo(xphAt(voc), Number(L));
  if (!inBand(h, band)) fails.push(`${voc}: level ${L} in ${fmt(h, 1)} h on the hunt (band ${band.join('–')} h)`);
}
// XP and Gold an hour climb with the level (a higher hunt always pays more).
for (const voc of VOCATIONS) for (let i = 1; i < levels.length; i++) {
  const [a, b] = [levels[i - 1], levels[i]].map(L => table[voc].levels[L].hunt);
  if (banded(levels[i]) && !(b.xph > a.xph && b.goldh > a.goldh)) fails.push(`${voc}: the L${levels[i]} hunt pays no more than L${levels[i - 1]}'s`);
}

for (const voc of VOCATIONS) {
  const g = table[voc].gap, B = BANDS.gap;
  // One blow takes ≥ 90% of his life (so one or two fell him), and every fall came in at most two that landed.
  if (!(g.oneShot.blow >= .9 && (!(g.oneShot.death > 0) || g.oneShot.blows <= B.oneShotBlows))) fails.push(`${voc}: a level-40 creature's blow takes ${pct(g.oneShot.blow)} of a level-20 Keeper's life, falls in ${fmt(g.oneShot.blows, 0)} blows (≥ 90%, ≤ ${B.oneShotBlows})`);
  if (g.oneShot.won > B.oneShotWin) fails.push(`${voc}: a level-20 Keeper beats a level-40 creature ${pct(g.oneShot.won)} of the time (≤ ${pct(B.oneShotWin)})`);
  if (!(g.oneShot.dealt <= B.oneShotDealt * (1 + SLACK))) fails.push(`${voc}: a level-20 Keeper deals ${pct(g.oneShot.dealt)} of his damage to a level-40 creature (≤ ${pct(B.oneShotDealt)})`);
  for (const p of g.plus5) if (!(p.death >= B.plus5Each[0] && p.death <= B.plus5Each[1])) fails.push(`${voc}: a level-${p.level} Keeper hunting level-${p.level + GAP_HUNT.lift} creatures falls in ${pct(p.death)} of ${GAP_HUNT.secs / 60}-minute hunts (each vocation ${B.plus5Each.map(pct).join('–')})`);
}

// Five levels up, the four vocations together fall in 25–50% of the hunts (a real threat, survivable).
for (const L of [20, 30]) {
  const m = mean(VOCATIONS.map(v => table[v].gap.plus5.find(p => p.level === L).death));
  if (!(m >= BANDS.gap.plus5Death[0] * (1 - SLACK) && m <= BANDS.gap.plus5Death[1] * (1 + SLACK))) fails.push(`level-${L} Keepers hunting level-${L + GAP_HUNT.lift} creatures fall in ${pct(m)} of hunts, the vocations' mean (${BANDS.gap.plus5Death.map(pct).join('–')})`);
}

if (argv.check) {
  if (fails.length) { console.log(`combat-sim: ${fails.length} band(s) missed (${fmt(secs, 0)} s)`); for (const f of fails) console.log(`  ✗ ${f}`); process.exit(1); }
  console.log(`combat-sim: every band holds — ${VOCATIONS.length} vocations × ${levels.length} levels, ${BOSSES.length} bosses, the Seam Eater (${fmt(secs, 0)} s)`);
} else if (fails.length) {
  console.log(`\n${fails.length} band(s) missed:`); for (const f of fails) console.log(`  ✗ ${f}`);
}
