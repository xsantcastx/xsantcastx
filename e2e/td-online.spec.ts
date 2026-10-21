/**
 * td-online.spec.ts — online, step 1 (owner 2026-10-21: "is online working? … can other players see each other?").
 *
 * Two browsers enter the top-down world against a private Hearth room (scripts/social-server.mjs on a free port):
 * both join on their own (no button), each draws the other as a sprite with a name plate, a chat line arrives on
 * the other side (with an unread count while its Chat tab is not open), a tap on the other Keeper opens their card,
 * and Wave shows over both Keepers on both screens. Settings → Chat → Ignore leaves the room.
 * Screenshots: docs/handoff/cozy-ui/online-two-keepers.jpg, online-card-wave.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL)); });
test.afterAll(async () => { await hearth?.stop(); });

const peers = async (page: Page) => (await page.locator('.viewport canvas').getAttribute('data-peers')) ?? '';
const peerAt = async (page: Page, name: string) => {
  const m = new RegExp(`${name}@(-?\\d+),(-?\\d+)`).exec(await peers(page));
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};

test('two Keepers see each other, chat, and wave', async ({ browser }, info) => {
  test.setTimeout(120_000);
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    await enterAs(a, hearth.port, 'Aster', 'warlock');
    await enterAs(b, hearth.port, 'Bryn', 'ashguard');
    // Bryn steps away east, so the two stand apart (and a tap finds Bryn, not Aster).
    await b.locator('.viewport canvas').evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
    await b.keyboard.down('d'); await b.waitForTimeout(700); await b.keyboard.up('d');
    // Each draws the other (same area, as a sprite with a plate): the canvas lists who it drew.
    await expect.poll(() => peers(a), { timeout: 15000 }).toContain('Bryn@');
    await expect.poll(() => peers(b), { timeout: 15000 }).toContain('Aster@');
    await expect(a.locator('.td-chat__tabs .td-chat__online')).toHaveText('2 online');
    // Let Bryn's glide settle where Bryn stopped.
    await a.waitForTimeout(800);
    await a.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card { visibility: hidden !important; }' });
    await a.screenshot({ path: 'docs/handoff/cozy-ui/online-two-keepers.jpg', type: 'jpeg', quality: 80 });

    // Chat: Bryn speaks; Aster (on the Game tab) gets an unread count, then the line.
    await b.locator('.td-chat__tabs [role=tab]').nth(1).click();
    await b.locator('.td-chat__say input').fill('Well met by the fire!');
    await b.locator('.td-chat__say input').press('Enter');
    await expect(a.locator('[data-chat-unread]').first()).toHaveText('1', { timeout: 10000 });
    await a.locator('.td-chat__tabs [role=tab]').nth(1).click();
    await expect(a.locator('.td-chat__log')).toContainText('Bryn: Well met by the fire!');
    await expect(a.locator('[data-chat-unread]')).toHaveCount(0);

    // Aster taps Bryn: the card (name, class, level) and Wave.
    const at = await peerAt(a, 'Bryn');
    expect(at, 'Bryn is drawn on Aster\'s screen').not.toBeNull();
    await a.mouse.click(at!.x, at!.y);
    const card = a.locator('[data-peer-card]');
    await expect(card).toBeVisible({ timeout: 5000 });
    await expect(card.locator('h2')).toHaveText('Bryn');
    await expect(card).toContainText(/Ashguard/);
    await expect(card).toContainText(/Level \d+/);
    await card.locator('[data-peer-wave]').click();
    // Over both, on both screens: Aster sees itself and Bryn waving; Bryn sees Aster waving and itself waved at.
    await expect(a.locator('.viewport canvas')).toHaveAttribute('data-self-waving', 'true');
    await expect.poll(() => peers(a)).toMatch(/Bryn@-?\d+,-?\d+~/);
    await expect.poll(() => peers(b), { timeout: 5000 }).toMatch(/Aster@-?\d+,-?\d+~/);
    await expect(b.locator('.viewport canvas')).toHaveAttribute('data-self-waving', 'true');
    await expect(b.locator('.td-chat')).toBeVisible();
    await a.screenshot({ path: 'docs/handoff/cozy-ui/online-card-wave.jpg', type: 'jpeg', quality: 80 });

    // Settings → Chat → Ignore: Bryn leaves the room, and Aster stops drawing Bryn.
    await b.locator('.viewport canvas').evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
    await b.keyboard.press('m');
    await b.locator('#places-list [data-open="sound"]').click();
    await b.locator('[data-chat-setting="ignore"]').click();
    await expect.poll(() => peers(a), { timeout: 15000 }).not.toContain('Bryn@');
    await expect(a.locator('.td-chat__tabs .td-chat__online')).toHaveText('1 online');
  } finally {
    await ca.close(); await cb.close();
  }
});
