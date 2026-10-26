/**
 * rune-ledger.spec.ts — runes are satchel stacks (docs/design/runewords.md §1): a monster's rune lands as a 1×1 stack
 * once per drop id, and the old Rune Forge counts move into the satchel as runes of the same tier, losslessly and once.
 */
import { TestBed } from '@angular/core/testing';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { InventoryService } from '../rpg/inventory.service';
import { RUNES_KEY, RuneForgeService, runeMigrationOpId } from './rune-forge.service';
import { runeById } from './rune.model';
import { runeOfStack, runeStackKey } from './rune-stack';

class MemoryGateway {
  readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void { this.bag.set(key, JSON.stringify(value)); }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  read(key: string): unknown { const raw = this.bag.get(key); try { return raw == null ? null : JSON.parse(raw); } catch { return null; } }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

function boot(memory: MemoryGateway): { runes: RuneForgeService; inventory: InventoryService } {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [RuneForgeService, InventoryService, LocalSaveRegistry, { provide: GameStateGateway, useValue: memory }] });
  const runes = TestBed.inject(RuneForgeService);
  const inventory = TestBed.inject(InventoryService);
  runes.init();
  return { runes, inventory };
}

describe('the rune ledger (runes in the satchel)', () => {
  it('keys a rune stack by its id, and reads it back', () => {
    expect(runeStackKey('ash')).toBe('rune-ash');
    expect(runeOfStack('rune-ash')?.id).toBe('ash');
    expect(runeOfStack('cinder-ore')).toBeNull();
    expect(runeStackKey('ash')).not.toContain(':');
    expect(runeStackKey('ash')).not.toContain('|');
  });

  it('lands a monster rune in the satchel once per drop id', () => {
    const { runes, inventory } = boot(new MemoryGateway());
    const ash = runeById('ash')!;
    expect(runes.grant(ash, Math.random, 'drop:k1')).toBeTruthy();
    runes.grant(ash, Math.random, 'drop:k1');
    expect(inventory.stackOf('rune-ash')).toBe(1);
    expect(runes.countOf('ash')).toBe(1);
    expect(runes.hasEverFound('ash')).toBe(true);
    expect(runes.snapshot.held['ash']).toBe(1);
  });

  it('moves every forged rune into the satchel as the same rune, and nothing is lost', () => {
    const memory = new MemoryGateway();
    memory.write(RUNES_KEY, { version: 1, runes: { ash: 7, godstone: 1, ember: 0 }, firstFound: { ash: '2026-01-01T00:00:00.000Z', godstone: '2026-01-02T00:00:00.000Z' }, strikes: 40, goldSpent: 24000 });
    const { runes, inventory } = boot(memory);
    expect(inventory.stackOf('rune-ash')).toBe(7);
    expect(inventory.stackOf('rune-godstone')).toBe(1);
    expect(inventory.stackOf('rune-ember')).toBe(0);
    expect(runes.countOf('ash')).toBe(7);
    expect(inventory.hasStackOp(runeMigrationOpId('ash'))).toBe(true);
    const saved = JSON.parse(memory.readRaw(RUNES_KEY)!);
    expect(saved.runes).toEqual({});
    expect(saved.migrated).toBe(1);
    // First-found dates (the Codex) survive.
    expect(runes.hasEverFound('godstone')).toBe(true);
  });

  it('is idempotent: a second device migrating the same old blob lands nothing twice', () => {
    const memory = new MemoryGateway();
    const old = { version: 1, runes: { ash: 3 }, firstFound: { ash: '2026-01-01T00:00:00.000Z' }, strikes: 3, goldSpent: 1800 };
    memory.write(RUNES_KEY, old);
    boot(memory);
    // The cloud brings the unmigrated blob back (another device): migrating again is a no-op on the op id.
    memory.write(RUNES_KEY, old);
    const { inventory } = boot(memory);
    expect(inventory.stackOf('rune-ash')).toBe(3);
  });

  it('pays a retired non-monster rune source in Gold, never a rune', () => {
    const { runes, inventory } = boot(new MemoryGateway());
    const gold = runes.payInstead(runeById('ash')!, 'spec');
    expect(gold).toBe(runeById('ash')!.sellValue);
    expect(inventory.stackOf('rune-ash')).toBe(0);
  });
});
