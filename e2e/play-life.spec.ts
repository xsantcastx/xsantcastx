/**
 * play-life.spec.ts — Phase 4 "Life" (keepers, townsfolk), walked in all five
 * towns. Nothing here was ever seen in a browser (docs/handoff/phase4-life.md).
 *
 * The browser pane runs hidden, so no screenshots: the spec reads what the
 * engine DRAWS. An init script wraps three CanvasRenderingContext2D methods on
 * the world canvas and records, frame by frame (a frame starts at the engine's
 * full clearRect):
 *   - name tags: `fillText` in the tag font at the tag's fixed height, with the
 *     plate's on-canvas left/right edges (device px, through the current
 *     transform) and the canvas width. The tag is pinned inside the viewport,
 *     so near an edge its x is not the keeper's: a tag is paired with the
 *     nearest keeper shadow in the same frame, and that shadow is the keeper's x.
 *   - speech bubbles: `fillText` in the bubble font and ink. The wrapped lines are
 *     joined and matched against the keeper lines in life.i18n.ts.
 *   - figures' floor shadows: `ellipse` at FLOOR + 2 in the 30 : 7 shadow
 *     proportion. A keeper's is 30 wide (scale 1), a townsperson's narrower
 *     (scale ≤ 0.86): its x is where the figure stands.
 * Station hit boxes come from the town data the engine itself reads
 * (`stationAt`: |x − station.x| ≤ width / 2).
 */
import { expect, test, type Page } from '@playwright/test';
import { canvas, focusWorld, openPlay, playerX, seed, walk, type Blobs } from './play-helpers';
import { TOWNS } from '../src/app/play/world/world.model';
import type { RealmTownId, StationDef, TownDef } from '../src/app/play/world/world.model';
import { KEEPER_HALF, TOWN_KEEPERS } from '../src/app/play/world/life';
import { LIFE_I18N } from '../src/app/play/world/life.i18n';

/** A drawn name tag: text, world x, plate left / right on the canvas (device px), canvas width. */
type Tag = [string, number, number, number, number];
interface Frame { tags: Tag[]; bubble: string[]; keepers: number[]; folk: number[] }

const REALMS: RealmTownId[] = ['infernal', 'luminous', 'umbral', 'celestial', 'verdant'];

async function instrument(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const W = window as unknown as { __life: { on: boolean; frames: unknown[] } };
    W.__life = { on: false, frames: [] };
    const P = CanvasRenderingContext2D.prototype;
    const clear = P.clearRect, fill = P.fillText, ellipse = P.ellipse;
    let cur: { tags: [string, number, number, number, number][]; bubble: string[]; keepers: number[]; folk: number[] } | null = null;
    const world = (c: CanvasRenderingContext2D) => !!(c.canvas as HTMLCanvasElement).closest?.('.viewport');
    P.clearRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
      if (x === 0 && y === 0 && world(this)) {
        if (cur && W.__life.on && W.__life.frames.length < 20000) W.__life.frames.push(cur);
        cur = { tags: [], bubble: [], keepers: [], folk: [] };
      }
      return clear.call(this, x, y, w, h);
    };
    P.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, max?: number) {
      if (cur && world(this) && /Cormorant/.test(this.font)) {
        // Tag: '#ffe1b0' on the plate; bubble: '#2a1c16' ink (the Keeper's own "You" label shares the font).
        if (/\b14px/.test(this.font) && y === 430 && this.fillStyle === '#ffe1b0') {
          // The plate is min(200, text + 20) wide, centred on x (town-life.ts nameTag).
          const m = this.getTransform(), w = Math.min(200, this.measureText(text).width + 20);
          cur.tags.push([text, x, m.a * (x - w / 2) + m.e, m.a * (x + w / 2) + m.e, this.canvas.width]);
        }
        else if (/\b15px/.test(this.font) && this.fillStyle === '#2a1c16') cur.bubble.push(text);
      }
      return max === undefined ? fill.call(this, text, x, y) : fill.call(this, text, x, y, max);
    };
    P.ellipse = function (this: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, ccw?: boolean) {
      if (cur && y === 612 && rx > 0 && Math.abs(ry / rx - 7 / 30) < 1e-6 && world(this)) (rx > 29.9 ? cur.keepers : cur.folk).push(x);
      return ellipse.call(this, x, y, rx, ry, rotation, start, end, ccw);
    };
  });
}

