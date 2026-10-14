#!/usr/bin/env node
/**
 * check-meaning.js — every thing in the world must mean something.
 *
 * Owner rule (2026-10-13): every item, material, block, stat, NPC, creature
 * and station needs (1) a SOURCE, (2) a USE, (3) WORLD MEANING (lore / canon
 * tie) and (4) VISIBILITY to the player. This script loads the game's own
 * definition tables (TypeScript, transpiled on the fly like
 * `seamworks-engine.test.cjs` does), builds the source → thing → use graph and
 * reports what breaks the rule.
 *
 * It is a RATCHET, like check-ds-adherence: today's debt lives in
 * `scripts/meaning-baseline.json`; the run fails only on a violation that is
 * not in the baseline. Fix something → the script tells you to shrink the
 * baseline (`--update-baseline` rewrites it from the current state).
 *
 *   node scripts/check-meaning.js                    report + gate
 *   node scripts/check-meaning.js --update-baseline  accept the current state
 *   node scripts/check-meaning.js --json             machine-readable dump
 *
 * Audit with recommended fixes: docs/world/meaning-audit.md.
 *
 * What counts:
 *   source  crafting / forge / refine output, hunt or area drop, Delve terrain
 *           yield or block, gathering node / skill tier, expedition loot,
 *           mission / NPC chain / collection / arena reward, Gambler box pool.
 *           The simulated Exchange alone is NOT a world source (it sells from
 *           thin air): that is reported as `market-only-source`.
 *   use     recipe / forge / refine / infusion input, Delve mission delivery,
 *           placeable block, equip with a stat the game reads for the Keeper,
 *           a tool that works a terrain or gathering node. Selling alone
 *           (vendor buyback, Exchange) is reported as `sell-only-use`.
 *   lore    a lore line on the definition (or the Collection Log's seed lore).
 *   visible a display name the satchel can paint (not a raw id) and, for
 *           materials, a non-empty "Found in…" line.
 *
 * Canon names (creature atlas, item lore codex, narrative bible) live outside
 * the repo, so canon ties are printed as INFO when the canon folder exists and
 * never gate.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'src', 'app');
const BASELINE = path.join(__dirname, 'meaning-baseline.json');
const CANON_DIR = path.join(require('os').homedir(), 'Documents', '1. Projects', 'Eclipse Realms', 'docs', '03-lore-and-design');

// ── Loader: transpile TS modules, stub anything that is not a relative import ──
const cache = new Map();
function stub() {
  const fn = function () { return proxy; };
  const proxy = new Proxy(fn, {
    get: (_t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'prototype' ? {} : proxy),
    apply: () => proxy,
    construct: () => proxy,
  });
  return proxy;
}
function resolveTs(from, name) {
  const base = path.resolve(path.dirname(from), name);
  for (const c of [`${base}.ts`, base, path.join(base, 'index.ts')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText;
  const req = name => {
    if (!name.startsWith('.')) return stub();
    const f = resolveTs(file, name);
    return f ? load(f) : stub();
  };
  new Function('require', 'module', 'exports', code)(req, module, module.exports);
  return module.exports;
}
const L = p => load(path.join(APP, p));
// Required as a library (the loader only): stop here.
module.exports = { load, APP };
if (require.main !== module) return;
const read =p => fs.readFileSync(path.join(APP, p), 'utf8');

// Source files for the "is this stat read anywhere" scan. Synced-folder
// duplicates ("name 2.ts") are never part of the build.
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.ts$/.test(e.name) && !/\.spec\.ts$/.test(e.name) && !/ \d+\.ts$/.test(e.name)) out.push(full);
  }
  return out;
}
const SOURCES = walk(APP).map(f => ({ rel: path.relative(APP, f), text: fs.readFileSync(f, 'utf8') }));

// ── Game tables ────────────────────────────────────────────────────────────
const { ITEM_DEFINITIONS } = L('shared/rpg/item-definition.ts');
const { ITEM_STAT_KEYS, ITEM_STAT_LABELS } = L('shared/rpg/item.model.ts');
const { CRAFTING_RECIPES } = L('shared/crafting/crafting.model.ts');
const { FORGE_EQUIPMENT_RECIPES } = L('shared/rpg/forge-recipes.ts');
const { REFINE_RECIPES } = L('shared/rpg/refine-ops.ts');
const { materialDisplay } = L('shared/rpg/material-catalog.ts');
const { foundInWorld } = L('shared/world/found-in.data.ts');
const { TOWNS } = L('play/world/world.model.ts');
const { PANEL_IDS } = L('play/world/world.model.ts');
const { PANEL_REGISTRY } = L('play/world/panel-registry.ts');
const { TOWN_KEEPERS, TOWNSFOLK_COUNT, townsfolkLines } = L('play/world/life.ts');
const { TERRAIN_NODE_LIST, PLACEABLES } = L('play/engine/terrain.ts');
// The endless Delve's generator (Phase 7): what it lays east and west of the core.
const { SECTOR_NODES } = L('play/engine/sector-gen.ts');
const { MINING_TIERS } = L('shared/activity/activity.model.ts');
const { FORAGING_TIERS } = L('shared/activity/foraging.model.ts');
const { PROSPECTING_TIERS } = L('shared/activity/prospecting.model.ts');
const EXPLORER = L('shared/explorer/explorer.model.ts');
const { VENDOR_SHELF } = L('shared/vendor/material-vendor.model.ts');
const { EXCHANGE_CATALOGUE } = L('shared/exchange/exchange.model.ts');
const { ARENA_SHOP } = L('shared/arena/arena.model.ts');
const { COLLECTION_REWARDS } = L('shared/collection/collection.model.ts');
const { NPC_CHAINS } = L('shared/npc/npc-quest.model.ts');
const { NPCS, DIALOGUE } = L('shared/npc/npc.model.ts');
const { DELVE_MISSIONS, DELVE_MATERIAL_NAMES } = L('shared/npc/delve-missions.model.ts');
const { MYSTERY_BOXES, boxWindow, boxPool } = L('shared/gambler/mystery-box.ts');
const { REEL_SYMBOLS } = L('shared/reels/reels.model.ts');
const { UNIQUE_ITEMS } = L('shared/rpg/unique-items.ts');
const { INFUSIONS } = L('shared/enchanting/infusion.model.ts');
const { SOCKET_CHANNEL } = L('shared/enchanting/socket.model.ts');
const { SOCKET_WORDS } = L('shared/enchanting/socket-words.ts');
const { RUNES, RUNEWORDS } = L('shared/rune-forge/rune.model.ts');
const { STAT_DEFINITIONS } = L('shared/rpg/player-stats.model.ts');
const { ARTIFACTS: ESSENCE_ARTIFACTS } = L('shared/economy/economy.model.ts');
const { DELVE_INSCRIPTIONS } = L('shared/delve/delve-lore.model.ts');
const FISHING = L('shared/fishing/fishing.model.ts');

// Ids in un-exported tables, read as text.
function objectKeys(file, constName) {
  const text = read(file);
  const start = text.indexOf(`const ${constName}`);
  if (start < 0) return [];
  const body = text.slice(start, text.indexOf('\n};', start));
  return [...body.matchAll(/^\s*'([a-z0-9-]+)'\s*:/gm)].map(m => m[1]);
}
const MATERIAL_NAMES = objectKeys('shared/rpg/material-catalog.ts', 'MATERIAL_NAMES');
const SEED_LORE = new Set(objectKeys('shared/collection/collection.model.ts', 'SEED_LORE'));
const BESTIARY_IDS = [...read('codex/bestiary.ts').matchAll(/^\s*id: '([a-z0-9-]+)'/gm)].map(m => m[1]);
const I18N_KEYS = new Set(SOURCES.filter(s => /i18n\.ts$|translation\.service\.ts$/.test(s.rel))
  .flatMap(s => [...s.text.matchAll(/^\s*'([a-zA-Z][\w.-]*)':\s*\{/gm)].map(m => m[1])));
const PROSPECT_DISCOVERY = /'clarity-elixir'/.test(read('shared/activity/activity.model.ts')) ? 'clarity-elixir' : null;

// ── The graph ──────────────────────────────────────────────────────────────
/** key `${cat}:${id}` → node */
const graph = new Map();
function node(cat, id, name) {
  const key = `${cat}:${id}`;
  if (!graph.has(key)) graph.set(key, { cat, id, name: name || id, sources: new Set(), uses: new Set(), sells: new Set(), market: new Set(), lore: false, visible: true, notes: [] });
  const n = graph.get(key);
  if (name && n.name === id) n.name = name;
  return n;
}
const defById = new Map(ITEM_DEFINITIONS.map(d => [d.id, d]));
const isMaterialId = id => !defById.has(id) || defById.get(id).family === 'material';
/** Materials and items share one id space; route to the right category. */
const thing = id => (isMaterialId(id) ? node('material', id) : node('item', id, defById.get(id)?.name));
const src = (id, label) => thing(id).sources.add(label);
const use = (id, label) => thing(id).uses.add(label);

