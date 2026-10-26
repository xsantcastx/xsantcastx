/**
 * td-sexton-online.spec.ts — the Sexton's Count's Row-Walker in the room-run world (players: "the key just won't drop").
 *
 * Since M3 the Hearth room runs Ember Isle's creatures and every Keeper there is the room's member: the screen raises
 * nothing of its own. The Row-Walker (Hollis Vane, a unique Bone Walker with one follower) is raised by the Keeper's
 * own screen while the chain is on its 'key' step — a step the room cannot see. Before the fix it stood frozen on a
 * member (a replica's mind sleeps) and every blow was a claim naming no creature of the room, so it never fell and
 * Barrow Key 1 never came. Now it is a personal creature (td-mobs Mob.personal): simulated, wounded and felled on its
 * Keeper's screen alone, never on the wire.
 *
 * Two browsers against a private Hearth room running the world: Aster (on the 'key' step) wounds his own Hollis Vane
 * through the real attack path, then fells him (the same hurt path) and the chain moves to 'door'; Bryn (not on the chain) stands at the same plot and
 * never sees him.
 */
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';
import { ERA } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_WORLD: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

type Sexton = {
  to(where: string): string | null;
  strike(): boolean;
  smite(what: 'walker'): boolean;
  walker(): { hp: number; max: number; personal: boolean; name: string | null } | null;
  state(): { step: string; level: string; mobs: string[] };
};
const sx = <T>(page: Page, fn: (h: Sexton) => T) => page.evaluate(`(${fn.toString()})(window.__tdSexton)`) as Promise<T>;
const canvas = (page: Page) => page.locator('.viewport canvas');
const savedFacts = (page: Page) => page.evaluate(() => {
  const raw = JSON.parse(localStorage.getItem('godforge-town-tasks') || 'null');
  const s = raw && 'v' in raw && 'updatedAt' in raw ? raw.v : raw;
  return Object.keys(s?.chains?.['sexton-count'] ?? {}).sort();
});
const keeper = (facts: string[]) => {
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(20) + 10 } as typeof act.progress.xpByDiscipline;
  return {
    'godforge-realm-era': String(ERA), 'godforge-activity': act,
    'godforge-town-tasks': { version: 3, accepted: {}, progress: {}, claimed: [], dAccepted: {}, dProgress: {}, dClaimed: [], chains: { 'sexton-count': Object.fromEntries(facts.map((f, i) => [f, 1000 + i])) } },
  };
};
const hide = (page: Page) => page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });

test('online: a member fells its own Row-Walker, Barrow Key 1 comes, and the other Keeper never sees him', async ({ browser }, info) => {
  test.setTimeout(180_000);
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    await enterAs(a, hearth.port, 'Aster', 'ashguard', keeper(['taken', 'stone-1', 'stone-2', 'stone-3', 'page']), 'fxsexton=1');
    await enterAs(b, hearth.port, 'Bryn', 'warlock', keeper([]), 'fxsexton=1');
    for (const p of [a, b]) await hide(p);
    expect(await sx(a, h => h.state().step)).toBe('key');
    for (const p of [a, b]) await sx(p, h => h.to('barrow'));
    // Both are the room's members at the plot: the room runs the island's creatures.
    for (const p of [a, b]) await expect(canvas(p)).toHaveAttribute('data-coop-role', 'member', { timeout: 20000 });

    // ── Hollis Vane rises on Aster's screen only, as a personal creature ──
    await expect(canvas(a)).toHaveAttribute('data-sexton', /^key\|surface\|0\|1\|/, { timeout: 15000 });
    const w = await sx(a, h => h.walker());
    expect(w?.personal).toBe(true);
    expect(w?.name).toBe('Hollis Vane');
    await b.waitForTimeout(1500);
    expect(await sx(b, h => h.walker())).toBeNull();
    await expect(canvas(b)).toHaveAttribute('data-sexton', /^offer\|surface\|0\|0\|/);

    // ── Aster's own blows (the real attack path) wound him; the last blow lays him down (the same hurt path) ──
    const full = (await sx(a, h => h.walker()))!.hp;
    await sx(a, h => h.strike());
    await expect.poll(async () => (await sx(a, h => h.walker()))?.hp ?? 0, { timeout: 20000 }).toBeLessThan(full);
    expect(await sx(a, h => h.smite('walker'))).toBe(true);
    expect(await sx(a, h => h.walker())).toBeNull();
    await expect.poll(() => sx(a, h => h.state().step), { timeout: 10000 }).toBe('door');
    await expect.poll(() => savedFacts(a)).toContain('key');
    await expect(a.locator('.td-toast')).toContainText(/Barrow Key 1/, { timeout: 5000 });
    // Bryn's chain never moved.
    expect(await savedFacts(b)).toEqual([]);
  } finally {
    await ca.close(); await cb.close();
  }
});
