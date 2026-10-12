/**
 * home-forge.i18n.ts: copy for the Homestead's own Anvil and Enchanting Circle.
 * Lazy: registered by the mini-games and the Homestead (play chunk), checked by
 * scripts/check-i18n-keys.js.
 */
export const HOME_FORGE_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'homeForge.anvil.name':       { en: 'Your Anvil', es: 'Tu yunque' },
  'homeForge.circle.name':      { en: 'Your Enchanting Circle', es: 'Tu circulo de encantamiento' },
  'homeForge.kicker':           { en: 'Homestead', es: 'Hacienda' },
  'homeForge.column.title':     { en: 'Your crafting corner', es: 'Tu rincon de forja' },
  'homeForge.column.buildings': { en: 'Buildings', es: 'Edificios' },
  'homeForge.tier':            { en: 'Tier {{tier}}', es: 'Nivel {{tier}}' },
  'homeForge.upgrade.anvil':    { en: 'Upgrade Anvil {{tier}} · {{cost}} Gold', es: 'Mejorar yunque {{tier}} · {{cost}} de oro' },
  'homeForge.upgrade.circle':   { en: 'Upgrade Circle {{tier}} · {{cost}} Gold', es: 'Mejorar circulo {{tier}} · {{cost}} de oro' },
  'homeForge.upgrade.need':     { en: 'Need {{n}} more', es: 'Faltan {{n}}' },
  'homeForge.upgrade.maxed':    { en: 'Fully upgraded', es: 'Mejora completa' },
  'homeForge.upgrade.done':     { en: '{{name}} is now tier {{tier}}!', es: '¡{{name}} ya es nivel {{tier}}!' },
  'homeForge.upgrade.funds':    { en: 'Not enough Gold yet.', es: 'Aun no tienes suficiente oro.' },
  'homeForge.upgrade.failed':   { en: 'That did not go through. Try again.', es: 'No se pudo. Intentalo otra vez.' },
  'homeForge.anvil.next2':      { en: 'Next: a wider Perfect zone', es: 'Siguiente: zona Perfecta mas ancha' },
  'homeForge.anvil.next3':      { en: 'Next: a spare strike (your worst one does not count)', es: 'Siguiente: un golpe extra (el peor no cuenta)' },
  'homeForge.anvil.next4':      { en: 'Next: the widest Perfect and Good zones', es: 'Siguiente: las zonas Perfecta y Buena mas anchas' },
  'homeForge.anvil.top':        { en: 'Widest zones and a spare strike', es: 'Zonas mas anchas y un golpe extra' },
  'homeForge.circle.next2':     { en: 'Next: easier ritual timing', es: 'Siguiente: ritual mas facil de acertar' },
  'homeForge.circle.next3':     { en: 'Next: even easier timing, rarest rune first', es: 'Siguiente: aun mas facil, tu runa mas rara primero' },
  'homeForge.circle.next4':     { en: 'Next: the easiest ritual timing', es: 'Siguiente: el ritual mas facil' },
  'homeForge.circle.top':       { en: 'Easiest timing, rarest rune first', es: 'El ritual mas facil, tu runa mas rara primero' },
  'homeForge.anvil.inGame':     { en: 'Your Anvil {{tier}}: a wider Perfect zone.', es: 'Tu yunque {{tier}}: zona Perfecta mas ancha.' },
  'homeForge.anvil.spareNote':  { en: 'Your worst strike does not count.', es: 'Tu peor golpe no cuenta.' },
  'homeForge.circle.inGame':    { en: 'Your Circle {{tier}}: the gold ring is easier to hit.', es: 'Tu circulo {{tier}}: el anillo dorado es mas facil de acertar.' },
};
