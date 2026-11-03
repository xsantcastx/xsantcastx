/**
 * The Infernal Reach as an act (td-sections.ts, maps/reach-sections.ts): every section's thing to read and its sealed
 * thing, the Waystones' Atlas, the seams. EN + ES. Lazy: registered by the play view. Lore is logged in
 * docs/world/lore-addendum.md ("S7: the Reach as an act").
 */
export const REACH_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Things to read (the zone bible's check) ──
  'reach.read.pyrehold-bell': { en: 'The Watch bell\'s plaque: "Rung at dusk and at need. Struck by five, kept by one."', es: 'La placa de la campana de la Guardia: "Se toca al anochecer y en la necesidad. Forjada por cinco, guardada por uno."' },
  'reach.read.steppe-cairn': { en: 'A Watch cairn, its brass plaque green with ash: "Struck by five, kept by one. The road is held from here."', es: 'Un mojon de la Guardia, la placa de laton verde de ceniza: "Forjada por cinco, guardada por uno. Desde aqui se defiende el camino."' },
  'reach.read.shore-tideboard': { en: 'A fisher\'s tide-board, in chalk: "Mirrorfin running south again. Ash Perch in Glasswater. No bait after dark."', es: 'La tablilla de mareas de un pescador, en tiza: "El Pez Espejo baja al sur otra vez. Perca de Ceniza en Aguavidrio. Nada de cebo de noche."' },
  'reach.read.charwood-post': { en: 'A woodward\'s tally post: "Burnt 112. Planted 9." Under it, cut deeper: "H. Ashby."', es: 'El poste de cuentas de un guardabosques: "Quemados 112. Plantados 9." Debajo, mas hondo: "H. Ashby."' },
  'reach.read.kiln-tally': { en: 'A cart tally in chalk: a row of strokes for every day, five carts a day. The fourth row stops at two.', es: 'Una cuenta de carros en tiza: una fila de rayas por dia, cinco carros al dia. La cuarta fila se detiene en dos.' },
  'reach.read.kettle-stamp': { en: 'Stamped in the kettle\'s rim: "PYRE WATCH — RATIONS — FORTY MEN." Something has been boiling slag in it.', es: 'Grabado en el borde del caldero: "GUARDIA DE LA PIRA — RACIONES — CUARENTA HOMBRES." Alguien ha hervido escoria en el.' },
  'reach.read.scorch-words': { en: 'Two words cut in the stone, again and again, until there is more cut than stone: vael dra.', es: 'Dos palabras talladas en la piedra, una y otra vez, hasta que hay mas corte que piedra: vael dra.' },
  'reach.read.throat-ring': { en: 'A Firecaller\'s ring, cut into the glass: vael dra, vael dra. The glass ran, and the last word is half melted.', es: 'Un circulo de Invocafuegos, tallado en el vidrio: vael dra, vael dra. El vidrio corrio, y la ultima palabra esta medio fundida.' },
  'reach.read.throat-prints': { en: 'Footprints fused into the glass floor, deep and even, all of them going in.', es: 'Huellas fundidas en el suelo de vidrio, hondas y parejas, todas hacia dentro.' },
  'reach.read.drake-post': { en: 'A Watch warning post: "DRAKES NEST SOUTH. KEEP THE ROAD." Somebody has added: "they know the road."', es: 'Un poste de aviso de la Guardia: "LOS DRACOS ANIDAN AL SUR. NO DEJES EL CAMINO." Alguien ha anadido: "conocen el camino."' },
  'reach.read.bastion-mile': { en: 'A Bastion milestone: "ASHEN BASTION — TWO LEAGUES." Under the distance, in another hand: "Present."', es: 'Un hito del Bastion: "BASTION CENICIENTO — DOS LEGUAS." Bajo la distancia, de otra mano: "Presente."' },
  'reach.read.cinderport-tides': { en: 'The tide board. Under the tides, in Marit\'s hand: "The lamp stays lit till the last ketch is in."', es: 'La tablilla de mareas. Bajo las mareas, con la letra de Marit: "La lampara sigue encendida hasta que entra el ultimo queche."' },
  'reach.read.ashgrove-board': { en: 'Maud Kiln\'s board, chalked by the kilns: "Charcoal is fire that agreed to wait. Nine days a clamp. No sooner."', es: 'La pizarra de Maud Kiln, junto a los hornos: "El carbon es fuego que acepto esperar. Nueve dias cada pila. Ni uno menos."' },

  // ── Sealed things (each a promise for later) ──
  'reach.sealed.pyrehold-strongroom': { en: 'The Watch strongbox, iron-banded. Captain Vey keeps its only key.', es: 'El cofre de la Guardia, reforzado con hierro. El capitan Vey guarda la unica llave.' },
  'reach.sealed.steppe-beacon': { en: 'An old beacon tower of the Watch, its door bricked up from inside.', es: 'Una vieja torre de almenara de la Guardia, con la puerta tapiada desde dentro.' },
  'reach.sealed.shore-cave': { en: 'A door cut into the cliff, shut with drowned glass. The tide has never quite reached it.', es: 'Una puerta tallada en el acantilado, cerrada con vidrio ahogado. La marea nunca ha llegado a tocarla.' },
  'reach.sealed.charwood-kiln': { en: 'A charcoal kiln, its door bricked over. The bricks are warm.', es: 'Un horno de carbon con la puerta tapiada. Los ladrillos estan tibios.' },
  'reach.sealed.kiln-arch': { en: '"BURNERS ONLY", in chalk, on bricks laid in a hurry. Something was walled out. Or in.', es: '"SOLO CARBONEROS", en tiza, sobre ladrillos puestos con prisa. Algo quedo tapiado fuera. O dentro.' },
  'reach.sealed.deep-kiln': { en: 'A kiln gone cold, its door bricked shut. Somebody tallied nine days on it, and stopped.', es: 'Un horno apagado, la puerta tapiada. Alguien conto nueve dias en ella, y paro.' },
  'reach.sealed.badlands-sluice': { en: 'An iron sluice-gate from the Forge\'s spill, rusted shut. Slag has dried in its teeth.', es: 'Una compuerta de hierro del derrame de la Forja, oxidada y cerrada. La escoria se seco entre sus dientes.' },
  'reach.sealed.throat-tube': { en: 'A side tube, choked with glass. Through it, faint, the sound of something still cooling.', es: 'Un tubo lateral, ahogado de vidrio. A traves, debil, el sonido de algo que aun se enfria.' },
  'reach.sealed.throat-glass': { en: 'A wall of glass. Your own light looks back at you from it. Without the light, perhaps, it would show something else.', es: 'Un muro de vidrio. Tu propia luz te devuelve la mirada. Sin la luz, quiza, mostraria otra cosa.' },
  'reach.sealed.drake-cage': { en: 'A drake-catcher\'s cage, its door rusted shut. Whoever set it never came back for it.', es: 'La jaula de un cazador de dracos, la puerta oxidada y cerrada. Quien la puso nunca volvio a por ella.' },
  'reach.sealed.bastion-gate': { en: 'The Ashen Bastion\'s great gate, barred from the inside. The garrison is still behind it.', es: 'La gran puerta del Bastion Ceniciento, atrancada por dentro. La guarnicion sigue detras.' },
  'reach.sealed.cinderport-cellar': { en: 'Marit\'s sea-chest, padlocked. Chalked on the lid: "Keep out. Yes, you."', es: 'El arcon de Marit, con candado. En la tapa, en tiza: "Fuera. Si, tu."' },
  'reach.sealed.ashgrove-clamp': { en: 'A charcoal clamp, earthed over and smoking. Not to be opened for nine days.', es: 'Una pila de carbon, cubierta de tierra y humeando. No se abre en nueve dias.' },

  // ── The prompt in reach (E, a tap) ──
  'reach.act.tdstone': { en: 'Touch {{name}}', es: 'Tocar {{name}}' },
  'reach.act.read': { en: 'Read {{name}}', es: 'Leer {{name}}' },
  'reach.act.sealed': { en: 'Look at {{name}}', es: 'Mirar {{name}}' },
  'reach.act.seam': { en: 'Walk on: {{name}}', es: 'Seguir: {{name}}' },

  // ── The Waystones' Atlas (one a section; world-acts.md §0) ──
  'atlas.title': { en: 'The Waystones of {{land}}', es: 'Las Piedras de Camino de {{land}}' },
  'atlas.close': { en: 'Close', es: 'Cerrar' },
  'atlas.lead': { en: 'A stone that remembers who touched it. Travel to any stone you have touched, for free.', es: 'Una piedra que recuerda quien la toco. Viaja gratis a cualquier piedra que hayas tocado.' },
  'atlas.here': { en: 'You are here', es: 'Estas aqui' },
  'atlas.known': { en: 'Touched', es: 'Tocada' },
  'atlas.unknown': { en: 'Not found yet', es: 'Aun sin encontrar' },
  'atlas.travel': { en: 'Travel to {{name}}', es: 'Viajar a {{name}}' },
  'atlas.pick': { en: 'Pick a stone', es: 'Elige una piedra' },
  'atlas.band': { en: 'Lv {{lo}}–{{hi}}', es: 'Nv {{lo}}–{{hi}}' },
  'atlas.safe': { en: 'Safe', es: 'Seguro' },
  'atlas.touched': { en: 'The {{name}} remembers you now. +{{xp}} Delving XP.', es: 'La {{name}} ya te recuerda. +{{xp}} PX de Exploracion.' },
  'atlas.aria': { en: 'Waystones', es: 'Piedras de Camino' },
  'atlas.land.infernal-reach': { en: 'the Infernal Reach', es: 'Infernal Reach' },
};
