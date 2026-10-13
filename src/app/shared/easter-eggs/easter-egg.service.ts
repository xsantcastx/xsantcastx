import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { CACHE_TTL, FirestoreCacheService } from '../firestore-cache.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { BehaviorSubject } from 'rxjs';

export interface EasterEgg {
  id: string;
  name: string;
  description: string;
  tool?: string;        // tool slug or 'global' for site-wide
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;         // emoji
  /**
   * Overrides the standard easter-egg XP award for this one egg. Left unset on
   * every egg that is genuinely hidden; used for the handful that are simply
   * *noticed* rather than hunted, which should not pay the same as a hunt.
   */
  xp?: number;
}

export interface EggDiscovery {
  egg: EasterEgg;
  isNew: boolean;
  totalFound: number;
  totalEggs: number;
}

/** Master registry of all easter eggs */
export const EASTER_EGGS: EasterEgg[] = [
  // ── Global ──────────────────────────────────────────────────────
  { id: 'konami',          name: 'Old School',           description: 'Entered the Konami Code',                          tool: 'global',  rarity: 'rare',      icon: '🕹️' },
  { id: 'night-owl',       name: 'Night Owl',            description: 'Used the site between 2am and 5am',                tool: 'global',  rarity: 'common',    icon: '🦉' },
  { id: 'speed-demon',     name: 'Speed Demon',          description: 'Visited five different halls in under 60 seconds',  tool: 'global',  rarity: 'rare',      icon: '⚡' },
  { id: 'explorer',        name: 'Explorer',             description: 'Walked every hall on the World door',              tool: 'global',  rarity: 'common',    icon: '🧭' },

  // ── The six chains ──────────────────────────────────────────────
  // One per NPC, banked by NpcQuestService when the last step of that
  // character's chain is claimed. Registered here rather than kept private to
  // the NPC feature so they inherit the rarity drop, the XP payout, the
  // discovery date and the Codex card like every other achievement — a wall
  // that showed twenty-nine of thirty-five discoveries because six lived
  // somewhere else would be the wrong kind of secret.
  { id: 'npc-aureth-chain',    name: 'Champion of Light',    description: "Finished Aureth's chain, to the end of the Eclipse", tool: 'global', rarity: 'legendary', icon: '\u2600\ufe0f' },
  { id: 'npc-verrin-chain',    name: 'The Hollow',           description: "Finished Verrin's chain, to the last silence",      tool: 'global', rarity: 'legendary', icon: '\ud83c\udf11' },
  { id: 'npc-kael-chain',      name: 'Forgeborn',            description: "Finished Kael's chain, and heard about the eye",    tool: 'global', rarity: 'legendary', icon: '\ud83d\udd25' },
  { id: 'npc-archivist-chain', name: 'Keeper of Fragments',  description: "Finished the Archivist's chain",                    tool: 'global', rarity: 'legendary', icon: '\ud83d\udcdc' },
  { id: 'npc-merchant-chain',  name: 'Technically Family',   description: "Finished the Merchant's chain",                     tool: 'global', rarity: 'legendary', icon: '\ud83d\udcb0' },
  { id: 'npc-nameless-chain',  name: 'It Remembers',         description: 'Answered the Nameless three times',                 tool: 'global', rarity: 'legendary', icon: '\u2049\ufe0f' },

  // ── Batch 10: the Codex ────────────────────────────────────
  // Awarded for opening /codex. It is not hidden — it is on the nav — so it
  // pays 25 rather than the standard 200: finding the record of every secret is
  // the start of the hunt, not a result of one.
  { id: 'codex-archivist',    name: 'The Archivist',        description: 'Opened the Codex for the first time',                 tool: 'global',                    rarity: 'rare',      icon: '📜', xp: 25 },
  { id: 'trials-first',       name: 'The Proving Ground',   description: 'Stood before the Arena gates',                        tool: 'global',                    rarity: 'common',    icon: '⚔️', xp: 25 },

  // ── Batch 11: the Ambient Forge ────────────────────────────
  // Earned by presence rather than by hunting, so every one of them carries an
  // explicit `xp` well under the standard 200. Paying a hunt's price for
  // sitting still would quietly out-earn the quests these are meant to sit
  // alongside — a capped day of idling is worth ~60 XP, and a single 200 XP
  // drop for reaching it would be three days' allowance in one moment.
  { id: 'idle-patient-one',      name: 'The Patient One',        description: 'Earned 100 XP from ambient forge energy',              tool: 'global', rarity: 'rare',      icon: '🕯️', xp: 40 },
  { id: 'idle-forge-meditation', name: 'Forge Meditation',       description: 'Kept the forge in sight for thirty unbroken minutes',  tool: 'global', rarity: 'epic',      icon: '🧘', xp: 60 },
  { id: 'idle-vigil',            name: 'The Vigil',              description: 'Earned 500 XP from ambient forge energy',              tool: 'global', rarity: 'epic',      icon: '🌙', xp: 80 },
  { id: 'idle-eternal-flame',    name: 'Eternal Flame',          description: 'Earned 2000 XP from ambient forge energy',             tool: 'global', rarity: 'legendary', icon: '🔥', xp: 150 },
  { id: 'idle-never-sleeps',     name: 'The Godforge Never Sleeps', description: 'Had the forge open as the date rolled over',        tool: 'global', rarity: 'rare',      icon: '🌌', xp: 50 },
  { id: 'idle-forge-striker',    name: 'Forge Striker',          description: 'Struck the forge one thousand times',                  tool: 'global', rarity: 'epic',      icon: '🔨', xp: 80 },
  { id: 'idle-obsidian-hammer',  name: 'Obsidian Hammer',        description: 'Struck the forge ten thousand times',                  tool: 'global', rarity: 'legendary', icon: '⚒️', xp: 200 },

  // ── Batch 12: the Godforge Market ──────────────────────────
  // Six awarded by the ledger rather than by an input into a tool. They pay
  // below the standard 200 for the same reason The Archivist does: the Market
  // is linked from the header and the Forge Flame is on every page, so these
  // are the record of a habit rather than the result of a hunt.
  //
  // There is no strike-count achievement here. 'idle-forge-striker' and
  // 'idle-obsidian-hammer' above already pay at a thousand and ten thousand,
  // and the Market's flame drives that same counter — a second pair keyed on
  // the same act would put two cards on the wall for one thing and let a
  // visitor bank both for a single swing.
  { id: 'forge-first-purchase',      name: 'First Purchase',          description: 'Bought anything at all in the Godforge Market',       tool: 'global', rarity: 'common', icon: '🪙',  xp: 25 },
  { id: 'forge-investor',            name: 'Forge Investor',          description: 'Owned five upgrades across the two ladders',          tool: 'global', rarity: 'rare',   icon: '📈', xp: 50 },
  { id: 'forge-market-mogul',        name: 'Market Mogul',            description: 'Owned fifteen upgrades across the two ladders',       tool: 'global', rarity: 'epic',   icon: '🏦', xp: 100 },
  { id: 'forge-artifact-collector',  name: 'Artifact Collector',      description: 'Held three of the five artifacts at once',            tool: 'global', rarity: 'legendary', icon: '💠', xp: 200 },
  { id: 'forge-complete-collection', name: 'The Complete Collection', description: 'Held every artifact the Market will ever sell',       tool: 'global', rarity: 'legendary', icon: '👑', xp: 500 },
  { id: 'forge-click-frenzy',        name: 'Click Frenzy',            description: 'Struck the Forge Flame 100 times inside one minute',  tool: 'global', rarity: 'epic',   icon: '🌀', xp: 100 },

  // ── The Rune Forge ──────────────────────────────────────────────
  // Eight, and the shape of the ladder is the drop table's. The three
  // collection rungs are priced off how many strikes they actually take at the
  // published rates rather than off how they read: ten uniques is most of one
  // sitting, twenty is a long week, and all twenty-five needs the 0.05% rune,
  // which is why it and 'rune-void-voice' are the only two filed Mythic.
  //
  // 'rune-breath-of-void' carries no `xp` override and no explicit tier here
  // because it is not authored as Singular — Singular is earned at runtime when
  // the global discovery count comes back exactly 1, and this is the one
  // achievement on the wall genuinely capable of returning that.
  { id: 'rune-first',                name: 'First Rune',              description: 'Took the first rune off the anvil',                   tool: 'global', rarity: 'common', icon: '🪨', xp: 25 },
  { id: 'rune-collector',            name: 'Rune Collector',          description: 'Found ten of the twenty-five runes',                  tool: 'global', rarity: 'rare',   icon: '🗿', xp: 75 },
  { id: 'rune-master',               name: 'Rune Master',             description: 'Found twenty of the twenty-five runes',               tool: 'global', rarity: 'epic',   icon: '⛰️', xp: 250 },
  { id: 'rune-complete-set',         name: 'The Complete Set',        description: 'Found all twenty-five runes, Void included',          tool: 'global', rarity: 'legendary', icon: '🌑', xp: 1000 },
  { id: 'rune-first-word',           name: 'First Runeword',          description: 'Set runes into a word and made it hold',              tool: 'global', rarity: 'epic',   icon: '📜', xp: 150 },
  { id: 'rune-word-scholar',         name: 'Runeword Scholar',        description: 'Completed three Runewords',                           tool: 'global', rarity: 'legendary', icon: '📖', xp: 400 },
  { id: 'rune-void-voice',           name: 'Voice of the Void',       description: 'The Void rune fell. It falls once in two thousand.',  tool: 'global', rarity: 'legendary', icon: '👁️', xp: 2000 },
  { id: 'rune-breath-of-void',       name: 'Breath of the Void',      description: 'Completed the last Runeword in the Archivum',         tool: 'global', rarity: 'legendary', icon: '🕳️', xp: 5000 },

  // ── Lore Scrolls ────────────────────────────────────────────────
  // Two, not eight. The scrolls already pay out as they are found — every one
  // is a page of the codex that was not readable before — so the wall only
  // needs to mark the two thresholds a collector actually aims at. A rung at
  // one, five, fifteen and twenty as well would be four more cards for the same
  // act, which is the mistake the strike-count note above records not making.
  { id: 'scroll-lore-hunter',        name: 'Lore Hunter',             description: 'Turned up ten of the twenty-five Lore Scrolls',       tool: 'global', rarity: 'epic',   icon: '📜', xp: 300 },
  { id: 'scroll-full-codex',         name: 'The Full Codex',          description: 'Every scroll, including the page that is blank',      tool: 'global', rarity: 'legendary', icon: '📖', xp: 2500 },

  // ── The character sheet ─────────────────────────────────────────
  // Paid at 25 like The Archivist, and for the same reason: this one is
  // *noticed* rather than hunted, and a page you can reach from the navbar
  // should not pay what a four-leading-zero hash pays.
  { id: 'forge-self-aware',          name: 'Self-Aware',              description: 'Opened your own Forge for the first time',            tool: 'global', rarity: 'rare',   icon: '🪞', xp: 25 },

  // ── Cloud save ──────────────────────────────────────────────────
  // Bound the forge to an account, so the save outlives the browser it was made
  // in. Announced rather than hidden — the button says exactly what it does —
  // so it pays 50 rather than a hunt's 200, above Self-Aware and The Archivist
  // because opening a page is a click and this is a decision. The tier is
  // Eclipsed rather than Mortal for the same reason: most visitors will use
  // every tool on the site and never make it.
  { id: 'cloud-eternal-archive',     name: 'The Eternal Archive',     description: 'Bound your progress to the cloud',                    tool: 'global', rarity: 'rare',   icon: '☁️', xp: 50 },

  // ── The combo ladder ────────────────────────────────────────────
  // Consecutive paid strikes on the Forge Flame. The 500ms cooldown caps the
  // rate at two a second, so these are the only achievements on the wall priced
  // in *time held* rather than in a thing done: x9,999 is 83 minutes of unbroken
  // rhythm, and a single gap over two seconds puts it back to zero.
  //
  // The payouts climb steeply because the difficulty does. x10 is an accident on
  // the way to somewhere else; x5,000 is forty minutes of not stopping. Every
  // one carries an explicit `xp` — the standard 200 would be robbery at the
  // bottom of the ladder and an insult at the top.
  { id: 'combo-rapid-strike',        name: 'Rapid Strike',            description: 'Reached a x10 strike combo',                          tool: 'global', rarity: 'common',    icon: '⚡',  xp: 25 },
  { id: 'combo-forge-frenzy',        name: 'Forge Frenzy',            description: 'Reached a x50 strike combo',                          tool: 'global', rarity: 'rare',      icon: '🔥',  xp: 60 },
  { id: 'combo-century-forge',       name: 'Century Forge',           description: 'Reached a x100 strike combo',                         tool: 'global', rarity: 'epic',      icon: '💯',  xp: 120 },
  // 666 is passed through on the way to a thousand rather than climbed to, so
  // it pays less than the rung below it despite the rarer tier. It is a thing
  // you find, not a thing you hold.
  { id: 'combo-forbidden-count',     name: 'The Forbidden Count',     description: 'Struck the number that must not be named',            tool: 'global', rarity: 'legendary', icon: '🜏',  xp: 100 },
  { id: 'combo-relentless',          name: 'The Relentless',          description: 'Reached a x500 strike combo',                         tool: 'global', rarity: 'epic',      icon: '⛓️',  xp: 200 },
  { id: 'combo-millennium-strike',   name: 'Millennium Strike',       description: 'Reached a x1,000 strike combo',                       tool: 'global', rarity: 'legendary', icon: '🌩️', xp: 350 },
  { id: 'combo-eclipse-breaker',     name: 'Eclipse Breaker',         description: 'Reached a x5,000 strike combo',                       tool: 'global', rarity: 'legendary', icon: '🌘',  xp: 700 },
  { id: 'combo-first-sun',           name: 'First Sun Shatter',       description: 'Reached the maximum x9,999 strike combo',             tool: 'global', rarity: 'legendary', icon: '☀️',  xp: 1_500 },
];

