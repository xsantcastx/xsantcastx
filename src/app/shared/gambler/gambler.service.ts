/**
 * gambler.service.ts — the till, the counter, and the one place a box is opened.
 *
 * `mystery-box.ts` decides *what* a box pays out and stays pure. This is the
 * half that touches the world: it debits Gold, mints the item, hands it to
 * `InventoryService` (still the only writer of instances), advances the pity
 * counter and persists it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE ORDER OF OPERATIONS, WHICH IS THE WHOLE FILE
 * ─────────────────────────────────────────────────────────────────────────────
 * An open touches three ledgers that can each fail independently, and every
 * ordering except one has a way of costing the player something:
 *
 *   1. Check the bag has room *first*. Debiting Gold and then discovering the
 *      bag is full at 250 rows would take the money and hand back nothing.
 *   2. Roll before debiting. The roll is pure and cannot fail, but a catalogue
 *      error returns null, and finding that out after the debit is the same bug
 *      as (1).
 *   3. Debit Gold. If this fails the player could not afford it and nothing
 *      else has happened yet.
 *   4. Mint and add. If the add is refused after the debit — which needs the
 *      bag to fill between steps 1 and 4, so effectively never — the Gold is
 *      refunded rather than swallowed. A refund is the correct answer even
 *      when the race is impossible, because the alternative is a silent theft
 *      that nobody can reproduce.
 *   5. Advance pity last. Pity is a *consolation*, so it must only move for an
 *      open the player actually received.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS NO MUTATION ID
 * ─────────────────────────────────────────────────────────────────────────────
 * Temper and reforge both take one, because both are idempotent operations on
 * an object that already exists and a double-submit has to resolve to one
 * result. An open is not idempotent by nature — the second open is a second
 * item, which is what the player is paying for. Replay protection here would
 * mean a fast double-click silently eats the second purchase. The guard is that
 * `spendGold` is synchronous and flushes before this method returns, so a second
 * click is a second, fully-paid open.
 *
 * Browser-only. Every method no-ops on the SSR path, the same as its neighbours.
 */
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Subject, type Observable } from 'rxjs';

import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { mintEquipment } from '../rpg/item-definition';
import { qualityOf, qualityTagOf, type QualityTag } from '../rpg/item-quality';
import { uniqueById, type UniqueItem } from '../rpg/unique-items';
import type { GameItem } from '../rpg/item.model';
import {
  MYSTERY_BOXES,
  advancePity,
  boxById,
  pityArmed,
  pityFor,
  pityRemaining,
  rollBox,
  type MysteryBox,
  type PityState,
} from './mystery-box';

export const GAMBLER_KEY = 'godforge-gambler';
const SCHEMA_VERSION = 1;

interface GamblerRecord {
  version: number;
  /** Consecutive floor results, per box id. See mystery-box.ts. */
  pity: Record<string, number>;
  /** Lifetime opens, per box id. Shown on the shelf; never gates anything. */
  opened: Record<string, number>;
  /** Lifetime Gold spent at the shelf. The honest number, for the header. */
  spent: number;
  /** Named objects found here. Separate from the Collection Log's count. */
  uniques: number;
}

function emptyRecord(): GamblerRecord {
  return { version: SCHEMA_VERSION, pity: {}, opened: {}, spent: 0, uniques: 0 };
}

export interface OpenedBox {
  box: MysteryBox;
  item: GameItem;
  /** The named object, when the box paid one out. */
  unique: UniqueItem | null;
  /** Average roll grade, 0..1, or null on an ungraded mint. */
  quality: number | null;
  tag: QualityTag;
  /** True when bad luck protection, not the weights, set the rarity. */
  pityApplied: boolean;
}

export type OpenFailure = 'ssr' | 'unknown-box' | 'bag-full' | 'catalogue' | 'funds' | 'mint';

