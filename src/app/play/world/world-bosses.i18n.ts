/**
 * world-bosses.i18n.ts: the world bosses' omens (world-bosses.ts): the line the whole world hears when one rises,
 * falls, or leaves unfound. Lazy: registered by the side-scroller (play chunk), checked by scripts/check-i18n-keys.js.
 */
export const WORLD_BOSSES_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'play.worldBoss.old-greymaw.rise': { en: 'The Emberwood has gone quiet. The wolves are waiting for someone: Old Greymaw walks.', es: 'El Bosque de Ascuas guarda silencio. Los lobos esperan a alguien: la Vieja Fauces Grises camina.' },
  'play.worldBoss.old-greymaw.fall': { en: 'Old Greymaw is down. The Emberwood breathes again.', es: 'La Vieja Fauces Grises ha caido. El Bosque de Ascuas respira otra vez.' },
  'play.worldBoss.old-greymaw.gone': { en: 'The wolves scatter. Old Greymaw has gone back into the Emberwood.', es: 'Los lobos se dispersan. La Vieja Fauces Grises ha vuelto al Bosque de Ascuas.' },
  'play.worldBoss.gharak-emberjaw.rise': { en: 'War-horns in the Badlands, and no clan answers them: Gharak Emberjaw has come.', es: 'Cuernos de guerra en las Tierras Baldias, y ningun clan responde: ha llegado Gharak Fauce de Ascua.' },
  'play.worldBoss.gharak-emberjaw.fall': { en: 'Gharak Emberjaw has fallen. The horns stop.', es: 'Gharak Fauce de Ascua ha caido. Los cuernos callan.' },
  'play.worldBoss.gharak-emberjaw.gone': { en: 'The horns fade toward the peaks. Gharak Emberjaw has moved on.', es: 'Los cuernos se pierden hacia los picos. Gharak Fauce de Ascua se ha ido.' },
  'play.worldBoss.the-copied-hart.rise': { en: 'Two harts drink at Glassmere, and only one casts a reflection: the Copied Hart is abroad.', es: 'Dos ciervos beben en Lagovidrio, y solo uno se refleja: el Ciervo Copiado anda suelto.' },
  'play.worldBoss.the-copied-hart.fall': { en: 'The Copied Hart is down. At Glassmere, one hart still drinks without a reflection.', es: 'El Ciervo Copiado ha caido. En Lagovidrio, un ciervo aun bebe sin reflejo.' },
  'play.worldBoss.the-copied-hart.gone': { en: 'The Copied Hart walks into the trees, and the trees close behind it.', es: 'El Ciervo Copiado entra en la espesura, y los arboles se cierran tras el.' },
  'play.worldBoss.ser-wickless.rise': { en: 'A lantern with no flame is walking the Marches: Ser Wickless keeps his patrol.', es: 'Un farol sin llama recorre las Marismas: Ser Sinmecha sigue su ronda.' },
  'play.worldBoss.ser-wickless.fall': { en: 'Ser Wickless has fallen. His lantern lies dark in the water.', es: 'Ser Sinmecha ha caido. Su farol yace apagado en el agua.' },
  'play.worldBoss.ser-wickless.gone': { en: 'The flameless lantern sinks below the fog. Ser Wickless has gone under.', es: 'El farol sin llama se hunde en la niebla. Ser Sinmecha se ha sumergido.' },
};