/**
 * Eggs the public Codex and chrome counts are allowed to show.
 *
 * Every registered egg is global now — the 135 tool-page eggs went with the
 * tools site (2026-10-13). The filter stays as the guard: an egg with a
 * non-global `tool` would be a leftover, not a public achievement.
 */
export function isPublicCodexEgg(egg: EasterEgg): boolean {
  return !egg.tool || egg.tool === 'global';
}

export const PUBLIC_CODEX_EGGS: EasterEgg[] = EASTER_EGGS.filter(isPublicCodexEgg);

/** localStorage key holding the array of discovered egg ids. */
export const EGGS_FOUND_KEY = 'easter-eggs-found';
/**
 * localStorage key holding `{ eggId: ISO timestamp }`.
 *
 * A second key rather than a richer value under the first: the found-ids array
 * has been written by every build since the egg system shipped, and changing its
 * shape would strand everyone's existing discoveries behind a migration. Eggs
 * found before this key existed simply have no date, which the Codex renders as
 * "found before the Codex opened" rather than inventing one.
 */
export const EGGS_DATES_KEY = 'easter-eggs-dates';

@Injectable({ providedIn: 'root' })
export class EasterEggService {
  private lazyFirestore = inject(LazyFirestoreService);
  private cache = inject(FirestoreCacheService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private saves = inject(LocalSaveRegistry);
  private store = inject(GameStateGateway);
  private discovered = new Set<string>();
  private dates: Record<string, string> = {};

  discovery$ = new BehaviorSubject<EggDiscovery | null>(null);

  get totalEggs(): number { return PUBLIC_CODEX_EGGS.length; }
  get foundCount(): number {
    return PUBLIC_CODEX_EGGS.reduce((n, egg) => n + (this.discovered.has(egg.id) ? 1 : 0), 0);
  }
  /** Raw discovered ids, including any unknown ids an old save still carries. */
  get discoveredCount(): number { return this.discovered.size; }

  async init(): Promise<void> {
    if (!this.isBrowser) return;
    this.readFound();
    this.readDates();

    // Two keys, two owners. `trigger()` writes the whole discovered set from
    // memory, so discoveries merged in from another device would be dropped by
    // the next egg found on this one — and the dates blob alongside it.
    this.saves.register(EGGS_FOUND_KEY, {
      // Deliberately silent: this replaces the set with the union of both
      // devices, and announcing those would fire a drop toast per egg the other
      // device found. They are not new discoveries, they are the same ones.
      rehydrate: () => this.readFound(),
    });
    this.saves.register(EGGS_DATES_KEY, { rehydrate: () => this.readDates() });
  }

  /** Replace the discovered set from storage. */
  private readFound(): void {
    const stored = this.store.readRaw(EGGS_FOUND_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) this.discovered = new Set<string>(parsed);
    } catch { /* unparseable blob — keep what we have rather than throw on boot */ }
  }

