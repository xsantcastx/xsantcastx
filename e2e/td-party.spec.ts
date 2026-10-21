/**
 * td-party.spec.ts — parties (docs/design/online.md Phase 2; Hearth protocol 3).
 *
 * Three browsers enter the top-down world against a private Hearth room (scripts/social-server.mjs on a free port):
 * Aster taps Bryn and invites; Bryn (a phone) gets the cozy invite toast and accepts; Aster invites Cora, who accepts.
 * Aster's party frames show both (name, class · level, life, which way); Bryn is hurt and Aster's frame for Bryn drops.
 * Bryn speaks on the Party tab and the line reaches Aster and Cora (with an unread count). Aster fells a creature:
 * Bryn and Cora, standing near, each get a share of its Hunting XP (a toast). Cora leaves, then Bryn: the party is gone.
 * A last test stands up the v2 room (the server as it was before protocol 3) and checks the client degrades: no
 * invite button, a quiet line on the card, everything else unchanged.
 *
 * Screenshots: docs/handoff/cozy-ui/party-{invite,frames,frames-phone,chat,xp}.jpg.
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import { expect, test, type Page } from '@playwright/test';
import { enterAs, newContext, startHearth, type Hearth } from './hearth-helpers';
import { ERA } from './play-helpers';
import { emptyActivityLedger } from '../src/app/shared/activity/activity.model';
import { keeperXpForLevel } from '../src/app/shared/skills/keeper-level';

let hearth: Hearth;
test.beforeAll(async ({}, info) => { hearth = await startHearth(String(info.project.use.baseURL)); });
test.afterAll(async () => { await hearth?.stop(); });

const canvas = (page: Page) => page.locator('.viewport canvas');
const peers = async (page: Page) => (await canvas(page).getAttribute('data-peers')) ?? '';
const peerAt = async (page: Page, name: string) => {
  const m = new RegExp(`${name}@(-?\\d+),(-?\\d+)`).exec(await peers(page));
  return m ? { x: Number(m[1]), y: Number(m[2]) } : null;
};
/** Level 6 Keepers (the creatures round the Seamworks sit inside a level-6 band). */
const keeper = () => {
  const act = emptyActivityLedger();
  act.progress.xpByDiscipline = { hunting: keeperXpForLevel(6) + 10 } as typeof act.progress.xpByDiscipline;
  return { 'godforge-realm-era': String(ERA), 'godforge-activity': act };
};
const step = async (page: Page, key: string, ms: number) => {
  await canvas(page).evaluate(c => (c as HTMLCanvasElement).focus({ preventScroll: true }));
  await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key);
};
const hide = (page: Page) => page.addStyleTag({ content: '.glim-say, .lvl-banner, .area-card, .guide { visibility: hidden !important; }' });
/** A tap on a Keeper beside a task giver can walk up to the giver and open the talk: put it away. */
const calm = async (page: Page) => { await page.waitForTimeout(400); if (await page.locator('.menu-scrim').count()) await page.locator('.menu-scrim').click({ position: { x: 4, y: 4 } }); };
/** Tap a peer on `page` and invite them. */
async function invite(page: Page, name: string): Promise<void> {
  await expect.poll(() => peers(page), { timeout: 15000 }).toContain(`${name}@`);
  await page.waitForTimeout(600);
  const at = await peerAt(page, name);
  expect(at, `${name} is drawn`).not.toBeNull();
  await page.mouse.click(at!.x, at!.y);
  const card = page.locator('[data-peer-card]');
  await expect(card.locator('h2')).toHaveText(name, { timeout: 5000 });
  await card.locator('[data-peer-invite]').click();
  await card.locator('.td-peer__x').click();
}

