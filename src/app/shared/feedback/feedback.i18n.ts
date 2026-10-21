/**
 * feedback.i18n.ts: "Send feedback" (the Menu item, the title screen's link and the form), EN + ES. Lazy: registered by
 * the play view and the lobby.
 */
export const FEEDBACK_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'feedback.menu': { en: 'Send feedback', es: 'Enviar opinion' },
  'feedback.menuBlurb': { en: 'Tell the maker about a bug or an idea.', es: 'Cuentale al creador un fallo o una idea.' },
  'feedback.title': { en: 'Send feedback', es: 'Enviar opinion' },
  'feedback.close': { en: 'Close', es: 'Cerrar' },
  'feedback.lead': { en: 'A bug, an idea, anything. One note a minute; the maker reads every one.', es: 'Un fallo, una idea, lo que sea. Una nota por minuto; el creador lee todas.' },
  'feedback.type': { en: 'What is it?', es: 'Que es?' },
  'feedback.type.bug': { en: 'Bug', es: 'Fallo' },
  'feedback.type.idea': { en: 'Idea', es: 'Idea' },
  'feedback.type.other': { en: 'Other', es: 'Otro' },
  'feedback.message': { en: 'Your note', es: 'Tu nota' },
  'feedback.placeholder': { en: 'What happened, or what would you like? (at least 10 characters)', es: 'Que paso, o que te gustaria? (minimo 10 caracteres)' },
  'feedback.count': { en: '{{n}} / 1000', es: '{{n}} / 1000' },
  'feedback.shot': { en: 'Attach a screenshot of the game', es: 'Adjuntar una captura del juego' },
  'feedback.shotHint': { en: 'A small picture of what the game shows now. You can see it before it goes.', es: 'Una imagen pequena de lo que muestra el juego ahora. La ves antes de enviarla.' },
  'feedback.shotAlt': { en: 'The screenshot that will be sent', es: 'La captura que se enviara' },
  'feedback.shotFail': { en: 'The screenshot could not be made small enough, so it is left out.', es: 'No se pudo reducir la captura lo suficiente, asi que se omite.' },
  'feedback.device': { en: 'Sent along: your browser, window size, game version, place, class and level.', es: 'Se envia tambien: tu navegador, tamano de ventana, version del juego, lugar, clase y nivel.' },
  'feedback.send': { en: 'Send', es: 'Enviar' },
  'feedback.sending': { en: 'Sending…', es: 'Enviando…' },
  'feedback.sent': { en: 'Sent. Thank you, Keeper — it reached the maker.', es: 'Enviado. Gracias, Guardian — le llego al creador.' },
  'feedback.again': { en: 'Send another', es: 'Enviar otra' },
  'feedback.signin': { en: 'Feedback needs a signed-in Keeper, so a note can be answered for and kept from spam. Sign in (Menu, Account, or the title screen) and come back.', es: 'La opinion requiere un Guardian con sesion iniciada, para poder atenderla y evitar spam. Inicia sesion (Menu, Cuenta, o la pantalla de titulo) y vuelve.' },
  'feedback.short': { en: 'A few more words, please: at least 10 characters.', es: 'Unas palabras mas, por favor: minimo 10 caracteres.' },
  'feedback.wait': { en: 'One note a minute. Try again in {{n}} s.', es: 'Una nota por minuto. Intenta de nuevo en {{n}} s.' },
  'feedback.refused': { en: 'The note was not accepted. Wait a minute and try again.', es: 'La nota no fue aceptada. Espera un minuto e intenta de nuevo.' },
  'feedback.failed': { en: 'It did not go through. Check your connection and try again.', es: 'No se envio. Revisa tu conexion e intenta de nuevo.' },
  'feedback.link': { en: 'Send feedback', es: 'Enviar opinion' },
};