export interface GamblerSnapshot {
  spent: number;
  uniques: number;
  opened: Record<string, number>;
  pity: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class GamblerService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly economy = inject(EconomyService);
  private readonly inventory = inject(InventoryService);
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);

  private record: GamblerRecord = emptyRecord();
  private loaded = false;

  private readonly snapshot$$ = new BehaviorSubject<GamblerSnapshot>({
    spent: 0, uniques: 0, opened: {}, pity: {},
  });
  private readonly opened$$ = new Subject<OpenedBox>();

  /** Counters, replayed to late subscribers. */
  readonly snapshot$: Observable<GamblerSnapshot> = this.snapshot$$.asObservable();
  /** One event per successful open. Not replayed — it drives the animation. */
  readonly opened$: Observable<OpenedBox> = this.opened$$.asObservable();

  get snapshot(): GamblerSnapshot { return this.snapshot$$.value; }

  readonly boxes = MYSTERY_BOXES;

  /**
   * Read the record and publish it once.
   *
   * `load()` is lazy and every *reader* calls it, so `pityLeft` and
   * `openedCount` were always right. `snapshot$` was not: it is a
   * `BehaviorSubject` seeded with zeros, and nothing published into it until the
   * first `open()` — so a player who reloaded the page saw "0 spent here" over a
   * record that said a hundred thousand, until they bought another box.
   *
   * Idempotent, and called from the component's `ngOnInit` the same way
   * `EconomyService.init` and `InventoryService.init` are.
   */
  init(): void {
    if (!this.isBrowser) return;
    this.load();
    this.publish();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Reads
  // ───────────────────────────────────────────────────────────────────────────

  canAfford(box: MysteryBox): boolean {
    return this.economy.snapshot.gold >= box.cost;
  }

  /** Floor results in a row on this box. */
  pityCount(boxId: string): number {
    return pityFor(this.load().pity, boxId);
  }

  /** Floor results still to come before the guarantee fires. */
  pityLeft(boxId: string): number {
    return pityRemaining(this.load().pity, boxId);
  }

  /** True when the next open on this box cannot land on its worst rarity. */
  guaranteed(boxId: string): boolean {
    return pityArmed(this.load().pity, boxId);
  }

  openedCount(boxId: string): number {
    const n = this.load().opened[boxId];
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // The open
  // ───────────────────────────────────────────────────────────────────────────

  /** Buy and open one box. See the header for why the steps are in this order. */
  open(
    boxId: string,
    rng: () => number = Math.random,
  ): { ok: true; result: OpenedBox } | { ok: false; code: OpenFailure } {
    if (!this.isBrowser) return { ok: false, code: 'ssr' };

    const box = boxById(boxId);
    if (!box) return { ok: false, code: 'unknown-box' };
    if (!this.inventory.canAcceptInstance()) return { ok: false, code: 'bag-full' };

    const record = this.load();
    const rolled = rollBox(box, record.pity, rng);
    if (!rolled) return { ok: false, code: 'catalogue' };

    if (!this.economy.spendGold(box.cost, 'mystery-box')) return { ok: false, code: 'funds' };

    const minted = mintEquipment(rolled.definitionId, rolled.rarity, rng);
    if (!minted) {
      this.economy.earnGold(box.cost, 'mystery-box-refund');
      return { ok: false, code: 'mint' };
    }
    const stored = this.inventory.add(minted);
    if (!stored) {
      // Only reachable if the bag filled between the check above and here.
      // Refunding is the right answer anyway — see the header.
      this.economy.earnGold(box.cost, 'mystery-box-refund');
      return { ok: false, code: 'mint' };
    }

    const unique = rolled.unique ? uniqueById(rolled.definitionId) ?? null : null;
    this.record = {
      ...record,
      pity: { ...advancePity(record.pity, box, rolled.rarity) },
      opened: { ...record.opened, [box.id]: this.openedCount(box.id) + 1 },
      spent: record.spent + box.cost,
      uniques: record.uniques + (unique ? 1 : 0),
    };
    this.persist();

    const result: OpenedBox = {
      box,
      item: stored,
      unique,
      quality: qualityOf(stored),
      tag: qualityTagOf(stored),
      pityApplied: rolled.pityApplied,
    };
    this.publish();
    this.opened$$.next(result);
    return { ok: true, result };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Storage
  // ───────────────────────────────────────────────────────────────────────────

  private load(): GamblerRecord {
    if (this.loaded) return this.record;
    this.loaded = true;
    if (!this.isBrowser) return this.record;

    // Registered on first read rather than in an `init()`, matching ComboService:
    // this is the moment the cached copy starts existing, so it is the moment a
    // cloud pull needs to be able to invalidate it.
    this.saves.register(GAMBLER_KEY, {
      rehydrate: () => {
        this.loaded = false;
        this.load();
        this.publish();
      },
    });

    try {
      const raw = this.store.readRaw(GAMBLER_KEY);
      if (!raw) return this.record;
      const parsed = JSON.parse(raw) as Partial<GamblerRecord>;
      this.record = {
        version: SCHEMA_VERSION,
        pity: countMap(parsed.pity),
        opened: countMap(parsed.opened),
        spent: whole(parsed.spent),
        uniques: whole(parsed.uniques),
      };
    } catch {
      this.record = emptyRecord();
    }
    return this.record;
  }

  private persist(): void {
    this.store.write(GAMBLER_KEY, this.record);
  }

  private publish(): void {
    const record = this.load();
    this.snapshot$$.next({
      spent: record.spent,
      uniques: record.uniques,
      opened: { ...record.opened },
      pity: { ...record.pity },
    });
  }

  /** Wipe the counters. Exposed alongside the other resets. */
  reset(): void {
    if (!this.isBrowser) return;
    this.record = emptyRecord();
    this.loaded = true;
    this.store.remove(GAMBLER_KEY);
    this.publish();
  }
}

/**
 * Read a persisted `{ id: count }` map, dropping anything that is not a count.
 *
 * Clamped on read as well as on write: a hand-edited blob should not be able to
 * arm bad luck protection on a box the player has never opened.
 */
function countMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    out[key] = Math.max(0, Math.floor(value));
  }
  return out;
}

function whole(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}
