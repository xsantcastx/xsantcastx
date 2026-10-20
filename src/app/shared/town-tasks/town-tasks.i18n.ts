/**
 * town-tasks.i18n.ts — the town keepers' own words: who each giver is, and each task's title, ask and thanks
 * (shared/town-tasks/town-tasks.model.ts). Lazy: registered by the side-scroller (play chunk) with the HUD's table.
 * Lore shipped 2026-10-20 (owner reviews in play): docs/world/lore-addendum.md "Town tasks".
 */
import { DAILY_TASKS } from './town-tasks.model';

const ONCE: Record<string, { en: string; es: string }> = {
  // ── Who they are ──
  'task.giver.bench-smith.who': { en: 'The Seamworks bench smith. Her anvil is older than the square.', es: 'La herrera del banco de la Seamworks. Su yunque es mas viejo que la plaza.' },
  'task.giver.buyback-clerk.who': { en: 'He buys back what the island gives up, and writes down who sold it.', es: 'Compra lo que la isla suelta, y apunta quien lo vendio.' },
  'task.giver.sexton-wren.who': { en: 'Keeper of the Hushed Barrow. He sweeps the graves and counts them twice.', es: 'Guarda del Tumulo Callado. Barre las tumbas y las cuenta dos veces.' },
  'task.giver.captain-vey.who': { en: 'Captain of the Pyre Watch. The walls are his, and so is every scar on them.', es: 'Capitan de la Guardia de la Pira. Las murallas son suyas, y cada cicatriz en ellas.' },
  'task.giver.forgewife-marr.who': { en: 'Keeps Pyrehold\'s great forges lit. She has never once let them go cold.', es: 'Mantiene encendidas las grandes forjas de Pyrehold. Nunca las ha dejado enfriar.' },
  'task.giver.scholar-pryor.who': { en: 'A scholar of the Spire who maps what the Deep breathes out.', es: 'Una erudita de la Aguja que cartografia lo que exhala la Profundidad.' },
  'task.giver.harbourmaster-coyle.who': { en: 'Harbourmaster of Cinderport. Nothing docks without her nod.', es: 'Capitana del puerto de Cinderport. Nada atraca sin su permiso.' },
  'task.giver.netter-pell.who': { en: 'Mends nets on the pier and swears the sea is warmer than it used to be.', es: 'Remienda redes en el muelle y jura que el mar esta mas caliente que antes.' },
  'task.giver.woodward-ashby.who': { en: 'A woodward of the Charwood. He walks the burnt trees and names the ones still living.', es: 'Guardabosques del Bosque Carbonizado. Recorre los arboles quemados y nombra a los que siguen vivos.' },
  'task.giver.charburner-kiln.who': { en: 'Ashgrove\'s charburner. Her kilns smoke day and night, and she likes it that way.', es: 'La carbonera de Ashgrove. Sus hornos humean dia y noche, y asi le gusta.' },

  // ── The Seamworks ──
  'task.seam-mara-1.title': { en: 'Ore for the Bench', es: 'Mineral para el banco' },
  'task.seam-mara-1.ask': { en: 'The bench is hungry and so am I. Bring me Cinder Ore from the seams, and I\'ll pay you in coin and residue.', es: 'El banco tiene hambre, y yo tambien. Traeme Cinder Ore de las vetas y te pago en monedas y residuo.' },
  'task.seam-mara-1.thanks': { en: 'Good ore. It still hums. Most of it does, out here.', es: 'Buen mineral. Todavia zumba. Casi todo zumba, aqui.' },
  'task.seam-mara-2.title': { en: 'Bark for the Quench', es: 'Corteza para el temple' },
  'task.seam-mara-2.ask': { en: 'World-root bark in the quench water keeps a blade from cracking. Cut me some in the woods past the square.', es: 'La corteza de raiz del mundo en el agua del temple evita que la hoja se agriete. Cortame un poco en el bosque.' },
  'task.seam-mara-2.thanks': { en: 'Smell that? Sap and smoke. The trees out there remember a greener sky.', es: 'Lo hueles? Savia y humo. Esos arboles recuerdan un cielo mas verde.' },
  'task.seam-edrin-1.title': { en: 'Rivets in the Road', es: 'Remaches en el camino' },
  'task.seam-edrin-1.ask': { en: 'Rivet Maws chew the cart road to gravel. Put six of them down and the carts can roll again.', es: 'Las Fauces Remachadas mastican el camino. Derriba seis y los carros volveran a rodar.' },
  'task.seam-edrin-1.thanks': { en: 'Six. I wrote it down. Here, the ore they were chewing on.', es: 'Seis. Lo apunte. Toma, el mineral que masticaban.' },
  'task.seam-edrin-2.title': { en: 'A Sealed Letter', es: 'Una carta sellada' },
  'task.seam-edrin-2.ask': { en: 'Take this letter up to the Ember Inn\'s rooms. My cousin rents the one at the end. Don\'t read it. It\'s only numbers.', es: 'Lleva esta carta a las habitaciones de la Ember Inn. Mi prima alquila la del fondo. No la leas. Solo son numeros.' },
  'task.seam-edrin-2.thanks': { en: 'She got it? Then the tally is square. Thank you, Keeper.', es: 'La recibio? Entonces la cuenta cuadra. Gracias, Guardian.' },
  'task.seam-wren-1.title': { en: 'Wolves at the Treeline', es: 'Lobos en la linde' },
  'task.seam-wren-1.ask': { en: 'Ash Wolves dig at the barrow\'s edge at night. Drive five of them off for good.', es: 'Los Lobos de Ceniza escarban en el tumulo de noche. Ahuyenta a cinco para siempre.' },
  'task.seam-wren-1.thanks': { en: 'Quieter already. The dead appreciate a little peace.', es: 'Ya hay mas calma. Los muertos agradecen un poco de paz.' },
  'task.seam-wren-2.title': { en: 'Quiet the Barrow', es: 'Calmar el tumulo' },
  'task.seam-wren-2.ask': { en: 'Some of my graves don\'t stay closed. Lay five Bone Walkers back to rest, and I\'ll give you the cowl I found among them.', es: 'Algunas tumbas no se quedan cerradas. Devuelve al descanso a cinco Caminantes de Hueso y te dare la capucha que encontre entre ellos.' },
  'task.seam-wren-2.thanks': { en: 'Five fewer footsteps at night. Take the cowl. Whoever wore it won\'t ask for it back.', es: 'Cinco pasos menos por la noche. Toma la capucha. Quien la llevaba no la reclamara.' },

  // ── Pyrehold ──
  'task.pyre-vey-1.title': { en: 'Clan Raiders', es: 'Saqueadores del clan' },
  'task.pyre-vey-1.ask': { en: 'The Cinder clans raid the Charwood road. Break eight of their orcs and they\'ll think twice.', es: 'Los clanes de Ceniza asaltan el camino del Bosque. Derrota a ocho de sus orcos y se lo pensaran dos veces.' },
  'task.pyre-vey-1.thanks': { en: 'The road\'s yours again. The Watch owes you a drink.', es: 'El camino vuelve a ser tuyo. La Guardia te debe un trago.' },
  'task.pyre-vey-2.title': { en: 'The Firecallers', es: 'Los llamafuegos' },
  'task.pyre-vey-2.ask': { en: 'Their firecallers sing the lava up out of the ground. Silence five of them.', es: 'Sus llamafuegos hacen subir la lava con sus cantos. Silencia a cinco.' },
  'task.pyre-vey-2.thanks': { en: 'No more singing in the badlands tonight. Good.', es: 'Esta noche no se canta en las tierras baldias. Bien.' },
  'task.pyre-marr-1.title': { en: 'Feed the Great Forges', es: 'Alimentar las grandes forjas' },
  'task.pyre-marr-1.ask': { en: 'Ember residue keeps the great forges burning hot and even. Bring me six and I\'ll trade you ore by the armful.', es: 'El residuo de brasa mantiene las forjas calientes y parejas. Traeme seis y te cambio mineral a brazadas.' },
  'task.pyre-marr-1.thanks': { en: 'Hear that roar? That\'s the city breathing.', es: 'Oyes ese rugido? Es la ciudad respirando.' },
  'task.pyre-marr-2.title': { en: 'Down to the Glass Halls', es: 'Bajar a los Salones de Cristal' },
  'task.pyre-marr-2.ask': { en: 'Something in the Molten Deep is drinking my heat. Go down to the Glass Halls and tell me what you see.', es: 'Algo en la Profundidad Fundida se bebe mi calor. Baja a los Salones de Cristal y dime que ves.' },
  'task.pyre-marr-2.thanks': { en: 'Glass, grown like frost? Then it\'s worse than I thought. Thank you for looking.', es: 'Cristal que crece como escarcha? Entonces es peor de lo que pensaba. Gracias por mirar.' },
  'task.pyre-pryor-1.title': { en: 'The View from the Lookout', es: 'La vista desde el mirador' },
  'task.pyre-pryor-1.ask': { en: 'Climb the Pyre Spire to its lookout and watch the caldera smoke for me. I need fresh eyes on it.', es: 'Sube al mirador de la Aguja de la Pira y vigila el humo de la caldera. Necesito ojos frescos.' },
  'task.pyre-pryor-1.thanks': { en: 'Leaning east, you say? Like it\'s listening. I\'ll write that down.', es: 'Se inclina al este, dices? Como si escuchara. Lo apuntare.' },
  'task.pyre-pryor-2.title': { en: 'The Tyrant\'s Caldera', es: 'La caldera del Tirano' },
  'task.pyre-pryor-2.ask': { en: 'The Magma Tyrant holds the third floor of the Deep. End it, and the Spire will arm you in iron that remembers the fire.', es: 'El Tirano de Magma domina el tercer piso de la Profundidad. Acaba con el y la Aguja te vestira con hierro que recuerda el fuego.' },
  'task.pyre-pryor-2.thanks': { en: 'The caldera is quiet. For the first time in my life, it\'s quiet. Take the cuirass.', es: 'La caldera esta en silencio. Por primera vez en mi vida. Toma la coraza.' },

  // ── Cinderport ──
  'task.port-coyle-1.title': { en: 'Scratching in the Cellar', es: 'Arañazos en la bodega' },
  'task.port-coyle-1.ask': { en: 'Something scratches under the Salted Ember\'s floor. Go down to the cellar and see what it is.', es: 'Algo araña bajo el suelo de la Salted Ember. Baja a la bodega y mira que es.' },
  'task.port-coyle-1.thanks': { en: 'Old bones and older barrels. Well. The scratching stopped when you went down.', es: 'Huesos viejos y barriles mas viejos. Vaya. Los arañazos pararon cuando bajaste.' },
  'task.port-coyle-2.title': { en: 'Drakes over the Fields', es: 'Dragones sobre los campos' },
  'task.port-coyle-2.ask': { en: 'Ember Drakes are hunting the Molten Fields and my ships won\'t sail under them. Bring down four, and I\'ll give you a staff from a captain who no longer needs it.', es: 'Los Dragones de Brasa cazan en los Campos Fundidos y mis barcos no zarpan bajo ellos. Derriba cuatro y te dare el baston de un capitan que ya no lo necesita.' },
  'task.port-coyle-2.thanks': { en: 'Clear skies. The ketch sails at dawn. The staff is yours.', es: 'Cielos despejados. El queche zarpa al alba. El baston es tuyo.' },
  'task.port-pell-1.title': { en: 'Tar for the Hulls', es: 'Brea para los cascos' },
  'task.port-pell-1.ask': { en: 'World-root bark boils down into a fine tar. Six pieces, and my boats stop leaking.', es: 'La corteza de raiz del mundo hierve y da una buena brea. Seis trozos, y mis barcas dejan de hacer agua.' },
  'task.port-pell-1.thanks': { en: 'Ha! Smell that boil. The sea will have to try harder now.', es: 'Ja! Huele ese hervor. El mar tendra que esforzarse mas.' },
  'task.port-pell-2.title': { en: 'Hounds on the Steppe', es: 'Sabuesos en la estepa' },
  'task.port-pell-2.ask': { en: 'Lava Hounds follow the fish carts up from the pier. Six of them, Keeper, and the carts get through.', es: 'Los Sabuesos de Lava siguen a los carros de pescado. Seis de ellos, Guardian, y los carros pasaran.' },
  'task.port-pell-2.thanks': { en: 'The carts made it with every fish still on them. You\'ve a fan on the pier.', es: 'Los carros llegaron con todos los peces. Tienes un admirador en el muelle.' },

  // ── Ashgrove ──
  'task.ash-hesk-1.title': { en: 'The Crypt Door', es: 'La puerta de la cripta' },
  'task.ash-hesk-1.ask': { en: 'The door under the Ashen Bastion stood open this morning. Go into the Ossuary and come back and tell me it\'s only a draught.', es: 'La puerta bajo el Bastion Ceniciento amanecio abierta. Entra en el Osario y vuelve a decirme que solo es una corriente.' },
  'task.ash-hesk-1.thanks': { en: 'Not a draught, then. I\'ll keep the lamps lit tonight. Take some bark for yours.', es: 'No era una corriente, entonces. Esta noche dejare las lamparas encendidas. Toma corteza para las tuyas.' },
  'task.ash-hesk-2.title': { en: 'Ghouls in the Ossuary', es: 'Necrofagos en el Osario' },
  'task.ash-hesk-2.ask': { en: 'Ash Ghouls are coming up out of the crypt to the treeline. Put six of them down.', es: 'Los Necrofagos de Ceniza suben de la cripta hasta la linde. Derriba a seis.' },
  'task.ash-hesk-2.thanks': { en: 'The trees are still standing. So are we. Thank you.', es: 'Los arboles siguen en pie. Nosotros tambien. Gracias.' },
  'task.ash-maud-1.title': { en: 'Cord for the Kilns', es: 'Leña para los hornos' },
  'task.ash-maud-1.ask': { en: 'My kilns want world-root bark: it burns slow and bright. Eight pieces, and I\'ll pay in residue.', es: 'Mis hornos quieren corteza de raiz del mundo: arde lento y brillante. Ocho trozos y te pago en residuo.' },
  'task.ash-maud-1.thanks': { en: 'That\'ll keep them breathing till the next moon.', es: 'Con eso respiraran hasta la proxima luna.' },
  'task.ash-maud-2.title': { en: 'Arrows in the Dark', es: 'Flechas en la oscuridad' },
  'task.ash-maud-2.ask': { en: 'Bone Archers shoot at my kiln-lights from the crypt. Break six and I\'ll give you the gauntlets my mother wore at the fires.', es: 'Los Arqueros de Hueso disparan a las luces de mis hornos desde la cripta. Rompe seis y te dare los guanteletes que llevaba mi madre en las hogueras.' },
  'task.ash-maud-2.thanks': { en: 'No arrows tonight. Wear them well; they\'ve held hotter things than you.', es: 'Esta noche no hay flechas. Llevalos bien; han sostenido cosas mas calientes que tu.' },

  // ── Places a visit names ──
  'task.place.ember-inn-2': { en: 'the Ember Inn\'s upstairs', es: 'el piso de arriba de la Ember Inn' },
  'task.place.molten-deep-2': { en: 'the Glass Halls (the Molten Deep, floor 2)', es: 'los Salones de Cristal (Profundidad Fundida, piso 2)' },
  'task.place.pyre-spire-3': { en: 'the Pyre Spire\'s lookout', es: 'el mirador de la Aguja de la Pira' },
  'task.place.salted-ember-0': { en: 'the Salted Ember\'s cellar', es: 'la bodega de la Salted Ember' },
  'task.place.ashen-crypt-1': { en: 'the Ossuary (the Ashen Crypt, floor 1)', es: 'el Osario (Cripta Cenicienta, piso 1)' },
};

