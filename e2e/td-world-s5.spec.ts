/**
 * td-world-s5.spec.ts — S5: the healer and the tank in a party, on the room (Hearth protocol 10; world/ally-claims.ts,
 * td/td-threat.ts; docs/handoff/s5-party-kits.md).
 *
 * Two browsers on the Seamworks island against a private Hearth room running the world. Aster is a Lanternwright, Bryn
 * an Ashguard; both are guests (the room keeps a guest's life too).
 *   1. A heal on a party mate: Bryn is hurt; Aster's Hearthlight picks the lowest ally in reach (him), the room weighs
 *      the claim and lands it on the life it keeps — Bryn's screen shows the heal (and its life climbs on the room's
 *      word), Aster's shows his bar climbing under his plate.
 *   2. A tank holds a creature off the healer: a hunting creature of the room comes at them; Bryn strikes it (his book
 *      makes threat ×2) and calls a Watch Cry; Aster keeps healing him (her heals make threat ×0.5). The creature's
 *      blows land on Bryn and never on Aster.
 * The numbers are printed (`# s5 …`); screenshots go to output/world-s5/ (not committed).
 */
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';
import { ERA } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';
import { LANTERN_SKILLS } from '../src/app/play/td/td-lantern-skills';

/** Hearthlight at rank 1 for a level-20 Lanternwright: its heal × the level's lift (td-mobs HEAL_PER_LEVEL 3%). */
const HEARTHLIGHT_20 = Math.round(LANTERN_SKILLS['hearthlight'].vars['heal'] * (1 + .03 * 20));

let hearth: Hearth;
test.beforeAll(async ({}, info) => {
  hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_WORLD: '1', SOCIAL_WORLD_FX: '1', SOCIAL_FAKE_AUTH: '1', SOCIAL_FAKE_TRADE: '1' });
});
test.afterAll(async () => { await hearth?.stop(); });

interface WorldView { role: string; host: string | null; mobs: { id: string; t: string; x: number; y: number; hp: number }[] }
interface LifeView { on: boolean; hp: number; room: { h: number; m: number; q: number; d?: 1 } | null; down: boolean }
interface AllyView { allies: { id: string; x: number; y: number; h: number; m: number }[]; sent: number; healed: number }
type Hooks = { __tdCoop: { view: () => WorldView; target: (id: string) => boolean; cast: (id: string) => string | null; life: () => LifeView; harm: (n: number) => number; allies: () => AllyView; pick: (id: string) => boolean } };

