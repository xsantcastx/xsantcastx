import { expect, test, type Page } from '@playwright/test';

import { INVENTORY_ERA } from '../src/app/shared/rpg/inventory.model';
import { REALM_ERA_KEY } from '../src/app/shared/save/realm-era';

/**
 * Worn gear sockets on the paper doll are a medallion 17% of the figure wide,
 * which is 33–35px on a 375–390px phone — under the 44px touch minimum. They
 * are tappable (a shortcut to the slot's well), so each one carries an
 * invisible hit pad of at least 44px. This measures the pads at phone width,
 * proves every socket's own centre lands on its own socket despite the pads
 * overlapping, and that a tap on one opens its slot.
 */

const WORN_SLOTS = ['head', 'chest', 'hands', 'weapon', 'trinket', 'legs', 'offhand'] as const;

// Artifacts fit every slot but Feet, so one shape seeds all seven sockets.
const SEEDED = {
  version: 2,
  era: INVENTORY_ERA,
  records: WORN_SLOTS.map((slotId, i) => ({
    id: `sock-${slotId}`, definitionId: `artifact:Sock ${slotId}`, kind: 'instance',
    category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: '2026-08-01T00:00:00.000Z',
    revision: { hlc: 1, deviceId: 'e2e', sequence: i + 1 }, source: 'inventory',
    name: `Sock ${slotId}`, type: 'artifact', stats: { goldPerSec: 1 }, sellValue: 5,
    location: { kind: 'equipped', slotId },
  })),
  tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null,
};

async function open(page: Page): Promise<void> {
  await page.addInitScript(
    ({ blob, eraKey, eraValue }) => {
      window.localStorage.setItem('xsantcastx_consent', 'denied');
      window.sessionStorage.setItem('visit-counted', '1');
      window.localStorage.setItem('easter-eggs-found', JSON.stringify(['forge-self-aware']));
      window.localStorage.setItem('godforge-inventory', blob);
      window.localStorage.setItem(eraKey, eraValue);
    },
    { blob: JSON.stringify(SEEDED), eraKey: REALM_ERA_KEY, eraValue: String(INVENTORY_ERA) },
  );
  await page.goto('/character', { waitUntil: 'load' });
  await page.waitForFunction(() => {
    const loader = document.querySelector('.gf-loader');
    if (!loader) return true;
    const style = getComputedStyle(loader);
    return loader.classList.contains('gf-loader--hidden')
      || style.visibility === 'hidden'
      || style.opacity === '0';
  }, { timeout: 8000 });
  await expect(page.locator('.ld').first().locator('.ld__socket-frame--worn')).toHaveCount(7);
}

for (const width of [375, 390]) {
  test(`every worn socket is a ≥44px target at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    // An achievement drop can slide in over the doll on first visit; it is
    // not part of the loadout, so dismiss it before hit-testing.
    const drop = page.locator('.ad--on');
    if (await drop.count()) await drop.first().click();
    await expect(drop).toHaveCount(0, { timeout: 15000 });
    // Let the landing flight settle so centres are measured at rest.
    await page.waitForTimeout(900);

    const report = await page.evaluate(() => {
      const doll = document.querySelector('.ld')!;
      return [...doll.querySelectorAll<HTMLElement>('.ld__socket-frame--worn')].map(frame => {
        const socket = frame.closest<HTMLElement>('.ld__socket')!;
        frame.scrollIntoView({ block: 'center' });
        const box = frame.getBoundingClientRect();
        const pad = getComputedStyle(frame, '::after');
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        // The topmost element *of the loadout* at that point. Site chrome that
        // is fixed to the viewport (the NPC bubble, the forge-flame toggle) can
        // sit over the doll depending on scroll; that is a page-level overlap,
        // not one socket's pad stealing another's centre, which is what the
        // overlapping pads could cause and what this check is for.
        const hit = document.elementsFromPoint(cx, cy).find(el => doll.contains(el)) ?? null;
        return {
          slot: socket.dataset['socket'],
          art: Math.round(box.width),
          padW: parseFloat(pad.width),
          padH: parseFloat(pad.height),
          ownCentre: !!hit && hit.closest('.ld__socket-frame--worn') === frame,
          hitWhat: hit ? `${hit.tagName.toLowerCase()}.${hit.className}` : 'nothing',
        };
      });
    });

    expect(report.map(r => r.slot).sort()).toEqual(
      ['chest', 'hands', 'head', 'legs', 'off-hand', 'trinket', 'weapon'],
    );
    for (const r of report) {
      expect.soft(r.padW, `${r.slot} pad width (art ${r.art}px)`).toBeGreaterThanOrEqual(44);
      expect.soft(r.padH, `${r.slot} pad height`).toBeGreaterThanOrEqual(44);
      expect.soft(r.ownCentre, `${r.slot} centre hits its own socket (hit ${r.hitWhat})`).toBe(true);
    }

    // The wells beside the figure stay ≥44px too.
    const wells = await page.locator('.ld').first().locator('.ld__slot').evaluateAll(els =>
      els.map(el => el.getBoundingClientRect()).map(b => Math.min(b.width, b.height)));
    for (const w of wells) expect(w).toBeGreaterThanOrEqual(44);

    // No horizontal scroll from the pads.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

    // A tap on a worn socket opens its slot, as its well would.
    await page.locator('.ld').first().locator('[data-socket="head"] .ld__socket-frame--worn').click();
    await expect(page.locator('.ld').first().getByRole('button', { name: /^Head,/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.ld__picker').first()).toBeVisible();
  });
}
