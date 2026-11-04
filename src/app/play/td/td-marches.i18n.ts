/**
 * The Umbral Marches as an act (S11 part 2; td-sections.ts MARCHES_BIBLE, maps/umbral-sections.ts): every section's and
 * every connector floor's thing to read and its sealed thing, the Atlas hints for its Waystones, the Interact verb for a
 * boardwalk, and the Bell Under the Water's lines (the night event, td-night-events.ts). EN + ES. Lazy: registered by
 * the play view. Lore is logged in docs/world/lore-addendum.md ("S11 part 2: the Marches as an act").
 */
export const MARCHES_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Things to read (the zone bible's check) ──
  'reach.read.shore-wickpost': { en: 'A post on the dunes, hung with wick-tags: tin scraps, a name scratched on each. Old Corvane\'s hand on the newest: "Lit for them that went out on the water. Not one of them came in by the dark."', es: 'Un poste en las dunas, colgado de etiquetas de mecha: trozos de lata, un nombre rayado en cada uno. La letra del Viejo Corvane en la mas nueva: "Encendidas por los que salieron al agua. Ninguno volvio por la oscuridad."' },
  'reach.read.gloamhaven-round': { en: 'The lamplighters\' round, cut into a board by the boardwalk: every post in Gloamhaven, in the order they are lit. Across the foot, in bigger letters: "Never let one go out. Not one."', es: 'La ronda de los faroleros, tallada en una tabla junto a la pasarela: cada poste de Gloamhaven, en el orden en que se encienden. Al pie, en letras mas grandes: "Que no se apague ninguno. Ni uno."' },
  'reach.read.fen-boundary': { en: 'An abbey slab, half under the bog, its letters filled with silt: "Here the abbey\'s parish ends. Pilgrim, keep to the boards." Someone has scratched under it: "What boards."', es: 'Una losa de la abadia, medio hundida en el lodo, con las letras llenas de cieno: "Aqui termina la parroquia de la abadia. Peregrino, no dejes las tablas." Alguien ha rayado debajo: "Que tablas."' },
  'reach.read.boardwalk-prayer': { en: 'A prayer-board nailed to the boardwalk\'s rail, its words in Cant: lum vesh. Light, seek. Under it, a sister\'s name burnt into the wood: Elspeth Haddow.', es: 'Una tabla de oracion clavada a la baranda de la pasarela, sus palabras en Cant: lum vesh. Luz, busca. Debajo, el nombre de una hermana quemado en la madera: Elspeth Haddow.' },
  'reach.read.belfry-rota': { en: 'The ringers\' rota, chalked on a board: four names against four bells, Cobb, Lisle, Teasel, Wyn. A fifth line, and a fifth bell, and the name rubbed out so hard the board is worn through.', es: 'El turno de los campaneros, en tiza sobre una tabla: cuatro nombres frente a cuatro campanas, Cobb, Lisle, Teasel, Wyn. Una quinta linea, una quinta campana, y el nombre borrado con tanta fuerza que la tabla esta gastada.' },
  'reach.read.belfry-glove': { en: 'A ringer\'s leather glove, hung on its hook, as if its owner meant to come back. Stitched inside the cuff: "Pull on four. Never on five."', es: 'El guante de cuero de un campanero, colgado de su gancho, como si su dueno pensara volver. Cosido dentro del puno: "Tira en el cuatro. Nunca en el cinco."' },
  'reach.read.meres-lampstake': { en: 'A lamp-stake driven into a hummock, its lamp long gone. Cut down its side: "Lampfish rise to a light. So do other things. Keep your lantern high."', es: 'Una estaca de farol clavada en un monticulo, sin farol desde hace mucho. Tallado a lo largo: "Los peces farol suben a la luz. Otras cosas tambien. Lleva el farol en alto."' },
  'reach.read.deep-wicktag': { en: 'A lost lantern on a post, cold, a wick-tag on its handle: a name, and under it, "Lit till they come home." The tin is green with years.', es: 'Un farol perdido en un poste, frio, con una etiqueta de mecha en el asa: un nombre, y debajo, "Encendido hasta que vuelvan." La lata esta verde de anos.' },
  'reach.read.galleries-tally': { en: 'The peat-cutters\' tally board: rows of strokes, a row a day, for the lanterns\' fuel. The last row stops half cut. Every spade in the gallery still stands where it was left.', es: 'La tabla de cuentas de los cortadores de turba: filas de trazos, una por dia, para el combustible de los faroles. La ultima fila se para a medias. Cada pala de la galeria sigue donde la dejaron.' },
  'reach.read.galleries-wicktag': { en: 'A wick-tag on a nail by the last chamber: "Merrin Sedge. Gone up for oil." The nail has rusted into the peat.', es: 'Una etiqueta de mecha en un clavo junto a la ultima camara: "Merrin Sedge. Subio por aceite." El clavo se ha oxidado dentro de la turba.' },
  'reach.read.ruins-slab': { en: 'An abbey slab in the drowned square, a list of the sisters\' cells in order. The last line is new chisel-work, bright under the silt: "She is still at her prayers. Let her finish."', es: 'Una losa de la abadia en la plaza ahogada, la lista de las celdas de las hermanas en orden. La ultima linea es de cincel nuevo, clara bajo el cieno: "Sigue rezando. Dejadla terminar."' },
  // ── Sealed things (promises for later; none opens yet) ──
  'reach.sealed.shore-watchhouse': { en: 'A drowned watch-house on the dunes, its door swollen shut with the damp. Through a crack: a lamp on a table, its wick trimmed.', es: 'Una caseta de guardia ahogada en las dunas, la puerta hinchada de humedad. Por una rendija: un farol sobre una mesa, la mecha recortada.' },
  'reach.sealed.gloamhaven-chapel': { en: 'A chapel door under the boardwalk, the drowned square\'s, its top just out of the water. Barred from inside. The bar is new.', es: 'Una puerta de capilla bajo la pasarela, de la plaza ahogada, con el dintel justo fuera del agua. Atrancada por dentro. La tranca es nueva.' },
  'reach.sealed.fen-cutters-hut': { en: 'A peat-cutter\'s hut, nailed shut from outside. A spade leans by the door, its blade still wet.', es: 'La choza de un cortador de turba, clavada por fuera. Una pala apoyada junto a la puerta, la hoja aun mojada.' },
  'reach.sealed.boardwalk-broken': { en: 'The boardwalk ends here. Its piles walk on out into the black water, boards gone, toward the abbey. Beside the break the old bell-tower lies on its side, its louvres open to the sky: the way on is down through it.', es: 'La pasarela termina aqui. Sus pilotes siguen hacia el agua negra, sin tablas, rumbo a la abadia. Junto a la rotura yace la vieja torre del campanario, de lado, con los ventanales abiertos al cielo: el camino sigue bajando por ella.' },
  'reach.sealed.belfry-fifth-door': { en: 'A door under the water\'s edge, its keyhole the shape of a bell. Beyond it, something slow and very large rings once, and the water shivers. It does not open. Not yet.', es: 'Una puerta bajo el borde del agua, con la cerradura en forma de campana. Al otro lado, algo lento y enorme suena una vez, y el agua tiembla. No se abre. Todavia no.' },
  'reach.sealed.meres-punt': { en: 'A punt chained under the water to a post, the chain locked. Something has been tied in it, and it is still tied.', es: 'Una batea encadenada bajo el agua a un poste, la cadena con candado. Algo esta atado dentro, y sigue atado.' },
  'reach.sealed.deep-chapel': { en: 'A chapel roof in the bog, only its ridge above the mire. The skylight is shut and painted black from inside.', es: 'El tejado de una capilla en el lodo, solo la cumbrera fuera del cieno. La claraboya esta cerrada y pintada de negro por dentro.' },
  'reach.sealed.galleries-boarded': { en: 'A flooded cut, boarded across. Behind the planks the water stands level with the top board, and does not drain.', es: 'Un corte inundado, tapiado con tablas. Detras, el agua llega a la tabla de arriba, y no baja.' },
  'reach.sealed.galleries-sluice': { en: 'The abbey\'s sluice, bricked up from the other side. Someone on that side did not want the water to come down.', es: 'La compuerta de la abadia, tapiada con ladrillo desde el otro lado. Alguien de ese lado no queria que bajara el agua.' },
  'reach.sealed.ruins-watergate': { en: 'The abbey\'s water-gate, its portcullis rusted down into the silt. The water behind it is higher than the water in front.', es: 'La puerta de agua de la abadia, el rastrillo oxidado hasta el cieno. El agua de detras esta mas alta que la de delante.' },
  // ── A boardwalk or a ford across the water: the prompt names the verb ──
  'reach.act.cross': { en: 'Cross: {{name}}', es: 'Cruzar: {{name}}' },
  // The Bell Under the Water: by the Belfry's roof the only thing to do is keep still.
  'reach.act.underbell': { en: 'Stand still — listen', es: 'Quieto — escucha' },
  // The fifth bell's door: it is sealed, and the prompt says so.
  'reach.act.sealed-fifth': { en: 'Sealed: {{name}}', es: 'Sellada: {{name}}' },
  // ── The Atlas (where each Waystone stands) ──
  'atlas.land.umbral-marches': { en: 'the Marches', es: 'los Marches' },
  // The Marches' Atlas title, short enough for one line on a 360 px phone.
  'atlas.title.umbral-marches': { en: 'Marches Waystones', es: 'Piedras de los Marches' },
  'atlas.near.corvane': { en: 'up from Mirewatch\'s pier', es: 'subiendo desde el muelle de Mirewatch' },
  'atlas.near.gloamhaven': { en: 'on the drowned square', es: 'en la plaza ahogada' },
  'atlas.near.wick': { en: 'up the Shore\'s north boardwalk', es: 'subiendo la pasarela norte de la Costa' },
  'atlas.near.prayer-board': { en: 'up the pilgrims\' road from the Fen', es: 'subiendo el camino de los peregrinos desde el Pantano' },
  'atlas.near.mere-lamp': { en: 'out of the Sunken Belfry', es: 'saliendo del Campanario Hundido' },
  'atlas.near.lost-lantern': { en: 'over the Meres\' east boardwalk', es: 'tras la pasarela este de los Meres' },
  'atlas.near.abbey-slab': { en: 'up the cutters\' stair out of the Bog Galleries', es: 'subiendo la escalera de los cortadores desde las Bog Galleries' },
  // ── The Bell Under the Water (the Black Meres, under an eclipse; world-acts.md §5.4) ──
  'nightev.underbell.ring': { en: 'Under the water, a bell rings once. Every light in the Meres goes out.', es: 'Bajo el agua, una campana suena una vez. Todas las luces de los Meres se apagan.' },
  'nightev.underbell.still': { en: 'Glim: "Don\'t move. It\'s listening."', es: 'Glim: "No te muevas. Esta escuchando."' },
  'nightev.underbell.moved': { en: 'Glim: "You moved. It stopped."', es: 'Glim: "Te has movido. Ha parado."' },
  'nightev.underbell.keyhole': { en: 'Glim: "There. Under the roof. A keyhole the shape of a bell, glowing." Wax pressed to the stone keeps its shape.', es: 'Glim: "Ahi. Bajo el tejado. Una cerradura en forma de campana, brillando." La cera apretada contra la piedra guarda su forma.' },
};
