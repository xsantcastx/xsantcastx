/**
 * td-friends.spec.ts — the social graph (docs/design/online.md Phase 3; Hearth protocol 4).
 *
 * Three browsers against a private Hearth room run with SOCIAL_FAKE_AUTH=1 (tokens `fake.<uid>` stand in for Firebase
 * ID tokens on localhost; an in-memory store stands in for Firestore): Aster and Bryn (a phone) are signed in, Cora is
 * a guest. Aster asks Bryn to be friends; Bryn accepts from the toast; Menu → Friends shows Bryn online, in Aster's
 * area. Cora's card says Guest and offers no friendship. Aster whispers Bryn (the profanity mask on the way); Cora's
 * swearing is masked in public chat. Aster mutes Cora, then blocks her (she leaves Aster's world and chat; the Friends
 * sheet lists her under Blocked), unblocks her, and reports her. Bryn appears offline and takes invites from friends
 * only: Aster's list shows Bryn offline, Cora's invite is refused. Aster removes Bryn. A last test stands up the v3
 * room (before protocol 4) and checks the client degrades: no social buttons, a quiet line in the Friends sheet.
 *
 * Screenshots: docs/handoff/cozy-ui/friends-{card,request,list,list-phone,whisper,blocked,settings}.jpg.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';

// A blocked click names its blocker in ten seconds instead of eating the whole test's budget.
test.use({ actionTimeout: 10000 });

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL), undefined, { SOCIAL_FAKE_AUTH: '1' }); });
test.afterAll(async () => { await hearth?.stop(); });

const canvas = (page: Page) => page.locator('.viewport canvas');
const peers = async (page: Page) => (await canvas(page).getAttribute('data-peers')) ?? '';
const peerAt = async (page: Page, name: string) => {
  const m = new RegExp(`${name}@(-?\\d+),(-?\\d+)`).exec(await peers(page));
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};
const step = async (page: Page, key: string, ms: number) => {
  await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
};
const key = async (page: Page, k: string) => { await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true })); await page.keyboard.press(k); };
const hide = (page: Page) => page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
/** A tap on a Keeper beside a task giver can walk up to the giver and open the talk: put it away. */
const calm = async (page: Page) => { await page.waitForTimeout(400); if (await page.locator('.menu-scrim').count()) await page.locator('.menu-scrim').click({ position: { x: 4, y: 4 } }); };
/**
 * Tap a Keeper and wait for their card. Keepers glide between presence packets, so a tap can land a pixel off and
 * become a walk (even into a task giver's talk): put that away and tap again, from fresh coordinates.
 */
async function card(page: Page, name: string) {
  const c = page.locator('[data-peer-card]');
  for (let i = 0; i < 4; i++) {
    await calm(page);
    await expect.poll(() => peers(page), { timeout: 15000 }).toContain(`${name}@`);
    // Where they are drawn, once it holds still for a moment (the camera follows the Keeper).
    let at = await peerAt(page, name);
    for (let k = 0; k < 20; k++) {
      await page.waitForTimeout(150);
      const again = await peerAt(page, name);
      if (again && at && again.x === at.x && again.y === at.y) break;
      at = again;
    }
    expect(at, `${name} is drawn`).not.toBeNull();
    await page.mouse.click(at!.x, at!.y + 6);
    try { await expect(c.locator('h2')).toHaveText(name, { timeout: 2000 }); break; } catch { /* missed: again */ }
  }
  // A missed tap may have set the Keeper walking to a task giver: let it arrive, and put the talk away.
  await page.waitForTimeout(900);
  if (await page.locator('.td-talk').count()) await page.keyboard.press('Escape');
  await expect(c.locator('h2')).toHaveText(name, { timeout: 2000 });
  return c;
}
const gameLog = (page: Page) => page.locator('.td-chat__log');
const toGame = async (page: Page) => { await page.locator('.td-chat__tabs [role=tab]').first().click(); };
const toChat = async (page: Page) => { await page.locator('.td-chat__tabs [role=tab]').nth(1).click(); };
async function openFriends(page: Page) {
  await calm(page);
  await key(page, 'm');
  await page.locator('#places-list [data-open="friends"]').click();
  await expect(page.locator('[data-friends-sheet]')).toBeVisible();
}
async function settings(page: Page) {
  await key(page, 'm');
  await page.locator('#places-list [data-open="sound"]').click();
  await expect(page.locator('.sound-host')).toBeVisible();
}

