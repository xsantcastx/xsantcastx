/**
 * The world clock, the sky and the eclipse: strings, EN + ES. Lazy: registered
 * by the play view (announcements, Glim) and by the Slate's phone face.
 */
export const WORLD_CLOCK_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // The week (world-clock.model WEEK_DAYS)
  'clock.day.forge': { en: 'Forgeday', es: 'Forjadia' },
  'clock.day.light': { en: 'Lightday', es: 'Luzdia' },
  'clock.day.ink': { en: 'Inkday', es: 'Tintadia' },
  'clock.day.star': { en: 'Starday', es: 'Astradia' },
  'clock.day.root': { en: 'Rootday', es: 'Raizdia' },
  'clock.day.hearth': { en: 'Hearthday', es: 'Hogardia' },
  'clock.day.moon': { en: 'Moonday', es: 'Lunadia' },
  // The months, one per realm (world-clock.model MONTHS)
  'clock.month.emberwane': { en: 'Emberwane', es: 'Brasamengua' },
  'clock.month.brightmere': { en: 'Brightmere', es: 'Claromar' },
  'clock.month.inkfall': { en: 'Inkfall', es: 'Tintacaida' },
  'clock.month.starturn': { en: 'Starturn', es: 'Girastro' },
  'clock.month.rootwake': { en: 'Rootwake', es: 'Raizvela' },
  'clock.date': { en: '{{day}}, {{n}} {{month}}', es: '{{day}}, {{n}} de {{month}}' },
  'clock.year': { en: 'Year {{n}} of the Held Seam', es: 'Ano {{n}} de la Veta Sostenida' },
  'clock.realm.infernal': { en: 'Infernal', es: 'Infernal' },
  'clock.realm.luminous': { en: 'Luminous', es: 'Luminoso' },
  'clock.realm.umbral': { en: 'Umbral', es: 'Umbrio' },
  'clock.realm.celestial': { en: 'Celestial', es: 'Celeste' },
  'clock.realm.verdant': { en: 'Verdant', es: 'Verdeante' },

  // The sky (SkyPhase)
  'clock.phase.dawn': { en: 'Dawn', es: 'Amanecer' },
  'clock.phase.day': { en: 'Day', es: 'Dia' },
  'clock.phase.dusk': { en: 'Dusk', es: 'Ocaso' },
  'clock.phase.night': { en: 'Night', es: 'Noche' },
  'clock.phase.eclipse': { en: 'Eclipse', es: 'Eclipse' },
  'clock.phase.underground': { en: 'Underground: the sky goes on above', es: 'Bajo tierra: el cielo sigue arriba' },

  // The eclipse
  'clock.eclipse.next': { en: 'Next eclipse in {{h}}h {{m}}m', es: 'Proximo eclipse en {{h}}h {{m}}m' },
  'clock.eclipse.nextShort': { en: '{{h}}h {{m}}m', es: '{{h}}h {{m}}m' },
  'clock.eclipse.days': { en: '{{d}}d {{h}}h {{m}}m', es: '{{d}}d {{h}}h {{m}}m' },
  'clock.eclipse.now': { en: 'Eclipse now · {{h}}h {{m}}m left', es: 'Eclipse ahora · quedan {{h}}h {{m}}m' },
  'clock.eclipse.title': { en: 'The eclipse', es: 'El eclipse' },
  'clock.eclipse.when': { en: '{{day}}, {{time}} · aligned with the {{realm}} realm', es: '{{day}}, {{time}} · alineado con el reino {{realm}}' },
  'clock.eclipse.what': { en: 'Every fifth day the moon mirror crosses the sun for eight hours. It comes back, always: nothing is lost by missing one.', es: 'Cada cinco dias el espejo lunar cruza el sol durante ocho horas. Siempre vuelve: no pierdes nada por perderte uno.' },
  'clock.eclipse.effects': { en: 'Under the eclipse', es: 'Bajo el eclipse' },
  'clock.effect.sky': { en: 'The sky goes dark at noon and the moon mirror flares.', es: 'El cielo se oscurece a mediodia y el espejo lunar destella.' },
  'clock.effect.glass': { en: 'Eclipse Glass outcrops rise in every hunting ground (any pickaxe).', es: 'Afloramientos de Cristal de Eclipse surgen en cada coto de caza (cualquier pico).' },
  'clock.effect.moths': { en: 'Afterimage Moths rise in the Reflection Channels and drop Eclipse Glass.', es: 'Polillas de Posimagen surgen en los Canales de Reflejo y sueltan Cristal de Eclipse.' },
  'clock.effect.dark': { en: 'The night wakes at noon: Moonwake opens, the Mirrorfin bites, Ink Lanterns drift.', es: 'La noche despierta a mediodia: se abre el Velaluna, pica el Espejaleta, vagan las Linternas de Tinta.' },
  'clock.effect.touched': { en: 'One creature in eight comes back Eclipse-touched: tougher, with better drops. Shadow spells +25%, Hunting XP +20%.', es: 'Una criatura de cada ocho vuelve tocada por el eclipse: mas dura, con mejor botin. Hechizos de Sombra +25%, XP de Caza +20%.' },
  'clock.effect.shrines': { en: 'A rift shrine first touched now pays double Delving XP, shows twice as far and leaves a sliver of Eclipse Glass.', es: 'Un santuario de grieta tocado por primera vez ahora da doble XP de Profundidad, muestra el doble y deja una astilla de Cristal de Eclipse.' },
  'clock.effect.aligned': { en: 'The aligned realm\'s hunting ground ({{realm}}) gives two Eclipse Glass a cut.', es: 'El coto del reino alineado ({{realm}}) da dos Cristales de Eclipse por corte.' },

  // The sky as a rule (play/td/td-phases.ts): the eclipse warning ribbon and the Spellbook's phase line
  'clock.warn.title': { en: 'The moon mirror is turning', es: 'El espejo lunar esta girando' },
  'clock.warn.line': { en: 'In {{m}} minutes the sun goes out. Things wake that sleep by day; keep a light close.', es: 'En {{m}} minutos se apaga el sol. Despiertan cosas que duermen de dia; ten una luz cerca.' },
  'clock.warn.short': { en: 'The sun goes out in {{m}} minutes.', es: 'El sol se apaga en {{m}} minutos.' },
  'clock.spell.now': { en: '{{phase}} now: {{pct}} power', es: '{{phase}} ahora: {{pct}} de poder' },

  // A dark-keeping node by day (the Moonwake Bloom): the engine's line and the HUD's action button
  'clock.gather.shut': { en: 'The {{name}} is shut tight. It opens at night, or under an eclipse.', es: 'La {{name}} esta bien cerrada. Se abre de noche, o bajo un eclipse.' },
  'clock.gather.shutAct': { en: '{{name}}: opens at night', es: '{{name}}: se abre de noche' },

  // Announcements (the message line)
  'clock.announce.soon': { en: 'The moon mirror is turning: an eclipse begins in {{h}} hours ({{realm}} aligned).', es: 'El espejo lunar esta girando: un eclipse empieza en {{h}} horas ({{realm}} alineado).' },
  'clock.announce.near': { en: 'The light is thinning. The eclipse begins within the hour.', es: 'La luz se adelgaza. El eclipse empieza antes de una hora.' },
  'clock.announce.start': { en: 'The eclipse! The moon mirror crosses the sun. Eclipse Glass rises in the hunting grounds, and some creatures come back Eclipse-touched.', es: 'El eclipse! El espejo lunar cruza el sol. El Cristal de Eclipse surge en los cotos de caza, y algunas criaturas vuelven tocadas por el eclipse.' },
  'clock.announce.end': { en: 'The eclipse passes. The next one comes in five days; it always comes back.', es: 'El eclipse pasa. El proximo llega en cinco dias; siempre vuelve.' },
  'clock.announce.night': { en: 'Night falls. Moonwake opens, the Mirrorfin rises, and the dead walk the wilds. Stay near the light.', es: 'Cae la noche. Se abre el Velaluna, sube el Espejaleta y los muertos caminan por lo salvaje. Quedate cerca de la luz.' },
  'clock.announce.dawn': { en: 'Dawn. The Moonwake shuts.', es: 'Amanece. El Velaluna se cierra.' },
  'clock.announce.witnessed': { en: 'Sera Quill\'s ledger: eclipse {{n}} observed. +{{gold}} Gold.', es: 'Registro de Sera Quill: eclipse {{n}} observado. +{{gold}} de Oro.' },
  'clock.announce.mark': { en: 'Sera Quill\'s ledger mark {{at}}: +{{gold}} Gold and {{glass}} Eclipse Glass.', es: 'Marca {{at}} del registro de Sera Quill: +{{gold}} de Oro y {{glass}} Cristal de Eclipse.' },
  'clock.announce.shrine': { en: 'The shrine drinks the eclipse: it shows twice as far, and leaves a sliver of Eclipse Glass.', es: 'El santuario bebe el eclipse: muestra el doble de lejos y deja una astilla de Cristal de Eclipse.' },

  // Sera Quill's Eclipse Ledger (the reward track)
  'clock.ledger.title': { en: 'Sera Quill\'s Eclipse Ledger', es: 'El Registro de Eclipses de Sera Quill' },
  'clock.ledger.count': { en: '{{n}} eclipses observed', es: '{{n}} eclipses observados' },
  'clock.ledger.next': { en: 'Next mark at {{at}}: +{{glass}} Eclipse Glass and Gold', es: 'Proxima marca en {{at}}: +{{glass}} Cristal de Eclipse y oro' },
  'clock.ledger.full': { en: 'Every mark paid. Each eclipse still pays its observation.', es: 'Todas las marcas pagadas. Cada eclipse sigue pagando su observacion.' },
  'clock.ledger.how': { en: 'Be in the world while an eclipse is on and it is written down, once. A missed eclipse is a gap in the data, not a mistake: the next one counts the same.', es: 'Estate en el mundo mientras hay un eclipse y queda anotado, una vez. Un eclipse perdido es un hueco en los datos, no un error: el siguiente cuenta igual.' },
  'clock.ledger.thisOne': { en: 'This eclipse is in the ledger.', es: 'Este eclipse ya esta en el registro.' },

  // Lore (eclipse.model CLOCK_ITEMS) — check-meaning reads these keys
  'clock.lore.moonwake-bloom': { en: 'It shuts the moment anyone looks straight at the sun. The Archive keeps one in a drawer, to prove the night happened.', es: 'Se cierra en cuanto alguien mira de frente al sol. El Archivo guarda uno en un cajon, para probar que la noche ocurrio.' },
  'clock.lore.mirrorfin': { en: 'Its scales are slivers of the moon mirror, and it swims up to see itself. By day it remembers it is a fish and goes back down.', es: 'Sus escamas son astillas del espejo lunar, y sube a verse. De dia recuerda que es un pez y vuelve a bajar.' },
  'clock.lore.eclipse-glass': { en: 'The moon mirror\'s flare, caught in the rock as it passed. It is warm on the side that faced the sun and cold on the side that faced the Archive.', es: 'El destello del espejo lunar, atrapado en la roca al pasar. Esta tibio del lado que miraba al sol y frio del lado que miraba al Archivo.' },
  'clock.name.moonwake-bloom': { en: 'Moonwake Bloom', es: 'Flor Velaluna' },
  'clock.name.mirrorfin': { en: 'Mirrorfin', es: 'Espejaleta' },
  'clock.name.eclipse-glass': { en: 'Eclipse Glass', es: 'Cristal de Eclipse' },

  // The music the Slate shows as "now playing" (the sound director's realm themes)
  'clock.music.infernal': { en: 'Hymn of the Held Seam', es: 'Himno de la Veta Sostenida' },
  'clock.music.luminous': { en: 'Noon over the Court', es: 'Mediodia sobre la Corte' },
  'clock.music.umbral': { en: 'Margins of the Archive', es: 'Margenes del Archivo' },
  'clock.music.celestial': { en: 'The Orrery Turns', es: 'El Orrery Gira' },
  'clock.music.verdant': { en: 'Rootwake', es: 'Raizvela' },
  'clock.music.mode.town': { en: 'by day', es: 'de dia' },
  'clock.music.mode.night': { en: 'by night', es: 'de noche' },
  'clock.music.mode.delve': { en: 'underground', es: 'bajo tierra' },
  'clock.music.mode.boss': { en: 'a guardian near', es: 'un guardian cerca' },
  'clock.music.mode.eclipse': { en: 'under the eclipse', es: 'bajo el eclipse' },

  // Glim notices the hour (lore: Glim is the Margin-Light; it keeps the maps, not the clocks)
  'clock.glim.night': { en: 'The dark is out. I can draw the Moonwake now; it only holds still at night.', es: 'Ya salio la oscuridad. Ahora puedo dibujar el Velaluna; solo se queda quieto de noche.' },
  'clock.glim.eclipse': { en: 'The moon mirror is in front of the sun. I am brighter than the sky. I don\'t like it, and I love it.', es: 'El espejo lunar esta delante del sol. Brillo mas que el cielo. No me gusta, y me encanta.' },
  'clock.glim.dawn': { en: 'Morning. I always think it might not come, and it always does.', es: 'Manana. Siempre pienso que quiza no llegue, y siempre llega.' },
};