// Universe: every definition, every named stack, every tier/expedition id.
for (const d of ITEM_DEFINITIONS) {
  const n = thing(d.id);
  n.name = d.name;
  n.lore = !!(d.lore && d.lore.trim());
}
const ALL_MATERIAL_IDS = new Set([
  ...MATERIAL_NAMES, ...Object.keys(DELVE_MATERIAL_NAMES),
  ...MINING_TIERS.map(t => t.oreId), ...FORAGING_TIERS.map(t => t.herbId), ...PROSPECTING_TIERS.map(t => t.mineralId),
  ...EXPLORER.REALM_COMMON_MATERIALS, ...Object.values(EXPLORER.REALM_EXCLUSIVE_MATERIALS).flat(),
  ...Object.values(EXPLORER.REALM_ARTBIBLE_MATERIALS).flat(),
  ...PLACEABLES.map(p => p.id),
]);
for (const id of ALL_MATERIAL_IDS) thing(id);

// Sources ───────────────────────────────────────────────────────────────────
for (const r of CRAFTING_RECIPES) src(r.output.itemId, `recipe ${r.id}`);
for (const r of FORGE_EQUIPMENT_RECIPES) src(r.id, `forge ${r.id}`);
for (const r of REFINE_RECIPES) src(r.to, `refine ${r.from}`);
for (const n of TERRAIN_NODE_LIST) {
  if (n.yield) src(n.yield.materialId, `terrain ${n.id}`);
  if (n.block) src(n.block, `dug ${n.id}`);
}
for (const id of ALL_MATERIAL_IDS) for (const p of foundInWorld(id)) src(id, `found in ${p.label}`);
for (const t of MINING_TIERS) src(t.oreId, 'Mining (Seamworks)');
for (const t of FORAGING_TIERS) src(t.herbId, 'Foraging (Canopy)');
for (const t of PROSPECTING_TIERS) src(t.mineralId, 'Prospecting (Orrery)');
if (PROSPECT_DISCOVERY) src(PROSPECT_DISCOVERY, 'Prospecting discovery');
for (const id of EXPLORER.REALM_COMMON_MATERIALS) src(id, 'expeditions (all realms)');
for (const [realm, ids] of Object.entries(EXPLORER.REALM_EXCLUSIVE_MATERIALS)) for (const id of ids) src(id, `${realm} expeditions`);
for (const [realm, ids] of Object.entries(EXPLORER.REALM_ARTBIBLE_MATERIALS)) for (const id of ids) src(id, `${realm} expeditions`);
for (const s of Object.values(NPC_CHAINS).flat()) if (s.reward && s.reward.item) src(s.reward.item.defId, `NPC chain ${s.id}`);
for (const m of DELVE_MISSIONS) if (m.reward && m.reward.item) src(m.reward.item.defId, `Delve mission ${m.id}`);
for (const r of COLLECTION_REWARDS) if (r.item) src(r.item, `Collection reward ${r.id}`);
for (const a of ARENA_SHOP) {
  if (a.kind === 'equipment' && a.definitionId) src(a.definitionId, `Arena shop ${a.id}`);
  if (a.kind === 'material' && a.stackKey) src(a.stackKey, `Arena shop ${a.id}`);
}
const boxRarities = new Set(MYSTERY_BOXES.flatMap(b => boxWindow(b)));
for (const rarity of boxRarities) for (const d of boxPool(rarity)) src(d.id, 'Gambler boxes');
for (const u of UNIQUE_ITEMS) if (boxRarities.has(u.rarity)) src(u.id, 'Gambler boxes (unique)');
// The Croupier's Reels: a winning line may hand over one of its symbol's thing.
const reelRunePrizes = new Set();
for (const s of REEL_SYMBOLS) if (s.prize) { if (s.prize.kind === 'rune') reelRunePrizes.add(s.prize.id); else src(s.prize.id, 'Reels prize'); }
/** Exchange rows are `mat:<id>` for stacks and carry `definitionId` for gear. */
const exchangeId = g => g.definitionId || g.materialId || (/^mat:(.+)$/.exec(g.id) || [])[1];
for (const g of EXCHANGE_CATALOGUE) { const id = exchangeId(g); if (id) thing(id).market.add('Exchange'); }

