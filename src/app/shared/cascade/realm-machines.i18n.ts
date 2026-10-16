/**
 * The few words the play view says about a realm machine in the world (the E
 * prompt, the find), EN + ES. Lazy and tiny on purpose: the machine's own words
 * (cascade.i18n.ts) load with the machine.
 */
export const REALM_MACHINES_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'machine.title.orrery-tumbler': { en: 'The Orrery Tumbler', es: 'El Tambor del Orrery' },
  'machine.kicker': { en: 'Found in the Orrery Wells', es: 'Hallado en los Pozos del Orrery' },
  'machine.act': { en: 'Play {{name}}', es: 'Jugar a {{name}}' },
  'machine.found.orrery-tumbler': { en: 'You found the Orrery Tumbler, the Meridian surveyors\' brass game, still turning.', es: 'Hallaste el Tambor del Orrery, el juego de laton de los agrimensores Meridianos, aun girando.' },
  'machine.found.slate': { en: 'Its face settles into your Mirror Slate: play it anywhere now.', es: 'Su cara se asienta en tu Pizarra Espejo: juegalo donde sea.' },
  'machine.found.noSlate': { en: 'Carry a Mirror Slate and its face will settle there too.', es: 'Lleva una Pizarra Espejo y su cara se asentara alli tambien.' },
};
