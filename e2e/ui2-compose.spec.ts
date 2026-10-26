/**
 * ui2-compose.spec.ts — before | after sheets for the UI clean pass, from docs/handoff/ui2/{before,after}/.
 *
 *   UI2_COMPOSE=1 npx playwright test --project=chromium --reporter=line e2e/ui2-compose
 *
 * Writes docs/handoff/ui2/compare-<name>.jpg: the two shots side by side, each labelled, with the list of what changed.
 */
import { test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

const DIR = 'docs/handoff/ui2';
const SHEETS: { name: string; shot: string; title: string; notes: string[] }[] = [
  { name: 'hud-desktop', shot: 'xp-1280x800-es', title: 'Desktop HUD, 1280 × 800 (ES), XP bar hovered', notes: [
    '1 XP tooltip no longer covers the Interact prompt: the prompt and toasts sit above a reserved lane over the bar',
    '2 Unit frame: Cormorant old-style digits ("I22", "7o") gone; name in Pixelify, Soul labelled ("Alma 0")',
    '3 Unit frame no longer repeats life/mana numbers beside the orbs',
    '4 Prompt reads as a sentence in Inter 13 (was 8 px capitals)',
    '5 Bottom bar hugs its contents on a 4 px grid, grooves between menu · skills · belt',
    '6 Chat stays legible when quiet (was 35% opacity: tabs vanished)',
  ] },
  { name: 'hud-desktop-1080', shot: 'hud-1920x1080-en', title: 'Desktop HUD, 1920 × 1080 (EN)', notes: [
    '1 HUD one step larger from 1700 × 980 (zoom 1.25, crisp): text was 8 to 10 px on a 1080p screen',
    '2 Same frame, prompt, chat and bar fixes as 1280',
  ] },
  { name: 'hud-phone', shot: 'xp-360x640-es', title: 'Phone HUD, 360 × 640 (ES), XP bar tapped', notes: [
    '1 Interact prompt starts right of the spell column (it crossed the skills and the belt)',
    '2 Glim’s line starts right of the spell column',
    '3 XP tooltip opens above the menu tabs and chat, inside the screen',
  ] },
  { name: 'hud-landscape', shot: 'hud-844x390-es', title: 'Phone landscape, 844 × 390 (ES)', notes: [
    '1 Glim’s line moves to the top lane: it covered the belt and the Interact prompt',
  ] },
  { name: 'menu', shot: 'menu-1280x800-es', title: 'Game Menu, 1280 × 800 (ES)', notes: [
    '1 Labels in sentence case at 14 px: upper-casing set Pixelify with Inter’s C ("seleCCion", "teClas")',
    '2 The menu ends above the bottom bar: the mana orb and belt stay visible',
  ] },
  { name: 'keys', shot: 'keys-1366x768-en', title: 'Skill Book → Keys, 1366 × 768 (EN)', notes: [
    '1 All eight keys per skill (was 1–4 while the bar has 8); caps come from the keymap',
    '2 A skill now stays on the key it was put on (7 stays 7; the bar used to compact)',
    '3 The belt’s three keys listed under the skills',
  ] },
  { name: 'keys-phone', shot: 'keys-360x640-es', title: 'Skill Book → Keys, 360 × 640 (ES)', notes: [
    '1 Eight keys wrap to two rows of four under the name; every key 44 × 44',
  ] },
  { name: 'sheet', shot: 'sheet-1280x800-es', title: 'Character sheet, 1280 × 800 (ES)', notes: [
    '1 The sheet ends above the bottom bar (it covered the belt and the mana orb)',
  ] },
];

const url = (p: string) => `data:image/jpeg;base64,${readFileSync(p).toString('base64')}`;

for (const s of SHEETS) {
  test(s.name, async ({ page }) => {
    test.skip(!process.env['UI2_COMPOSE'], 'set UI2_COMPOSE=1');
    const before = `${DIR}/before/${s.shot}.jpg`, after = `${DIR}/after/${s.shot}.jpg`;
    test.skip(!existsSync(before) || !existsSync(after), 'shots missing');
    const [w, h] = s.shot.split('-')[1].split('x').map(Number);
    const scale = w > 1400 ? .5 : w > 900 ? .75 : 1;
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    await page.setViewportSize({ width: cw * 2 + 72, height: ch + 160 + s.notes.length * 22 });
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#24150c;color:#f6e7c8;font:14px/1.4 Inter,system-ui,sans-serif">
      <div style="padding:16px 24px 8px;font:700 18px system-ui;color:#ffd27a">${s.title}</div>
      <div style="display:flex;gap:24px;padding:0 24px">
        ${[['Before (live 05ad60f0)', before], ['After (ui2)', after]].map(([label, p]) => `
          <figure style="margin:0"><figcaption style="padding:4px 0 6px;font:700 14px system-ui;color:${label.startsWith('After') ? '#6fd36a' : '#c99a3e'}">${label}</figcaption>
          <img src="${url(p)}" style="display:block;width:${cw}px;height:${ch}px;image-rendering:auto;outline:2px solid #6e4526"></figure>`).join('')}
      </div>
      <ol style="margin:12px 24px 16px;padding:0;list-style:none">${s.notes.map(n => `<li>${n}</li>`).join('')}</ol>
    </body></html>`);
    await page.screenshot({ path: `${DIR}/compare-${s.name}.jpg`, type: 'jpeg', quality: 85, fullPage: true });
  });
}
