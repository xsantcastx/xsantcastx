/**
 * app-update.i18n.ts — the "new version ready" toast. Lazy: registered by
 * UpdateToastComponent, never in the eager translation table.
 */
export const APP_UPDATE_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'appUpdate.ready':     { en: 'A new version is ready', es: 'Hay una nueva versión lista' },
  'appUpdate.reload':    { en: 'Reload', es: 'Recargar' },
  'appUpdate.saving':    { en: 'Saving…', es: 'Guardando…' },
  'appUpdate.later':     { en: 'Later', es: 'Más tarde' },
  'appUpdate.laterAria': { en: 'Later — ask again after the next update', es: 'Más tarde — pregunta de nuevo tras la próxima actualización' },
};
