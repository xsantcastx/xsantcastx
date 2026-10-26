import { GRAPHICS_KEY, artOpt, graphics, onGraphics, optIso, setGraphics } from './td-artopt';

describe('td-artopt Graphics (Classic / Isometric Beta)', () => {
  afterEach(() => { setGraphics('classic'); try { localStorage.removeItem(GRAPHICS_KEY); } catch { /* private mode */ } });

  it('is Classic until the device chooses', () => {
    expect(graphics()).toBe('classic');
    expect(optIso()).toBeFalse();
  });

  it('Isometric is kept on the device, drawn at once, and announced', () => {
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