test('a party: invite, accept, frames, party chat, shared XP on a kill, leave', async ({ browser }, info) => {
  test.setTimeout(180_000);
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const cc = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage(), c = await cc.newPage();
  try {
    await enterAs(a, hearth.port, 'Aster', 'warlock', keeper(), 'fxparty=1');
    await enterAs(b, hearth.port, 'Bryn', 'ashguard', keeper(), 'fxparty=1');
    await enterAs(c, hearth.port, 'Cora', 'lanternwright', keeper(), 'fxparty=1');
    // Bryn steps east and Cora west, so a tap finds each of them (and all three stay well inside 12 tiles).
    await step(b, 'd', 600);
    await step(c, 'a', 600);
    for (const p of [a, b, c]) await hide(p);

    // ── Invite → the toast → Accept ──
    await invite(a, 'Bryn');
    const toast = b.locator('[data-party-invite]');
    await expect(toast).toBeVisible({ timeout: 10000 });
    await expect(toast).toContainText('Aster invites you to a party.');
    await b.screenshot({ path: 'docs/handoff/cozy-ui/party-invite.jpg', type: 'jpeg', quality: 82 });
    await toast.locator('[data-invite-accept]').click();
    await expect(toast).toBeHidden();
    await expect(a.locator('[data-party-frames]')).toHaveAttribute('data-party-size', '2', { timeout: 10000 });
    await expect(a.locator('[data-party-frame][data-member="Bryn"]')).toContainText('Ashguard');

    await invite(a, 'Cora');
    await c.locator('[data-party-invite] [data-invite-accept]').click({ timeout: 10000 });
    await expect(a.locator('[data-party-frames]')).toHaveAttribute('data-party-size', '3', { timeout: 10000 });
    await expect(a.locator('[data-party-frame]')).toHaveCount(2);
    await expect(b.locator('[data-party-frame]')).toHaveCount(2);
    // The leader's crown on Aster's frame, on the others' screens; which way and how far, from presence.
    await expect(c.locator('[data-party-frame][data-member="Aster"] .td-party__crown')).toHaveCount(1);
    await expect(a.locator('[data-party-frame][data-member="Bryn"] [data-party-where]')).toHaveText(/beside you|east|north|south|west/);

    // ── Life travels: Bryn is hurt, Aster's frame for Bryn drops ──
    await b.evaluate(() => (window as unknown as { __tdParty: { hurt: (n: number) => void } }).__tdParty.hurt(45));
    await expect.poll(async () => Number(await a.locator('[data-party-frame][data-member="Bryn"]').getAttribute('data-hp')), { timeout: 10000 }).toBeLessThan(100);
    await calm(a);
    await a.screenshot({ path: 'docs/handoff/cozy-ui/party-frames.jpg', type: 'jpeg', quality: 82 });
    await b.waitForTimeout(300);
    await b.screenshot({ path: 'docs/handoff/cozy-ui/party-frames-phone.jpg', type: 'jpeg', quality: 82 });

    // ── Party chat: a Party tab beside Chat; the others get an unread count, then the line ──
    await b.locator('[data-party-tab]').click();
    await b.locator('[data-party-say] input').fill('On my way, stay by the fire');
    await b.locator('[data-party-say] input').press('Enter');
    await expect(a.locator('[data-party-unread]')).toHaveText('1', { timeout: 10000 });
    await a.locator('[data-party-tab]').click();
    await expect(a.locator('[data-party-line]').last()).toHaveText('Bryn: On my way, stay by the fire');
    await expect(c.locator('[data-party-tab] [data-party-unread]')).toHaveText('1');
    // "/p" in the Chat tab goes to the party too; the public room never hears it.
    await c.locator('.td-chat__tabs [role=tab]').nth(1).click();
    await c.locator('.td-chat__say input').fill('/p Right behind you');
    await c.locator('.td-chat__say input').press('Enter');
    await expect(a.locator('[data-party-line]').last()).toHaveText('Cora: Right behind you', { timeout: 10000 });
    await calm(a);
    await a.screenshot({ path: 'docs/handoff/cozy-ui/party-chat.jpg', type: 'jpeg', quality: 82 });

    // ── Shared XP: Aster fells a creature; Bryn and Cora, near, each pay themselves a share ──
    const felled = await a.evaluate(() => (window as unknown as { __tdParty: { smite: () => string | null } }).__tdParty.smite());
    expect(felled, 'a creature to fell').toBeTruthy();
    for (const p of [b, c]) await expect(canvas(p)).toHaveAttribute('data-party-share', /^\+\d+$/, { timeout: 10000 });
    await c.locator('.td-chat__tabs [role=tab]').first().click();
    await expect(c.locator('.td-chat__log')).toContainText(/Hunting XP, shared by Aster/);
    await c.waitForTimeout(200);
    await c.screenshot({ path: 'docs/handoff/cozy-ui/party-xp.jpg', type: 'jpeg', quality: 82 });

    // ── Leave: Cora leaves (two remain); Bryn leaves (one left: no party) ──
    await c.locator('[data-party-leave]').click({ timeout: 10000 });
    await expect(c.locator('[data-party-frames]')).toHaveCount(0, { timeout: 10000 });
    await expect(a.locator('[data-party-frames]')).toHaveAttribute('data-party-size', '2', { timeout: 10000 });
    await calm(a);
    await a.locator('.td-chat__tabs [role=tab]').first().click({ timeout: 8000 });
    await expect(a.locator('.td-chat__log')).toContainText('Cora left the party.');
    await b.locator('[data-party-leave]').click({ timeout: 10000 });
    await expect(a.locator('[data-party-frames]')).toHaveCount(0, { timeout: 10000 });
    await expect(a.locator('[data-party-tab]')).toHaveCount(0);
  } finally {
    await ca.close(); await cb.close(); await cc.close();
  }
});

test('against the v2 room (before protocol 3) the card offers no invite, and presence still works', async ({ browser }, info) => {
  test.setTimeout(90_000);
  // The room as deployed before parties: the last commit's server without protocol 3, written beside the test.
  const v2 = info.outputPath('social-server-v2.mjs');
  let source = '';
  try { source = execFileSync('git', ['show', '6a146f3f:scripts/social-server.mjs'], { encoding: 'utf8' }); } catch { /* shallow clone */ }
  test.skip(!/PROTOCOL = 2;/.test(source), 'the v2 server source is not in this clone');
  fs.writeFileSync(v2, source);
  const old = await startHearth(String(info.project.use.baseURL), v2);
  const ca = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const cb = await newContext(browser, info, { viewport: { width: 1280, height: 800 } });
  const a = await ca.newPage(), b = await cb.newPage();
  try {
    await enterAs(a, old.port, 'Aster', 'warlock');
    await enterAs(b, old.port, 'Bryn', 'ashguard');
    await step(b, 'd', 600);
    await hide(a);
    await expect.poll(() => peers(a), { timeout: 15000 }).toContain('Bryn@');
    await a.waitForTimeout(600);
    const at = await peerAt(a, 'Bryn');
    await a.mouse.click(at!.x, at!.y);
    const card = a.locator('[data-peer-card]');
    await expect(card.locator('h2')).toHaveText('Bryn', { timeout: 5000 });
    await expect(card.locator('[data-peer-wave]')).toBeVisible();
    await expect(card.locator('[data-peer-invite]')).toHaveCount(0);
    await expect(card.locator('[data-party-later]')).toBeVisible();
    await expect(a.locator('[data-party-frames]')).toHaveCount(0);
  } finally {
    await ca.close(); await cb.close(); await old.stop();
  }
});