async function record(page: Page, on: boolean): Promise<void> {
  await page.evaluate(v => { const l = (window as unknown as { __life: { on: boolean; frames: unknown[] } }).__life; l.on = v; if (v) l.frames = []; }, on);
}
async function frames(page: Page): Promise<Frame[]> {
  return page.evaluate(() => (window as unknown as { __life: { frames: Frame[] } }).__life.frames);
}

/** Into a town by the Waystone, then a fresh load of /play there (the town is restored; chatter starts unarmed-fresh). */
async function enterTown(page: Page, realm: RealmTownId, blobs: Blobs = {}): Promise<TownDef> {
  const town = TOWNS[realm]!;
  await seed(page, blobs);
  if (realm !== 'infernal') {
    await openPlay(page, '?at=waystone');
    await page.locator('.waystone-road', { hasText: town.name }).click();
    await expect(canvas(page)).toHaveAttribute('data-area', town.name);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('eclipse-play-world-v1') || '{}').town), { timeout: 8000 }).toBe(realm);
  }
  await openPlay(page);
  await expect(canvas(page)).toHaveAttribute('data-area', town.name);
  return town;
}

const half = (s: StationDef) => (s.width ?? 120) / 2;
/** Overlap of a body [x − r, x + r] with a station's hit box. */
const onStall = (x: number, r: number, s: StationDef) => x + r > s.x - half(s) && x - r < s.x + half(s);

function lineKeeper(text: string, lang: 'en' | 'es'): { keeper: string; key: string } | null {
  for (const [key, v] of Object.entries(LIFE_I18N)) {
    const m = /^play\.life\.line\.(.+)\.\d$/.exec(key);
    if (m && v[lang] === text) return { keeper: m[1], key };
  }
  return null;
}

/** Walk the town west to east past every keeper, recording what is drawn. */
async function walkTown(page: Page, town: TownDef): Promise<Frame[]> {
  const keepers = TOWN_KEEPERS[town.realm];
  const stalls = keepers.map(k => town.stations.find(s => s.id === k.station)!.x);
  const end = Math.min(town.width - 60, Math.max(...stalls) + 260);
  await focusWorld(page);
  await page.waitForTimeout(300);
  await record(page, true);
  await walk(page, 'd', end, 60000);
  // Let the last bubble play out.
  await page.waitForTimeout(6000);
  await record(page, false);
  return frames(page);
}

function analyse(town: TownDef, all: Frame[], lang: 'en' | 'es') {
  const tagX = new Map<string, number[]>();
  const lines = new Map<string, Set<string>>();
  const unknown = new Set<string>();
  const folk: number[] = [];
  /** Tags whose plate ran past a canvas edge (a little slack for the hit jolt). */
  const clipped: string[] = [];
  /** Tags drawn with no keeper figure under them. */
  const orphans: string[] = [];
  for (const f of all) {
    for (const [text, x, left, right, width] of f.tags) {
      if (left < -12 || right > width + 12) clipped.push(`${text} ${Math.round(left)}..${Math.round(right)} of ${width}`);
      // A plate pinned to an edge (4 world px in, ~4.4 device px) never leaves its keeper:
      // some figure stands within half a plate (≤ 100 px) of it.
      if (!f.keepers.some(k => Math.abs(k - x) <= 100)) { orphans.push(text); continue; }
      // Only an unpinned plate is centred on its keeper: those carry the keeper's x.
      if (left <= 10 || right >= width - 10) continue;
      if (!tagX.has(text)) tagX.set(text, []);
      tagX.get(text)!.push(x);
    }
    if (f.bubble.length) {
      const text = f.bubble.join(' ');
      const who = lineKeeper(text, lang);
      if (!who) unknown.add(text);
      else { if (!lines.has(who.keeper)) lines.set(who.keeper, new Set()); lines.get(who.keeper)!.add(who.key); }
    }
    folk.push(...f.folk);
  }
  return { tagX, lines, unknown, folk, clipped, orphans };
}