// ── Dailies (DAILY_TASKS): a title each; one ask and one thanks per giver, shared by their pool ──
const DAILY: Record<string, { en: string; es: string }> = {
  'task.giver.bench-smith.dailyAsk': { en: "The bench never rests, and neither do I. Today's errand is small, but the anvil will thank you.", es: 'El banco nunca descansa, ni yo. El encargo de hoy es pequeno, pero el yunque te lo agradecera.' },
  'task.giver.bench-smith.dailyThanks': { en: 'Small work, honest work. See you tomorrow, Keeper.', es: 'Trabajo pequeno, trabajo honrado. Hasta manana, Guardian.' },
  'task.giver.buyback-clerk.dailyAsk': { en: "Another day, another tally. Do me this one small favour and I'll write you down as reliable.", es: 'Otro dia, otra cuenta. Hazme este pequeno favor y te apunto como de fiar.' },
  'task.giver.buyback-clerk.dailyThanks': { en: 'Written down. Reliable, as I said.', es: 'Apuntado. De fiar, como dije.' },
  'task.giver.sexton-wren.dailyAsk': { en: 'The barrow wakes a little every night. A small errand keeps it sleepy.', es: 'El tumulo se despierta un poco cada noche. Un encargo pequeno lo mantiene dormido.' },
  'task.giver.sexton-wren.dailyThanks': { en: 'Quiet again, for today. The dead are patient; so am I.', es: 'En calma otra vez, por hoy. Los muertos son pacientes; yo tambien.' },
  'task.giver.captain-vey.dailyAsk': { en: 'The Watch never closes its eyes. Lend us yours for one small job today.', es: 'La Guardia nunca cierra los ojos. Presta los tuyos para un trabajo pequeno hoy.' },
  'task.giver.captain-vey.dailyThanks': { en: 'Good. The wall holds another day.', es: 'Bien. La muralla aguanta un dia mas.' },
  'task.giver.forgewife-marr.dailyAsk': { en: "A forge eats a little every day. Bring me today's portion and it stays lit.", es: 'Una forja come un poco cada dia. Traeme la racion de hoy y sigue encendida.' },
  'task.giver.forgewife-marr.dailyThanks': { en: "Hear it roar? That's today's share. Come tomorrow.", es: 'La oyes rugir? Es la racion de hoy. Ven manana.' },
  'task.giver.scholar-pryor.dailyAsk': { en: 'My maps need fresh notes every day. One small errand, if you would.', es: 'Mis mapas necesitan notas nuevas cada dia. Un encargo pequeno, si puedes.' },
  'task.giver.scholar-pryor.dailyThanks': { en: 'Noted, and mapped. The Deep is a little better understood tonight.', es: 'Anotado y cartografiado. La Profundidad se entiende un poco mejor esta noche.' },
  'task.giver.harbourmaster-coyle.dailyAsk': { en: 'The tide brings a new chore every morning. This one is yours, if you want it.', es: 'La marea trae una faena nueva cada manana. Esta es tuya, si la quieres.' },
  'task.giver.harbourmaster-coyle.dailyThanks': { en: 'Done before the tide turns. The harbour owes you.', es: 'Hecho antes de que cambie la marea. El puerto te debe una.' },
  'task.giver.netter-pell.dailyAsk': { en: 'The nets tear a little every day, and a good Keeper helps mend them.', es: 'Las redes se rompen un poco cada dia, y un buen Guardian ayuda a remendarlas.' },
  'task.giver.netter-pell.dailyThanks': { en: 'Mended. The sea can try again tomorrow.', es: 'Remendado. El mar puede volver a intentarlo manana.' },
  'task.giver.woodward-ashby.dailyAsk': { en: "The Charwood needs tending every single day. One small task, and I'll sleep easier.", es: 'El Bosque Carbonizado pide cuidado cada dia. Un encargo pequeno y dormire mejor.' },
  'task.giver.woodward-ashby.dailyThanks': { en: 'The trees stand another day. Thank you.', es: 'Los arboles siguen en pie otro dia. Gracias.' },
  'task.giver.charburner-kiln.dailyAsk': { en: "Kilns are greedy things. Feed mine a little today and they'll behave.", es: 'Los hornos son glotones. Alimenta un poco los mios hoy y se portaran bien.' },
  'task.giver.charburner-kiln.dailyThanks': { en: 'Warm kilns, warm hearts. Come back tomorrow.', es: 'Hornos calientes, corazones calientes. Vuelve manana.' },
  'task.dly-bench-smith-1.title': { en: "Ore for Today's Bench", es: 'Mineral para el banco de hoy' },
  'task.dly-bench-smith-2.title': { en: 'A Little Bark', es: 'Un poco de corteza' },
  'task.dly-bench-smith-3.title': { en: 'Rivets in the Gravel', es: 'Remaches en la grava' },
  'task.dly-buyback-clerk-1.title': { en: 'A Tally of Rivet Maws', es: 'Cuenta de Fauces Remachadas' },
  'task.dly-buyback-clerk-2.title': { en: 'Wolves on the Road', es: 'Lobos en el camino' },
  'task.dly-buyback-clerk-3.title': { en: 'Ore for the Ledger', es: 'Mineral para el libro' },
  'task.dly-sexton-wren-1.title': { en: 'A Restless Grave', es: 'Una tumba inquieta' },
  'task.dly-sexton-wren-2.title': { en: 'Wolves at the Wall', es: 'Lobos en el muro' },
  'task.dly-sexton-wren-3.title': { en: 'Bark for the Lamps', es: 'Corteza para las lamparas' },
  'task.dly-captain-vey-1.title': { en: 'Raiders on the Road', es: 'Saqueadores en el camino' },
  'task.dly-captain-vey-2.title': { en: 'Quiet the Firecallers', es: 'Callar a los llamafuegos' },
  'task.dly-captain-vey-3.title': { en: 'Hounds at the Gate', es: 'Sabuesos en la puerta' },
  'task.dly-forgewife-marr-1.title': { en: 'Residue for the Forge', es: 'Residuo para la forja' },
  'task.dly-forgewife-marr-2.title': { en: 'A Heap of Ore', es: 'Un monton de mineral' },
  'task.dly-forgewife-marr-3.title': { en: 'Orcs at the Slag Heap', es: 'Orcos en la escoria' },
  'task.dly-scholar-pryor-1.title': { en: 'Firecallers Observed', es: 'Llamafuegos observados' },
  'task.dly-scholar-pryor-2.title': { en: 'Hounds of the Steppe', es: 'Sabuesos de la estepa' },
  'task.dly-scholar-pryor-3.title': { en: 'Residue for the Ink', es: 'Residuo para la tinta' },
  'task.dly-harbourmaster-coyle-1.title': { en: 'Drakes over the Fields', es: 'Dragones sobre los campos' },
  'task.dly-harbourmaster-coyle-2.title': { en: 'Hounds on the Quay', es: 'Sabuesos en el muelle' },
  'task.dly-harbourmaster-coyle-3.title': { en: 'Bark for the Hulls', es: 'Corteza para los cascos' },
  'task.dly-netter-pell-1.title': { en: 'Bark for the Tar', es: 'Corteza para la brea' },
  'task.dly-netter-pell-2.title': { en: 'Hounds and Fish Carts', es: 'Sabuesos y carros de pescado' },
  'task.dly-netter-pell-3.title': { en: 'Drakes Over the Pier', es: 'Dragones sobre el muelle' },
  'task.dly-woodward-ashby-1.title': { en: 'Ghouls at the Treeline', es: 'Necrofagos en la linde' },
  'task.dly-woodward-ashby-2.title': { en: 'Archers in the Dark', es: 'Arqueros en la oscuridad' },
  'task.dly-woodward-ashby-3.title': { en: 'Bark for the Lanterns', es: 'Corteza para los faroles' },
  'task.dly-charburner-kiln-1.title': { en: "Cord for Today's Kilns", es: 'Lena para los hornos de hoy' },
  'task.dly-charburner-kiln-2.title': { en: 'Arrows at the Kiln-Lights', es: 'Flechas en las luces de los hornos' },
  'task.dly-charburner-kiln-3.title': { en: 'Ghouls by the Ash Heap', es: 'Necrofagos junto a la ceniza' },
};

/** Every daily's ask and thanks are its giver's own, so the HUD's `task.<id>.ask|thanks` stems resolve for each. */
for (const t of DAILY_TASKS) {
  DAILY[`task.${t.id}.ask`] = DAILY[`task.giver.${t.giver}.dailyAsk`];
  DAILY[`task.${t.id}.thanks`] = DAILY[`task.giver.${t.giver}.dailyThanks`];
}

export const TOWN_TASKS_I18N: Readonly<Record<string, { en: string; es: string }>> = { ...ONCE, ...DAILY };
