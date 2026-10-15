/**
 * glim.i18n.ts: Glim, the Margin-Light (shared/glim/glim.ts). Lazy: registered by
 * the side-scroller (play chunk), the Codex (Glim's entry) and the Delve mission
 * chip (mission hints), checked by scripts/check-i18n-keys.js.
 *
 * Voice (docs/world/world-and-cast.md §4): curious first, helpful second,
 * honest always; a little nerdy about maps; says "I don't know" plainly; never
 * flatters, never cute. Short: a phone shows a line in the toast band above the
 * world, three lines at most. Place and item names stay in English in ES, like
 * the rest of the play HUD.
 */
export const GLIM_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'play.glim.ask': { en: 'Ask Glim for a hint ({{n}} of {{total}})', es: 'Pide una pista a Glim ({{n}} de {{total}})' },
  'play.glim.askDone': { en: 'Ask Glim again', es: 'Pregunta otra vez a Glim' },
  'play.glim.dismiss': { en: 'Dismiss Glim', es: 'Despedir a Glim' },
  'play.glim.step': { en: 'Hint {{n}} of {{total}}', es: 'Pista {{n}} de {{total}}' },

  // ── Lines: the Prologue, the lantern, the stopping point, the tell ──
  'play.glim.line.meet': { en: "Hello. I'm Glim. I keep the maps. Mostly the blank parts; they're the interesting ones.", es: 'Hola. Soy Glim. Guardo los mapas. Sobre todo las partes en blanco; son las interesantes.' },
  'play.glim.line.homestead': { en: 'Somebody left you a plot. Nobody left you a reason. We\'ll find one.', es: 'Alguien te dejo una parcela. Nadie te dejo una razon. Ya la encontraremos.' },
  'play.glim.line.edge': { en: 'A blade made to show where a boundary is before anyone crosses it. Wear it well.', es: 'Una hoja hecha para mostrar donde esta un limite antes de que alguien lo cruce. Llevala bien.' },
  'play.glim.line.maws': { en: 'The Maws drag their bolts toward the Delve shaft. I\'d like to know why. I\'ve marked it.', es: 'Las Fauces arrastran sus pernos hacia el pozo de la Sima. Quiero saber por que. Lo he anotado.' },
  'play.glim.line.delve': { en: 'North is a convention. Down is a fact. We\'re going down.', es: 'El norte es una convencion. Abajo es un hecho. Vamos hacia abajo.' },
  'play.glim.line.lantern': { en: 'I\'ll be your light down here. The torches you place are my notes; I leave them for you.', es: 'Aqui abajo sere tu luz. Las antorchas que pones son mis notas; te las dejo.' },
  'play.glim.line.stop': { en: 'This is a good place to stop. The torch is lit and the map is honest.', es: 'Este es un buen sitio para parar. La antorcha esta encendida y el mapa es honesto.' },
  'play.glim.line.mirror': { en: 'Something here is performing certainty. I go dim around that. Watch which one I dim for.', es: 'Algo aqui finge certeza. Me apago cerca de eso. Fijate por cual me apago.' },
  'play.glim.line.mirrorAgain': { en: 'Dimming. That one is too sure of itself.', es: 'Me apago. Ese esta demasiado seguro de si mismo.' },
  'play.glim.line.dashed': { en: 'I\'ll mark it dashed until we\'ve seen it. A solid line is a promise.', es: 'Lo marco con linea discontinua hasta que lo veamos. Una linea continua es una promesa.' },
  'play.glim.line.wall': { en: 'I don\'t know what\'s past that wall. I\'d rather tell you that than draw you a door.', es: 'No se que hay detras de ese muro. Prefiero decirtelo a dibujarte una puerta.' },
  'play.glim.line.north': { en: 'That\'s your third pass by this seam. I\'m not judging. I\'m annotating.', es: 'Es tu tercera pasada por esta veta. No te juzgo. Tomo notas.' },

  // ── The hint ladder: 1 a nudge, 2 a direction, 3 Show me ──
  'play.glim.hint.yours': { en: 'This one\'s yours to find. I\'ll hold the light.', es: 'Este te toca encontrarlo a ti. Yo sostengo la luz.' },
  'play.glim.hint.follow': { en: 'Follow me. I\'ll fly ahead and wait there.', es: 'Sigueme. Volare delante y te esperare alli.' },
  'play.glim.hint.here': { en: 'It\'s right where you\'re standing. Try it; I\'ll watch.', es: 'Esta justo donde estas. Pruebalo; yo miro.' },
  'play.glim.hint.mark': { en: 'I\'ll mark it on your Delve map. Open the map (M) and look for my light.', es: 'Lo marcare en tu mapa de la Sima. Abre el mapa (M) y busca mi luz.' },
  'play.glim.hint.back.1': { en: 'Everything for this goal is on the Seamworks floor. We\'ve wandered off the map\'s legend.', es: 'Todo para este objetivo esta en Basalt Seamworks. Nos salimos de la leyenda del mapa.' },
  'play.glim.hint.back.2': { en: 'Take the way back marked on the goal line; Show me walks it the short way.', es: 'Toma el camino de vuelta que marca el objetivo; Llevame lo recorre por el atajo.' },

  'play.glim.hint.buy.town.1': { en: 'Gold here comes from work. You have a plot with a Forge that pays you to strike it.', es: 'Aqui el oro sale del trabajo. Tienes una parcela con una Forja que te paga por golpearla.' },
  'play.glim.hint.buy.town.2': { en: 'Your Homestead is west along the street, past the mine head. Walk in; the Forge is the big one.', es: 'Tu Hacienda esta al oeste por la calle, pasada la boca de la mina. Entra; la Forja es la grande.' },
  'play.glim.hint.buy.home.1': { en: 'Every strike on the Forge is a coin. Fifteen of them buy something that strikes for you.', es: 'Cada golpe a la Forja es una moneda. Quince compran algo que golpea por ti.' },
  'play.glim.hint.buy.home.2': { en: 'Stand at the Forge and Interact (E) to 15 Gold, then press Buy on Forge Bellows.', es: 'Ponte en la Forja e interactua (E) hasta 15 de oro, luego pulsa Comprar en Forge Bellows.' },

  'play.glim.hint.craft.mine.1': { en: 'A blade starts as rock. There\'s a seam on this floor that glows where the ore is.', es: 'Una hoja empieza siendo roca. En este suelo hay una veta que brilla donde esta el mineral.' },
  'play.glim.hint.craft.mine.2': { en: 'The Cinder Ore seam is west of the Forge, by the mine head. Mine it (E); an ember turns up by your 8th ore.', es: 'La veta de Cinder Ore esta al oeste de la Forja, junto al pozo. Picala (E); una brasa aparece antes del 8.o mineral.' },
  'play.glim.hint.craft.forge.1': { en: 'You\'re carrying a blade\'s worth of ore. It only needs heat.', es: 'Llevas mineral para una hoja. Solo le falta calor.' },
  'play.glim.hint.craft.forge.2': { en: 'The Seamworks Forge is the anvil by the fire. Use it (E) to make the Basalt Edge.', es: 'La Seamworks Forge es el yunque junto al fuego. Usala (E) para hacer la Basalt Edge.' },
  'play.glim.hint.craft.equip.1': { en: 'A blade in a bag protects nobody.', es: 'Una hoja en la bolsa no protege a nadie.' },
  'play.glim.hint.craft.equip.2': { en: 'Use the Seamworks Forge once more (E): it puts the Edge in your hand.', es: 'Usa la Seamworks Forge una vez mas (E): te pone la hoja en la mano.' },

  'play.glim.hint.hunt.town.1': { en: 'The Rivet Maws hoard bolts. They\'re east of here, and they don\'t like visitors.', es: 'Las Fauces Remachadas acumulan pernos. Estan al este y no les gustan las visitas.' },
  'play.glim.hint.hunt.town.2': { en: 'Walk east past the Waystone. When the red line flashes under one, step back, then attack (J).', es: 'Camina al este pasado el Waystone. Cuando parpadee la linea roja, retrocede y luego ataca (J).' },
  'play.glim.hint.hunt.here.1': { en: 'They\'re close. Watch the ground under them before you swing.', es: 'Estan cerca. Mira el suelo bajo ellas antes de golpear.' },
  'play.glim.hint.hunt.here.2': { en: 'Walk up to a Maw. When the red line flashes, step back, then attack (J).', es: 'Acercate a una Fauce. Cuando parpadee la linea roja, retrocede y luego ataca (J).' },

  'play.glim.hint.delve.town.1': { en: 'The way down is a shaft in this very floor. I can smell the cold coming up it.', es: 'El camino hacia abajo es un pozo en este mismo suelo. Huelo el frio que sube por el.' },
  'play.glim.hint.delve.town.2': { en: 'The Ember Delve shaft is just east of the ore seam. Walk onto it and Interact (E).', es: 'El pozo de la Sima de Brasas esta al este de la veta. Ponte encima e interactua (E).' },
  'play.glim.hint.delve.world.1': { en: 'The Delve is not somewhere else. It is the rock under this street.', es: 'La Sima no esta en otra parte. Es la roca bajo esta calle.' },
  'play.glim.hint.delve.world.2': { en: 'Beside the mine head, west end of the street: hold Down (S) and attack (J). Its own ledge is bedrock.', es: 'Junto a la boca de la mina, al oeste de la calle: manten Abajo (S) y ataca (J). Su propio saliente es roca madre.' },
  'play.glim.hint.delve.dig.1': { en: 'The rock gives to a pick. Any block next to you will do.', es: 'La roca cede ante el pico. Cualquier bloque a tu lado sirve.' },
  'play.glim.hint.delve.dig.2': { en: 'Hold Down (S) and attack (J). On a phone, tap a block beside you.', es: 'Manten Abajo (S) y ataca (J). En el movil, toca un bloque a tu lado.' },

  'play.glim.hint.rune.1': { en: 'There\'s a forge here that strikes runes, not blades. You can afford one try now.', es: 'Aqui hay una forja que golpea runas, no hojas. Ya te alcanza para un intento.' },
  'play.glim.hint.rune.2': { en: 'The Rune Forge is east of the Crafting Bench. One strike is 600 Gold; the odds are on the forge.', es: 'La Rune Forge esta al este del Crafting Bench. Un golpe cuesta 600 de oro; las probabilidades estan en la forja.' },

  // Delve missions: where to look, never what a carving means. Step 3 is Glim's mark on the map.
  'play.glim.hint.m.shadow.1': { en: 'Verrin wants the shadow of a tree that grows downward. Shallow roots first.', es: 'Verrin quiere la sombra de un arbol que crece hacia abajo. Primero las raices poco profundas.' },
  'play.glim.hint.m.shadow.2': { en: 'The Root Hollows, the Delve\'s first layer. Cut the violet root growths with a sickle or a blade.', es: 'Root Hollows, la primera capa de la Sima. Corta las raices violetas con una hoz o una hoja.' },
  'play.glim.hint.m.seam.1': { en: 'Kael said "old seam". The old things are usually deeper.', es: 'Kael dijo "veta vieja". Lo viejo suele estar mas abajo.' },
  'play.glim.hint.m.seam.2': { en: 'The Basalt Caverns, below the Root Hollows. Slag veins, and an old Keeper\'s cache.', es: 'Basalt Caverns, bajo Root Hollows. Vetas de escoria y el escondite de un antiguo Guardian.' },
  'play.glim.hint.m.glowcaps.1': { en: 'Glowcaps light themselves. Look for the layer that doesn\'t need me.', es: 'Los Glowcaps se iluminan solos. Busca la capa que no me necesita.' },
  'play.glim.hint.f.minnow.1': { en: 'Small bright fish like small bright water. I have one lake on my map that glows on its own.', es: 'Los peces pequeños y brillantes buscan agua brillante. Tengo un lago en el mapa que brilla solo.' },
  'play.glim.hint.f.minnow.2': { en: 'The Grotto Mere, in the Glowcap Grotto. Any rod will do.', es: 'Grotto Mere, en Glowcap Grotto. Cualquier caña sirve.' },
  'play.glim.hint.f.alcove.1': { en: 'Something is still lit under the water. Light that stubborn is worth a held breath.', es: 'Algo sigue encendido bajo el agua. Una luz tan terca merece contener el aliento.' },
  'play.glim.hint.f.alcove.2': { en: 'East end of the Grotto Mere, under the surface. A Gill Draught buys you time.', es: 'Al este de Grotto Mere, bajo la superficie. Un Gill Draught te da tiempo.' },
  'play.glim.hint.f.lamp.1': { en: 'Some things only rise when it is dark, and only for the right bait.', es: 'Algunas cosas solo suben de noche, y solo por el cebo correcto.' },
  'play.glim.hint.f.lamp.2': { en: 'The Grotto Mere after dark, with Glowcap bait. Keep a torch close; I mean it.', es: 'Grotto Mere de noche, con cebo de Glowcap. Ten una antorcha cerca; lo digo en serio.' },
  'play.glim.hint.f.eels.1': { en: 'Eels like water that has a root in it. The Hollows have a little of both.', es: 'A las anguilas les gusta el agua con raíces. Las Hollows tienen un poco de ambas.' },
  'play.glim.hint.f.eels.2': { en: 'The seep in the Root Hollows alcove, or Kael\'s flooded seam.', es: 'La filtración del rincón de Root Hollows, o la veta inundada de Kael.' },
  'play.glim.hint.f.order.1': { en: 'Two orders, two waters. One of them is not water at all.', es: 'Dos pedidos, dos aguas. Una de ellas no es agua.' },
  'play.glim.hint.f.order.2': { en: 'Perch in the Grotto Mere; Slagjaw Eels in the Magma Halls lava with a Seam Rod.', es: 'Percas en Grotto Mere; anguilas Slagjaw en la lava de Magma Halls con una Seam Rod.' },
  'play.glim.hint.f.debt.1': { en: 'Old debts sink to the hottest, deepest places. Patience is the bait here.', es: 'Las deudas viejas se hunden en lo más caliente y profundo. Aquí el cebo es la paciencia.' },
  'play.glim.hint.f.debt.2': { en: 'The lava pools in the Magma Halls. It bites very rarely; keep casting.', es: 'Los pozos de lava de Magma Halls. Pica muy pocas veces; sigue lanzando.' },
  'play.glim.hint.f.pages.1': { en: 'Paper turns up where it shouldn\'t. Every water down here has swallowed some.', es: 'El papel aparece donde no debería. Toda el agua de aquí abajo se ha tragado algo.' },
  'play.glim.hint.f.pages.2': { en: 'Any water in the Delve. It comes up as junk on the line, now and then.', es: 'Cualquier agua del Delve. Sale como basura en el sedal, de vez en cuando.' },
  'play.glim.hint.u.rivets.1': { en: 'Rivets end up wherever water sits still long enough.', es: 'Los remaches acaban donde el agua se queda quieta el tiempo suficiente.' },
  'play.glim.hint.u.rivets.2': { en: 'Fish any water in the Delve, or try a flooded shaft out east or west.', es: 'Pesca en cualquier agua del Delve, o prueba un pozo inundado al este o al oeste.' },
  'play.glim.hint.u.seal.1': { en: 'The deepest room we know has a floor that is not quite a floor.', es: 'La sala mas honda que conocemos tiene un suelo que no es del todo un suelo.' },
  'play.glim.hint.u.seal.2': { en: 'The fragment chamber, under your feet. A Pickaxe IV, and Delving 15.', es: 'La camara del fragmento, bajo tus pies. Un Pico IV y Delving 15.' },
  'play.glim.hint.u.marks.1': { en: 'Four people worked down here. People leave corners lit.', es: 'Cuatro personas trabajaron aqui abajo. La gente deja rincones encendidos.' },
  'play.glim.hint.u.marks.2': { en: 'Two east of the shaft, two west, not far. Look for a warm forge corner on the map.', es: 'Dos al este del pozo, dos al oeste, no lejos. Busca un rincon de forja tibio en el mapa.' },
  'play.glim.hint.u.furnace.1': { en: 'Kael\'s old rail goes all the way down. So does the heat.', es: 'El viejo rail de Kael baja hasta el fondo. El calor tambien.' },
  'play.glim.hint.u.furnace.2': { en: 'Ride the rail to the Furnace Hall. Bring a bucket: the trough is there for a reason.', es: 'Baja por el rail hasta la Sala del Horno. Lleva un cubo: el abrevadero esta ahi por algo.' },
  // The Rift Gates (rift-gates.model.ts): where to look, never what is behind them.
  'play.glim.hint.r.gate.1': { en: 'There is a frame in the Underhearth older than anything Kael built. It hums toward Verrin\'s realm.', es: 'Hay un marco en el Bajohogar mas viejo que todo lo que construyo Kael. Zumba hacia el reino de Verrin.' },
  'play.glim.hint.r.gate.2': { en: 'West of the Landing, deep in the iron rock. Cut four splinters from its frame and make the Umbral Sigil at a bench.', es: 'Al oeste del Rellano, hondo en la roca de hierro. Corta cuatro astillas del marco y haz el Sello Umbral en un banco.' },
  'play.glim.hint.r.glass.1': { en: 'The ink ore glows a little, the way a bruise does. The glass only shows where it is darkest.', es: 'La mena de tinta brilla un poco, como un moraton. El vidrio solo aparece donde esta mas oscuro.' },
  'play.glim.hint.r.glass.2': { en: 'Inkstone round the ink pools in the Shallows; nightglass in the Gloam Deep and the walls where shades rest.', es: 'Piedra de tinta junto a los pozos de tinta en los Bajios; vidrio nocturno en la Penumbra Honda y en las paredes donde descansan las sombras.' },
  'play.glim.hint.r.warden.1': { en: 'Something under the Gate Hollow asks only to be lit.', es: 'Algo bajo la Hondonada del Portal solo pide que lo iluminen.' },
  'play.glim.hint.r.warden.2': { en: 'Dig down from the gate. Three braziers, a torch each. Fight it only in their light.', es: 'Cava hacia abajo desde el portal. Tres braseros, una antorcha cada uno. Lucha solo en su luz.' },
  // The Root Deeps and the Prism Mines (rift-gates.model.ts): where to look, never what is behind them.
  'play.glim.hint.v.gate.1': { en: 'There is a frame in the Root Hollows the roots grow round, not through. It smells of sap.', es: 'Hay un marco en las Oquedades que las raices rodean en vez de atravesar. Huele a savia.' },
  'play.glim.hint.v.gate.2': { en: 'West of the shaft, in the Root Hollows. Cut four splinters from its frame and make the Verdant Sigil at a bench.', es: 'Al oeste del pozo, en las Oquedades. Corta cuatro astillas del marco y haz el Sello Verdante en un banco.' },
  'play.glim.hint.v.glass.1': { en: 'The root bleeds glass where it was cut, and amber where it was cut long ago.', es: 'La raiz sangra vidrio donde la cortaron, y ambar donde la cortaron hace mucho.' },
  'play.glim.hint.v.glass.2': { en: 'Rootglass in the Root Deeps\' living wood; heart-amber deeper, and in the roofs where graftlings grow.', es: 'Vidrio de raiz en la madera viva de las Raices Hondas; ambar corazon mas abajo, y en los techos donde crecen los injertitos.' },
  'play.glim.hint.v.graft.1': { en: 'Something under the Gate Hollow joins everything that is cut.', es: 'Algo bajo la Hondonada del Portal une todo lo que se corta.' },
  'play.glim.hint.v.graft.2': { en: 'Climb down the vine in the west tunnel. Cut the red roots on her floor, and put a torch by every stump.', es: 'Baja por la enredadera del tunel oeste. Corta las raices rojas del suelo y pon una antorcha junto a cada tocon.' },
  'play.glim.hint.l.gate.1': { en: 'There is a frame in the Grotto that the glowcaps lean toward, as if it were morning.', es: 'Hay un marco en la Gruta hacia el que se inclinan las setas, como si fuera de manana.' },
  'play.glim.hint.l.gate.2': { en: 'East in the Glowcap Grotto. Cut four splinters from its frame and make the Luminous Sigil at a bench.', es: 'Al este en la Gruta de Setas. Corta cuatro astillas del marco y haz el Sello Luminoso en un banco.' },
  'play.glim.hint.l.glass.1': { en: 'The light down there sets, like honey. The ore is where it set in the rock.', es: 'La luz alli abajo cuaja, como la miel. La mena esta donde cuajo en la roca.' },
  'play.glim.hint.l.glass.2': { en: 'Prismite in the Prism Mines\' pale rock; dawnglass deeper, and in the roofs where prismlings gather.', es: 'Prismita en la roca palida de las Minas de Prisma; vidrio del alba mas abajo, y en los techos donde se juntan los prismitas.' },
  'play.glim.hint.l.sun.1': { en: 'A light under the Gate Hollow is still waiting for whoever it was promised to.', es: 'Una luz bajo la Hondonada del Portal sigue esperando a quien se la prometieron.' },
  'play.glim.hint.l.sun.2': { en: 'Climb down the beam in the west tunnel. Turn the mirror at its foot and hold the Hollow Sun in the light.', es: 'Baja por el rayo del tunel oeste. Gira el espejo de abajo y manten al Sol Hueco en la luz.' },
  // The Orrery Wells (rift-gates.model.ts): Sera Quill's chain, filed by the Archivist.
  'play.glim.hint.c.gate.1': { en: 'There is a frame in the Magma Halls the heat will not touch. Things near it cannot agree which way is down.', es: 'Hay un marco en las Salas de Magma que el calor no toca. Las cosas cerca de el no se ponen de acuerdo sobre donde esta abajo.' },
  'play.glim.hint.c.gate.2': { en: 'East in the Magma Halls. Cut four splinters from its frame and make the Celestial Sigil at a bench.', es: 'Al este en las Salas de Magma. Corta cuatro astillas del marco y haz el Sello Celestial en un banco.' },
  'play.glim.hint.c.steel.1': { en: 'What fell a long way and kept its shine is up where you cannot reach it. Unless up is where you stand.', es: 'Lo que cayo de muy lejos y conservo su brillo esta arriba, donde no llegas. A menos que arriba sea donde pisas.' },
  'play.glim.hint.c.steel.2': { en: 'Starsteel in the Brass Galleries and the roofs of orrery vaults; meridian glass deeper, and up the star-wells.', es: 'Acero estelar en las Galerias de Laton y en los techos de las bovedas del orrery; vidrio meridiano mas abajo, y arriba de los pozos estelares.' },
  'play.glim.hint.c.ephemeris.1': { en: 'Something under the Gate Hollow is still waiting for the sky to agree with it.', es: 'Algo bajo la Hondonada del Portal sigue esperando a que el cielo le de la razon.' },
  'play.glim.hint.c.ephemeris.2': { en: 'Climb down the chain in the west tunnel. Turn a ring in its hall and it drops into its own well. Strike before it rises.', es: 'Baja por la cadena del tunel oeste. Gira un anillo de su sala y caera en su propio pozo. Golpea antes de que se eleve.' },
  'play.glim.hint.u.coalfish.1': { en: 'Something swims in what was banked. It is cold until it isn\'t.', es: 'Algo nada en lo que quedo acumulado. Esta frio hasta que deja de estarlo.' },
  'play.glim.hint.u.coalfish.2': { en: 'The Underhearth\'s lava lakes, with a rod that works every lava.', es: 'Los lagos de lava del Bajohogar, con una cana que sirva en toda lava.' },
  'play.glim.hint.m.glowcaps.2': { en: 'The Glowcap Grotto, below the Basalt Caverns. Bring a sickle.', es: 'Glowcap Grotto, bajo Basalt Caverns. Lleva una hoz.' },
  'play.glim.hint.m.words.1': { en: 'Somebody carved words into the Delve walls. They catch the light when you pass close.', es: 'Alguien grabo palabras en los muros de la Sima. Reflejan la luz si pasas cerca.' },
  'play.glim.hint.m.words.2': { en: 'Every layer has some. Walk close to a carved wall and copy it. What it means is yours to work out.', es: 'Cada capa tiene alguna. Acercate a un muro grabado y copialo. Lo que significa te toca a ti.' },
  'play.glim.hint.m.words3.1': { en: 'All of them means the deep ones too. The last few are past the Grotto.', es: 'Todas incluye las profundas. Las ultimas estan pasado el Grotto.' },
  'play.glim.hint.m.fracture.1': { en: 'The fracture is at the bottom of what we\'ve charted. Something guards the way.', es: 'La fractura esta al fondo de lo que hemos cartografiado. Algo guarda el paso.' },
  'play.glim.hint.m.fracture.2': { en: 'The Magma Halls, past the Seam Eater. Go armed, and bring torches.', es: 'Magma Halls, pasado el Seam Eater. Ve armado y lleva antorchas.' },

  // ── The Codex entry (no easter egg yet) ──
  'play.glim.codex.title': { en: 'Glim, the Margin-Light', es: 'Glim, la Luz del Margen' },
  'play.glim.codex.role': { en: 'Your companion. Keeps the maps, voices your goals, hints when asked, and is your light in the Delve.', es: 'Tu companero. Guarda los mapas, te dice tus objetivos, da pistas si las pides y es tu luz en la Sima.' },
  'play.glim.codex.origin': { en: 'Once an Afterimage Moth, it flew into the Orrery and ate a page of the Archivist\'s map, and learned to read from the inside. The Archivist made it the Archive\'s lamp, and lends it to new Keepers.', es: 'Fue una Polilla de Imagen Residual: entro en el Orrery, se comio una pagina del mapa del Archivista y aprendio a leer desde dentro. El Archivista la hizo lampara del Archivo y la presta a los nuevos Guardianes.' },
  'play.glim.codex.rule': { en: '"A hint is a kindness. An answer is a theft." It will not hint at secrets.', es: '"Una pista es una amabilidad. Una respuesta es un robo." No da pistas sobre secretos.' },
  'play.glim.codex.alsoLabel': { en: 'Also called', es: 'Tambien llamado' },
  'play.glim.codex.also': { en: '—', es: '—' },
  'play.glim.codex.met': { en: 'Met', es: 'Conocido' },
  'play.glim.codex.notMet': { en: 'Not yet met. Enter the world.', es: 'Aun no lo conoces. Entra al mundo.' },
};
