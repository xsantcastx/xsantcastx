/**
 * account.i18n.ts — the in-game "Account & settings" panel (☰ menu): cloud
 * save / sign-in, language and the analytics-cookie choice. These used to live
 * in the site header and the cookie banner; the game-only shell moved them into
 * the world. Lazy: registered by AccountPanelComponent, checked by
 * scripts/check-i18n-keys.js.
 */
export const ACCOUNT_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'account.menu': { en: 'Account & settings', es: 'Cuenta y ajustes' },
  'account.menuBlurb': { en: 'Cloud save, language and cookies', es: 'Guardado en la nube, idioma y cookies' },
  'account.save.title': { en: 'Cloud save', es: 'Guardado en la nube' },
  'account.save.body': { en: 'Sign in to keep your Keeper on every device. Without it, progress lives in this browser.', es: 'Inicia sesion para llevar a tu Guardian a cualquier dispositivo. Sin ella, el progreso vive en este navegador.' },
  'account.lang.title': { en: 'Language', es: 'Idioma' },
  'account.cookies.title': { en: 'Cookies', es: 'Cookies' },
  'account.cookies.body': { en: 'Analytics cookies only count visits. The game works the same either way.', es: 'Las cookies de analitica solo cuentan visitas. El juego funciona igual en ambos casos.' },
  'account.cookies.on': { en: 'Analytics: allowed', es: 'Analitica: permitida' },
  'account.cookies.off': { en: 'Analytics: declined', es: 'Analitica: rechazada' },
  'account.cookies.unset': { en: 'Analytics: not chosen yet', es: 'Analitica: sin elegir' },
  'account.cookies.allow': { en: 'Allow', es: 'Permitir' },
  'account.cookies.decline': { en: 'Decline', es: 'Rechazar' },
};
