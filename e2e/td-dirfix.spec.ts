/**
 * td-dirfix.spec.ts — three Art & UX Director notes on the Isometric world (docs/handoff/dirfix.md):
 *   1. On a phone the camera clears the left skill rail: the Keeper stands in the middle of the world the rails
 *      leave, and a big target (a Lava Hound) the rail would hide is brought out from under it.
 *   2. The Interact prompt never covers a name plate: a creature whose name would sit under the prompt has it lifted
 *      clear (landscape phone and desktop).
 *   3. A wolf behind a tree, too far for the old six-tile reach but near enough to wear its bar, fades the crown.
 * SHOTS=<dir> also saves before/after pictures (the "before" removes the HUD markers the engine measures, which is the
 * old behaviour exactly).
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

type View = { shift: number; l: number; r: number; avoid: number; faded: number };
type Pt = { x: number; y: number };
const SHOTS = process.env['SHOTS'];
const canvas = (page: Page) => page.locator('.viewport canvas');
const art = <T>(page: Page, f: string, ...args: unknown[]): Promise<T> =>
  page.evaluate(([f, args]) => (window as unknown as { __tdArt: Record<string, (...a: unknown[]) => unknown> }).__tdArt[f as string](...(args as unknown[])), [f, args] as const) as Promise<T>;
const frameErrors: string[] = [];
test.beforeEach(({ page }) => { frameErrors.length = 0; page.on('console', m => { if (m.type() === 'error' && m.text().includes('frame error')) frameErrors.push(m.text()); }); });
test.afterEach(() => { expect(frameErrors).toEqual([]); });

async function open(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
  await seed(page, { 'eclipse-td': '1', 'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', hair: 'curls', updatedAt: 1 } });
  await page.goto('/play?td=1&hour=12&artopt=iso');
  await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 30000 });
  await expect(canvas(page)).toHaveAttribute('data-graphics', 'iso');
  await page.waitForFunction(() => !!(window as unknown as { __tdArt?: unknown }).__tdArt && !!(window as unknown as { __tdZones?: unknown }).__tdZones);
  await page.addStyleTag({ content: '.guide, .glim-say, .area-card, .lvl-banner { visibility: hidden !important; }' });
  await page.waitForTimeout(1200);
}
/** Every visible HUD button standing over the world (not inside a panel or window), as [x0, y0, x1, y1] css px. */
const hudButtons = (page: Page): Promise<number[][]> => page.evaluate(() => {
  const out: number[][] = [];
  for (const el of Array.from(document.querySelectorAll('.stage button'))) {
    if (el.closest('dialog, [role=dialog], .place')) continue;
    const b = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (b.width < 2 || b.height < 2 || cs.visibility === 'hidden' || cs.display === 'none' || b.right < 0 || b.left > innerWidth || b.bottom < 0 || b.top > innerHeight) continue;
    out.push([b.left, b.top, b.right, b.bottom]);
  }
  return out;
});
const player = async (page: Page): Promise<Pt> => ({ x: Number(await canvas(page).getAttribute('data-player-x')), y: Number(await canvas(page).getAttribute('data-player-y')) });
/** CSS px per art px, from the projection itself. */
const cssPerArt = async (page: Page, p: Pt): Promise<number> => {
  const a = await art<Pt>(page, 'pageOf', p.x, p.y), b = await art<Pt>(page, 'pageOf', p.x + 10, p.y + 10);
  return (b.y - a.y) / 10;
};
/** The world offset from the Keeper whose foot (lifted `lift` art px) projects `dx`, `dy` css px from his foot. */
const offsetFor = (dx: number, dy: number, c: number, lift = 0) => {
  const X = dx / c, Y = dy / c + lift;
  return { x: Math.round(Y + X / 2), y: Math.round(Y - X / 2) };
};
/** Remove the HUD markers the engine measures: the old camera and plates, for the "before" pictures. */
const unmark = (page: Page, attr: string) => page.evaluate(a => document.querySelectorAll(`[${a}]`).forEach(e => e.removeAttribute(a)), attr);