test.describe('Phase 4 Life, walked in every town', () => {
  test.describe.configure({ timeout: 120000 });

  for (const realm of REALMS) {
    test(`${realm}: keepers stand beside their stalls, greet once, and townsfolk keep off the stalls`, async ({ page }) => {
      await instrument(page);
      const town = await enterTown(page, realm);
      const all = await walkTown(page, town);
      expect(all.length, 'frames drawn while walking').toBeGreaterThan(30);
      const { tagX, lines, unknown, folk, clipped, orphans } = analyse(town, all, 'en');
      expect([...unknown], 'every bubble is a keeper line').toEqual([]);
      // Name tags stay inside the visible canvas, and always over their keeper.
      expect([...new Set(clipped)], 'name tags cut by the viewport edge').toEqual([]);
      expect([...new Set(orphans)], 'name tags with no keeper under them').toEqual([]);
      for (const def of TOWN_KEEPERS[realm]) {
        const xs = tagX.get(def.name) ?? [];
        expect(xs.length, `${def.name}'s name tag is drawn`).toBeGreaterThan(0);
        // A keeper stands still: one x for the whole walk.
        expect(new Set(xs).size, `${def.name} stands in one place`).toBe(1);
        const x = xs[0];
        const own = town.stations.find(s => s.id === def.station)!;
        // Beside its own stall: not on its hit box, and within one keeper-width-plus-step of it.
        expect(onStall(x, KEEPER_HALF, own), `${def.name} at ${x} overlaps ${own.id} (${own.x} ± ${half(own)})`).toBe(false);
        const gap = Math.abs(x - own.x) - half(own) - KEEPER_HALF;
        expect(gap, `${def.name} is beside ${own.id}`).toBeGreaterThanOrEqual(0);
        expect(gap, `${def.name} is beside ${own.id}`).toBeLessThanOrEqual(100);
        // And on no other stall either.
        for (const s of town.stations) expect(onStall(x, KEEPER_HALF, s), `${def.name} at ${x} overlaps ${s.id}`).toBe(false);
        // Greets once on the way past: exactly one of its lines, never the second.
        expect([...(lines.get(def.id) ?? [])], `${def.name} greets exactly once`).toHaveLength(1);
      }
      // Only this town's keepers are drawn.
      expect([...tagX.keys()].sort()).toEqual(TOWN_KEEPERS[realm].map(k => k.name).sort());
      expect(folk.length, 'townsfolk were drawn').toBeGreaterThan(0);
      const onAStall = folk.filter(x => town.stations.some(s => onStall(x, 0, s)));
      expect([...new Set(onAStall.map(Math.round))], 'townsfolk standing on a stall').toEqual([]);
    });
  }

  test('a keeper greets once: standing beside it, or stepping away and back, does not re-greet', async ({ page }) => {
    await instrument(page);
    const town = await enterTown(page, 'infernal');
    const kael = 1619; // read from the tag below; the walk target only
    await focusWorld(page);
    await record(page, true);
    await walk(page, 'd', kael - 40);
    await page.waitForTimeout(7000); // the bubble (5.5 s) ends; Kael stays silent
    await walk(page, 'a', kael - 250); // still inside 300: not re-armed
    await walk(page, 'd', kael - 40);
    await page.waitForTimeout(1500);
    await record(page, false);
    const { tagX, lines } = analyse(town, await frames(page), 'en');
    expect(tagX.get('Kael')?.[0]).toBe(kael);
    expect([...(lines.get('kael') ?? [])]).toEqual(['play.life.line.kael.1']);
    expect(Math.abs((await playerX(page)) - kael)).toBeLessThan(170);
  });

  test('with the language set to Spanish, every town draws its keepers\' Spanish name tags and lines', async ({ page }) => {
    test.setTimeout(300000);
    await instrument(page);
    for (const realm of REALMS) {
      const town = await enterTown(page, realm, { 'preferred-language': 'es' });
      await expect(page.locator('html')).toHaveAttribute('lang', 'es');
      const all = await walkTown(page, town);
      const { tagX, lines, unknown } = analyse(town, all, 'es');
      expect([...tagX.keys()].sort(), `${realm} name tags`).toEqual(
        TOWN_KEEPERS[realm].map(k => LIFE_I18N[k.nameKey].es).sort());
      expect([...unknown], `${realm}: every bubble is a Spanish keeper line`).toEqual([]);
      expect(lines.size, `${realm}: keepers spoke Spanish`).toBeGreaterThan(0);
    }
  });
});
