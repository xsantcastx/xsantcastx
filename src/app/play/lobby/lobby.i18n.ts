/**
 * The title screen and the character list: strings, EN + ES. Lazy: registered by the play lobby.
 */
export const LOBBY_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'lobby.title': { en: 'Eclipse Realms', es: 'Eclipse Realms' },
  'lobby.tagline': { en: 'The sun went dark. The hearth did not.', es: 'El sol se apago. El hogar no.' },
  'lobby.waking': { en: 'Waking the realm...', es: 'Despertando el reino...' },
  'lobby.signIn': { en: 'Sign in with Google', es: 'Entrar con Google' },
  'lobby.signingIn': { en: 'Signing in...', es: 'Entrando...' },
  'lobby.signInBlurb': { en: 'Your Keepers follow you to every device.', es: 'Tus Guardianes te siguen a cualquier dispositivo.' },
  'lobby.guest': { en: 'Play offline', es: 'Jugar sin conexion' },
  'lobby.guestBlurb': { en: 'Saved on this device only. You can sign in later.', es: 'Se guarda solo en este dispositivo. Puedes entrar mas tarde.' },
  'lobby.signInFailed': { en: 'Sign-in did not finish: {{msg}}', es: 'No se pudo entrar: {{msg}}' },

  'lobby.select.title': { en: 'Choose your Keeper', es: 'Elige a tu Guardian' },
  'lobby.select.slots': { en: '{{n}} of {{max}} Keepers', es: '{{n}} de {{max}} Guardianes' },
  'lobby.select.empty': { en: 'No Keeper has answered the hearth yet. Make one to begin.', es: 'Ningun Guardian ha respondido al hogar aun. Crea uno para empezar.' },
  'lobby.select.level': { en: 'Level {{n}}', es: 'Nivel {{n}}' },
  'lobby.select.where': { en: 'Last seen: {{area}}', es: 'Visto por ultima vez: {{area}}' },
  'lobby.select.nowhere': { en: 'Has not set out yet', es: 'Aun no ha partido' },
  'lobby.select.unnamed': { en: 'Unnamed Keeper', es: 'Guardian sin nombre' },
  'lobby.select.elsewhere': { en: 'Saved in the cloud', es: 'Guardado en la nube' },
  'lobby.select.enter': { en: 'Enter world', es: 'Entrar al mundo' },
  'lobby.select.syncing': { en: 'Syncing…', es: 'Sincronizando…' },
  'lobby.select.new': { en: 'New Keeper', es: 'Nuevo Guardian' },
  'lobby.select.delete': { en: 'Delete', es: 'Borrar' },
  'lobby.select.full': { en: 'All five places by the hearth are taken.', es: 'Los cinco sitios junto al hogar estan ocupados.' },
  'lobby.select.signedIn': { en: 'Signed in as {{who}}', es: 'Sesion de {{who}}' },
  'lobby.select.offline': { en: 'Playing offline: saved on this device', es: 'Sin conexion: guardado en este dispositivo' },
  'lobby.select.signOut': { en: 'Sign out', es: 'Cerrar sesion' },
  'lobby.select.signIn': { en: 'Sign in to keep them safe', es: 'Entra para guardarlos' },
  'lobby.select.loading': { en: 'Opening the gate...', es: 'Abriendo la puerta...' },
  'lobby.select.list': { en: 'Your Keepers', es: 'Tus Guardianes' },
  'lobby.camp.hint': { en: 'Choose a Keeper by the fire.', es: 'Elige un Guardian junto al fuego.' },

  'lobby.delete.title': { en: 'Let {{name}} go?', es: 'Dejar ir a {{name}}?' },
  'lobby.delete.body': {
    en: 'Their bag, gear, Gold, levels and every place they have been are gone for good, on every device. Type the name to be sure.',
    es: 'Su bolsa, equipo, Oro, niveles y cada lugar visitado se pierden para siempre, en todos los dispositivos. Escribe el nombre para confirmar.',
  },
  'lobby.delete.bodyNameless': {
    en: 'This Keeper never took a name. Whatever they carried is gone for good, on every device.',
    es: 'Este Guardian nunca tuvo nombre. Lo que llevaba se pierde para siempre, en todos los dispositivos.',
  },
  'lobby.delete.typeHint': { en: 'Type "{{name}}"', es: 'Escribe "{{name}}"' },
  'lobby.delete.confirm': { en: 'Delete forever', es: 'Borrar para siempre' },
  'lobby.delete.cancel': { en: 'Keep them', es: 'Conservar' },
  'lobby.delete.done': { en: '{{name}} has gone back to the dark.', es: '{{name}} ha vuelto a la oscuridad.' },

  'lobby.create.title': { en: 'A new Keeper', es: 'Un nuevo Guardian' },
  'lobby.create.back': { en: 'Back to the list', es: 'Volver a la lista' },
  'lobby.create.close': { en: 'Close without making a Keeper', es: 'Cerrar sin crear un Guardian' },
  'lobby.create.skipTut': { en: 'I\'ve played before: skip the tutorial', es: 'Ya he jugado: saltar el tutorial' },

  'lobby.menu': { en: 'Character select', es: 'Seleccion de personaje' },
  'lobby.menuBlurb': { en: 'Save and return to your Keepers', es: 'Guardar y volver a tus Guardianes' },
};
