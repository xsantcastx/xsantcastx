/**
 * game-state.quota.spec.ts — a full disk must not refuse play.
 *
 * The owner's phone filled its localStorage quota and every pickup after that
 * said "That pickup could not be saved": `setItem` threw, the gateway swallowed
 * it, and the inventory's read-back check saw the old blob and rolled the
 * grant back. These drive the real gateway and the real InventoryService with
 * `setItem` throwing a QuotaExceededError.
 */
import { TestBed } from '@angular/core/testing';
import { GameStateGateway, SAVE_BACKUP_KEY } from './game-state.gateway';
import { INVENTORY_KEY, InventoryService } from '../rpg/inventory.service';

function quotaError(): Error {
  const err = new Error('The quota has been exceeded.');
  err.name = 'QuotaExceededError';
  return err;
}

function stackQty(inventory: InventoryService, key: string): number {
  return inventory.snapshot.stacks.filter(s => s.stackKey === key).reduce((n, s) => n + s.quantity, 0);
}

describe('GameStateGateway on a full disk', () => {
  let full: boolean;
  let realSet: typeof Storage.prototype.setItem;

  beforeEach(() => {
    localStorage.clear();
    full = false;
    realSet = Storage.prototype.setItem;
    spyOn(Storage.prototype, 'setItem').and.callFake(function (this: Storage, key: string, value: string) {
      if (full) throw quotaError();
      realSet.call(this, key, value);
    });
    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
  });

  it('keeps a refused write in memory, so reads see it and the cloud queue can send it', () => {
    const gateway = TestBed.inject(GameStateGateway);
    const seen: number[] = [];
    gateway.spilled$.subscribe(n => seen.push(n));

    gateway.write('godforge-story', { a: 1 });
    full = true;
    gateway.write('godforge-story', { a: 2 });

    expect(gateway.read('godforge-story')).toEqual({ a: 2 });
    expect(localStorage.getItem('godforge-story')).toBe('{"a":1}');
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('frees the merge backup first, then retries the write', () => {
    const gateway = TestBed.inject(GameStateGateway);
    realSet.call(localStorage, SAVE_BACKUP_KEY, 'x'.repeat(1000));
    let refusals = 1;
    (Storage.prototype.setItem as jasmine.Spy).and.callFake(function (this: Storage, key: string, value: string) {
      if (refusals > 0 && key !== SAVE_BACKUP_KEY) { refusals--; throw quotaError(); }
      realSet.call(this, key, value);
    });

    gateway.write('godforge-story', { a: 3 });

    expect(localStorage.getItem(SAVE_BACKUP_KEY)).toBeNull();
    expect(localStorage.getItem('godforge-story')).toBe('{"a":3}');
  });

  it('puts held values on disk once there is room again', () => {
    const gateway = TestBed.inject(GameStateGateway);
    full = true;
    gateway.write('godforge-story', { a: 4 });
    expect(localStorage.getItem('godforge-story')).toBeNull();

    full = false;
    gateway.retrySpilled(true);

    expect(localStorage.getItem('godforge-story')).toBe('{"a":4}');
  });

  it('a pickup lands on a full disk, once, and a retried grant id does not land twice', () => {
    const inventory = TestBed.inject(InventoryService);
    inventory.init();
    full = true;

    expect(inventory.grantStack('pickup:1', 'cinder-ore', 3)).toBe(true);
    expect(stackQty(inventory, 'cinder-ore')).toBe(3);
    // Walking over the same drop again (same grant id) is one grant.
    inventory.grantStack('pickup:1', 'cinder-ore', 3);
    expect(stackQty(inventory, 'cinder-ore')).toBe(3);

    // Room again: the held ledger reaches the disk with the next write.
    full = false;
    expect(inventory.grantStack('pickup:2', 'cinder-ore', 1)).toBe(true);
    const onDisk = JSON.parse(localStorage.getItem(INVENTORY_KEY)!);
    expect(onDisk.stackOps.map((op: { id: string }) => op.id)).toContain('pickup:1');
  });
});
