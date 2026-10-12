import {
  HUB,
  OUTBOUND_SHARE,
  ON_SITE_SHARE,
  bezierAt,
  cycleAt,
  journeyAt,
  monogram,
  progressAt,
  realmAnchor,
  routeControl,
} from './works-map.model';

describe('works-map.model', () => {
  it('derives progress from the frozen start and duration only', () => {
    expect(progressAt(1_000, 10_000, 1_000)).toBe(0);
    expect(progressAt(1_000, 10_000, 6_000)).toBeCloseTo(0.5);
    expect(progressAt(1_000, 10_000, 99_000)).toBe(1);
    expect(progressAt(1_000, 0, 1_000)).toBe(1);
  });

  it('walks out, stays at the site, and walks home', () => {
    expect(journeyAt(0)).toEqual({ phase: 'out', along: 0 });
    expect(journeyAt(OUTBOUND_SHARE + ON_SITE_SHARE / 2)).toEqual({ phase: 'site', along: 1 });
    const back = journeyAt(0.99);
    expect(back.phase).toBe('back');
    expect(back.along).toBeLessThan(0.05);
    expect(journeyAt(1)).toEqual({ phase: 'home', along: 0 });
    expect(journeyAt(Number.NaN).phase).toBe('out');
  });

  it('starts every road at the Treasury and ends it at the realm', () => {
    const site = realmAnchor(2, 5);
    const c = routeControl(site);
    expect(bezierAt(HUB, c, site, 0)).toEqual(HUB);
    const end = bezierAt(HUB, c, site, 1);
    expect(end.x).toBeCloseTo(site.x);
    expect(end.y).toBeCloseTo(site.y);
  });

  it('reads a worker cycle from its last beat', () => {
    expect(cycleAt(0, 5_000, 10_000)).toBe(0);
    expect(cycleAt(10_000, 5_000, 12_500)).toBeCloseTo(0.5);
    expect(cycleAt(10_000, 5_000, 99_000)).toBe(1);
  });

  it('makes a monogram from a name', () => {
    expect(monogram('Whisper of Nox')).toBe('WN');
    expect(monogram('Tamsin')).toBe('T');
    expect(monogram('')).toBe('?');
  });
});
