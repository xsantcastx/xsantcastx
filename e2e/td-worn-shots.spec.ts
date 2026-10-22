/**
 * td-worn-shots.spec.ts — worn gear that looks like the item (owner 2026-10-22: "I got some crazy looking item from that
 * boss, a unique helm, and I put it on my head, and nope — I was expecting like a hooded dark with red eyes").
 *
 * A lineup of the Keeper wearing each boss unique and each item set whole, from the front, from behind and from the side
 * (the game's own painters, through `window.__wornLineup` on ?fxworn=1), and a close-up of the Sexton's Lost Cowl: a
 * grave-dark cowl, the face lost in its shadow, two red eye-pips. Then the Keeper really wearing the cowl in the world,
 * and another Keeper (a pinned peer) wearing it too — what other players see.
 *
 * Screenshots: docs/handoff/cozy-ui/worn-*.jpg.
 */
import { expect, test, type Page } from '@playwright/test';
import { ERA, ledger, seed } from './play-helpers';

const SHOTS = 'docs/handoff/cozy-ui';

const BOSSES: { label: string; ids: string[] }[] = [
  { label: "Sexton's Lost Cowl", ids: ['unique-sextons-lost-cowl'] },
  { label: 'Crown of the Banked Coal', ids: ['unique-crown-banked-coal'] },
  { label: "The Abbess's Censer", ids: ['unique-abbess-censer'] },
  { label: 'Seamstitch Grips', ids: ['unique-seamstitch-grips'] },
  { label: "Tyrant's Crucible", ids: ['unique-tyrants-crucible'] },
  { label: 'Hammer of the First Watch', ids: ['unique-hammer-first-watch'] },
  { label: 'Splinterbow', ids: ['unique-splinterbow-rootcradle'] },
  { label: 'Mossbound Heart', ids: ['unique-mossbound-heart'] },
  { label: "Warden's Last Ember", ids: ['unique-wardens-last-ember'] },
  { label: 'Ashbone Phylactery', ids: ['unique-ashbone-phylactery'] },
];
const SETS: { label: string; ids: string[] }[] = [
  { label: 'The Ossuary Watch', ids: ['set-ossuary-helm', 'set-ossuary-hauberk', 'set-ossuary-bulwark', 'set-ossuary-boots'] },
  { label: 'Garb of the Drowned Abbey', ids: ['set-abbey-hood', 'set-abbey-robe', 'set-abbey-censer-chain', 'set-abbey-sandals'] },
  { label: 'Rootcradle Vestments', ids: ['set-rootcradle-circlet', 'set-rootcradle-wrap', 'set-rootcradle-bracers', 'set-rootcradle-greaves'] },
  { label: "The Lamplighter's Things", ids: ['set-lamplighter-lantern', 'set-lamplighter-coat', 'set-lamplighter-gloves', 'set-lamplighter-signet'] },
];
const OPEN: { label: string; ids: string[] }[] = [
  ['Stillglass Cowl', 'unique-stillglass-cowl'], ['Crown of Borrowed Noon', 'unique-crown-of-borrowed-noon'], ['The Nameless Crown', 'unique-nameless-crown'],
  ['Spore Crown', 'unique-spore-crown'], ['Lantern Oath', 'unique-lantern-oath'], ["Aureth's Mantle", 'unique-aureths-mantle'],
  ['The Quiet Cuirass', 'unique-quiet-cuirass'], ["Kael's Left Hand", 'unique-kaels-left-hand'], ["Verrin's Requiem", 'unique-verrins-requiem'],
  ['Worldsplitter', 'unique-worldsplitter'], ['Hollowmark', 'unique-hollowmark'], ['Lastwarden', 'unique-lastwarden'],
  ["Rootmother's Embrace", 'unique-rootmothers-embrace'], ['Shadowloom', 'unique-shadowloom'], ["Archivist's Codex", 'unique-archivists-codex'],
].map(([label, id]) => ({ label, ids: [id] }));

type W = { __wornLineup?: (groups: { label: string; ids: string[] }[], opts?: Record<string, unknown>) => HTMLCanvasElement };