// Uses ──────────────────────────────────────────────────────────────────────
// A `rune: true` ingredient is a Forge rune spent from the ledger, not a stack.
const recipeRunes = new Set();
for (const r of CRAFTING_RECIPES) for (const i of r.ingredients) {
  if (i.rune) recipeRunes.add(i.materialId); else use(i.materialId, `recipe ${r.id}`);
}
for (const r of FORGE_EQUIPMENT_RECIPES) for (const i of r.inputs) use(i.id, `forge ${r.id}`);
for (const r of REFINE_RECIPES) use(r.from, `refine → ${r.to}`);
for (const inf of INFUSIONS) for (const i of inf.inputs) use(i.materialId, `infusion ${inf.id}`);
for (const m of DELVE_MISSIONS) {
  const items = (m.objective && m.objective.items) || [];
  for (const i of items) use(i.materialId, `Delve mission ${m.id}`);
}
for (const p of PLACEABLES) use(p.id, `placeable → ${p.node}`);
// Fishing (Phase 6, src/app/shared/fishing): what the fishing loop grants and spends.
for (const c of FISHING.CATCHES) src(c.id, c.rarity === 'quest' ? 'fishing: the Ledger Catch, on its day' : `fishing ${c.waters.join('/')}`);
for (const b of FISHING.BAITS) use(b.id, 'fishing bait');
for (const r of FISHING.RODS) use(r.id, `fishing rod (tier ${r.tier})`);
src('worn-rod', 'starter kit: every Keeper is handed one (FishingService.ensureWornRod)');
for (const id of FISHING.CRATE_IDS) use(id, 'opened in the satchel (FishingService.openCrate)');
for (const id of FISHING.LEDGER_CATCH_IDS) use(id, 'the Lodge Warden\'s Ledger Catch (FishingService.turnIn)');
for (const c of FISHING.LODGE_CHARMS) { src(c.id, 'the Lodge Warden\'s Ledger Catch ladder'); use(c.id, `held: ${c.effect}`); }
for (const [crate, rows] of Object.entries(FISHING.CRATE_CONTENTS)) for (const row of rows) src(row.id, `crate ${crate}`);
// The Seam Bucket: scoops into a full bucket, which pours back out (engine useBucket).
use('seam-bucket', 'scoops water or lava (Delve hotbar)');
for (const id of ['seam-bucket-water', 'seam-bucket-lava']) { src(id, 'a Seam Bucket scooped full'); use(id, 'poured in the Delve (water on lava sets obsidian)'); }
// The Underhearth's gear (Phase 8): gear stacks the engine reads from the satchel, not placeables or recipe inputs.
use('seam-cart', 'carried: rides Kael\'s rails and the Keeper\'s Seam Rails (engine/traversal.ts)');
use('thornroot-grapple', 'the Delve hotbar\'s grapple (engine/traversal.ts)');
use('four-hammer-marks', 'kept: summons the Banked Furnace at its hearth in the Furnace Hall (not consumed)');
for (const row of VENDOR_SHELF) thing(row.materialId).sells.add('vendor buyback');
for (const g of EXCHANGE_CATALOGUE) { const id = exchangeId(g); if (id) thing(id).sells.add('Exchange'); }