  /** Replace the first-found dates from storage. */
  private readDates(): void {
    const dates = this.store.readRaw(EGGS_DATES_KEY);
    if (!dates) return;
    try {
      const parsed = JSON.parse(dates);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) this.dates = parsed;
    } catch { /* same */ }
  }

  isFound(id: string): boolean {
    return this.discovered.has(id);
  }

  /** ISO timestamp of first discovery, or null when unknown. */
  foundAt(id: string): string | null {
    return this.dates[id] ?? null;
  }

  /**
   * Trigger an easter egg by ID. If it's new, shows the discovery notification
   * and persists to Firestore + localStorage.
   */
  async trigger(id: string): Promise<void> {
    if (!this.isBrowser) return;

    const egg = EASTER_EGGS.find(e => e.id === id);
    if (!egg) return;

    const isNew = !this.discovered.has(id);
    this.discovered.add(id);

    // Persist locally
    try {
      this.store.write(EGGS_FOUND_KEY, [...this.discovered]);
      if (isNew) {
        this.dates = { ...this.dates, [id]: new Date().toISOString() };
        this.store.write(EGGS_DATES_KEY, this.dates);
      }
    } catch { /* quota or private mode — the drop still fires, it just won't stick */ }

    // Announce first, persist second. The global counter now travels through
    // a lazily-downloaded Firestore SDK, and the player should never wait on a
    // network chunk to see their own discovery.
    this.discovery$.next({
      egg,
      isNew,
      totalFound: this.foundCount,
      totalEggs: this.totalEggs,
    });

    if (isNew) {
      // Track in Firestore (global discovery count) — fire and forget.
      void this.lazyFirestore.get().then(handle => {
        if (!handle) return;
        const { db, api } = handle;
        return api.setDoc(
          api.doc(db, 'easter-eggs', id),
          { discoveries: api.increment(1), name: egg.name },
          { merge: true }
        );
      }).catch(() => { /* silent */ });
    }
  }

  /**
   * How many people have found this egg, site-wide.
   *
   * Cached for an hour. This is the "0.4% of visitors found this" line on a
   * discovery toast — a bragging figure, not a number anything branches on, so
   * it is not worth a document read every time an egg fires.
   */
  async getGlobalCount(id: string): Promise<number> {
    if (!this.isBrowser) return 0;
    return this.cache.through(`easter-eggs/${id}`, CACHE_TTL.counters, async () => {
      const handle = await this.lazyFirestore.get();
      if (!handle) return 0;
      const { db, api } = handle;
      const snap = await api.getDoc(api.doc(db, 'easter-eggs', id));
      return snap.exists() ? ((snap.data()['discoveries'] as number) ?? 0) : 0;
    }).catch(() => 0);
  }
}