test('friends, whispers, mute, block, report and privacy at the hearth', async ({ browser }, info) => {
  test.setTimeout(180_000);
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const cc = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage(), c = await cc.newPage();
  try {
    await enterAs(a, hearth.port, 'Aster', 'warlock', { 'eclipse-hearth-fake-token': 'fake.u1.aster' });
    await enterAs(b, hearth.port, 'Bryn', 'ashguard', { 'eclipse-hearth-fake-token': 'fake.u2.bryn' });
    await enterAs(c, hearth.port, 'Cora', 'lanternwright');
    await step(b, 'd', 600);
    await step(c, 'a', 600);
    for (const p of [a, b, c]) await hide(p);

    // ── Cora is a guest: her card says so and offers no friendship; she can still be whispered, muted, blocked. ──
    let cardC = await card(a, 'Cora');
    await expect(cardC.locator('[data-peer-guest]')).toHaveText('Guest');
    await expect(cardC.locator('[data-peer-friend]')).toHaveCount(0);
    await expect(cardC.locator('[data-peer-whisper]')).toBeVisible();
    await cardC.locator('.td-peer__x').click();

    // ── Friends: ask, the toast, accept ──
    const cardB = await card(a, 'Bryn');
    await expect(cardB.locator('[data-peer-guest]')).toHaveCount(0);
    await a.screenshot({ path: 'docs/handoff/cozy-ui/friends-card.jpg', type: 'jpeg', quality: 82 });
    await cardB.locator('[data-peer-friend]').click();
    await cardB.locator('.td-peer__x').click();
    const req = b.locator('[data-friend-request]');
    await expect(req).toContainText('Aster wants to be friends.', { timeout: 10000 });
    await b.screenshot({ path: 'docs/handoff/cozy-ui/friends-request.jpg', type: 'jpeg', quality: 82 });
    await req.locator('[data-friend-accept]').click();
    await expect(req).toBeHidden();
    await toGame(a);
    await expect(gameLog(a)).toContainText('You and Bryn are friends now.', { timeout: 10000 });

    // Menu → Friends: Bryn, online, in Aster's area.
    await openFriends(a);
    const rowB = a.locator('[data-friend][data-friend-name="Bryn"]');
    await expect(rowB).toHaveAttribute('data-online', 'true');
    await expect(rowB.locator('[data-friend-where]')).toHaveText('online, in your area');
    await a.screenshot({ path: 'docs/handoff/cozy-ui/friends-list.jpg', type: 'jpeg', quality: 82 });
    await openFriends(b);
    await expect(b.locator('[data-friend][data-friend-name="Aster"]')).toHaveAttribute('data-online', 'true');
    await b.screenshot({ path: 'docs/handoff/cozy-ui/friends-list-phone.jpg', type: 'jpeg', quality: 82 });
    await b.keyboard.press('Escape');

    // ── A whisper from the list: "/w Bryn " is ready; the line is masked on the way ──
    await rowB.locator('[data-friend-whisper]').click();
    const say = a.locator('.td-chat__say input');
    await expect(say).toHaveValue('/w Bryn ');
    await say.pressSequentially('meet me by the shit forge');
    await say.press('Enter');
    await toChat(b);
    await expect(b.locator('[data-whisper-line][data-whisper="from"]').last()).toHaveText('Aster whispers: meet me by the s*** forge', { timeout: 10000 });
    await expect(a.locator('[data-whisper-line][data-whisper="to"]').last()).toHaveText('To Bryn: meet me by the s*** forge');
    await b.screenshot({ path: 'docs/handoff/cozy-ui/friends-whisper.jpg', type: 'jpeg', quality: 82 });

    // ── Public chat: Cora swears, everyone reads it masked (her line marked as a guest's) ──
    await toChat(c);
    await c.locator('.td-chat__say input').fill('what the fuck is that');
    await c.locator('.td-chat__say input').press('Enter');
    await expect(a.locator('.td-chat__log li[data-guest]').last()).toHaveText('Cora: what the f*** is that', { timeout: 10000 });

    // ── Mute (this device): Cora's lines vanish on Aster's screen only ──
    cardC = await card(a, 'Cora');
    await cardC.locator('[data-peer-mute]').click();
    await cardC.locator('.td-peer__x').click();
    await toChat(a);
    await expect(a.locator('.td-chat__log')).not.toContainText('what the f***');
    await expect(b.locator('.td-chat__log')).toContainText('what the f***');
    cardC = await card(a, 'Cora');
    await cardC.locator('[data-peer-mute]').click();
    await cardC.locator('.td-peer__x').click();
    await expect(a.locator('.td-chat__log')).toContainText('what the f***');

    // ── Block: Cora leaves Aster's world and chat; the Friends sheet lists her; Unblock brings her back ──
    cardC = await card(a, 'Cora');
    await cardC.locator('[data-peer-block]').click();
    await expect(a.locator('[data-peer-card]')).toHaveCount(0);
    await expect.poll(() => peers(a), { timeout: 10000 }).not.toContain('Cora@');
    await c.locator('.td-chat__say input').fill('hello? anyone');
    await c.locator('.td-chat__say input').press('Enter');
    await expect(b.locator('.td-chat__log')).toContainText('hello? anyone', { timeout: 10000 });
    await expect(a.locator('.td-chat__log')).not.toContainText('hello? anyone');
    await openFriends(a);
    await expect(a.locator('[data-blocked][data-blocked-name="Cora"]')).toBeVisible();
    await a.screenshot({ path: 'docs/handoff/cozy-ui/friends-blocked.jpg', type: 'jpeg', quality: 82 });
    await a.locator('[data-blocked][data-blocked-name="Cora"] [data-unblock]').click();
    await expect(a.locator('[data-blocked]')).toHaveCount(0);
    await a.keyboard.press('Escape');
    await expect.poll(() => peers(a), { timeout: 10000 }).toContain('Cora@');

    // ── Report: one tap for the reason; the room files it ──
    cardC = await card(a, 'Cora');
    await cardC.locator('[data-peer-report]').click();
    await cardC.locator('[data-report-reason="abuse"]').click();
    await expect(a.locator('.td-chat__log, .td-toast').first()).toBeVisible();
    await toGame(a);
    await expect(gameLog(a)).toContainText('The report about Cora was filed.', { timeout: 10000 });
    await calm(a);

    // ── Privacy: Bryn appears offline and takes invites from friends only ──
    await settings(b);
    await b.locator('[data-presence-setting="offline"]').click();
    await b.locator('[data-invites-setting="friends"]').click();
    await b.locator('.sound-host').evaluate(el => { el.scrollTop = el.scrollHeight; });
    await b.screenshot({ path: 'docs/handoff/cozy-ui/friends-settings.jpg', type: 'jpeg', quality: 82 });
    await b.keyboard.press('Escape');
    await openFriends(a);
    await expect(a.locator('[data-friend][data-friend-name="Bryn"]')).toHaveAttribute('data-online', 'false', { timeout: 10000 });
    await expect(a.locator('[data-friend][data-friend-name="Bryn"] [data-friend-where]')).toHaveText('offline');
    // Cora (not a friend) cannot invite Bryn; Aster (a friend) still could.
    const bryn = await card(c, 'Bryn');
    await bryn.locator('[data-peer-invite]').click();
    await toGame(c);
    await expect(gameLog(c)).toContainText('not taking invites', { timeout: 10000 });

    // ── Remove: off both lists ──
    await a.locator('[data-friend][data-friend-name="Bryn"] [data-friend-remove]').click();
    await expect(a.locator('[data-friend]')).toHaveCount(0, { timeout: 10000 });
    await openFriends(b);
    await expect(b.locator('[data-friend]')).toHaveCount(0, { timeout: 10000 });
  } finally {
    await ca.close(); await cb.close(); await cc.close();
  }
});

