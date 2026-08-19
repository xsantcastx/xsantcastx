import {
  DeviceLease,
  HEARTBEAT_MS,
  LEASE_TTL_MS,
  canAcquire,
  coerceLease,
  describeDevice,
  isLeaseExpired,
} from './device-lease';

function lease(over: Partial<DeviceLease> = {}): DeviceLease {
  return { deviceId: 'A', acquiredAt: 1_000, heartbeatAt: 1_000, ...over };
}

describe('device lease expiry', () => {
  it('holds while the heartbeat is inside the window', () => {
    const held = lease({ heartbeatAt: 10_000 });
    expect(isLeaseExpired(held, 10_000 + LEASE_TTL_MS - 1)).toBe(false);
  });

  it('expires once the window has passed', () => {
    const held = lease({ heartbeatAt: 10_000 });
    expect(isLeaseExpired(held, 10_000 + LEASE_TTL_MS + 1)).toBe(true);
  });

  it('treats a missing or unreadable lease as free', () => {
    expect(isLeaseExpired(null, 0)).toBe(true);
    expect(isLeaseExpired(lease({ heartbeatAt: Number.NaN }), 0)).toBe(true);
  });

  it('leaves room for a missed beat', () => {
    // The whole point of a 30s beat under a 120s TTL: a backgrounded tab or a
    // tunnel must not hand the save away on one skipped heartbeat.
    const held = lease({ heartbeatAt: 0 });
    expect(isLeaseExpired(held, HEARTBEAT_MS * 2)).toBe(false);
  });

  it('does not expire a holder whose clock runs ahead', () => {
    // Safe direction: defer to the device that is plausibly still playing.
    expect(isLeaseExpired(lease({ heartbeatAt: 90_000 }), 10_000)).toBe(false);
  });
});

describe('acquiring', () => {
  it('takes a lease nobody holds', () => {
    expect(canAcquire(null, 'A', 0)).toBe(true);
  });

  it('renews our own without waiting for expiry', () => {
    expect(canAcquire(lease({ deviceId: 'A', heartbeatAt: 9_000 }), 'A', 9_100)).toBe(true);
  });

  it('refuses another device that is still beating', () => {
    expect(canAcquire(lease({ deviceId: 'B', heartbeatAt: 9_000 }), 'A', 9_100)).toBe(false);
  });

  it('takes over from a device that has stopped', () => {
    const stale = lease({ deviceId: 'B', heartbeatAt: 0 });
    expect(canAcquire(stale, 'A', LEASE_TTL_MS + 1)).toBe(true);
  });
});

describe('coerceLease', () => {
  it('rejects anything without a device id', () => {
    expect(coerceLease(null)).toBeNull();
    expect(coerceLease({})).toBeNull();
    expect(coerceLease({ deviceId: '' })).toBeNull();
    expect(coerceLease('nope')).toBeNull();
  });

  it('defaults unreadable timestamps to zero, which reads as expired', () => {
    const got = coerceLease({ deviceId: 'A', heartbeatAt: 'soon' });
    expect(got?.heartbeatAt).toBe(0);
    // Against a real clock rather than a synthetic one: a zero heartbeat means
    // 1970, so any present-day `now` is far outside the window.
    expect(isLeaseExpired(got, Date.now())).toBe(true);
  });

  it('keeps a device name and bounds its length', () => {
    expect(coerceLease({ deviceId: 'A', deviceName: 'Chrome on Mac' })?.deviceName)
      .toBe('Chrome on Mac');
    expect(coerceLease({ deviceId: 'A', deviceName: 'x'.repeat(200) })?.deviceName?.length)
      .toBe(60);
  });
});

describe('describeDevice', () => {
  it('names the common desktop browsers', () => {
    expect(describeDevice(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    )).toBe('Chrome on Mac');
    expect(describeDevice(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    )).toBe('Firefox on Windows');
  });

  it('does not call Chrome "Safari"', () => {
    // Chrome's UA contains the token "Safari", so order of testing matters.
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1';
    expect(describeDevice(ua)).toBe('Chrome on iPhone');
  });

  it('names real Safari on a phone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(describeDevice(ua)).toBe('Safari on iPhone');
  });

  it('sees through an iPad claiming to be a Mac', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    expect(describeDevice(ua, 'touch:5')).toBe('Safari on iPad');
    // …and still calls a real Mac a Mac.
    expect(describeDevice(ua, 'touch:0')).toBe('Safari on Mac');
  });

  it('prefers Edge over the Chrome token it also carries', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0';
    expect(describeDevice(ua)).toBe('Edge on Windows');
  });

  it('degrades to something sayable rather than throwing', () => {
    expect(describeDevice('')).toBe('Browser on Desktop');
  });
});