const SHOTS = 'output/world-s5';
const shot = async (page: Page, name: string) => { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: 'jpeg', quality: 72 }); };
const canvas = (page: Page) => page.locator('.viewport canvas');
const view = (page: Page) => page.evaluate(() => (window as unknown as Hooks).__tdCoop.view());
const life = (page: Page) => page.evaluate(() => (window as unknown as Hooks).__tdCoop.life());
const allies = (page: Page) => page.evaluate(() => (window as unknown as Hooks).__tdCoop.allies());
const cast = (page: Page, id: string) => page.evaluate(s => (window as unknown as Hooks).__tdCoop.cast(s), id);
const level20 = () => {
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(20) + 10 } as typeof act.progress.xpByDiscipline;
  return act;
};
const hide = (page: Page) => page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
async function fx(origin: string, body: Record<string, unknown>): Promise<{ id: string | null; mobs: { id: string; hp: number; st: number }[] }> {
  const res = await fetch(`http://127.0.0.1:${hearth.port}/world/fx`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  expect(res.status).toBe(200);
  return res.json();
}

test('S5: a healer heals her party mate and both see it; a tank holds the room\'s creature off the healer', async ({ browser }, info) => {
  test.setTimeout(240_000);
  const origin = new URL(String(info.project.use.baseURL)).origin;
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    await enterAs(a, hearth.port, 'Aster', 'lanternwright', { 'godforge-realm-era': String(ERA), 'godforge-activity': level20() }, 'fxcoop=1');
    await enterAs(b, hearth.port, 'Bryn', 'ashguard', { 'godforge-realm-era': String(ERA), 'godforge-activity': level20() }, 'fxcoop=1');
    for (const p of [a, b]) await hide(p);
    for (const p of [a, b]) await expect(canvas(p)).toHaveAttribute('data-coop-role', 'member', { timeout: 20000 });
    for (const p of [a, b]) await expect(canvas(p)).toHaveAttribute('data-room-life', 'on', { timeout: 10000 });
    // Each sees the other in reach, with its life as the room keeps it.
    await expect.poll(async () => (await allies(a)).allies.some(x => x.m > 1), { timeout: 15000 }).toBe(true);

    // ── 1. A heal on the party mate: the room weighs it; both screens see it ──
    const lb = await life(b);
    await b.evaluate(n => (window as unknown as Hooks).__tdCoop.harm(n), Math.round(lb.hp * .6));
    await expect.poll(async () => (await life(b)).room?.h ?? 9999, { timeout: 5000 }).toBeLessThan(lb.hp * .6);
    // Aster sees him low under his plate (the room's word), then heals the lowest ally: him.
    await expect.poll(async () => { const x = (await allies(a)).allies[0]; return x ? x.h / x.m : 1; }, { timeout: 5000 }).toBeLessThan(.6);
    const hurtAt = (await life(b)).room!.h;
    const castAt = await a.evaluate(() => { (window as unknown as Hooks).__tdCoop.cast('hearthlight'); return Date.now(); });
    await expect.poll(async () => (await allies(a)).sent, { timeout: 8000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await allies(b)).healed, { timeout: 8000 }).toBeGreaterThan(0);
    await expect.poll(async () => (await life(b)).room?.h ?? 0, { timeout: 8000 }).toBeGreaterThan(hurtAt);
    const seenAt = await b.evaluate(() => Date.now());
    await expect.poll(async () => { const x = (await allies(a)).allies[0]; return x?.h ?? 0; }, { timeout: 5000 }).toBeGreaterThan(hurtAt);
    // The whole heal lands on the room (its three ticks over 3 s), not a sliver: at least its computed amount, unless
    // the room's own bounds (the target's most life, 60% of it a second from all healers) say less.
    const due = Math.min(HEARTHLIGHT_20, lb.room!.m - hurtAt);
    await expect.poll(async () => (await life(b)).room!.h - hurtAt, { timeout: 8000 }).toBeGreaterThanOrEqual(due - 1);
    expect((await allies(b)).healed).toBeGreaterThanOrEqual(due - 1);
    await shot(a, 'aster-heals-bryn'); await shot(b, 'bryn-healed');
    console.log(`# s5 heal: Aster's cast → Bryn healed on the room ≤ ${seenAt - castAt} ms; healed ${(await allies(b)).healed}, sent ${(await allies(a)).sent}`);

    // ── 2. The tank holds the room's creature off the healer ──
    // Bryn stands between: a hunting wolf laid beside him; he strikes it and calls the Watch Cry; Aster heals him.
    // A Cinder Orc: tough. Its War Stomp (S6) is a ring round itself that strikes everyone in it, whoever it goes for —
    // so the healer stands back a few tiles (inside Hearthlight's reach, outside the stomp): what is tested is who it
    // goes for, not whether a ring reaches a healer standing in the tank's pocket.
    await a.keyboard.down('ArrowLeft'); await a.waitForTimeout(800); await a.keyboard.up('ArrowLeft');
    await expect.poll(async () => {
      const bryn = (await allies(a)).allies[0], aster = (await allies(b)).allies[0];
      return bryn && aster ? Math.hypot(bryn.x - aster.x, bryn.y - aster.y) : 0;
    }, { timeout: 5000 }).toBeGreaterThan(44);
    const wolf = (await fx(origin, { near: 'Bryn', lay: { type: 'cinder-orc', dx: 16, dy: 0, calm: false } })).id!;
    await expect.poll(async () => (await view(b)).mobs.some(m => m.id === wolf), { timeout: 10000 }).toBe(true);
    await b.evaluate(id => (window as unknown as Hooks).__tdCoop.target(id), wolf);
    await cast(b, 'watch-cry');
    const aster0 = (await life(a)).room!.h, bryn0 = (await life(b)).room!.h;
    let brynDipped = false, last = bryn0, asterBitten = false;
    // The tank fallen: at 0 on the room (its death grace) or held down. The creature then rightly turns on the healer.
    const fallen = (l: LifeView) => l.down || !!l.room?.d || (l.room?.h ?? 1) <= 0;
    for (let i = 0; i < 24; i++) {
      if (i % 2 === 0) await a.evaluate(() => { const h = (window as unknown as Hooks).__tdCoop; h.cast('hearthlight'); });
      await b.evaluate(id => (window as unknown as Hooks).__tdCoop.target(id), wolf);
      await a.waitForTimeout(250);
      const lb2 = await life(b), now = lb2.room!.h;
      if (now < last) brynDipped = true;
      last = now;
      // What counts is while the tank stands (on a slow machine the heals fall behind and he falls).
      if (fallen(lb2)) break;
      if ((await life(a)).room!.h < aster0) {
        // A bite on the healer only counts if the tank was still standing when it landed: the two screens hear the
        // room ~one snapshot apart, so give the tank's screen that long to hear its own fall first.
        await a.waitForTimeout(400);
        asterBitten = !fallen(await life(b));
        break;
      }
    }
    expect(brynDipped, 'the creature fought the tank').toBe(true);
    console.log(`# s5 threat: Aster ${aster0} → ${(await life(a)).room!.h}, Bryn ${bryn0} → ${(await life(b)).room!.h} over 6 s with the wolf on them`);
    expect(asterBitten).toBe(false);
    await shot(a, 'tank-holds');
  } finally {
    await ca.close(); await cb.close();
  }
});
