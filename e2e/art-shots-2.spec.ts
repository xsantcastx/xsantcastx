/**
 * art-shots-2.spec.ts — before/after screenshots for one art style, pass 2
 * (docs/handoff/one-art-style.md, "What remains"): portraits, item icons, the
 * Gambler altar, hub dressing, the Homestead. Towns and hunts are shot by
 * art-shots.spec.ts (ART_DIR points it here). Skipped unless ART_SHOTS names a prefix:
 *
 *   ART_SHOTS=after PW_PORT=4371 npx playwright test e2e/art-shots-2 --project=chromium
 *
 * A camera, not a test: nothing is asserted beyond reaching the scene.
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, ERA, ledger, openPlay, seed, walkTo } from './play-helpers';

const PREFIX = process.env['ART_SHOTS'] ?? '';
const DIR = process.env['ART_DIR'] ?? 'docs/handoff/one-art-style-2';
const RESTORED = { 'eclipse-seamworks-world-v1': { restored: true, era: ERA, resetAt: null } };

const SIZES = [
  { name: 'phone', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } },
  { name: 'desktop', use: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } },
] as const;

/** A satchel that shows every icon family: ores, bars, gems, herbs, runes, fish, crates, tools. */
const BAG = [
  'cinder-ore', 'emberheart-ore', 'orichalcum-ore', 'celestial-alloy', 'celestial-quartz', 'void-crystal', 'luminous-prism',
  'sunbloom', 'nightbloom', 'moonpetal-herb', 'thornroot', 'verdant-sap', 'solar-resin', 'shadowthread-silk', 'world-root-bark',
  'slag-fragment', 'pyrite-dust', 'umbral-ink', 'infernal-heartstone', 'ember-residue', 'blindfin', 'root-crate', 'ironwood', 'inkstone',
];
const ITEM = (id: string, def: string, name: string, type: string, rarity: string, slot?: string) => ({
  id, definitionId: def, kind: 'instance', category: 'equipment', tags: ['equipment'], rarity, soulbound: false,
  acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 900, deviceId: 'e2e', sequence: 900 }, source: 'inventory',
  name, type, ...(slot ? { slot } : {}), stats: { power: 3 }, rollQuality: { power: 0.6 }, sellValue: 10, econ: 3, location: { kind: 'bag' },
});
const GEAR = [
  ITEM('e2e-longblade', 'eclipse-longblade', 'Eclipse Longblade', 'weapon', 'epic', 'weapon'),
  ITEM('e2e-helm', 'astral-helm', 'Astral Helm', 'armor', 'rare', 'head'),
  ITEM('e2e-cuirass', 'infernal-cuirass', 'Infernal Cuirass', 'armor', 'legendary', 'chest'),
  ITEM('e2e-ring', 'anchor-ring', 'Anchor Ring', 'trinket', 'uncommon', 'trinket'),
];

async function shot(page: Page, scene: string, size: string): Promise<void> {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${DIR}/${PREFIX}-${scene}-${size}.jpg`, type: 'jpeg', quality: 82 });
}

async function waitLoader(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const loader = document.querySelector('.gf-loader');
    if (!loader) return true;
    const style = getComputedStyle(loader);
    return loader.classList.contains('gf-loader--hidden') || style.visibility === 'hidden' || style.opacity === '0';
  }, { timeout: 10000 }).catch(() => undefined);
}

const shots = PREFIX ? test.describe : test.describe.skip;

for (const size of SIZES) {
  shots(`art shots 2 (${size.name})`, () => {
    test.use(size.use);
    test.describe.configure({ timeout: 180000 });

    test('satchel icons', async ({ page }) => {
      const inv = ledger(Object.fromEntries(BAG.map((id, i) => [id, 3 + i]))) as { records: unknown[] };
      inv.records.push(...GEAR);
      await seed(page, { ...RESTORED, 'godforge-realm-era': String(ERA), 'godforge-inventory': inv });
      await openPlay(page);
      await page.keyboard.press('i');
      await expect(page.locator('#satchel-book')).toBeVisible();
      await shot(page, 'satchel', size.name);
    });

    test('npc portrait (Verrin) and Codex people', async ({ page }) => {
      await seed(page, RESTORED);
      await page.goto('/world/realms/umbral', { waitUntil: 'load' });
      await waitLoader(page);
      await expect(page.locator('.npc__portrait')).toBeVisible({ timeout: 20000 });
      await page.waitForTimeout(600);
      await shot(page, 'npc-verrin', size.name);
      await page.goto('/codex?tab=collection', { waitUntil: 'load' });
      await waitLoader(page);
      // People of the Realms is deferred below the log: scroll until it renders, then to it.
      const people = page.locator('[data-codex="people"]');
      await page.locator('[data-codex="glim"]').scrollIntoViewIfNeeded({ timeout: 20000 }).catch(() => undefined);
      for (let i = 0; i < 20 && !(await people.count()); i++) {
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(300);
      }
      await people.scrollIntoViewIfNeeded({ timeout: 20000 }).catch(() => undefined);
      await page.waitForTimeout(600);
      await shot(page, 'codex-people', size.name);
    });

    test('market shelves', async ({ page }) => {
      await seed(page, { ...RESTORED, 'godforge-economy': { version: 3, gold: 50_000_000, totalGoldEarned: 5e7, runGoldEarned: 5e7 } });
      await page.goto('/market', { waitUntil: 'load' });
      await waitLoader(page);
      await page.waitForTimeout(800);
      await shot(page, 'market', size.name);
    });

    test('gambler altar', async ({ page }) => {
      await seed(page, { ...RESTORED, 'godforge-economy': { version: 3, gold: 1_000_000, totalGoldEarned: 1e6, runGoldEarned: 1e6 } });
      await page.goto('/gambler', { waitUntil: 'load' });
      await waitLoader(page);
      await shot(page, 'gambler', size.name);
      const open = page.locator('.gb__buy .ab__btn');
      if (await open.isVisible().catch(() => false)) {
        await open.click();
        await page.waitForTimeout(1400);
        await shot(page, 'gambler-reveal', size.name);
      }
    });

    test('hub dressing', async ({ page }) => {
      await seed(page, RESTORED);
      await openPlay(page);
      await shot(page, 'hub', size.name);
    });

    test('homestead', async ({ page }) => {
      await seed(page, {
        ...RESTORED,
        'godforge-economy': {
          version: 3, gold: 2e9, totalGoldEarned: 2e9, runGoldEarned: 2e9,
          upgrades: { 'apprentice-striker': 5, 'forge-golem': 3, 'eclipse-automaton': 1, 'forge-bellows': 4, 'ember-stoker': 2, 'nether-furnace': 1 },
        },
      });
      await openPlay(page);
      await walkTo(page, 1075, 40);
      await page.keyboard.press('e');
      await expect(canvas(page)).toHaveAttribute('data-area', 'Your Homestead', { timeout: 30000 });
      await page.waitForTimeout(1200);
      await shot(page, 'homestead', size.name);
      await walkTo(page, 1500, 80).catch(() => undefined);
      await shot(page, 'homestead-east', size.name);
    });
  });
}
