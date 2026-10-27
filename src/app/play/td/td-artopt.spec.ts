import { GRAPHICS_KEY, artOpt, defaultGraphics, graphics, onGraphics, optIso, resetGraphicsForTest, setGraphics } from './td-artopt';

describe('td-artopt Graphics (Classic / Isometric Beta)', () => {
  // Every other unit spec runs the engine in Classic (karma.helpers): leave it that way.
  beforeEach(() => setGraphics('classic'));
  afterEach(() => setGraphics('classic'));

  it('is Isometric for a player who never chose (the default since 2026-10-27); the unit specs run Classic', () => {
    expect(defaultGraphics(false)).toBe('iso');
    expect(defaultGraphics(true)).toBe('classic');
    localStorage.removeItem(GRAPHICS_KEY); resetGraphicsForTest();
    expect(graphics()).toBe('classic');
    localStorage.setItem(GRAPHICS_KEY, 'iso'); resetGraphicsForTest();
    expect(graphics()).toBe('iso');
    expect(optIso()).toBeTrue();
  });

  it('Isometric is kept on the device, drawn at once, and announced', () => {
    setGraphics('classic');
    const heard: string[] = [];
    const off = onGraphics(g => heard.push(g));
    setGraphics('iso');
    expect(localStorage.getItem(GRAPHICS_KEY)).toBe('iso');
    expect(graphics()).toBe('iso');
    expect(artOpt()).toBe('iso');
    expect(optIso()).toBeTrue();
    setGraphics('classic');
    expect(optIso()).toBeFalse();
    expect(heard).toEqual(['iso', 'classic']);
    off();
  });

  it('ignores anything that is not a graphics choice', () => {
    setGraphics('fancy' as never);
    expect(graphics()).toBe('classic');
  });
});
