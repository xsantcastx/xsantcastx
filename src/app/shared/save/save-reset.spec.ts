import { coerceResetStamp, resetVerdict } from './save-reset';

describe('resetVerdict', () => {
  it('does nothing when neither side has ever wiped', () => {
    expect(resetVerdict(0, 0)).toBe('none');
  });

  it('does nothing once both sides agree the wipe has landed', () => {
    expect(resetVerdict(5_000, 5_000)).toBe('none');
  });

  it('re-pushes a wipe the cloud has not heard about', () => {
    // The bug this whole change exists to close: the local half of a reset
    // succeeded and the cloud half did not, so the pull that follows must not
    // read the surviving cloud copy as state to adopt.
    expect(resetVerdict(9_000, 0)).toBe('push-local');
    expect(resetVerdict(9_000, 4_000)).toBe('push-local');
  });

  it('adopts a wipe taken later on another device', () => {
    // A reset is account-wide. This device's survivors are not state the cloud
    // is missing — they are the save the other device deleted.
    expect(resetVerdict(0, 9_000)).toBe('adopt-remote');
    expect(resetVerdict(4_000, 9_000)).toBe('adopt-remote');
  });

  it('treats unreadable stamps as never-wiped rather than throwing', () => {
    expect(resetVerdict(Number.NaN, 0)).toBe('none');
    expect(resetVerdict(Number.NaN, 5_000)).toBe('adopt-remote');
    expect(resetVerdict(5_000, Number.NaN)).toBe('push-local');
  });

  it('is antisymmetric, so two devices cannot both decide they win', () => {
    // The property that makes the reconciliation terminate: whatever one device
    // concludes, the other concludes the mirror image, so exactly one wipe is
    // pushed and the other side adopts it.
    const pairs: [number, number][] = [[0, 0], [1, 0], [0, 1], [7, 7], [9, 3]];
    for (const [a, b] of pairs) {
      const forward = resetVerdict(a, b);
      const backward = resetVerdict(b, a);
      if (forward === 'none') expect(backward).toBe('none');
      if (forward === 'push-local') expect(backward).toBe('adopt-remote');
      if (forward === 'adopt-remote') expect(backward).toBe('push-local');
    }
  });
});

describe('coerceResetStamp', () => {
  it('reads a well-formed stamp', () => {
    expect(coerceResetStamp({ at: 1234, deviceId: 'A' })).toEqual({ at: 1234, deviceId: 'A' });
  });

  it('reports anything unreadable as never wiped', () => {
    expect(coerceResetStamp(null).at).toBe(0);
    expect(coerceResetStamp({}).at).toBe(0);
    expect(coerceResetStamp({ at: 'yesterday' }).at).toBe(0);
    expect(coerceResetStamp({ at: -5 }).at).toBe(0);
    expect(coerceResetStamp('nope').at).toBe(0);
  });

  it('drops an empty device id rather than carrying it', () => {
    expect(coerceResetStamp({ at: 1, deviceId: '' })).toEqual({ at: 1 });
  });
});
