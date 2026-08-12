/**
 * pro.service.spec.ts — the grant ledger for a paid product.
 *
 * Only one behaviour here is worth a test, and it is the one that cannot be
 * checked by clicking through a browser: `activatePro()` mints currency, and
 * the URL that triggers it (`/pro?purchase=success`) is a page a buyer can
 * bookmark, refresh, share or hit twice on a flaky connection. Every one of
 * those is a second call, and a second mint would be a printing press attached
 * to a public URL.
 *
 * The rest of the service is storage plumbing that a browser proves better than
 * a harness. These tests own the parts that are money-shaped.
 */
import { TestBed } from '@angular/core/testing';
import {
  ProService,
  PRO_KEY,
  PRO_GOLD_BONUS,
  PRO_ESSENCE_BONUS,
  PRO_XP_MULTIPLIER,
} from './pro.service';
import { EconomyService } from '../economy/economy.service';

/** Records what the service asked the economy to mint. */
class EconomyStub {
  goldCalls: number[] = [];
  essenceCalls: number[] = [];
  grants: Array<{ cosmeticId: string; variantId: string }> = [];

  earnGold(amount: number): number {
    this.goldCalls.push(amount);
    return amount;
  }
  earnEssence(amount: number): number {
    this.essenceCalls.push(amount);
    return amount;
  }
  grantCosmetic(cosmeticId: string, variantId: string): boolean {
    this.grants.push({ cosmeticId, variantId });
    return true;
  }

  get totalGold(): number {
    return this.goldCalls.reduce((a, b) => a + b, 0);
  }
  get totalEssence(): number {
    return this.essenceCalls.reduce((a, b) => a + b, 0);
  }
}

describe('ProService', () => {
  let economy: EconomyStub;

  /** Build a fresh service against current localStorage. */
  function make(): ProService {
    TestBed.resetTestingModule();
    economy = new EconomyStub();
    TestBed.configureTestingModule({
      providers: [ProService, { provide: EconomyService, useValue: economy }],
    });
    return TestBed.inject(ProService);
  }

  beforeEach(() => localStorage.removeItem(PRO_KEY));
  afterEach(() => localStorage.removeItem(PRO_KEY));

  it('starts inactive with no grants', () => {
    const pro = make();
    expect(pro.isPro()).toBe(false);
    expect(pro.xpMultiplier()).toBe(1);
    expect(economy.totalGold).toBe(0);
  });

  it('mints the welcome bundle exactly once on activation', () => {
    const pro = make();
    expect(pro.activatePro()).toBe(true);

    expect(pro.isPro()).toBe(true);
    expect(economy.totalGold).toBe(PRO_GOLD_BONUS);
    expect(economy.totalEssence).toBe(PRO_ESSENCE_BONUS);
    expect(economy.grants.length).toBe(3);
  });

  it('does not re-mint when activatePro is called again in the same session', () => {
    const pro = make();
    pro.activatePro();
    // A buyer refreshing the success page, three times.
    pro.activatePro();
    pro.activatePro();
    pro.activatePro();

    expect(economy.totalGold).toBe(PRO_GOLD_BONUS);
    expect(economy.totalEssence).toBe(PRO_ESSENCE_BONUS);
  });

  it('does not re-mint for a returning visitor in a new session', () => {
    make().activatePro();
    // New page load: fresh service, same localStorage.
    const second = make();
    second.activatePro();

    expect(second.isPro()).toBe(true);
    // The second session's economy stub saw no mint at all.
    expect(economy.totalGold).toBe(0);
    expect(economy.totalEssence).toBe(0);
  });

  it('reports the doubled multiplier only while active', () => {
    const pro = make();
    expect(pro.xpMultiplier()).toBe(1);
    pro.activatePro();
    expect(pro.xpMultiplier()).toBe(PRO_XP_MULTIPLIER);
    pro.deactivatePro();
    expect(pro.xpMultiplier()).toBe(1);
  });

  it('does not re-mint after a deactivate/reactivate round trip', () => {
    const pro = make();
    pro.activatePro();
    pro.deactivatePro();
    pro.activatePro();

    expect(pro.isPro()).toBe(true);
    expect(economy.totalGold).toBe(PRO_GOLD_BONUS);
  });

  it('honours the legacy bare-string flag without minting', () => {
    // A browser flipped by hand, or by a build that predates the JSON record.
    // There is no way to tell whether the grants were paid, so declining to
    // mint is the conservative direction.
    localStorage.setItem(PRO_KEY, 'true');
    const pro = make();

    expect(pro.isPro()).toBe(true);
    expect(economy.totalGold).toBe(0);

    pro.activatePro();
    expect(economy.totalGold).toBe(0);
  });

  it('treats corrupt storage as not-Pro rather than throwing', () => {
    localStorage.setItem(PRO_KEY, '{ not json');
    const pro = make();

    expect(pro.isPro()).toBe(false);
    expect(pro.xpMultiplier()).toBe(1);
  });

  it('emits over pro$ so ad slots can react without a reload', () => {
    const pro = make();
    const seen: boolean[] = [];
    pro.pro$.subscribe(v => seen.push(v));

    pro.activatePro();
    pro.deactivatePro();

    expect(seen).toEqual([false, true, false]);
  });
});