test('against the v3 room (before protocol 4) the card has no social buttons and the Friends sheet waits', async ({ browser }, info) => {
  test.setTimeout(90_000);
  const v3 = info.outputPath('social-server-v3.mjs');
  let source = '';
  try { source = execFileSync('git', ['show', '6cf9e3b1:scripts/social-server.mjs'], { encoding: 'utf8' }); } catch { /* shallow clone */ }
  test.skip(!/PROTOCOL = 3;/.test(source), 'the v3 server source is not in this clone');
  fs.writeFileSync(v3, source);
  const old = await startHearth(String(info.project.use.baseURL), v3);
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    await enterAs(a, old.port, 'Aster', 'warlock', { 'eclipse-hearth-fake-token': 'fake.u1.aster' });
    await enterAs(b, old.port, 'Bryn', 'ashguard');
    await step(b, 'd', 600);
    await hide(a);
    const cardB = await card(a, 'Bryn');
    await expect(cardB.locator('[data-peer-wave]')).toBeVisible();
    await expect(cardB.locator('[data-peer-invite]')).toBeVisible();
    await expect(cardB.locator('[data-peer-social]')).toHaveCount(0);
    await expect(cardB.locator('[data-peer-guest]')).toHaveCount(0);
    await cardB.locator('.td-peer__x').click();
    await openFriends(a);
    await expect(a.locator('[data-friends-later]')).toHaveText('Friends open when the hearth updates.');
  } finally {
    await ca.close(); await cb.close(); await old.stop();
  }
});