for (const size of [{ width: 360, height: 640 }, { width: 390, height: 844 }]) {
  test.describe(`phone ${size.width}×${size.height}`, () => {
    test.use({ viewport: size, hasTouch: true, isMobile: true });
    test('the camera clears the skill rail, and brings a Lava Hound target out from under it', async ({ page }) => {
      test.setTimeout(90000);
      await open(page);
      // A portrait phone's thumb HUD (docs/design/ui-pass-3.md §A.2) keeps the skills under the right thumb and nothing
      // on the left over the play centre: there is no rail for the camera to clear (play-thumb-hud.spec.ts pins it).
      test.skip(await page.locator('.stage--thumb').count() > 0, 'no left skill rail on a portrait phone');
      const rail = await page.locator('.td-skills').boundingBox();
      expect(rail, 'the phone skill rail is shown').not.toBeNull();
      await expect.poll(async () => (await art<View>(page, 'view')).l, { timeout: 5000 }).toBeGreaterThan(40);
      const v = await art<View>(page, 'view');
      // The Keeper stands in the middle of the world right of the rail (within a few px), not under the canvas's centre.
      const p = await player(page), at = await art<Pt>(page, 'pageOf', p.x, p.y);
      await expect.poll(async () => { const q = await art<Pt>(page, 'pageOf', p.x, p.y); return Math.abs(q.x - (v.l + size.width) / 2); }, { timeout: 5000 }).toBeLessThan(4);
      expect(at.x).toBeGreaterThan(size.width / 2);
      // A Lava Hound placed where, centred on the screen's old middle, it would stand right under the rail.
      const c = await cssPerArt(page, p), here = await art<Pt>(page, 'pageOf', p.x, p.y);
      const off = offsetFor(rail!.x + rail!.width / 2 - here.x, 0, c);
      await page.evaluate(o => (window as unknown as { __tdZones: { foe(t: string, l: number, dx: number, dy: number): number | null } }).__tdZones.foe('lava-hound', 10, o.x, o.y), off);
      const hound = { x: p.x + off.x, y: p.y + off.y };
      expect((await art<Pt>(page, 'pageOf', hound.x, hound.y)).x).toBeLessThan(rail!.x + rail!.width);
      if (SHOTS) {
        await unmark(page, 'data-world-rail');
        await page.waitForTimeout(800);
        await page.screenshot({ path: `${SHOTS}/before-hound-${size.width}x${size.height}.png` });
        await page.reload();
        await open(page);
        await page.evaluate(o => (window as unknown as { __tdZones: { foe(t: string, l: number, dx: number, dy: number): number | null } }).__tdZones.foe('lava-hound', 10, o.x, o.y), off);
      }
      expect(await art<boolean>(page, 'aim')).toBe(true);
      // Targeted: the camera brings its body out from under the rail.
      await expect.poll(async () => (await art<Pt>(page, 'pageOf', hound.x, hound.y)).x, { timeout: 5000 }).toBeGreaterThan(rail!.x + rail!.width + 8);
      // The Keeper is still well inside the view.
      const k = await art<Pt>(page, 'pageOf', p.x, p.y);
      expect(k.x).toBeGreaterThan(size.width * .3);
      expect(k.x).toBeLessThan(size.width * .9);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-hound-${size.width}x${size.height}.png` });
    });
  });
}

for (const size of [{ width: 844, height: 390, touch: true }, { width: 1280, height: 800, touch: false }]) {
  test.describe(`prompt ${size.width}×${size.height}`, () => {
    test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.touch });
    test('a name plate under the Interact prompt is lifted clear of it', async ({ page }) => {
      test.setTimeout(90000);
      await open(page);
      // A sideways phone's thumb HUD (ui-pass-3 Wave B) has no prompt bar: the disc and a ticker line name the verb.
      test.skip(await page.locator('.stage--thumb').count() > 0, 'no Interact prompt under the thumb HUD');
      const prompt = page.locator('.prompt.armed');
      await expect(prompt).toBeVisible({ timeout: 10000 });
      await expect.poll(async () => (await art<View>(page, 'view')).avoid, { timeout: 5000 }).toBeGreaterThanOrEqual(1);
      const pr = (await prompt.boundingBox())!;
      const p = await player(page), c = await cssPerArt(page, p), here = await art<Pt>(page, 'pageOf', p.x, p.y);
      // An Ash Wolf whose name would sit right in the prompt's middle (its name ~ its height + 6 px over its foot).
      const zones = (o: Pt) => page.evaluate(o => (window as unknown as { __tdZones: { foe(t: string, l: number, dx: number, dy: number): number | null } }).__tdZones.foe('ash-wolf', 1, o.x, o.y), o);
      await zones({ x: 4000, y: 4000 });
      await art(page, 'aim');
      const h = (await art<{ h: number }>(page, 'target'))!.h;
      await art(page, 'aim', 99999);
      const off = offsetFor(pr.x + pr.width / 2 - here.x, pr.y + pr.height / 2 - here.y, c, h + 6);
      await zones(off);
      await page.waitForTimeout(500);
      const meets = (a: number[]) => a[0] < pr.x + pr.width && a[2] > pr.x && a[1] < pr.y + pr.height && a[3] > pr.y;
      if (SHOTS) {
        await unmark(page, 'data-world-avoid');
        await page.waitForTimeout(600);
        // Without the marker (the old build) the wolf's name sits under the prompt.
        expect((await art<number[][]>(page, 'plates')).some(meets)).toBe(true);
        await page.screenshot({ path: `${SHOTS}/before-prompt-${size.width}x${size.height}.png` });
        await page.evaluate(() => document.querySelector('.prompt.armed')!.setAttribute('data-world-avoid', ''));
        await page.waitForTimeout(600);
      }
      const plates = await art<number[][]>(page, 'plates');
      expect(plates.length).toBeGreaterThan(0);
      expect(plates.filter(meets), `plates ${JSON.stringify(plates)} clear of the prompt ${JSON.stringify(pr)}`).toEqual([]);
      // The wolf's own name stands just over the prompt (lifted, not lost).
      expect(plates.some(a => a[0] < pr.x + pr.width && a[2] > pr.x && a[3] <= pr.y + .5 && a[3] > pr.y - 4 * c)).toBe(true);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/after-prompt-${size.width}x${size.height}.png` });
      // No plate lands against ANY HUD button (the campfire / anchor buttons, the rails, the attack cluster).
      const buttons = await hudButtons(page);
      expect(buttons.length).toBeGreaterThan(0);
      const hit = plates.filter(a => buttons.some(b => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]));
      expect(hit, `plates ${JSON.stringify(plates)} clear of the HUD buttons ${JSON.stringify(buttons)}`).toEqual([]);
    });
  });
}

