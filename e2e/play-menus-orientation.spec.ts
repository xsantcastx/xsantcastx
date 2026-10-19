/**
 * play-menus-orientation.spec.ts — every in-game menu fits the phone it is on,
 * held either way (docs/handoff/menus-orientation.md).
 *
 * One menu system: a portrait phone gets a bottom sheet, a landscape phone a
 * right-hand side panel (the world and the move stick stay in view on the
 * left), a desktop a window. Same title bar and one 44px × close everywhere.
 *
 * At 844×390 (landscape phone) and 360×740 (small portrait phone), for each
 * menu in MENUS:
 *   - it opens;
 *   - no visible element of it lies outside the viewport, and the page does not
 *     scroll sideways;
 *   - its close button (and its primary action, where it has one) is at least
 *     44×44 and a hit test at its centre reaches it;
 *   - in landscape it leaves the left thumb zone (the move stick) uncovered.
 * And: turning the phone mid-menu keeps the menu open and usable.
 *
 * MENUS_MEASURE=1 only measures (no assertions), at every size in ALL_SIZES,
 * writing MENUS_OUT (JSON) and, with MENUS_SHOTS=<dir>/<prefix>, a screenshot
 * per menu and size. That is how the before/after grid was made.
 */
import { expect, test, type Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { ALL_SIZES, EXTRA_MENUS, MENUS, TEST_SIZES, measure, openMenu, type Report } from './play-menus';

const MEASURE_ONLY = !!process.env['MENUS_MEASURE'];
const OUT = process.env['MENUS_OUT'];
const SHOTS = process.env['MENUS_SHOTS'];
const ONLY = process.env['MENUS_ONLY']?.split(',');
const SIZES = process.env['MENUS_SIZES']?.split(',');

if (MEASURE_ONLY) {
  for (const size of ALL_SIZES.filter(s => !SIZES || SIZES.includes(s.tag))) {
    test.describe(`measure ${size.tag}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: size.touch, isMobile: size.mobile });
      test.describe.configure({ timeout: 600_000 });
      test(`every menu at ${size.tag}`, async ({ page }) => {
        const reports: Report[] = [];
        for (const menu of [...MENUS, ...EXTRA_MENUS]) {
          if (ONLY && !ONLY.includes(menu.id)) continue;
          let report: Report;
          try {
            const opened = await openMenu(page, menu);
            report = { menu: menu.id, size: size.tag, opened, ...(opened ? await measure(page, menu) : { root: null, hscroll: false, outside: [], close: null, primary: null, small: [], clipped: [], blocked: [], scrollers: 0, coversMove: false }) };
          } catch (err) {
            report = { menu: menu.id, size: size.tag, opened: false, root: null, hscroll: false, outside: [], close: null, primary: null, small: [], clipped: [], blocked: [], scrollers: 0, coversMove: false, error: String(err).slice(0, 200) };
          }
          reports.push(report);
          if (SHOTS) {
            fs.mkdirSync(path.dirname(SHOTS), { recursive: true });
            await page.screenshot({ path: `${SHOTS}-${menu.id}-${size.tag}.png` }).catch(() => null);
          }
        }
        if (OUT) {
          const all = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) as Report[] : [];
          fs.writeFileSync(OUT, JSON.stringify([...all.filter(r => r.size !== size.tag), ...reports], null, 1));
        }
      });
    });
  }
} else {
  for (const size of TEST_SIZES) {
    test.describe(`menus at ${size.tag}`, () => {
      test.use({ viewport: { width: size.width, height: size.height }, hasTouch: true, isMobile: true });
      test.describe.configure({ timeout: 600_000 });
      const landscape = size.width > size.height;

      test(`every menu opens, fits, and closes from a 44px target`, async ({ page }) => {
        const failures: string[] = [];
        for (const menu of MENUS) {
          if (!(await openMenu(page, menu))) { failures.push(`${menu.id}: did not open`); continue; }
          const m = await measure(page, menu);
          if (m.hscroll) failures.push(`${menu.id}: the page scrolls sideways`);
          if (m.outside.length) failures.push(`${menu.id}: outside the viewport: ${m.outside.map(o => `${o.sel} ${JSON.stringify(o.box)}`).join('; ')}`);
          if (!m.close) failures.push(`${menu.id}: no close button`);
          else {
            if (Math.min(m.close.box.w, m.close.box.h) < 44) failures.push(`${menu.id}: close is ${m.close.box.w}x${m.close.box.h}`);
            if (!m.close.hit) failures.push(`${menu.id}: close is covered`);
          }
          if (menu.id === 'satchel-charm' && !m.primary) failures.push(`${menu.id}: no Equip on the charm's card`);
          if (m.primary) {
            if (Math.min(m.primary.box.w, m.primary.box.h) < 44) failures.push(`${menu.id}: primary is ${m.primary.box.w}x${m.primary.box.h}`);
            if (!m.primary.hit) failures.push(`${menu.id}: primary is covered`);
          }
          if (m.clipped.length) failures.push(`${menu.id}: cut off: ${m.clipped.join('; ')}`);
          if (m.blocked.length) failures.push(`${menu.id}: covered: ${m.blocked.join('; ')}`);
          if (landscape && !menu.modal && m.coversMove) failures.push(`${menu.id}: covers the move stick`);
          // The owner's rule: the primary action is in plain view the moment the menu opens (no scrolling to reach it).
          if (menu.noScroll) {
            // Two taps at most (open it, press the action), and no scrolling: the action is in view at scrollTop 0.
            if (!m.primary) failures.push(`${menu.id}: no primary action`);
            else if (!m.primary.noScroll) failures.push(`${menu.id}: the primary action needs scrolling to reach`);
            const top = await page.evaluate(() => document.querySelector('.place-body')?.scrollTop ?? 0);
            if (top > 0) failures.push(`${menu.id}: the body was scrolled (${top}px) when it opened`);
          }
          // And it closes from its close button.
          let closed = true;
          for (let n = 0; n < (menu.closeClicks ?? 1) && closed; n++) closed = await page.locator(menu.close).first().click({ timeout: 5000 }).then(() => true, () => false);
          if (!closed) { failures.push(`${menu.id}: its close could not be clicked`); continue; }
          await expect(page.locator(menu.root).first()).toBeHidden({ timeout: 4000 }).catch(() => failures.push(`${menu.id}: close did not close it`));
        }
        expect(failures, failures.join('\n')).toEqual([]);
      });

      test(`the Satchel: every well, pocket and card button answers a tap`, async ({ page }) => {
        expect(await openMenu(page, MENUS.find(m => m.id === 'satchel')!)).toBe(true);
        const book = page.locator('#satchel-book');
        // Every well and every pocket: scrolled into view if the body must, then hit at its centre.
        const hitAll = async (sel: string) => {
          const n = await book.locator(sel).count();
          expect(n, sel).toBeGreaterThan(0);
          for (let i = 0; i < n; i++) {
            const el = book.locator(sel).nth(i);
            await el.scrollIntoViewIfNeeded();
            const hit = await el.evaluate(node => {
              const r = node.getBoundingClientRect();
              const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return { ok: !!at && (at === node || node.contains(at)), w: r.width, h: r.height, under: at?.className?.toString() ?? '' };
            });
            expect(hit.ok, `${sel} #${i} is under ${hit.under}`).toBe(true);
            expect(Math.min(hit.w, hit.h), `${sel} #${i}`).toBeGreaterThanOrEqual(40);
          }
        };
        await hitAll('.well');
        await hitAll('.pocket');
        // No empty well spells its slot out in a word that spills from the box: each shows a picture.
        expect(await book.locator('.well:not(.filled) em').count()).toBe(0);
        // No charm in the bag reads as initials: every pocket has its pixel icon.
        expect(await book.locator('.pocket em').count()).toBe(0);
        // A charm's card: every button in it answers a tap, Equip included.
        const charm = book.locator('.pocket[aria-label^="Student"]').first();
        await charm.scrollIntoViewIfNeeded();
        await charm.click();
        await expect(book.locator('.slip .wear')).toBeVisible();
        for (const sel of ['.slip-x', '.slip .wear', '.slip .to-vault']) {
          const el = book.locator(sel).first();
          if (!(await el.count())) continue;
          await el.scrollIntoViewIfNeeded();
          const ok = await el.evaluate(node => {
            const r = node.getBoundingClientRect();
            const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return !!at && (at === node || node.contains(at)) && r.bottom <= innerHeight && r.top >= 0;
          });
          expect(ok, `${sel} answers a tap`).toBe(true);
        }
        if (SHOTS) await page.screenshot({ path: `${SHOTS}-satchel-charm-tap-${size.tag}.png` });
        // Equip works from there.
        await book.locator('.slip .wear').click();
        await expect(book.locator('.well[data-slot="charm2"].filled, .well[data-slot="charm3"].filled').first()).toBeVisible();
      });
    });
  }

  test.describe('turning the phone mid-menu', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    for (const id of ['satchel-charm', 'crafting', 'places']) {
      test(`${id} stays open and usable through portrait → landscape → portrait`, async ({ page }) => {
        const menu = MENUS.find(m => m.id === id)!;
        expect(await openMenu(page, menu)).toBe(true);
        // A scroll position inside the menu survives the turn (where there is anything to scroll).
        const scroller = await page.evaluate(sel => {
          const root = document.querySelector(sel.split(' ')[0])!;
          const all = [root, ...Array.from(root.querySelectorAll('*'))] as HTMLElement[];
          const s = all.find(el => { const cs = getComputedStyle(el); return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 40; });
          if (!s) return false;
          s.dataset['turnProbe'] = '1';
          s.scrollTop = 30;
          return true;
        }, menu.root);
        for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
          await page.setViewportSize(viewport);
          await page.waitForTimeout(400);
          await expect(page.locator(menu.root).first()).toBeVisible();
          const m = await measure(page, menu);
          expect(m.hscroll).toBe(false);
          expect(m.outside, JSON.stringify(m.outside)).toEqual([]);
          expect(m.clipped, m.clipped.join('; ')).toEqual([]);
          expect(m.blocked, m.blocked.join('; ')).toEqual([]);
          expect(m.close?.hit).toBe(true);
          expect(Math.min(m.close!.box.w, m.close!.box.h)).toBeGreaterThanOrEqual(44);
          if (menu.primary) expect(m.primary?.hit, 'the primary action answers a tap').toBe(true);
          if (scroller) expect(await page.locator('[data-turn-probe]').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        }
        await page.locator(menu.close).first().click();
        await expect(page.locator(menu.root).first()).toBeHidden();
      });
    }
  });
}
