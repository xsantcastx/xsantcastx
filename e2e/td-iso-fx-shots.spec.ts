/**
 * td-iso-fx-shots.spec.ts — the spells and the fight at the isometric angle, the dungeon dressing, the stalls and the
 * Cold Hearth (td-iso-fx.ts, docs/handoff/iso-fx.md). Skipped unless ISO_FX_SHOTS is set:
 *
 *   ISO_FX_SHOTS=1 [ISO_FX_TAG=after] [ISO_FX_SCENES=combat,boss,dungeon,stalls,hearth,crypt,inn] [ISO_FX_SIZES=phone,desktop] \
 *     [ISO_FX_DETAIL=low] PW_PORT=4797 npx playwright test e2e/td-iso-fx-shots --project=chromium
 *
 * Writes output/iso-fx/<tag>/<scene>-<size>.png (not committed): 1280×800 DPR 2 and 390×844 DPR 3. The fight is laid by
 * the engine's camera hooks (__tdArt.fight / boss / dress) and held still (__tdArt.freeze). A camera, not a test — but
 * every scene must draw without a page error.
 */
import { expect, test, type Page } from '@playwright/test';
import { seed } from './play-helpers';

const ON = !!process.env['ISO_FX_SHOTS'];
const TAG = process.env['ISO_FX_TAG'] ?? 'after';
const SCENES = (process.env['ISO_FX_SCENES'] ?? 'combat,boss,dungeon,stalls,hearth,crypt,inn').split(',');
const SIZE_NAMES = (process.env['ISO_FX_SIZES'] ?? 'phone,desktop').split(',');
const DETAIL = process.env['ISO_FX_DETAIL'] ?? '';
const DIR = `output/iso-fx/${TAG}`;
const SIZES = [
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 } },
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 } },
] as const;

const run = (page: Page, fn: string) => page.evaluate(f => new Function('w', `return (${f})(w)`)(window), fn);

async function open(page: Page, query: string): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(d => {
    localStorage.setItem('preferred-language', 'en');
    if (d) localStorage.setItem('eclipse-td-detail', d);
  }, DETAIL);
  await seed(page, {
    'eclipse-td': '1',
    'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', skin: 1, hair: 'curls', hairColor: 0, outfit: 3, updatedAt: 1 },
  });
  await page.goto(`/play?td=1&${query}&artopt=iso`);
  await expect(page.locator('canvas').first()).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
  await page.waitForFunction(() => !!(window as unknown as { __tdZones?: unknown }).__tdZones && !!(window as unknown as { __tdArt?: unknown }).__tdArt);
  await page.waitForTimeout(2000);
  const skip = page.locator('[data-prologue-skip]').first();
  if (await skip.isVisible().catch(() => false)) await skip.click().catch(() => undefined);
  await page.addStyleTag({ content: '.guide, .glim-say, .lvl-banner, .area-card { visibility: hidden !important; }' });
  return errors;
}

/** Each scene: where to stand (go), then what to lay round the Keeper once he is there (lay). */
const PLACES: Record<string, { query?: string; go: string; lay?: string }> = {
  // A worn road through grass by day: novas, bolts, shots, spears, a falling frost ring, an ink stain, an elite's cold
  // aura, a pack aura's sigil, a creature's breath cone, sparks on a Bone Walker, the Keeper's aura pulsing.
  combat: { go: 'w => { w.__tdZones.to(58, 62); return w.__tdArt.road(0); }', lay: 'w => { w.__tdArt.freeze(true); w.__tdArt.aura(true); w.__tdArt.pulse(); return w.__tdArt.fight(); }' },
  // Ember Mine −1 in its dark: the Ashbone Dragon's breath cone, a charge lane, a summons' sigil, a rend ring.
  boss: { go: "w => w.__tdArt.visit('ember-mine-1', 11, 13, 'ember-isle')", lay: 'w => { w.__tdArt.freeze(true); return w.__tdArt.boss(); }' },
  // The same floor dressed: altar, braziers lit and cold, cage, chains, statue, cobweb, stairs, a ladder, ruin walls.
  dungeon: { go: "w => w.__tdArt.visit('ember-mine-1', 11, 13, 'ember-isle')", lay: 'w => { w.__tdArt.freeze(true); return w.__tdArt.dress(); }' },
  // The Seamworks square's stalls (the Keeper's first sight of the town).
  stalls: { go: 'w => true' },
  // The Cold Hearth by day, unlit, the Keeper three tiles east of it.
  hearth: { query: 'phase=day&fxfall=1', go: "w => { w.__tdHearth.at('hearth'); return new Promise(done => setTimeout(() => { const cv = document.querySelector('canvas'); const c = Math.floor(+cv.getAttribute('data-player-x') / 16), r = Math.floor(+cv.getAttribute('data-player-y') / 16); done(w.__tdArt.visit('surface', c + 3, r + 2, 'ember-isle')); }, 500)); }" },
  // The Drowned Crypts' walls at the fog's edge.
  crypt: { go: "w => w.__tdArt.visit('drowned-crypts-1', 24, 3, 'umbral-marches')" },
  // The inn's upstairs: its posts and pillars in front of the Keeper.
  inn: { go: "w => w.__tdArt.visit('ember-inn-2', 8, 5, 'ember-isle')" },
};

const shots = ON ? test.describe : test.describe.skip;
for (const size of SIZES) if (SIZE_NAMES.includes(size.name)) shots(`iso fx (${size.name})`, () => {
  test.use(size.use);
  for (const name of SCENES) test(name, async ({ page }) => {
    test.setTimeout(120000);
    const place = PLACES[name];
    const errors = await open(page, place.query ?? 'hour=12');
    await run(page, place.go);
    await page.waitForTimeout(3000);
    if (place.lay) await run(page, place.lay);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${DIR}/${name}-${size.name}${DETAIL ? `-${DETAIL}` : ''}.png` });
    expect(errors).toEqual([]);
  });
});
