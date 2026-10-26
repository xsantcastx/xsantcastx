import { DETAIL_KEY, envDetail, lowEndDevice, onEnvDetail, setEnvDetail } from './td-detail';

describe('td-detail (Environment detail)', () => {
  afterEach(() => { try { localStorage.removeItem(DETAIL_KEY); } catch { /* none */ } setEnvDetail('normal', false); });

  it('reads a weak device as low-end, an automated browser never', () => {
    expect(lowEndDevice({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe(true);
    expect(lowEndDevice({ deviceMemory: 8, hardwareConcurrency: 4 })).toBe(true);
    expect(lowEndDevice({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe(false);
    expect(lowEndDevice({ deviceMemory: 2, webdriver: true })).toBe(false);
    expect(lowEndDevice({})).toBe(false);
  });

  it('saves the choice on this device and tells the world once', () => {
    const seen: string[] = [];
    const off = onEnvDetail(d => seen.push(d));
    setEnvDetail('low');
    expect(envDetail()).toBe('low');
    expect(localStorage.getItem(DETAIL_KEY)).toBe('low');
    setEnvDetail('low');
    setEnvDetail('normal');
    off();
    expect(seen).toEqual(['low', 'normal']);
  });
});