async function lineup(page: Page, groups: { label: string; ids: string[] }[], opts: Record<string, unknown>, path: string): Promise<void> {
  const box = await page.evaluate(([g, o]) => {
    const el = (window as unknown as W).__wornLineup!(g, o);
    document.getElementById('worn-lineup')?.remove();
    el.id = 'worn-lineup';
    Object.assign(el.style, { position: 'fixed', left: '0', top: '0', zIndex: '99999', imageRendering: 'pixelated' });
    document.body.appendChild(el);
    return { width: el.width, height: el.height };
  }, [groups, opts] as const);
  await page.screenshot({ path, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: Math.min(box.width, 1600), height: Math.min(box.height, 1200) } });
}

/** A worn instance in the satchel ledger (equipped in `slot`). */
function worn(id: string, definitionId: string, name: string, slot: string, i: number): unknown {
  return {
    id, definitionId, kind: 'instance', category: 'artifacts', tags: ['artifact'], rarity: 'legendary', soulbound: false,
    acquiredAt: '2026-10-01T00:00:00.000Z', revision: { hlc: 300 + i, deviceId: 'e2e', sequence: 1 }, source: 'inventory',
    name, type: 'artifact', stats: { ward: 2 }, sellValue: 900, econ: 3, location: { kind: 'equipped', slotId: slot }, itemLevel: 20,
  };
}

test.describe('worn gear looks like the item', () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('lineups: every boss unique and every set, front / back / side; the Sexton\'s Cowl close up', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await seed(page, { 'eclipse-td': '1', 'godforge-realm-era': String(ERA) });
    await page.goto('/play?td=1&hour=12&fxworn=1');
    await expect(page.locator('.viewport canvas')).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
    await expect.poll(() => page.evaluate(() => typeof (window as unknown as W).__wornLineup)).toBe('function');

    await lineup(page, BOSSES, { scale: 4, cols: 4 }, `${SHOTS}/worn-boss-uniques.jpg`);
    await lineup(page, SETS, { scale: 4, cols: 2 }, `${SHOTS}/worn-sets.jpg`);
    await lineup(page, OPEN, { scale: 3, cols: 5 }, `${SHOTS}/worn-uniques.jpg`);
    await lineup(page, [{ label: "Sexton's Lost Cowl — front and side", ids: ['unique-sextons-lost-cowl'] }], { scale: 12, cols: 1, views: ['down', 'side'] }, `${SHOTS}/worn-sexton-cowl.jpg`);

    // The cowl's eyes really are red in the painted sheet: read the lineup's pixels round the face.
    const red = await page.evaluate(() => {
      const el = document.getElementById('worn-lineup') as HTMLCanvasElement;
      const d = el.getContext('2d')!.getImageData(0, 0, el.width, el.height).data;
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 90 && d[i + 2] < 90) n++;
      return n;
    });
    expect(red).toBeGreaterThan(40);
    expect(errors).toEqual([]);
  });

  test('in the world: the Keeper wears the Sexton\'s Cowl and the Censer, and another Keeper wears them too', async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    const base = ledger({}) as { records: unknown[]; hlc: number };
    await page.addInitScript(() => localStorage.setItem('preferred-language', 'en'));
    await seed(page, {
      'eclipse-td': '1', 'godforge-realm-era': String(ERA),
      'godforge-inventory': { ...base, records: [...base.records,
        worn('w-cowl', 'unique-sextons-lost-cowl', "Sexton's Lost Cowl", 'head', 0),
        worn('w-censer', 'unique-abbess-censer', "The Abbess's Censer", 'off-hand', 1),
      ], hlc: base.hlc + 400 },
      'godforge-keeper-look': { version: 1, made: true, prompted: true, name: 'Ilsa', vocation: 'ashguard' },
    });
    await page.goto('/play?td=1&hour=12&fxpeer=1');
    const canvas = page.locator('.viewport canvas');
    await expect(canvas).toHaveAttribute('data-player-x', /\d/, { timeout: 30000 });
    await expect(canvas).toHaveAttribute('data-keeper-gear', /unique-sextons-lost-cowl/);
    // Another Keeper beside a task giver, wearing the same (as presence `worn` would carry it).
    await page.evaluate(() => (window as unknown as { __tdPeer: { lay(n: string, dx: number, w: string): unknown } }).__tdPeer.lay('Wick', -44, 'hu.sextons-lost-cowl,ou.abbess-censer,cset-abbey-robe'));
    await page.waitForTimeout(900);
    const b = (await canvas.boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/worn-in-world.jpg`, type: 'jpeg', quality: 90, clip: { x: b.x + b.width / 2 - 260, y: b.y + b.height / 2 - 170, width: 520, height: 300 } });
    expect(errors).toEqual([]);
  });
});
