/**
 * td-world-kin.spec.ts — the room's creatures fight the Keepers' summons (the owner, 2026-10-26: "the monsters aren't
 * attacking my minions"; play/world/room-kin.ts).
 *
 * Two browsers on the Seamworks island against a private Hearth room running the world. Bryn (a Warlock) raises two
 * skeletons; his screen tells the room (`/coop/pals` with `kin`), and Aster's screen draws them (the owner's word,
 * relayed). A creature of the room laid beside them goes for a skeleton, not for Bryn: the room bites it, Bryn's screen
 * applies the room's word, the skeleton falls only when the room says so, and Aster sees its life drop and the
 * skeleton gone. Screenshots go to output/world-kin/ (not committed).
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';
import { ERA } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

let hearth: Hearth;
test.beforeAll(async ({}, info) => {
  hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_WORLD: '1', SOCIAL_WORLD_FX: '1' });
});
test.afterAll(async () => { await hearth?.stop(); });

interface Pal { owner?: string; i?: string; k: string; x: number; y: number; h?: number; m?: number }
type Hooks = { __tdCoop: { view: () => { role: string; host: string | null }; raise: (n: number) => number; mine: () => Pal[]; pals: () => Pal[] } };

const SHOTS = 'output/world-kin';
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 72 }); };
const canvas = (page: Page) => page.locator('.viewport canvas');
const hook = <T>(page: Page, f: (h: Hooks['__tdCoop']) => T) => page.evaluate(`(${f.toString()})(window.__tdCoop)`) as Promise<T>;
const level20 = () => {
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(20) + 10 } as typeof act.progress.xpByDiscipline;
  return act;
};
async function fx(origin: string, body: Record<string, unknown>): Promise<{ id: string | null }> {
  const res = await fetch(`http://127.0.0.1:${hearth.port}/world/fx`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect(res.status).toBe(200);
  return res.json();
}

test('summons: a room creature bites a Warlock\'s raised skeleton; it falls on the room\'s word; the other Keeper sees it', async ({ browser }, info) => {
  test.setTimeout(150_000);
  const origin = new URL(String(info.project.use.baseURL)).origin;
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    await enterAs(a, hearth.port, 'Aster', 'ashguard', { 'godforge-realm-era': String(ERA), 'godforge-activity': level20() }, 'fxcoop=1');
    await enterAs(b, hearth.port, 'Bryn', 'warlock', { 'godforge-realm-era': String(ERA), 'godforge-activity': level20() }, 'fxcoop=1');
    for (const p of [a, b]) await p.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
    for (const p of [a, b]) await expect(canvas(p)).toHaveAttribute('data-coop-role', 'member', { timeout: 20000 });
    for (const p of [a, b]) await expect.poll(async () => (await hook(p, h => h.view())).host, { timeout: 10000 }).toBe('@room');
    // No wild creature in the way: only the one we lay.
    await fx(origin, { near: 'Bryn', quiet: true });

    // Bryn raises two; Aster's screen draws them (relayed from Bryn's word through the room).
    await hook(b, h => h.raise(2));
    await expect.poll(async () => (await hook(a, h => h.pals())).filter(p => p.k === 'skel').length, { timeout: 10000 }).toBe(2);
    const max = (await hook(b, h => h.mine())).find(p => p.k === 'skel')?.m ?? 0;
    expect(max).toBeGreaterThan(0);

    // A creature of the room beside the skeletons (an Obsidian Golem: the two skeletons do not fell it first): it goes
    // for one of them, not for Bryn, and the room bites it.
    await fx(origin, { near: 'Bryn', lay: { type: 'obsidian-golem', dx: 36, dy: 6, calm: false } });
    const skelLife = async (p: Page, mine: boolean) => (await hook(p, mine ? h => h.mine() : h => h.pals())).filter(x => x.k === 'skel').map(x => x.h ?? 0);
    await expect.poll(async () => Math.min(...await skelLife(b, true), max), { timeout: 20000 }).toBeLessThan(max);
    await shot(b, 'bryn-skeleton-bitten');
    // Aster sees the bitten skeleton's life drop (the owner's word, relayed).
    await expect.poll(async () => Math.min(...await skelLife(a, false), max), { timeout: 10000 }).toBeLessThan(max);
    await shot(a, 'aster-sees-it');
    // It falls when the room says so: one fewer on Bryn's screen, and on Aster's.
    await expect.poll(async () => (await skelLife(b, true)).length, { timeout: 40000 }).toBeLessThan(2);
    await expect.poll(async () => (await hook(a, h => h.pals())).filter(p => p.k === 'skel').length, { timeout: 10000 }).toBeLessThan(2);
    console.log('# kin: a room creature bit and felled a raised skeleton; both screens saw it');
  } finally {
    await ca.close(); await cb.close();
  }
});