// Which item stats change a number in play when the KEEPER wears them.
const defFiles = /^(shared\/rpg\/(item\.model|item-definition|artbible-items|unique-items|item-reforge|item-upgrade|build-identity|stat-delta)|shared\/enchanting\/socket|translation\.service|version-history)|component\.ts$|i18n\.ts$/;
const readersOf = re => SOURCES.filter(s => !defFiles.test(s.rel) && re.test(s.text)).map(s => s.rel);
const KEEPER_READS = {};
const ANY_READS = {};
for (const key of ITEM_STAT_KEYS) {
  const keeper = new Set(readersOf(new RegExp(`equippedTotals\\.${key}\\b`)));
  if (key === 'magicFind') readersOf(/\bequippedMagicFind\b/).filter(f => !/inventory\.service/.test(f)).forEach(f => keeper.add(f));
  if (key === 'strikePower' || key === 'ward') readersOf(/\bkeeperCombatStats\(/).filter(f => !/keeper-combat\.ts$/.test(f)).forEach(f => keeper.add(f));
  KEEPER_READS[key] = [...keeper];
  ANY_READS[key] = readersOf(new RegExp(`\\.${key}\\b`));
}
const keeperLive = new Set(ITEM_STAT_KEYS.filter(k => KEEPER_READS[k].length));
const statSheetShows = /ITEM_STAT_KEYS/.test(read('shared/rpg/keeper-stat-sheet.component.ts'));

for (const d of ITEM_DEFINITIONS) {
  if (d.family === 'material') continue;
  const n = thing(d.id);
  const live = d.rollKeys.filter(k => keeperLive.has(k));
  if (live.length) n.uses.add(`equip (${live.join(', ')})`);
  else if (d.rollKeys.length) n.notes.push(`its stats (${d.rollKeys.join(', ')}) do nothing on the Keeper`);
}
// Tools: a tool family is used when a terrain or gathering node names it.
const toolFamilies = new Set();
for (const n of TERRAIN_NODE_LIST) for (const t of Object.keys(n.tools || {})) toolFamilies.add(t);
for (const town of Object.values(TOWNS)) for (const a of [town, ...town.hunts]) for (const g of a.nodes || []) for (const t of Object.keys(g.tools || {})) toolFamilies.add(t);
for (const d of ITEM_DEFINITIONS) {
  const m = /^(pickaxe|axe|sickle|staff)-(\d)$/.exec(d.id);
  if (m && toolFamilies.has(m[1])) use(d.id, `tool: works ${m[1]} nodes`);
  // The Worn starter tools (src/app/shared/skills/tool-items.ts): handed to
  // every Keeper by SideScrollerComponent.ensureStarterTools, used as tier I.
  const st = /^starter-(pickaxe|axe|sickle)$/.exec(d.id);
  if (st && toolFamilies.has(st[1])) { src(d.id, 'starter kit: every Keeper is handed one'); use(d.id, `tool: works ${st[1]} nodes (tier I)`); }
}

// A crafted thing with no lore of its own still has the Bench's blurb.
for (const r of CRAFTING_RECIPES) if (r.blurb && r.blurb.trim()) { const n = thing(r.output.itemId); n.lore = n.lore || true; }

// Lore + visibility for materials ─────────────────────────────────────────
for (const n of graph.values()) {
  if (n.cat !== 'material') continue;
  if (!n.lore) n.lore = SEED_LORE.has(n.id);
  const display = materialDisplay(n.id);
  if (display && n.name === n.id) n.name = display.name;
  if (!display) { n.visible = false; n.notes.push('satchel paints the raw id (no display row)'); }
  if (!PLACEABLES.some(p => p.id === n.id) && !foundInWorld(n.id).length) { n.visible = false; n.notes.push('no "Found in…" line'); }
}

// ── Violations ─────────────────────────────────────────────────────────────
const violations = [];
const flag = (cat, kind, id, detail) => violations.push({ cat, kind, id, detail });

for (const n of graph.values()) {
  if (n.cat !== 'item' && n.cat !== 'material') continue;
  if (!n.sources.size) flag(n.cat, n.market.size ? 'market-only-source' : 'no-source', n.id, n.market.size ? 'only the Exchange sells it' : 'nothing in the world grants it');
  if (!n.uses.size) flag(n.cat, n.sells.size ? 'sell-only-use' : 'no-use', n.id, n.notes.find(x => /stats/.test(x)) || (n.sells.size ? `only ${[...n.sells].join(' / ')}` : 'nothing consumes or equips it'));
  if (!n.lore) flag(n.cat, 'no-lore', n.id, 'no lore line');
  if (!n.visible) flag(n.cat, 'not-visible', n.id, n.notes.filter(x => !/stats/.test(x)).join('; '));
}

// Found-in must name the Delve for everything the Delve's terrain yields.
for (const town of Object.values(TOWNS)) for (const a of [town, ...town.hunts]) {
  const t = a.terrain; if (!t) continue;
  const nodes = new Set([...t.bands, ...t.veins, ...t.stamps, ...(t.biomes || []).flatMap(b => b.veins || [])].map(x => x.node));
  for (const id of nodes) {
    const y = TERRAIN_NODE_LIST.find(n => n.id === id)?.yield;
    if (y && !foundInWorld(y.materialId).some(p => p.label.startsWith(a.name))) flag('material', 'found-in-omits', y.materialId, `"Found in…" never names ${a.name}, where ${id} yields it`);
  }
}

// Items that share an id with an Essence-shop artifact flag: two meanings, one name.
for (const a of ESSENCE_ARTIFACTS) if (defById.has(a.id)) flag('item', 'twin-definition', a.id, 'also an Essence-shop artifact flag with a different effect');

// Forge runes (the anvil's ledger) ─────────────────────────────────────────
const runewordRunes = new Set(RUNEWORDS.flatMap(w => w.runes || []));
const socketWordRunes = new Set(SOCKET_WORDS.flatMap(w => w.runes || []));
for (const r of RUNES) {
  const n = node('rune', r.id, r.name);
  if (r.dropRate > 0) n.sources.add('Rune Forge strike');
  if (reelRunePrizes.has(r.id)) n.sources.add('Reels prize');
  if (SOCKET_CHANNEL[r.id]) n.uses.add(`socket → ${SOCKET_CHANNEL[r.id]}`);
  if (runewordRunes.has(r.id)) n.uses.add('runeword');
  if (socketWordRunes.has(r.id)) n.uses.add('socket word');
  if (recipeRunes.has(r.id)) n.uses.add('recipe input');
  n.lore = !!(r.lore && r.lore.trim());
  if (!n.sources.size) flag('rune', 'no-source', r.id, 'drop rate 0');
  if (!n.uses.size) flag('rune', 'no-use', r.id, 'no socket channel, runeword or socket word');
  else if (SOCKET_CHANNEL[r.id] && !keeperLive.has(SOCKET_CHANNEL[r.id]) && !runewordRunes.has(r.id) && !socketWordRunes.has(r.id)) flag('rune', 'dead-stat-use', r.id, `socketed it adds ${SOCKET_CHANNEL[r.id]}, which does nothing on the Keeper`);
  if (!n.lore) flag('rune', 'no-lore', r.id, 'no lore line');
}

// Item stats ────────────────────────────────────────────────────────────────
for (const key of ITEM_STAT_KEYS) {
  node('stat', key, ITEM_STAT_LABELS[key]);
  if (!ANY_READS[key].length) flag('stat', 'never-read', key, 'no formula reads it');
  else if (!KEEPER_READS[key].length) flag('stat', 'keeper-never-reads', key, `read only by ${ANY_READS[key].join(', ')}; worn by the Keeper it changes nothing`);
  if (!ITEM_STAT_LABELS[key] || !statSheetShows) flag('stat', 'never-shown', key, 'no label on the Keeper Stats sheet');
}
// Allocated stats (Forge Power, Luck, …): model fn → service getter → consumer.
{
  const model = read('shared/rpg/player-stats.model.ts');
  const service = read('shared/rpg/player-stats.service.ts');
  const fnOf = {};
  for (const chunk of model.split('export function ').slice(1)) {
    const m = /^(\w+)\(stats: PlayerStats\)[\s\S]*?STAT_BY_ID\.get\('(\w+)'\)/.exec(chunk);
    if (m) fnOf[m[2]] = m[1];
  }
  for (const s of STAT_DEFINITIONS) {
    node('stat', s.id, s.name);
    const fn = fnOf[s.id];
    const getter = fn && (new RegExp(`get (\\w+)\\(\\)[^{]*\\{ return ${fn}\\(`).exec(service) || [])[1];
    const consumers = getter ? readersOf(new RegExp(`\\bstats\\.${getter}\\b`)).filter(f => !/player-stats/.test(f)) : [];
    if (!consumers.length) flag('stat', 'never-read', s.id, `allocated stat; ${getter ? `getter ${getter}` : 'no getter'} has no consumer`);
    if (!s.name || !s.format) flag('stat', 'never-shown', s.id, 'no name/format');
  }
}

// Terrain nodes (Delve blocks) ──────────────────────────────────────────────
// Roles that are not a yield, a block or a placeable but are still a purpose.
const STRUCTURAL = { air: 'open space', bedrock: 'world boundary', 'cracked-wall': 'staff-only gate', inscription: 'Archivist inscription', 'rift-shrine': 'shows the tunnels round it on the map (rift shrine)',
  // The Underhearth (Phase 8): set pieces with a role, not a yield.
  'hearth-seal': 'the Banked seal: the one way down to the Underhearth (Pickaxe IV, Delving 15, The Fracture claimed)',
  'hearth-brick': 'the Four\'s masonry: the Furnace Hall\'s floor and the Banked Furnace\'s body (world boundary)',
  'furnace-vent': 'the Banked Furnace\'s vents: douse them with water to open its core',
  'furnace-hearth': 'the Banked Furnace\'s hearth: the Four Hammer-Marks wake it there',
  'hammer-mark': 'the Four\'s hammer-marks: a rubbing for Kael\'s "Four Hammers"',
  'old-rail': 'Kael\'s old rail: the Seam Cart rides it',
  'fracture-seam': 'the fracture\'s own line through the rock: lights the Underhearth (lore)' };
const laidOut = new Set();
for (const town of Object.values(TOWNS)) for (const a of [town, ...town.hunts]) {
  const t = a.terrain; if (!t) continue;
  for (const x of [...t.bands, ...t.veins, ...t.stamps, ...(t.biomes || []).flatMap(b => b.veins || [])]) laidOut.add(x.node);
  for (const b of t.biomes || []) if (b.loose) laidOut.add(b.loose.node);
  // Inscriptions are carved into always-air cells from the lore table, not the layout.
  if (DELVE_INSCRIPTIONS.length) laidOut.add('inscription');
}
for (const id of SECTOR_NODES || []) laidOut.add(id);
const placedNodes = new Set(PLACEABLES.map(p => p.node));
for (const n of TERRAIN_NODE_LIST) {
  const g = node('block', n.id, n.label);
  if (laidOut.has(n.id)) g.sources.add('Delve layout');
  if (placedNodes.has(n.id)) g.sources.add('placed by the Keeper');
  // Obsidian is made, not laid out: water meets lava (play/engine/liquids.ts `react`, a bucket's `pour`).
  if (n.id === 'obsidian' && /OBSIDIAN = nodeIndex\('obsidian'\)/.test(read('play/engine/liquids.ts'))) g.sources.add('water meets lava (liquids)');
  if (n.yield) g.uses.add(`yields ${n.yield.materialId}`);
  if (n.block) g.uses.add(`gives ${n.block}`);
  if (n.placeable) g.uses.add(`placeable ${n.placeable}`);
  if (STRUCTURAL[n.id]) g.uses.add(STRUCTURAL[n.id]);
  if (!g.sources.size) flag('block', 'never-generated', n.id, 'not in any Delve layout and not placeable');
  if (!g.uses.size) flag('block', 'no-yield-or-purpose', n.id, `breaking it gives nothing${n.xp ? ` but ${n.xp} XP` : ''}`);
}

// Creatures ─────────────────────────────────────────────────────────────────
const spawned = new Map();
for (const town of Object.values(TOWNS)) for (const a of [town, ...town.hunts]) for (const m of a.monsters) {
  const table = m.drops || a.drops;
  const mats = table.entries.filter(e => e.kind === 'material').map(e => e.material);
  const prev = spawned.get(m.creature) || { name: m.name, areas: [], mats: new Set(), own: false };
  prev.areas.push(a.name); mats.forEach(x => prev.mats.add(x)); prev.own = prev.own || !!m.drops;
  spawned.set(m.creature, prev);
}
for (const [id, c] of spawned) {
  const n = node('creature', id, c.name);
  n.sources.add(`spawns in ${c.areas.join(', ')}`);
  if (c.mats.size) n.uses.add(`drops ${[...c.mats].join(', ')}`);
  if (!c.mats.size) flag('creature', 'no-drops', id, 'drops coins only');
  if (!I18N_KEYS.has(`play.creature.${id}`)) flag('creature', 'not-visible', id, 'no play.creature name key');
  if (!BESTIARY_IDS.includes(id)) flag('creature', 'no-lore', id, 'no Codex Bestiary entry');
}
for (const id of BESTIARY_IDS) if (!spawned.has(id)) {
  node('creature', id);
  flag('creature', 'never-spawns', id, 'in the Bestiary, absent from every area');
}

// NPCs ──────────────────────────────────────────────────────────────────────
const giverIds = new Set([...Object.keys(NPC_CHAINS).filter(id => NPC_CHAINS[id].length), ...DELVE_MISSIONS.map(m => m.npcId)]);
const dialogueNpcs = new Set(DIALOGUE.map(d => d.npcId));
const keeperNpcs = new Set();
for (const [townId, keepers] of Object.entries(TOWN_KEEPERS)) {
  const town = TOWNS[townId];
  for (const k of keepers) {
    if (k.npc) keeperNpcs.add(k.npc);
    const st = town && town.stations.find(s => s.id === k.station);
    const n = node('npc', `keeper:${townId}/${k.id}`, k.name);
    if (st && (st.kind === 'panel' || st.kind === 'waystone')) n.uses.add(`opens ${st.panel || st.kind}`);
    // A keeper at a passage shows the way through it (a click on them takes it).
    if (st && st.kind === 'passage' && st.to) n.uses.add(`shows the way to ${st.to}`);
    // Every keeper is a person in the Codex's People of the Realms (codex-people.component.ts).
    if (!['where', 'who', 'teaches'].every(f => I18N_KEYS.has(`codex.people.${f}.${k.id}`))) flag('npc', 'not-visible', `keeper:${townId}/${k.id}`, 'no People of the Realms entry (codex/people.i18n.ts)');
    if (k.titleKey && !I18N_KEYS.has(k.titleKey)) flag('npc', 'not-visible', `keeper:${townId}/${k.id}`, `missing ${k.titleKey}`);
    for (const id of k.serves || []) { const also = town && town.stations.find(s => s.id === id); if (also && also.panel) n.uses.add(`opens ${also.panel}`); }
    if (k.npc && giverIds.has(k.npc)) n.uses.add('gives quests');
    if (!n.uses.size) flag('npc', 'no-role', `keeper:${townId}/${k.id}`, st ? `stands at ${st.kind} "${st.id}", which opens nothing` : `station "${k.station}" does not exist`);
    if (!k.lines || !k.lines.length) flag('npc', 'no-lines', `keeper:${townId}/${k.id}`, 'says nothing');
    if (k.nameKey && !I18N_KEYS.has(k.nameKey)) flag('npc', 'not-visible', `keeper:${townId}/${k.id}`, `missing ${k.nameKey}`);
  }
}
for (const npc of NPCS) {
  const n = node('npc', npc.id, npc.name);
  if (keeperNpcs.has(npc.id)) n.uses.add('stands at a station');
  if (giverIds.has(npc.id)) n.uses.add('gives quests');
  // A companion travels with the Keeper: its role counts only when the play view wires it.
  if (npc.companion && SOURCES.some(s => s.rel.startsWith(`play${path.sep}`) && s.text.includes(`npcById('${npc.id}')`))) n.uses.add(`companion: ${npc.companion}`);
  if (!n.uses.size) flag('npc', 'no-role', npc.id, npc.companion ? 'companion the play view never shows' : 'canon NPC with no station and no quest in the world');
  if (!dialogueNpcs.has(npc.id)) flag('npc', 'no-lines', npc.id, 'no DIALOGUE');
}
for (const [realm, count] of Object.entries(TOWNSFOLK_COUNT)) {
  if (!count) continue;
  const n = node('npc', `townsfolk:${realm}`);
  const lines = townsfolkLines && TOWNS[realm] ? townsfolkLines(TOWNS[realm]) : [];
  if (lines.length) n.uses.add(`name where ${lines.length} local materials are found`);
  else flag('npc', 'no-role', `townsfolk:${realm}`, `${count} wanderers with no line, station or quest`);
}

// Stations + panels ─────────────────────────────────────────────────────────
const placedPanels = new Set();
const keeperStations = new Set(Object.entries(TOWN_KEEPERS).flatMap(([t, ks]) => ks.flatMap(k => [k.station, ...(k.serves || [])].map(s => `${t}/${s}`))));
for (const town of Object.values(TOWNS)) for (const a of [town, ...town.hunts]) for (const s of a.stations) {
  const id = `${a.id}/${s.id}`;
  const n = node('station', id, s.label);
  if (s.panel) { placedPanels.add(s.panel); if (!PANEL_REGISTRY[s.panel]) flag('station', 'no-use', id, `panel ${s.panel} has no loader`); }
  if (!s.blurb) flag('station', 'not-visible', id, 'no blurb for the Places list');
  if (a === town && s.kind === 'panel' && a.id !== 'homestead' && !keeperStations.has(`${town.id}/${s.id}`)) flag('station', 'no-keeper', id, 'panel station with nobody behind it');
}
// Panels a HUD control opens rather than a station: 'character' is the
// Places/☰ menu's "Character & stats" (SideScrollerComponent.openCharacter).
for (const p of ['character']) placedPanels.add(p);
for (const p of PANEL_IDS) if (!placedPanels.has(p)) { node('station', `panel:${p}`); flag('station', 'never-placed', `panel:${p}`, 'a panel no station opens'); }

// ── Canon (informational) ──────────────────────────────────────────────────
const info = [];
if (fs.existsSync(CANON_DIR)) {
  const canon = fs.readdirSync(CANON_DIR).filter(f => f.endsWith('.md')).map(f => fs.readFileSync(path.join(CANON_DIR, f), 'utf8')).join('\n').toLowerCase();
  const inCanon = name => canon.includes(name.toLowerCase());
  for (const [id, c] of spawned) if (!inCanon(c.name)) info.push(`creature ${id} ("${c.name}") is not named in canon`);
  for (const r of RUNES) if (!new RegExp(`\\*\\*${r.name.toLowerCase()}:\\*\\*`).test(canon)) info.push(`rune ${r.id} is not in the canon rune table`);
  for (const id of Object.keys(DELVE_MATERIAL_NAMES)) if (!inCanon(DELVE_MATERIAL_NAMES[id])) info.push(`material ${id} ("${DELVE_MATERIAL_NAMES[id]}") is not named in canon`);
} else {
  info.push(`canon folder not found (${CANON_DIR}); canon ties not checked`);
}

// ── Report ─────────────────────────────────────────────────────────────────
const keyOf = v => `${v.cat}:${v.kind}:${v.id}`;
const args = process.argv.slice(2);
if (args.includes('--explain')) {
  // node scripts/check-meaning.js --explain cinder-ore  → its sources and uses
  const id = args[args.indexOf('--explain') + 1];
  for (const n of graph.values()) if (n.id === id) {
    console.log(`${n.cat} ${n.id} (${n.name})\n  sources: ${[...n.sources].join('; ') || '—'}\n  uses:    ${[...n.uses].join('; ') || '—'}\n  sells:   ${[...new Set([...n.sells, ...n.market])].join('; ') || '—'}\n  lore: ${n.lore}  visible: ${n.visible}${n.notes.length ? `\n  notes: ${n.notes.join('; ')}` : ''}`);
  }
  process.exit(0);
}
if (args.includes('--json')) {
  console.log(JSON.stringify({ violations, info, stats: { KEEPER_READS, ANY_READS } }, null, 2));
  process.exit(0);
}
const CATS = ['block', 'material', 'npc', 'stat', 'rune', 'item', 'creature', 'station'];
const counts = {};
for (const v of violations) (counts[v.cat] ??= {})[v.kind] = (counts[v.cat][v.kind] || 0) + 1;
const totals = Object.fromEntries(CATS.map(c => [c, [...graph.values()].filter(n => n.cat === c).length]));

console.log('World meaning — every thing needs a source, a use, lore and a place the player sees it.\n');
console.log(`${'category'.padEnd(10)}${'things'.padStart(7)}  violations`);
for (const c of CATS) {
  const row = counts[c] ? Object.entries(counts[c]).map(([k, n]) => `${k} ${n}`).join(', ') : '—';
  console.log(`${c.padEnd(10)}${String(totals[c]).padStart(7)}  ${row}`);
}
console.log(`\nTotal: ${violations.length} violations.\n`);
for (const c of CATS) {
  const rows = violations.filter(v => v.cat === c);
  if (!rows.length) continue;
  console.log(`── ${c} ──`);
  for (const v of rows.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id))) {
    console.log(`  ${v.kind.padEnd(20)} ${v.id.padEnd(32)} ${v.detail}`);
  }
}
if (info.length) {
  console.log('\nCanon (info only, never gates):');
  for (const line of info) console.log(`  ${line}`);
}

const current = [...new Set(violations.map(keyOf))].sort();
if (args.includes('--update-baseline')) {
  fs.writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`\nBaseline written: ${current.length} accepted violations.`);
  process.exit(0);
}
const baseline = new Set(fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : []);
const fresh = current.filter(k => !baseline.has(k));
const fixed = [...baseline].filter(k => !current.includes(k));
if (fixed.length) {
  console.log(`\nFixed since the baseline — remove from scripts/meaning-baseline.json (or run --update-baseline):`);
  for (const k of fixed) console.log(`  ${k}`);
}
if (fresh.length) {
  console.error(`\nERROR: ${fresh.length} new violation(s) beyond the baseline:`);
  for (const k of fresh) console.error(`  ${k}`);
  console.error('Give it a source, a use, lore and a visible line — or remove it. See docs/world/meaning-audit.md.');
  process.exit(1);
}
console.log(`\nNo new violations (${current.length} in the baseline). ✓`);
