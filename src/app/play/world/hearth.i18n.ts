/**
 * hearth.i18n.ts: the Hearth chat's collapsed pill and its show / hide
 * controls on /play. Lazy: registered by the side-scroller (play chunk),
 * checked by scripts/check-i18n-keys.js.
 */
export const HEARTH_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'play.hearth.name': { en: 'Hearth', es: 'Hogar' },
  'play.hearth.online': { en: '{{n}} online', es: '{{n}} en linea' },
  'play.hearth.chat': { en: 'chat', es: 'charla' },
  'play.hearth.open': { en: 'Open the Hearth chat', es: 'Abrir la charla del Hogar' },
  'play.hearth.hide': { en: 'Hide', es: 'Ocultar' },
  'play.hearth.hideLabel': { en: 'Hide the Hearth chat', es: 'Ocultar la charla del Hogar' },
};
