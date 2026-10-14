/**
 * delve-save.service.ts — owns `godforge-delve`: the player's Delve seed, the
 * cells they have dug or placed in the core, the once-per-player finds already
 * paid, and (save v2, the endless Delve) every sector they changed east and
 * west of the core. The formats and merges are in delve-save.model.ts (the
 * index and the core) and delve-region.model.ts (sectors and regions).
 *
 * It is the engine's `DelvePersistence` (structurally: `seed`, `cells`,
 * `changed`, …, and `sectors`), handed over by the play view. Digging is fast
 * — a held swing breaks a cell every half second — so changes collect in
 * memory and are written at most every DEBOUNCE_MS; the gateway then batches
 * the cloud write on its own debounce. `flush()` (registry, pagehide,
 * settleForReload) settles every pending write; `rehydrate()` cancels it and
 * re-reads, so a merged blob from cloud save is never overwritten by this tab's
 * stale copy.
 *
 * Sectors (save v2):
 *  - every region lives on this device in a RegionStore (IndexedDB, or a
 *    localStorage key when IndexedDB is missing), written on the same debounce;
 *  - the 16 regions changed most recently also ride in the cloud, one per slot
 *    blob `godforge-delve-r0..15` (SYNCED_BLOBS, `progress/delve-r<n>`), each
 *    slot written at most once per SLOT_WRITE_MS while play goes on (a flush
 *    writes them at once); a region pushed out of the slots stays on the device;
 *  - IndexedDB answers asynchronously: until it has, the sectors known are the
 *    slots'; when it answers, its copy is merged in and `reloaded$` fires so the
 *    engine rebuilds (the same path as a cloud merge);
 *  - far, unheld, unchanged sectors regrow on load (delve-region.model.ts
 *    `shouldRegrow`, "the Delve keeps what is held").
 *
 * The seed is rolled once, the first time a Delve is entered on a device with
 * no save, and written at once. Two devices that rolled before signing in are
 * reconciled by the merge (the earlier seed wins); sectors dug under the other
 * seed are never read.
 */
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Observable, Subject } from 'rxjs';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import {
  DELVE_KEY, DelveChest, DelveSave, chestKey, claimOnce, coerceDelveSave, decodeCells, decodeSeen, encodeCells, encodeSeen, newDelveSave, rollSeed,
} from './delve-save.model';
import {
  coerceRegion, decodeFog, decodeIndexSet, decodeRuns, encodeFog, encodeIndexSet, encodeRuns, mergeRegion, parseSectorKey, regionKey, regionOf,
  regrow, REGION_SLOT_KEYS, REGION_SLOTS, sectorKey, shouldRegrow, type DelveRegion, type SectorDiff,
} from './delve-region.model';
import { openRegionStore, type RegionStore } from './delve-region-store';
import type { DelveSectorStore, SectorSave } from '../../play/engine/engine.model';
import { TERRAIN_NODE_LIST } from '../../play/engine/terrain';

interface LiveArea { layout: string; cells: Map<number, number>; seen?: string; bits?: Uint8Array; wet?: string; liquids?: string }
interface LiveSector { g: number; t: number; cells: Map<number, number>; liquids: Map<number, number>; fog: Uint8Array | null; receipts: Set<number>; h?: number }
interface LiveRegion { rx: number; ry: number; t: number; sectors: Map<string, LiveSector>; slot: number; dirty: boolean; slotDirty: boolean; slotAt: number }

/** How long dug cells wait in memory before they are written. */
export const DEBOUNCE_MS = 1500;
/** A slot (cloud region document) is written at most this often while play goes on (spec §3.4). */
export const SLOT_WRITE_MS = 30_000;
/** Sector columns of the core (sector-gen.ts coreSectorCols for the 120-wide core): never regrow. */
const CORE_SECTORS = 4;
/** Nodes that are placed or made: a sector holding one never regrows. */
const PLACED = Uint8Array.from(TERRAIN_NODE_LIST, node =>
  node.placeable || ['packed-dirt', 'basalt-block', 'obsidian-block', 'obsidian'].includes(node.id) ? 1 : 0);
const ANCHOR = new Set(TERRAIN_NODE_LIST.flatMap((node, i) => node.id === 'camp' || node.id === 'chest' ? [i] : []));

