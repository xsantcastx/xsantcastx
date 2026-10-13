/**
 * hearth.i18n.ts: the Hearth chat on /play: its collapsed pill, show / hide
 * controls, and the open panel (join, roster, log, say). Lazy: registered by the side-scroller (play chunk),
 * checked by scripts/check-i18n-keys.js.
 */
export const HEARTH_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'play.hearth.name': { en: 'Hearth', es: 'Hogar' },
  'play.hearth.online': { en: '{{n}} online', es: '{{n}} en linea' },
  'play.hearth.chat': { en: 'chat', es: 'charla' },
  'play.hearth.open': { en: 'Open the Hearth chat', es: 'Abrir la charla del Hogar' },
  'play.hearth.hide': { en: 'Hide', es: 'Ocultar' },
  'play.hearth.hideLabel': { en: 'Hide the Hearth chat', es: 'Ocultar la charla del Hogar' },
  'play.hearth.title': { en: 'The fire is open', es: 'El fuego esta abierto' },
  'play.hearth.nameLabel': { en: 'Name', es: 'Nombre' },
  'play.hearth.namePlaceholder': { en: 'Your name', es: 'Tu nombre' },
  'play.hearth.joining': { en: 'Joining…', es: 'Entrando…' },
  'play.hearth.join': { en: 'Join the hearth', es: 'Unirse al hogar' },
  'play.hearth.keepers': { en: 'Connected Keepers', es: 'Guardianes conectados' },
  'play.hearth.you': { en: 'You', es: 'Tu' },
  'play.hearth.quarry': { en: 'Quarry', es: 'Cantera' },
  'play.hearth.camp': { en: 'Camp', es: 'Campamento' },
  'play.hearth.leave': { en: 'Leave', es: 'Salir' },
  'play.hearth.log': { en: 'Room messages', es: 'Mensajes de la sala' },
  'play.hearth.empty': { en: 'The fire is quiet. Join, then say hello.', es: 'El fuego esta en silencio. Unete y saluda.' },
  'play.hearth.messageLabel': { en: 'Message', es: 'Mensaje' },
  'play.hearth.messagePlaceholder': { en: 'Say hello…', es: 'Saluda…' },
  'play.hearth.send': { en: 'Send', es: 'Enviar' },
};
