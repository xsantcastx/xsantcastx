/**
 * The Mirror Slate: strings, EN + ES. Lazy: registered by the play view (the
 * HUD button, Lune's and Kael's counters) and by the Slate itself.
 */
export const SLATE_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // The HUD button and the busy rule
  'slate.hud.label': { en: 'Slate', es: 'Pizarra' },
  'slate.hud.open': { en: 'Open the Mirror Slate (P)', es: 'Abrir la Pizarra Espejo (P)' },
  'slate.refuse.fight': { en: 'Not mid-fight. Step away from the creature first.', es: 'No en plena pelea. Alejate primero de la criatura.' },
  'slate.refuse.fallen': { en: 'Get back on your feet first.', es: 'Primero ponte en pie.' },
  'slate.refuse.game': { en: 'Finish what your hands are doing first.', es: 'Termina primero lo que tienes entre manos.' },
  'slate.awarded': { en: 'Lune Coyne slides you the Mirror Slate. Press P to use it anywhere.', es: 'Lune Coyne te desliza la Pizarra Espejo. Pulsa P para usarla donde sea.' },

  // The Slate
  'slate.title': { en: 'The Mirror Slate', es: 'La Pizarra Espejo' },
  'slate.kicker': { en: 'Carried', es: 'Llevada' },
  'slate.kicker2': { en: 'Carried · tier II', es: 'Llevada · nivel II' },
  'slate.tabs': { en: 'The Slate', es: 'La Pizarra' },
  'slate.tab.tables': { en: 'Tables', es: 'Mesas' },
  'slate.tab.map': { en: 'Map & bounties', es: 'Mapa y recompensas' },
  'slate.games': { en: 'Lune\'s tables', es: 'Las mesas de Lune' },
  'slate.table.reels': { en: 'Reels', es: 'Rodillos' },
  'slate.table.runeDrop': { en: 'Rune Drop', es: 'Caida de Runas' },
  'slate.table.seamSweeper': { en: 'Seam Sweeper', es: 'Barrido de Veta' },
  'slate.table.ascent': { en: 'Eclipse Ascent', es: 'Ascenso del Eclipse' },
  'slate.table.cascade': { en: 'Cascade', es: 'Cascada' },
  'slate.table.tumbler': { en: 'Tumbler', es: 'Tambor' },
  'slate.tables.note': { en: 'Same odds, same bet limits, same ledger as her tables. Gold only.', es: 'Mismas probabilidades, mismos limites, mismo registro que sus mesas. Solo Oro.' },
  'slate.back': { en: 'Back', es: 'Volver' },
  'slate.loading': { en: 'The glass clears…', es: 'El cristal se aclara…' },
  'slate.loadError': { en: 'The glass stayed dark. Close the Slate and open it again.', es: 'El cristal siguio oscuro. Cierra la Pizarra y abrela otra vez.' },

  // The phone face (docs/handoff/world-clock.md)
  'slate.phone.clock': { en: 'The world clock', es: 'El reloj del mundo' },
  'slate.phone.nowPlaying': { en: 'Now playing', es: 'Sonando' },
  'slate.phone.skip': { en: 'Next phrase', es: 'Siguiente frase' },
  'slate.phone.skipped': { en: 'next phrase coming', es: 'llega la siguiente frase' },
  'slate.phone.mute': { en: 'Mute all sound', es: 'Silenciar todo' },
  'slate.phone.unmute': { en: 'Turn the sound back on', es: 'Volver a activar el sonido' },
  'slate.phone.muted': { en: 'Muted', es: 'Silenciado' },
  'slate.phone.eclipseIn': { en: 'Next eclipse in', es: 'Proximo eclipse en' },
  'slate.phone.eclipseNow': { en: 'Eclipse now · ends in', es: 'Eclipse ahora · acaba en' },
  'slate.phone.aligned': { en: 'Aligned with the {{realm}} realm. Gather its glass!', es: 'Alineado con el reino {{realm}}. Recoge su cristal!' },
  'slate.phone.calendar': { en: 'This month', es: 'Este mes' },
  'slate.phone.eclipseDay': { en: 'An eclipse day', es: 'Un dia de eclipse' },
  'slate.phone.pages': { en: 'Slate pages', es: 'Paginas de la Pizarra' },
  'slate.phone.page': { en: 'Page {{n}} of {{total}}', es: 'Pagina {{n}} de {{total}}' },
  'slate.phone.dock': { en: 'Favourites', es: 'Favoritos' },
  'slate.phone.mark': { en: 'Mark {{at}}: +{{glass}} Eclipse Glass and Gold', es: 'Marca {{at}}: +{{glass}} Cristal de Eclipse y oro' },
  'slate.app.scan': { en: 'Scan', es: 'Escaner' },
  'slate.app.pets': { en: 'Pets', es: 'Mascotas' },
  'slate.app.codex': { en: 'Codex', es: 'Codice' },
  'slate.app.about': { en: 'About', es: 'Acerca de' },
  'slate.phone.home': { en: 'Home', es: 'Inicio' },
  'slate.phone.putAway': { en: 'Put the Slate away', es: 'Guardar la Pizarra' },
  'slate.app.eclipse': { en: 'Eclipse', es: 'Eclipse' },

  // Factory (the Homestead at a glance)

  // Map & bounties (tier II)
  'slate.map.pins': { en: 'Your map pins', es: 'Tus marcas del mapa' },
  'slate.map.pinsNone': { en: 'No pins yet. Open the map (M) in the Delve and add one.', es: 'Aun no hay marcas. Abre el mapa (M) en la Profundidad y anade una.' },
  'slate.map.pinAt': { en: 'column {{col}}, row {{row}}', es: 'columna {{col}}, fila {{row}}' },
  'slate.map.pinsHint': { en: 'Add, move and track pins on the Delve map (M).', es: 'Anade, mueve y sigue marcas en el mapa de la Profundidad (M).' },
  'slate.map.bounties': { en: 'Pim\'s bounties today', es: 'Las recompensas de Pim hoy' },
  'slate.map.progress': { en: '{{n}} / {{total}}', es: '{{n}} / {{total}}' },
  'slate.map.ready': { en: 'Done: claim it at the Quest Board, Rootglass Canopy.', es: 'Hecha: cobrala en el Tablon, Dosel de Raizcristal.' },
  'slate.map.claimed': { en: 'Claimed', es: 'Cobrada' },
  'slate.upgradeHint': { en: 'Kael at the Rune Forge (Basalt Seamworks) can bind a second face: your map pins and Pim\'s bounties.', es: 'Kael, en la Forja de Runas (Talleres de Basalto), puede atar una segunda cara: tus marcas del mapa y las recompensas de Pim.' },

  // Places stay places
  'slate.details': { en: 'What the Slate is', es: 'Que es la Pizarra' },
  'slate.lore': {
    en: 'A palm of the Archive\'s moon mirror, cut where it cracked and bound in Kael\'s brass. It shows what it was facing when it broke: the tables, and whatever you left burning at home.',
    es: 'Un palmo del espejo lunar del Archivo, cortado por donde se agrieto y atado con el laton de Kael. Muestra lo que tenia delante al romperse: las mesas, y lo que dejaste ardiendo en casa.',
  },
  'slate.rules': { en: 'Opens anywhere (P), never mid-fight or mid-game; the world waits while it is open. Crafting, the Market, the Exchange and selling stay where they stand.', es: 'Se abre donde sea (P), nunca en plena pelea ni a mitad de un juego; el mundo espera mientras esta abierta. Fabricar, el Mercado, la Lonja y vender siguen en su sitio.' },

  // Lune's counter
  'slate.offer.title': { en: 'The Mirror Slate', es: 'La Pizarra Espejo' },
  'slate.offer.line': { en: 'Lune Coyne: "Ten plays at my tables and the Slate is yours. {{n}} to go."', es: 'Lune Coyne: "Diez jugadas en mis mesas y la Pizarra es tuya. Faltan {{n}}."' },
  'slate.offer.what': { en: 'Her tables anywhere, and your Homestead at a glance.', es: 'Sus mesas donde sea, y tu Hacienda de un vistazo.' },
  'slate.offer.buy': { en: 'Buy the Slate · {{cost}} Gold', es: 'Comprar la Pizarra · {{cost}} de Oro' },
  'slate.offer.bought': { en: 'The Slate is yours. Press P to open it anywhere.', es: 'La Pizarra es tuya. Pulsa P para abrirla donde sea.' },
  'slate.offer.funds': { en: 'Not enough Gold yet.', es: 'Aun no tienes Oro suficiente.' },
  'slate.offer.failed': { en: 'That did not go through. Try again.', es: 'No se pudo. Intentalo de nuevo.' },

  // Kael's counter
  'slate.kael.title': { en: 'The Slate\'s second face', es: 'La segunda cara de la Pizarra' },
  'slate.kael.line': { en: 'Kael: "Archive glass in my brass. Bring Glowcap, slag and obsidian and I\'ll wake its second face."', es: 'Kael: "Cristal del Archivo en mi laton. Trae Hongo Luz, escoria y obsidiana y despertare su segunda cara."' },
  'slate.kael.gives': { en: 'Tier II adds your Delve map pins and Pim\'s bounties.', es: 'El nivel II anade tus marcas del mapa y las recompensas de Pim.' },
  'slate.kael.bind': { en: 'Bind the second face', es: 'Atar la segunda cara' },
  'slate.kael.done': { en: 'Kael binds the second face. Your Slate now shows your map pins and Pim\'s bounties.', es: 'Kael ata la segunda cara. Tu Pizarra ya muestra tus marcas y las recompensas de Pim.' },
  'slate.kael.short': { en: 'Still short of what Kael needs.', es: 'Aun falta algo de lo que pide Kael.' },
  'slate.kael.failed': { en: 'That did not go through. Try again.', es: 'No se pudo. Intentalo de nuevo.' },

};