test.describe('crowns', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test('a wolf behind a tree eight tiles off (it wears its bar) fades the crown', async ({ page }) => {
    test.setTimeout(90000);
    await open(page);
    const r = await art<{ tree: Pt; mob: Pt } | null>(page, 'behindTree', 'ash-wolf', 1, 0, 3000, 10);
    expect(r, 'a tree whose crown fades on this map').not.toBeNull();
    // The Keeper eight tiles south-east of the tree (in front of it on the screen, out of the old six-tile reach).
    // The tile eight tiles off can be blocked (a rock, another tree) and the jump then lands further away, so try the
    // spots round it until the Keeper stands outside the old reach but inside the bar's.
    let p = await player(page), dist = Infinity;
    for (const [dx, dy] of [[0, 0], [16, 0], [0, 16], [-16, 0], [0, -16], [16, 16], [-16, -16], [32, 0], [0, 32]]) {
      const d = 128 / Math.SQRT2;
      await page.evaluate(([x, y]) => (window as unknown as { __tdZones: { to(c: number, r: number): boolean } }).__tdZones.to(Math.floor(x / 16), Math.floor(y / 16)), [r!.tree.x + d + dx, r!.tree.y + d + dy]);
      p = await player(page);
      dist = Math.hypot(r!.mob.x - p.x, r!.mob.y - p.y);
      if (dist <= 150 && Math.max(Math.abs(r!.mob.x - p.x), Math.abs(r!.mob.y - p.y)) > 96) break;
    }
    expect(Math.max(Math.abs(r!.mob.x - p.x), Math.abs(r!.mob.y - p.y))).toBeGreaterThan(96);
    expect(dist).toBeLessThanOrEqual(150);
    await expect.poll(async () => (await art<View>(page, 'view')).faded, { timeout: 5000 }).toBeGreaterThan(0);
    if (SHOTS) {
      const at = await art<Pt>(page, 'pageOf', r!.mob.x, r!.mob.y);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/after-wolf-behind-tree.png`, clip: { x: Math.max(0, at.x - 200), y: Math.max(0, at.y - 220), width: 400, height: 320 } });
    }
  });
});
