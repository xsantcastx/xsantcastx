/**
 * td-s9-shots.spec.ts — S9's rows photographed in the running game (docs/handoff/s9rows.md): every new summon and each new
 * row's cast or hit, in Isometric (the default) and Classic, at 1280×800 and 390×844, and two of them on Low detail.
 * Skipped unless S9_SHOTS=1; the pictures land in output/s9rows/ (not committed). Nothing is asserted but that each
 * cast went off.
 *
 *   S9_SHOTS=1 PW_PORT=4696 npx playwright test e2e/td-s9-shots --project=chromium
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const on = process.env['S9_SHOTS'] ? test.describe : test.describe.skip;
type W = {
  __tdZones: { to(c: number, r: number): boolean; foe(type: string, level: number, dx?: number, dy?: number): number | null };
  __tdArt: { road(dc: number): unknown; cast(ranks: Record<string, number>, id: string, marks?: Record<string, number>): string | null; aim(i?: number): boolean };
};

/** Each shot: the calling, the row, the ranks it needs, how long after the cast the picture is taken (ms), any setup. */
interface Shot { voc: string; id: string; ranks?: Record<string, number>; wait: number; foes?: [number, number][]; before?: string }
const ONLY = process.env['S9_ONLY'];
const SHOTS_ALL: Shot[] = [
  { voc: 'warlock', id: 'ossuary-golem', wait: 1200 },
  { voc: 'warlock', id: 'raise-grave-mage', wait: 1500 },
  { voc: 'warlock', id: 'rime-lance', wait: 160 },
  { voc: 'warlock', id: 'kiln-breath', wait: 500 },
  { voc: 'ashguard', id: 'pyre-strike', wait: 120 },
  { voc: 'ashguard', id: 'watchquake', wait: 150 },
  { voc: 'lanternwright', id: 'moth-swarm', wait: 900 },
  { voc: 'lanternwright', id: 'chain-of-lamps', wait: 60, foes: [[40, 0], [70, 20], [100, -10], [130, 15]] },
  { voc: 'thornstrider', id: 'elder-beast', ranks: { 'call-of-the-wilds': 10 }, before: 'call-of-the-wilds', wait: 900 },
  { voc: 'thornstrider', id: 'thornrain', wait: 900 },
  { voc: 'thornstrider', id: 'lightning-call', wait: 680 },
  { voc: 'thornstrider', id: 'call-the-rain', wait: 900 },
  { voc: 'thornstrider', id: 'fogwalk', wait: 900 },
];
const SHOTS = ONLY ? SHOTS_ALL.filter(s => ONLY.split(',').includes(s.id)) : SHOTS_ALL;

async function open(page: Page, voc: string, look: string, low: boolean): Promise<void> {
  const keeper = { version: 1, made: true, prompted: true, name: 'Ilsa', vocation: voc, hair: 'curls', updatedAt: 1 };
  await seed(page, { 'eclipse-td': '1', 'godforge-keeper-look': keeper });
  await page.addInitScript(d => { try { localStorage.setItem('eclipse-td-detail', d); } catch { /* private */ } }, low ? 'low' : 'normal');
  await page.goto(`/play?td=1&hour=12&artopt=${look}`);
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await page.waitForFunction(() => !!(window as unknown as Partial<W>).__tdArt?.cast);
  await page.evaluate(() => { const w = window as unknown as W; w.__tdZones.to(58, 62); w.__tdArt.road(0); });
  // The prologue's card and Glim's hello out of the way; the place's title card faded.
  await page.getByText('Skip tutorial').first().click({ timeout: 1500 }).catch(() => undefined);
  await page.waitForTimeout(5000);
}

on('S9 rows in the running game', () => {
  for (const view of [{ name: 'desk', width: 1280, height: 800, mobile: false }, { name: 'phone', width: 390, height: 844, mobile: true }]) {
    for (const look of ['iso', 'live']) {
      test(`${view.name} ${look === 'iso' ? 'isometric' : 'classic'}`, async ({ browser }) => {
        test.setTimeout(600000);
        const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: view.width, height: view.height }, ...(view.mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
        const page = await ctx.newPage();
        for (const s of SHOTS) {
          await open(page, s.voc, look, false);
          await shoot(page, s, `output/s9rows/${view.name}-${look === 'iso' ? 'iso' : 'classic'}-${s.id}.png`);
        }
        await ctx.close();
      });
    }
  }
  test('Low detail: the Moth Swarm and Chain of Lamps', async ({ browser }) => {
    test.setTimeout(300000);
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    for (const s of SHOTS.filter(x => x.id === 'moth-swarm' || x.id === 'chain-of-lamps')) {
      await open(page, s.voc, 'iso', true);
      await shoot(page, s, `output/s9rows/desk-iso-low-${s.id}.png`);
    }
    await ctx.close();
  });
});

async function shoot(page: Page, s: Shot, path: string): Promise<void> {
  const foes = s.foes ?? [[48, 0], [64, 26], [30, -30]];
  await page.evaluate(f => { const w = window as unknown as W; for (const [dx, dy] of f) w.__tdZones.foe('bone-walker', 40, dx, dy); w.__tdArt.aim(f.length); }, foes);
  const ranks = { [s.id]: 10, ...(s.ranks ?? {}) };
  if (s.before) expect(await page.evaluate(([r, id]) => (window as unknown as W).__tdArt.cast(r as Record<string, number>, id as string), [ranks, s.before] as const)).toBeNull();
  if (s.before) await page.waitForTimeout(600);
  const why = await page.evaluate(([r, id]) => (window as unknown as W).__tdArt.cast(r as Record<string, number>, id as string), [ranks, s.id] as const);
  expect(why, s.id).toBeNull();
  await page.waitForTimeout(s.wait);
  if (process.env['S9_FREEZE']) await page.evaluate(() => (window as unknown as { __tdArt: { freeze(on: boolean): void } }).__tdArt.freeze(true));
  if (process.env['S9_DEBUG']) console.warn(s.id, JSON.stringify(await page.evaluate(() => (window as unknown as { __tdArt: { fx(): unknown } }).__tdArt.fx())));
  await page.screenshot({ path });
  // And close on the Keeper (the camera holds him at the canvas's middle).
  const cv = page.locator('canvas').first(), box = (await cv.boundingBox())!, vw = Math.min(560, box.width), vh = Math.min(420, box.height);
  const at = await page.evaluate(() => { const c = document.querySelector('canvas')!, a = (window as unknown as { __tdArt: { pageOf(x: number, y: number, l?: number): { x: number; y: number } } }).__tdArt; return a.pageOf(Number(c.getAttribute('data-player-x')), Number(c.getAttribute('data-player-y')), 10); });
  const cx = Math.max(box.x + vw / 2, Math.min(box.x + box.width - vw / 2, at.x + 40)), cy = Math.max(box.y + vh / 2, Math.min(box.y + box.height - vh / 2, at.y - 30));
  await page.screenshot({ path: path.replace('.png', '-close.png'), clip: { x: Math.round(cx - vw / 2), y: Math.round(cy - vh / 2), width: Math.round(vw), height: Math.round(vh) } });
}
