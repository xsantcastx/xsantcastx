import {
  COOLDOWN_STEPS_DAYS,
  InstallOfferInput,
  MIN_DWELL_MS,
  coerceInstallOfferRecord,
  cooldownMs,
  detectInstallPlatform,
  emptyInstallOfferRecord,
  hasCraftedFromSave,
  installOfferVerdict,
  isStandaloneDisplay,
  shouldOfferInstall,
  withDismissal,
  withInstall,
  withSession,
} from './pwa.model';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 12);

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1';
const IOS_INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0';
const DESKTOP_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0';

/** An input that satisfies every condition; each test breaks exactly one. */
function eligible(over: Partial<InstallOfferInput> = {}): InstallOfferInput {
  return {
    record: { ...emptyInstallOfferRecord(), sessions: 2 },
    now: NOW,
    platform: 'prompt',
    standalone: false,
    consentSettled: true,
    dwellMs: MIN_DWELL_MS,
    hasCrafted: false,
    ...over,
  };
}

describe('pwa.model', () => {
  describe('isStandaloneDisplay', () => {
    it('is false in a plain browser tab', () => {
      expect(isStandaloneDisplay(() => false, undefined)).toBe(false);
    });

    it('recognises standalone and the desktop title-bar overlay mode', () => {
      expect(isStandaloneDisplay(q => q === '(display-mode: standalone)', undefined)).toBe(true);
      expect(isStandaloneDisplay(q => q === '(display-mode: window-controls-overlay)', undefined)).toBe(true);
    });

    it('trusts iOS navigator.standalone even when no media query matches', () => {
      expect(isStandaloneDisplay(() => false, true)).toBe(true);
    });

    it('treats a throwing matchMedia as "not standalone" rather than crashing', () => {
      expect(isStandaloneDisplay(() => { throw new Error('no'); }, undefined)).toBe(false);
    });
  });

  describe('detectInstallPlatform', () => {
    it('prefers the held Chromium event over anything the UA says', () => {
      expect(detectInstallPlatform(IPHONE, 5, true)).toBe('prompt');
      expect(detectInstallPlatform(DESKTOP_CHROME, 0, true)).toBe('prompt');
    });

    it('gives iPhone and iOS Chrome the manual instructions', () => {
      expect(detectInstallPlatform(IPHONE, 5, false)).toBe('ios');
      expect(detectInstallPlatform(IOS_CHROME, 5, false)).toBe('ios');
    });

    it('tells an iPad posing as a Mac apart from a real Mac by touch points', () => {
      expect(detectInstallPlatform(IPAD_DESKTOP_UA, 5, false)).toBe('ios');
      expect(detectInstallPlatform(IPAD_DESKTOP_UA, 0, false)).toBe('none');
    });

    it('offers nothing inside in-app webviews or browsers without an install path', () => {
      expect(detectInstallPlatform(IOS_INSTAGRAM, 5, false)).toBe('none');
      expect(detectInstallPlatform(FIREFOX, 0, false)).toBe('none');
      expect(detectInstallPlatform(DESKTOP_CHROME, 0, false)).toBe('none');
      expect(detectInstallPlatform('', 0, false)).toBe('none');
    });
  });

  describe('engagement rule', () => {
    it('shows for an eligible returning visitor', () => {
      expect(installOfferVerdict(eligible())).toBe('show');
      expect(shouldOfferInstall(eligible())).toBe(true);
    });

    it('never shows on a first session with nothing crafted', () => {
      const first = eligible({ record: { ...emptyInstallOfferRecord(), sessions: 1 } });
      expect(installOfferVerdict(first)).toBe('not-engaged');
    });

    it('a first craft counts as engagement even in the first session', () => {
      const first = eligible({ record: { ...emptyInstallOfferRecord(), sessions: 1 }, hasCrafted: true });
      expect(installOfferVerdict(first)).toBe('show');
    });

    it('waits for the dwell time — never on first paint', () => {
      expect(installOfferVerdict(eligible({ dwellMs: 0 }))).toBe('too-soon');
      expect(installOfferVerdict(eligible({ dwellMs: MIN_DWELL_MS - 1 }))).toBe('too-soon');
    });

    it('waits for the cookie banner to be answered', () => {
      expect(installOfferVerdict(eligible({ consentSettled: false }))).toBe('consent-pending');
    });

    it('never shows inside the installed app, after an install, or without an install path', () => {
      expect(installOfferVerdict(eligible({ standalone: true }))).toBe('standalone');
      expect(installOfferVerdict(eligible({ record: withInstall(eligible().record, NOW) }))).toBe('installed');
      expect(installOfferVerdict(eligible({ platform: 'none' }))).toBe('unsupported');
    });

    it('shows the iOS instructions under the same rule', () => {
      expect(installOfferVerdict(eligible({ platform: 'ios' }))).toBe('show');
    });
  });

  describe('dismissal cooldown', () => {
    it('grows 14 → 30 → 90 days', () => {
      expect(COOLDOWN_STEPS_DAYS).toEqual([14, 30, 90]);
      expect(cooldownMs(0)).toBe(0);
      expect(cooldownMs(1)).toBe(14 * DAY);
      expect(cooldownMs(2)).toBe(30 * DAY);
      expect(cooldownMs(3)).toBe(90 * DAY);
    });

    it('suppresses the offer inside the cooldown and returns after it', () => {
      const once = withDismissal(eligible().record, NOW);
      expect(installOfferVerdict(eligible({ record: once, now: NOW + 13 * DAY }))).toBe('cooling-down');
      expect(installOfferVerdict(eligible({ record: once, now: NOW + 14 * DAY }))).toBe('show');
    });

    it('stops for good after the third dismissal', () => {
      let r = eligible().record;
      r = withDismissal(r, NOW);
      r = withDismissal(r, NOW);
      r = withDismissal(r, NOW);
      expect(installOfferVerdict(eligible({ record: r, now: NOW + 10_000 * DAY }))).toBe('declined');
    });
  });

  describe('record', () => {
    it('counts sessions', () => {
      expect(withSession(withSession(emptyInstallOfferRecord())).sessions).toBe(2);
    });

    it('coerces corrupt or hostile storage into a valid record', () => {
      expect(coerceInstallOfferRecord(null)).toEqual(emptyInstallOfferRecord());
      expect(coerceInstallOfferRecord('nope')).toEqual(emptyInstallOfferRecord());
      expect(coerceInstallOfferRecord([1, 2])).toEqual(emptyInstallOfferRecord());
      expect(coerceInstallOfferRecord({ sessions: -4, dismissedAt: 'x', dismissals: NaN, installedAt: Infinity }))
        .toEqual(emptyInstallOfferRecord());
      expect(coerceInstallOfferRecord({ sessions: 3.7, dismissedAt: NOW, dismissals: 1, installedAt: null }))
        .toEqual({ sessions: 3, dismissedAt: NOW, dismissals: 1, installedAt: null });
    });

    it('honours a dismissal stored by the previous banner', () => {
      const r = coerceInstallOfferRecord(null, String(NOW));
      expect(r.dismissedAt).toBe(NOW);
      expect(r.dismissals).toBe(1);
      expect(coerceInstallOfferRecord(null, 'garbage').dismissedAt).toBeNull();
    });
  });

  describe('hasCraftedFromSave', () => {
    it('reads crafting XP or any crafted count, and nothing else', () => {
      expect(hasCraftedFromSave(null)).toBe(false);
      expect(hasCraftedFromSave({ version: 1, xp: 0, crafted: {} })).toBe(false);
      expect(hasCraftedFromSave({ version: 1, xp: 5, crafted: {} })).toBe(true);
      expect(hasCraftedFromSave({ version: 1, xp: 0, crafted: { 'basalt-edge': 1 } })).toBe(true);
      expect(hasCraftedFromSave({ crafted: { a: 'lots' } })).toBe(false);
      expect(hasCraftedFromSave([1])).toBe(false);
    });
  });
});
