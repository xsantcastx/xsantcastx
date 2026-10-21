/**
 * td-ash2.spec.ts — the Ashguard's polish: the kit's iron helm in the four ways, and a held weapon in the swing.
 * The weapon's Strike and Spell Damage reach the engine as the swing's flat damage (td-melee weaponSwing); with
 * nothing in hand the blade swings as bare hands. Screenshots: docs/handoff/cozy-ui/ash2-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, seed } from './play-helpers';
import { activity, xpForLevel } from './play-delve-fixtures';
import { INVENTORY_ERA } from '../src/app/shared/rpg/inventory.model';

const SHOTS = 'docs/handoff/cozy-ui';
const canvas = (page: Page) => page.locator('.viewport canvas');
type Swing = { flat: number; mult: number };
const state = (page: Page) => page.evaluate(() => (window as unknown as { __tdAsh: { state(): { swing: Swing } } }).__tdAsh.state());
const foe = (page: Page, type: string, dx: number) => page.evaluate(([t, d]) => (window as unknown as { __tdAsh: { foe(t: string, d: number): number } }).__tdAsh.foe(t as string, d as number), [type, dx] as const);

const WEAPON = {
  version: 2, era: INVENTORY_ERA,
  records: [{
    id: 'a2-blade', definitionId: 'dawnrender', kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'rare', soulbound: false,
    acquiredAt: '2026-10-21T00:00:00.000Z', revision: { hlc: 1, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name: 'Dawnrender', type: 'artifact', stats: { strikePower: 3.2, spellDamage: 8 }, sellValue: 50, location: { kind: 'equipped', slotId: 'weapon' },
  }],
  tombstones: [], stackOps: [], goldFromSales: 0, sold: 0, hlc: 1, legacyBackup: null,
};

async function clip(page: Page, half: number, up = 20): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = (await canvas(page).boundingBox())!;
  return { x: Math.max(0, box.x + box.width / 2 - half), y: Math.max(0, box.y + box.height / 2 - half - up), width: half * 2, height: half * 2 };
}
async function walk(page: Page, key: string): Promise<void> {
  await canvas(page).focus();
  await page.keyboard.down(key); await page.waitForTimeout(350); await page.keyboard.up(key); await page.waitForTimeout(250);
}

test.use({ viewport: { width: 1280, height: 800 } });

for (const armed of [false, true]) {
  test(`the Ashguard's iron helm and swing (${armed ? 'weapon worn' : 'bare hands'})`, async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seed(page, {
      'eclipse-td': '1', 'preferred-language': 'en', 'godforge-realm-era': String(ERA), ...activity({ hunting: xpForLevel(8) }),
      'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Brann', vocation: 'ashguard', skin: 5, hair: 'cropped', updatedAt: 1 },
      ...(armed ? { 'godforge-inventory': WEAPON } : {}),
    });
    await page.goto('/play?td=1&hour=12');
    await expect(canvas(page)).toHaveAttribute('data-player-y', /\d/, { timeout: 20000 });
    // (3.2 Strike + a quarter of 8% Spell Damage − the starter's 1) × 3 = 13 flat; the Dawnrender is a greatsword, two
    // hands, so the blow lands ×1.2 (shared/rpg/item-hands.ts); bare hands swing at 85%.
    await expect.poll(async () => (await state(page)).swing, { timeout: 10000 }).toEqual(armed ? { flat: 13, mult: 1.2 } : { flat: 0, mult: .85 });

    if (armed) {
      for (const [key, dir] of [['s', 'down'], ['w', 'up'], ['a', 'left'], ['d', 'right']] as const) {
        await walk(page, key);
        await page.screenshot({ path: `${SHOTS}/ash2-helm-${dir}.jpg`, type: 'jpeg', quality: 92, clip: await clip(page, 52, 38) });
      }
      await foe(page, 'bone-walker', 22);
      await canvas(page).focus();
      await page.keyboard.down('j');
      await page.waitForTimeout(110);
      await page.screenshot({ path: `${SHOTS}/ash2-swing-weapon.jpg`, type: 'jpeg', quality: 90, clip: await clip(page, 110) });
      await page.keyboard.up('j');
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
}
