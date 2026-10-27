import { HD_FIG, HF, hdAttackFrame, hdCastFrame, hdCasts, hdFigure, hdWalkFrame, type HdSource, type HdView } from './td-hd-keeper';
import { NPC_LOOKS, garbKey } from '../../shared/keeper-look/npc-looks';
import { defaultLook, lookKey, VOCATIONS, type KeeperLook, type Vocation } from '../../shared/keeper-look/keeper-look.model';
import { gearKey } from '../../shared/keeper-look/keeper-gear';
import { vocationLook } from '../../shared/keeper-look/vocation-look';

const src = (look: KeeperLook, gear: HdSource['gear'], garb: HdSource['garb']): HdSource => ({ key: `${lookKey(look)}#${gearKey(gear)}#${garbKey(garb)}`, look, gear, garb });
const keeper = (v: Vocation, over: Partial<KeeperLook> = {}): HdSource => {
  const look = { ...defaultLook(), made: true, vocation: v, ...over } as KeeperLook, vl = vocationLook(v, null);
  return src(look, vl.gear, vl.garb);
};
/** Painted pixels in one cell (drawn at 1:1 onto a scratch canvas). */
function inked(s: HdSource, view: HdView, fr: number): number {
  const cv = document.createElement('canvas'); cv.width = HD_FIG.w; cv.height = HD_FIG.h;
  const c = cv.getContext('2d')!;
  const f = hdFigure(s); f.bake(view, fr); f.draw(c, HD_FIG.ax, HD_FIG.ay, 1, view, fr, false);
  const d = c.getImageData(0, 0, cv.width, cv.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
  return n;
}

describe('td-hd-keeper', () => {
  it('paints every calling, both figures, at every facing and frame', () => {
    for (const v of VOCATIONS) for (const form of ['masc', 'fem'] as const) {
      const s = keeper(v, { form });
      for (const view of [0, 1, 2, 3] as const) for (let fr = 0; fr <= HF.down; fr++) expect(inked(s, view, fr)).withContext(`${v} ${form} ${view} ${fr}`).toBeGreaterThan(1200);
    }
  });

  it('paints every named townsperson', () => {
    for (const [id, n] of Object.entries(NPC_LOOKS)) for (const view of [0, 1, 2, 3] as const) expect(inked(src(n.look, n.gear, n.garb), view, 0)).withContext(id).toBeGreaterThan(1200);
  });

  it('caches by key and grows a townsperson only to its first six frames', () => {
    const n = NPC_LOOKS['kael'], s = src(n.look, n.gear, n.garb);
    const f = hdFigure(s);
    expect(hdFigure(s)).toBe(f);
    f.bake(0, HF.idle);
    // Each view a townsperson has shown is one strip of six frames (the cache now outlives the specs before this one,
    // which may have shown it from other sides: a whole number of six-frame strips, at most four).
    const strip = HD_FIG.w * 6 * HD_FIG.h * 4;
    expect(f.bytes % strip).toBe(0);
    expect(f.bytes / strip).toBeGreaterThanOrEqual(1);
    expect(f.bytes / strip).toBeLessThanOrEqual(4);
  });

  it('reads the frame for walking, swinging and casting', () => {
    expect(hdWalkFrame(0, false)).toBe(HF.idle);
    expect(hdWalkFrame(.2, true)).toBeGreaterThanOrEqual(HF.walk);
    expect(hdAttackFrame(0)).toBe(HF.wind); expect(hdAttackFrame(.5)).toBe(HF.strike); expect(hdAttackFrame(.9)).toBe(HF.follow);
    expect(hdCastFrame(.1)).toBe(HF.raise); expect(hdCastFrame(.8)).toBe(HF.release);
    expect(hdCasts(keeper('warlock'))).toBeTrue();
    expect(hdCasts(keeper('lanternwright'))).toBeTrue();
    expect(hdCasts(keeper('ashguard'))).toBeFalse();
    expect(hdCasts(keeper('thornstrider'))).toBeFalse();
  });
});