@Injectable({ providedIn: 'root' })
export class DelveSaveService implements DelveSectorStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly store = inject(GameStateGateway);
  private readonly saves = inject(LocalSaveRegistry);
  private save: DelveSave | null = null;
  private hydrated = false;
  /**
   * Decoded diffs per area, the live copy `changed()` edits. Encoded on write.
   * `seen` is the explored-cells string as loaded; `bits` the decoded copy the
   * engine holds and edits once it has asked (`seenCells`).
   */
  private readonly live = new Map<string, LiveArea>();
  /** The endless Delve's regions, by `rx_ry`, under the save's seed. */
  private readonly regions = new Map<string, LiveRegion>();
  /** This device's copy of every region (null until it opens; SSR: never). */
  private device: RegionStore | null = null;
  private deviceReady = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private slotTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly reloaded$$ = new Subject<void>();
  /** Wall clock (tests pass a fake). */
  now: () => number = () => Date.now();
  /** Test seam: how the device store is opened. */
  openDevice: () => Promise<RegionStore> = () => openRegionStore(this.store);

  /** Fires after cloud save replaced the blob (or the device's regions arrived): the play view hands the engine the new Delve. */
  readonly reloaded$: Observable<void> = this.reloaded$$.asObservable();

  /** The engine's sector store: this service (the engine reads `sectors` off its persistence). */
  get sectors(): DelveSectorStore | null { return this.isBrowser ? this : null; }

  // ── DelvePersistence (the engine calls these) ─────────────────────────────

  /** The player's seed, rolled and saved on first ask. Undefined on the server: the spec's seed is used. */
  seed(_areaId: string): number | undefined {
    const save = this.ensure();
    return save?.seed;
  }

  cells(areaId: string, layout: string): ReadonlyMap<number, number> | null {
    if (!this.ensure()) return null;
    const area = this.area(areaId, layout);
    return area.cells.size ? area.cells : null;
  }

  changed(areaId: string, layout: string, index: number, kind: number | null): void {
    if (!this.ensure() || !Number.isInteger(index) || index < 0) return;
    const area = this.area(areaId, layout);
    if (kind === null) area.cells.delete(index);
    else area.cells.set(index, kind);
    this.schedule();
  }

  /** The map's explored cells for that layout: one bit per cell, the array the engine keeps and edits. */
  seenCells(areaId: string, layout: string, cells: number): Uint8Array | null {
    if (!this.ensure() || !Number.isInteger(cells) || cells <= 0) return null;
    const area = this.area(areaId, layout);
    if (!area.bits || area.bits.length !== (cells + 7) >> 3) area.bits = decodeSeen(area.seen, cells);
    return area.bits;
  }

  /** The engine explored more of the map (it edited the bits in place): written on the same debounce as digs. */
  explored(areaId: string, layout: string, bits: Uint8Array): void {
    if (!this.ensure()) return;
    const area = this.area(areaId, layout);
    area.bits = bits;
    this.schedule();
  }

  /** Settled liquid unlike the generated lakes, under liquid layout `wet`. */
  liquids(areaId: string, wet: string): ReadonlyMap<number, number> | null {
    if (!this.ensure()) return null;
    const area = this.live.get(areaId);
    if (!area || area.wet !== wet) return null;
    const cells = decodeCells(area.liquids);
    return cells.size ? cells : null;
  }

  /** The liquid settled (or a reaction or a bucket moved it): the whole diff, written on the same debounce as digs. */
  liquidsChanged(areaId: string, wet: string, cells: ReadonlyMap<number, number>): void {
    if (!this.ensure()) return;
    const area = this.live.get(areaId);
    if (!area) return;
    area.wet = wet;
    area.liquids = encodeCells(cells);
    this.schedule();
  }

  // ── Sectors (the endless Delve; engine.model DelveSectorStore) ────────────

  sector(_areaId: string, sx: number, sy: number): SectorSave | null {
    if (!this.ensure()) return null;
    const live = this.regions.get(this.regionKeyOf(sx, sy))?.sectors.get(sectorKey(sx, sy));
    if (!live) return null;
    return { g: live.g, t: live.t, cells: live.cells, liquids: live.liquids, fog: live.fog, receipts: live.receipts, ...(live.h ? { healed: live.h } : {}) };
  }

  sectorChanged(_areaId: string, sx: number, sy: number, g: number, local: number, kind: number | null, receipt?: boolean): void {
    if (!this.ensure() || !Number.isInteger(local) || local < 0 || local >= 1024) return;
    const { region, sector } = this.sectorFor(sx, sy, g, true)!;
    if (kind === null) sector.cells.delete(local); else sector.cells.set(local, kind);
    if (receipt) sector.receipts.add(local);
    this.touched(region, sector);
  }

  sectorLiquids(_areaId: string, sx: number, sy: number, g: number, cells: ReadonlyMap<number, number>): void {
    if (!this.ensure()) return;
    const found = this.sectorFor(sx, sy, g, cells.size > 0);
    if (!found) return;
    const { region, sector } = found;
    if (encodeRuns(sector.liquids) === encodeRuns(cells)) return;
    sector.liquids = new Map(cells);
    this.touched(region, sector);
  }

  sectorExplored(_areaId: string, sx: number, sy: number, g: number, fog: Uint8Array): void {
    if (!this.ensure()) return;
    const { region, sector } = this.sectorFor(sx, sy, g, true)!;
    const next = sector.fog ? sector.fog.slice() : new Uint8Array(8);
    let changed = !sector.fog;
    for (let i = 0; i < 8; i++) { const v = next[i] | (fog[i] ?? 0); if (v !== next[i]) { next[i] = v; changed = true; } }
    if (!changed) return;
    sector.fog = next;
    // Exploring is not a change to the rock: the regrowth clock (t) stands.
    region.dirty = true; region.slotDirty = true;
    this.schedule();
  }

  sectorKeys(_areaId: string): readonly { sx: number; sy: number }[] {
    if (!this.ensure()) return [];
    const out: { sx: number; sy: number }[] = [];
    for (const region of this.regions.values()) for (const key of region.sectors.keys()) { const at = parseSectorKey(key); if (at) out.push(at); }
    return out;
  }

  /** True once this device's region store has answered (or failed): the sectors known are complete. */
  get sectorsReady(): boolean { return this.deviceReady; }
  /** Which store holds this device's regions ('idb', 'local', 'memory'), and whether it had to drop any. */
  get deviceStore(): { kind: string; degraded: boolean } | null { return this.device ? { kind: this.device.kind, degraded: this.device.degraded } : null; }
  /** Region keys held by the cloud slots, slot by slot ('' = empty). Tests and the handoff. */
  slotRegions(): string[] {
    const out = new Array<string>(REGION_SLOTS).fill('');
    for (const [key, region] of this.regions) if (region.slot >= 0) out[region.slot] = key;
    return out;
  }

  private regionKeyOf(sx: number, sy: number): string { const r = regionOf(sx, sy); return regionKey(r.rx, r.ry); }

  /** The live sector (and its region), made on first need (`create`) under generator `g`. */
  private sectorFor(sx: number, sy: number, g: number, create: boolean): { region: LiveRegion; sector: LiveSector } | null {
    const key = this.regionKeyOf(sx, sy);
    let region = this.regions.get(key);
    if (!region) {
      if (!create) return null;
      const r = regionOf(sx, sy);
      region = { rx: r.rx, ry: r.ry, t: 0, sectors: new Map(), slot: -1, dirty: false, slotDirty: false, slotAt: 0 };
      this.regions.set(key, region);
    }
    let sector = region.sectors.get(sectorKey(sx, sy));
    if (!sector || sector.g !== g) {
      if (!create && !sector) return null;
      // A sector dug under another generator: the engine has already re-applied what survives.
      sector = { g, t: sector?.t ?? 0, cells: sector?.g === g ? sector.cells : new Map(), liquids: new Map(), fog: sector?.fog ?? null, receipts: sector?.receipts ?? new Set() };
      region.sectors.set(sectorKey(sx, sy), sector);
    }
    return { region, sector };
  }

  private touched(region: LiveRegion, sector: LiveSector): void {
    const now = this.now();
    sector.t = now; region.t = Math.max(region.t, now);
    region.dirty = true; region.slotDirty = true;
    this.schedule();
  }

  /**
   * Whether the player has dug (or placed) anything in this area yet, under any
   * layout. A read only: it never rolls a seed or writes a save, so asking it on
   * a first visit leaves a browser that has not entered the Delve untouched.
   */
  hasDug(areaId: string): boolean {
    if (!this.isBrowser) return false;
    if (!this.hydrated) {
      const raw = coerceDelveSave(this.store.read(DELVE_KEY));
      return !!raw?.areas?.[areaId]?.cells;
    }
    return (this.live.get(areaId)?.cells.size ?? 0) > 0 || [...this.regions.values()].some(r => [...r.sectors.values()].some(s => s.cells.size > 0));
  }

  // ── Once-per-player finds ─────────────────────────────────────────────────

  isClaimed(id: string): boolean { return !!this.ensure()?.claimed.includes(id); }

  /** Mark a once-per-player find paid, written at once. True the first time only. */
  claim(id: string): boolean {
    const save = this.ensure();
    if (!save || !claimOnce(save, id)) return false;
    this.write();
    return true;
  }

  // ── Chests (contents; DelveChestService moves the stacks) ─────────────────

  /**
   * The chest record at a cell of an area, made on first ask (`create`) under
   * the area's live layout. Null on the server, or when there is none and
   * `create` is false. `index` is the engine's stable cell id (the core's v1
   * index; a wing cell's own range, SectorWorld.cellId).
   */
  chest(areaId: string, index: number, create = true): DelveChest | null {
    const save = this.ensure();
    if (!save) return null;
    const key = chestKey(areaId, index);
    const layout = this.live.get(areaId)?.layout ?? '';
    let chest = save.chests?.[key];
    if (!create) return chest && chest.layout === layout ? chest : null;
    if (!chest || chest.layout !== layout) {
      chest = { layout, born: Date.now() * 1000 + Math.floor(Math.random() * 1000), n: 0, slots: {} };
      save.chests = { ...(save.chests ?? {}), [key]: chest };
    }
    return chest;
  }

  /** Every chest record with its key, for the orphan sweep. */
  chests(): { key: string; areaId: string; index: number; chest: DelveChest }[] {
    const save = this.ensure();
    return Object.entries(save?.chests ?? {}).map(([key, chest]) => {
      const at = key.lastIndexOf(':');
      return { key, areaId: key.slice(0, at), index: parseInt(key.slice(at + 1), 36), chest };
    });
  }

  /** The layout an area is dug under right now (once the engine has asked), or null. */
  layoutOf(areaId: string): string | null { return this.live.get(areaId)?.layout ?? null; }

  /** Write a chest's new contents now (moves are rare; the satchel side already saved). */
  saveChest(): void { if (this.save) this.write(); }

  /** Forget a chest (taken back empty, or refunded). */
  dropChest(key: string): void {
    const save = this.ensure();
    if (!save?.chests?.[key]) return;
    const { [key]: _gone, ...rest } = save.chests;
    save.chests = Object.keys(rest).length ? rest : undefined;
    if (!save.chests) delete save.chests;
    this.write();
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /** Settle every pending write now: the index, every changed region to the device, every changed slot to the cloud. */
  flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; this.write(); }
    this.writeSlots(true);
  }

  private ensure(): DelveSave | null {
    if (!this.isBrowser) return null;
    if (!this.hydrated) {
      this.hydrated = true;
      this.load();
      this.saves.register(DELVE_KEY, { flush: () => this.flush(), rehydrate: () => this.rehydrate() });
      REGION_SLOT_KEYS.forEach((key, slot) => this.saves.register(key, { flush: () => this.flush(), rehydrate: () => this.rehydrateSlot(slot) }));
      void this.openDeviceStore();
    }
    if (!this.save) {
      this.save = newDelveSave(rollSeed(globalThis.crypto), Date.now());
      this.write();
    }
    return this.save;
  }

  private load(): void {
    this.save = coerceDelveSave(this.store.read(DELVE_KEY));
    this.live.clear();
    for (const [id, area] of Object.entries(this.save?.areas ?? {})) this.live.set(id, { layout: area.layout, cells: decodeCells(area.cells), seen: area.seen, wet: area.wet, liquids: area.liquids });
    this.regions.clear();
    REGION_SLOT_KEYS.forEach((_, slot) => this.loadSlot(slot));
  }

  /** Read one slot blob into memory (merged with what is there for its region). */
  private loadSlot(slot: number): void {
    const region = coerceRegion(this.store.read(REGION_SLOT_KEYS[slot]));
    for (const live of this.regions.values()) if (live.slot === slot) live.slot = -1;
    if (!region || !this.save || region.seed !== this.save.seed) return;
    const key = regionKey(region.rx, region.ry);
    const mine = this.regions.get(key);
    const merged = mine ? mergeRegion(this.toRegion(key, mine), region) : region;
    const live = this.fromRegion(merged);
    live.slot = slot;
    live.dirty = mine?.dirty ?? false; live.slotDirty = mine?.slotDirty ?? false; live.slotAt = mine?.slotAt ?? 0;
    this.regions.set(key, live);
  }

  /** The device's regions arrived (IndexedDB is asynchronous): merge them in, regrow what has grown back, rebuild the engine. */
  private async openDeviceStore(): Promise<void> {
    let store: RegionStore;
    try { store = await this.openDevice(); } catch { this.deviceReady = true; return; }
    this.device = store;
    const regions = await store.load().catch(() => [] as DelveRegion[]);
    let changed = false;
    for (const region of regions) {
      if (!this.save || region.seed !== this.save.seed) continue;
      const key = regionKey(region.rx, region.ry), mine = this.regions.get(key);
      // The device's copy is local; the slot's may hold another device's digs: union, the device winning a cell.
      const merged = mine ? mergeRegion(region, this.toRegion(key, mine)) : region;
      const live = this.fromRegion(merged);
      live.slot = mine?.slot ?? -1; live.dirty = mine?.dirty ?? false; live.slotDirty = mine?.slotDirty ?? false; live.slotAt = mine?.slotAt ?? 0;
      this.regions.set(key, live);
      changed = true;
    }
    if (this.regrowFar()) changed = true;
    this.deviceReady = true;
    if (changed) this.reloaded$$.next();
  }

  /**
   * Regrowth, on load: every far, unheld sector unchanged for 14 days drops
   * its diff (receipts and the map stay). True when any did.
   */
  regrowFar(): boolean {
    const now = this.now();
    const anchors: { sx: number; sy: number }[] = [];
    for (const area of this.live.values()) for (const [index, kind] of area.cells) if (ANCHOR.has(kind)) anchors.push({ sx: Math.floor((index % 120) / 32), sy: Math.floor(Math.floor(index / 120) / 32) });
    for (const region of this.regions.values()) for (const [key, sector] of region.sectors) {
      if (![...sector.cells.values()].some(k => ANCHOR.has(k))) continue;
      const at = parseSectorKey(key);
      if (at) anchors.push(at);
    }
    let any = false;
    for (const region of this.regions.values()) {
      for (const [key, sector] of region.sectors) {
        const at = parseSectorKey(key);
        if (!at) continue;
        const diff = this.toDiff(sector);
        if (!shouldRegrow(at.sx, at.sy, diff, now, { coreSectors: CORE_SECTORS, placed: k => !!PLACED[k], anchors })) continue;
        region.sectors.set(key, this.fromDiff(regrow(diff, now)));
        region.dirty = true; region.slotDirty = true;
        any = true;
      }
    }
    if (any) this.schedule();
    return any;
  }

  private rehydrate(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const regions = new Map(this.regions);
    this.load();
    // Regions only this device holds (not in a slot) survive a re-read of the index and slots.
    for (const [key, region] of regions) if (!this.regions.has(key) && region.slot < 0) this.regions.set(key, region);
    this.reloaded$$.next();
  }

  /** Cloud save merged a slot: re-read it (the region it holds may now be another device's). */
  private rehydrateSlot(slot: number): void {
    if (!this.hydrated) return;
    this.loadSlot(slot);
    this.reloaded$$.next();
  }

  /** The live diff for an area; a diff dug under another layout is dropped here. */
  private area(areaId: string, layout: string): LiveArea {
    let area = this.live.get(areaId);
    if (!area || area.layout !== layout) {
      area = { layout, cells: new Map() };
      this.live.set(areaId, area);
    }
    return area;
  }

  private schedule(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.write(); }, DEBOUNCE_MS);
  }

  private write(): void {
    const save = this.save;
    if (!save) return;
    const areas: DelveSave['areas'] = {};
    for (const [id, area] of this.live) {
      const seen = area.bits ? encodeSeen(area.bits) : area.seen;
      areas[id] = { layout: area.layout, cells: encodeCells(area.cells), ...(seen ? { seen } : {}), ...(area.wet ? { wet: area.wet, liquids: area.liquids ?? '' } : {}) };
    }
    save.areas = areas;
    save.version = 2;
    this.store.write(DELVE_KEY, save);
    this.writeDevice();
    this.writeSlots(false);
  }

  /** Every changed region to this device's store. */
  private writeDevice(): void {
    const dirty = [...this.regions.entries()].filter(([, r]) => r.dirty);
    if (!dirty.length || !this.device) return;
    for (const [, r] of dirty) r.dirty = false;
    const keep = new Set([...this.regions.entries()].filter(([, r]) => r.slot >= 0).map(([key]) => key));
    void this.device.put(dirty.map(([key, r]) => this.toRegion(key, r)), keep);
  }

  /**
   * Changed regions to their cloud slots: a region without one takes a free
   * slot, else the slot of the region changed longest ago (that one stays on
   * the device). Each slot at most once per SLOT_WRITE_MS unless `now`.
   */
  private writeSlots(now: boolean): void {
    if (!this.save) return;
    const at = this.now();
    let next = Infinity;
    const pending = [...this.regions.entries()].filter(([, r]) => r.slotDirty).sort((a, b) => b[1].t - a[1].t);
    for (const [key, region] of pending) {
      if (region.slot < 0) {
        const used = new Set([...this.regions.values()].map(r => r.slot).filter(s => s >= 0));
        let slot = [...Array(REGION_SLOTS).keys()].find(s => !used.has(s)) ?? -1;
        if (slot < 0) {
          const oldest = [...this.regions.values()].filter(r => r.slot >= 0 && r !== region).sort((a, b) => a.t - b.t)[0];
          if (!oldest || oldest.t > region.t) continue;
          slot = oldest.slot; oldest.slot = -1;
        }
        region.slot = slot;
      }
      if (!now && at - region.slotAt < SLOT_WRITE_MS) { next = Math.min(next, region.slotAt + SLOT_WRITE_MS - at); continue; }
      region.slotDirty = false; region.slotAt = at;
      this.store.write(REGION_SLOT_KEYS[region.slot], this.toRegion(key, region));
    }
    if (this.slotTimer) { clearTimeout(this.slotTimer); this.slotTimer = null; }
    if (Number.isFinite(next)) this.slotTimer = setTimeout(() => { this.slotTimer = null; this.writeSlots(false); }, Math.max(1000, next));
  }

  // ── Region shapes ─────────────────────────────────────────────────────────

  private toDiff(sector: LiveSector): SectorDiff {
    const diff: SectorDiff = { g: sector.g, t: sector.t };
    if (sector.cells.size) diff.c = encodeRuns(sector.cells);
    if (sector.liquids.size) diff.l = encodeRuns(sector.liquids);
    if (sector.fog) diff.f = encodeFog(sector.fog);
    if (sector.receipts.size) diff.k = encodeIndexSet(sector.receipts);
    if (sector.h) diff.h = sector.h;
    return diff;
  }
  private fromDiff(diff: SectorDiff): LiveSector {
    return { g: diff.g, t: diff.t, cells: decodeRuns(diff.c), liquids: decodeRuns(diff.l), fog: decodeFog(diff.f), receipts: decodeIndexSet(diff.k), ...(diff.h ? { h: diff.h } : {}) };
  }
  private toRegion(_key: string, region: LiveRegion): DelveRegion {
    const sectors: Record<string, SectorDiff> = {};
    for (const [key, sector] of region.sectors) sectors[key] = this.toDiff(sector);
    return { v: 1, seed: this.save?.seed ?? 0, rx: region.rx, ry: region.ry, t: region.t, sectors };
  }
  private fromRegion(region: DelveRegion): LiveRegion {
    const sectors = new Map<string, LiveSector>();
    for (const [key, diff] of Object.entries(region.sectors)) sectors.set(key, this.fromDiff(diff));
    return { rx: region.rx, ry: region.ry, t: region.t, sectors, slot: -1, dirty: false, slotDirty: false, slotAt: 0 };
  }
}
