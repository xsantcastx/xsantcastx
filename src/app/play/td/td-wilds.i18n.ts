/**
 * The Verdant Wilds as an act (S11; td-sections.ts WILDS_BIBLE, maps/wilds-sections.ts): every section's and every Root
 * Hollows floor's thing to read and its sealed thing, the Atlas hints for its Waystones, and the Walking Tree's lines
 * (the night event, td-night-events.ts). EN + ES. Lazy: registered by the play view. Lore is logged in
 * docs/world/lore-addendum.md ("S11: the Wilds as an act").
 */
export const WILDS_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Things to read (the zone bible's check) ──
  'reach.read.shore-netpost': { en: 'A net-drying post, notched for every catch: "Rootling Eel, a full net. Mirrorfin, none since the bells stopped." Signed with a knot, not a name.', es: 'Un poste para secar redes, con una muesca por captura: "Anguila Raicilla, una red llena. Pez Espejo, ninguno desde que callaron las campanas." Firmado con un nudo, no con un nombre.' },
  'reach.read.rootglass-lamproll': { en: 'The lamplighters\' roll, carved into a root: nine names in nine hands, every one a Fenn. The tenth line is waiting.', es: 'La lista de los faroleros, tallada en una raiz: nueve nombres de nueve manos, todos Fenn. La decima linea espera.' },
  'reach.read.fern-bellpost': { en: 'A priests\' bell-post, its hook empty. Cut into the wood: "Rung at the turn of the light, so the wood remembers its shape."', es: 'Un poste de campana de los sacerdotes, con el gancho vacio. Tallado en la madera: "Se toca al cambiar la luz, para que el bosque recuerde su forma."' },
  'reach.read.ford-depthpost': { en: 'A depth post, the Rootwater\'s marks cut up its side: "Cross at the planks. The river takes the rest." The highest mark is above your head.', es: 'Un poste de profundidad, con las marcas del Rootwater a lo largo: "Cruza por los tablones. El rio se lleva lo demas." La marca mas alta queda por encima de tu cabeza.' },
  'reach.read.mere-tally': { en: 'A fisher\'s tally on a stake: "Rootling Eel, 3. Mirrorfin, 0. Something under the planks that was not a fish, 1."', es: 'La cuenta de un pescador en una estaca: "Anguila Raicilla, 3. Pez Espejo, 0. Algo bajo los tablones que no era un pez, 1."' },
  'reach.read.hedge-cairn': { en: 'A cairn by the thorns, cut by a priest\'s hand: "The wood closes what it forgets." The old road went on through here. Below, the Root Hollows still go on.', es: 'Un mojon junto a las espinas, tallado por mano de sacerdote: "El bosque cierra lo que olvida." El viejo camino seguia por aqui. Abajo, las Root Hollows aun siguen.' },
  'reach.read.hollows-gnaw': { en: 'Gnaw-marks in the root, in rows of five, like a tally. The last row is fresh.', es: 'Marcas de dientes en la raiz, en filas de cinco, como una cuenta. La ultima fila es reciente.' },
  'reach.read.hollows-rope': { en: 'A woodward\'s rope, tied off on a root at the Sporewell\'s lip and cut clean. A broken lamp beside it. Somebody went down the well.', es: 'La cuerda de un guardabosques, atada a una raiz al borde del Pozo de Esporas y cortada limpia. Una lampara rota al lado. Alguien bajo por el pozo.' },
  'reach.read.heartroot-rings': { en: 'The heartroot\'s rings, hundreds of them. Scratched across the outer ring, small: "tomorrow".', es: 'Los anillos de la raiz corazon, cientos. Rayado sobre el anillo exterior, pequeno: "manana".' },
  'reach.read.deep-lantern-hook': { en: 'A lantern hook nailed into a trunk, higher than any arm could reach. Fresh sap has run round the nail. The tree grew it there.', es: 'Un gancho de farol clavado en un tronco, mas alto de lo que alcanza ningun brazo. Savia fresca ha corrido alrededor del clavo. El arbol lo hizo crecer ahi.' },
  'reach.read.courts-moss': { en: 'The moss here grows in rows, straight as lines of verse. Where a row breaks, a bell-post stood.', es: 'El musgo aqui crece en hileras, rectas como versos. Donde una hilera se rompe, hubo un poste de campana.' },

  // ── Sealed things (each a promise for later) ──
  'reach.sealed.shore-hull': { en: 'A sloop\'s hull, pulled up the beach long ago. The moss has grown over its hatch and shut it better than any carpenter.', es: 'El casco de una balandra, varado en la playa hace mucho. El musgo ha crecido sobre la escotilla y la ha cerrado mejor que cualquier carpintero.' },
  'reach.sealed.rootglass-rootdoor': { en: 'A door in the roots below the boardwalk, grown shut. Warden Fenn says the Bole closed it itself, and she has not asked it why.', es: 'Una puerta en las raices bajo la pasarela, cerrada por el crecimiento. La guardiana Fenn dice que el Bole la cerro solo, y no le ha preguntado por que.' },
  'reach.sealed.fern-bellhouse': { en: 'A moss-priests\' bell-house, its door grown over with fern. There is no bell in it. There is no rope either.', es: 'Una casa de campana de los sacerdotes del musgo, con la puerta cubierta de helechos. No hay campana dentro. Tampoco cuerda.' },
  'reach.sealed.ford-sluice': { en: 'A sluice of the Drowned Aqueduct, choked with root. Water still runs somewhere behind it.', es: 'Una compuerta del Drowned Aqueduct, ahogada de raices. Detras, en algun sitio, aun corre el agua.' },
  'reach.sealed.mere-cave': { en: 'A cave in the mere\'s bank, sealed with roots woven like a basket. Something inside keeps it dry.', es: 'Una cueva en la orilla del lago, sellada con raices tejidas como un cesto. Algo dentro la mantiene seca.' },
  'reach.sealed.thorn-hedge': { en: 'The thorn hedge, grown across the old road to the Deep Wilds. A blade goes in and the thorns close behind it. The way on is below: the Root Hollows.', es: 'El seto de espinas, crecido sobre el viejo camino a los Deep Wilds. Una hoja entra y las espinas se cierran detras. El camino sigue abajo: las Root Hollows.' },
  'reach.sealed.hollows-packed': { en: 'A side tunnel packed shut with earth and root, by hand. The handprints are small.', es: 'Un tunel lateral tapado con tierra y raiz, a mano. Las huellas de las manos son pequenas.' },
  'reach.sealed.hollows-coffer': { en: 'A woodward\'s chest, swollen shut with the damp. Whoever left the rope by the well left this.', es: 'El arcon de un guardabosques, hinchado y cerrado por la humedad. Quien dejo la cuerda junto al pozo dejo esto.' },
  'reach.sealed.heartroot-niche': { en: 'A hollow behind a root. The root shivers when a light comes near, and stills when it goes.', es: 'Un hueco detras de una raiz. La raiz se estremece cuando se acerca una luz, y se calma cuando se va.' },
  'reach.sealed.deep-spore-mouth': { en: 'A hollow in the earth, choked with spores. At night the motes drift toward it as if they knew a way down.', es: 'Un hueco en la tierra, ahogado de esporas. De noche las motas van hacia el como si conocieran un camino hacia abajo.' },
  'reach.sealed.courts-bellframe': { en: 'A bell-frame in the old square, its bell long gone, taken by vines so thick they hold the frame up.', es: 'Un armazon de campana en la vieja plaza, sin campana desde hace mucho, tomado por enredaderas tan gruesas que lo sostienen.' },

  // ── The Walking Tree (the night event; world-acts.md §5.3) ──
  'reach.act.walker': { en: 'Strike the tree', es: 'Golpear el arbol' },
  'nightev.walker.seen': { en: 'One of the copied trees is not where it was.', es: 'Uno de los arboles copiados no esta donde estaba.' },
  'nightev.walker.dim': { en: 'Glim dims beside the tree. That one is the copy. Strike it.', es: 'Glim se apaga junto al arbol. Ese es la copia. Golpealo.' },
  'nightev.walker.struck': { en: 'The tree shivers, and is only a tree. A seed drops from it: a copy-seed.', es: 'El arbol se estremece, y ya solo es un arbol. Cae una semilla: una semilla copiada.' },

  // ── The Waystones' Atlas ──
  'atlas.near.net': { en: 'up from Mossharbor\'s pier', es: 'subiendo desde el muelle de Mossharbor' },
  'atlas.near.rootglass': { en: 'on the boardwalk by the Bole', es: 'en la pasarela junto al Bole' },
  'atlas.near.bell-post': { en: 'up the Mossy Shore\'s north road', es: 'subiendo el camino norte de la Costa Musgosa' },
  'atlas.near.plank': { en: 'over the Fernglades\' ford road', es: 'tras el camino del vado de los Fernglades' },
  'atlas.near.mere': { en: 'down the Ford\'s east path', es: 'bajando el sendero este del Vado' },
  'atlas.near.copy-tree': { en: 'up the Ford\'s north road', es: 'subiendo el camino norte del Vado' },
  'atlas.near.heartroot': { en: 'up the root-ramp out of the Root Hollows', es: 'subiendo la rampa de raiz desde las Root Hollows' },
  'atlas.near.pillar': { en: 'down the Deep Wilds\' east road', es: 'bajando el camino este de los Deep Wilds' },
  'atlas.land.verdant-wilds': { en: 'the Verdant Wilds', es: 'Verdant Wilds' },
};
