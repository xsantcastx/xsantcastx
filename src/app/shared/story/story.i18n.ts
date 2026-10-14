/**
 * story.i18n.ts: the Keeper's story, the Prologue and Act I (shared/story/story.ts).
 * Lazy: registered by the side-scroller (play chunk: the lines, the cards, the
 * chapter tag) and by the Story tab (the journal), checked by
 * scripts/check-i18n-keys.js.
 *
 * Canon and voice: docs/world/world-and-cast.md §2 and §3, texts in
 * docs/world/lore-addendum.md ("World and cast", shipped — owner reviews in
 * play). Spoken lines are short (they ride Glim's one line: three lines at
 * most on a phone). Place and item names stay in English in ES, like the rest
 * of the play HUD.
 *
 * Never a spoiler: a beat's title and text are shown only once it is found;
 * its lead says where to look, never what is there.
 */
export const STORY_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── The Story tab ──
  'story.journal.kicker': { en: "The Keeper's Record", es: 'El registro del Guardian' },
  'story.journal.lead': { en: 'Next lead', es: 'Siguiente pista' },
  'story.journal.found': { en: '{{n}} of {{total}} found', es: '{{n}} de {{total}} encontrados' },
  'story.journal.now': { en: 'Now', es: 'Ahora' },
  'story.journal.coming': { en: 'Still being written', es: 'Aun por escribir' },

  // ── Chapters ──
  'story.chapter.prologue': { en: 'Prologue · The Fresh Mark', es: 'Prologo · La marca fresca' },
  'story.chapter.act1': { en: 'Act I · The Old Seam', es: 'Acto I · La vieja veta' },
  'story.chapter.act2': { en: 'Act II · Five Witnesses', es: 'Acto II · Cinco testigos' },

  // ── Cards: one at each act boundary, three short paragraphs at most ──
  'story.card.continue': { en: 'Continue', es: 'Continuar' },
  'story.card.prologue.p1': {
    en: 'The Seamworks is loud and the rock is warm on one side. Someone left you a plot of land and a lantern. The lantern has opinions.',
    es: 'Basalt Seamworks es ruidoso y la roca esta caliente por un lado. Alguien te dejo una parcela y una linterna. La linterna tiene opiniones.',
  },
  'story.card.act1.kicker': { en: 'The Prologue ends', es: 'Termina el Prologo' },
  'story.card.act1.title': { en: 'Act I · The Old Seam', es: 'Acto I · La vieja veta' },
  'story.card.act1.p1': {
    en: 'Kael, from the Rune Forge, without looking up: "You read it. Most people step over it."',
    es: 'Kael, desde la Rune Forge, sin levantar la vista: "Lo leiste. Casi todos pasan por encima."',
  },
  'story.card.act1.p2': {
    en: 'The crack under the Seamworks goes further down than anyone has charted. Someone went down it before you, and kept count.',
    es: 'La grieta bajo Basalt Seamworks baja mas de lo que nadie ha cartografiado. Alguien bajo antes que tu, y llevo la cuenta.',
  },
  'story.card.act1.p3': {
    en: 'Verrin, Kael, the Merchant and the Archivist each have work for you in the Delve. Glim has a great deal of blank map.',
    es: 'Verrin, Kael, el Mercader y el Archivista tienen trabajo para ti en la Sima. Glim tiene mucho mapa en blanco.',
  },
  'story.card.act2.kicker': { en: 'End of Act I', es: 'Fin del Acto I' },
  'story.card.act2.title': { en: 'A line someone had already drawn', es: 'Una linea que alguien ya habia trazado' },
  'story.card.act2.p1': {
    en: 'Kael lays the fragment on the anvil, warm side toward the town. "It wasn\'t broken. It was drawn first and broken second."',
    es: 'Kael deja el fragmento en el yunque, con el lado tibio hacia el pueblo. "No se rompio. Primero lo trazaron y despues se rompio."',
  },
  'story.card.act2.p2': {
    en: 'The Archivist sets twelve copied inscriptions beside it and taps the last one: a single tally mark, and a fresh one. "That one is dated tomorrow." Kael: "Not yet."',
    es: 'El Archivista pone al lado doce inscripciones copiadas y toca la ultima: una marca de cuenta, y otra fresca. "Esa esta fechada manana." Kael: "Todavia no."',
  },
  'story.card.act2.p3': {
    en: 'Then, to you: "Five witnesses. One from each realm. Bring me five honest accounts of what this crack did to them, and I\'ll tell you who drew the line."',
    es: 'Luego, a ti: "Cinco testigos. Uno de cada reino. Traeme cinco relatos honestos de lo que esta grieta les hizo, y te dire quien trazo la linea."',
  },

  // ── Lines, said once when the beat happens (through Glim's line; a keeper's own voice where it is theirs) ──
  'story.say.p.words.1': { en: 'You read it. Most people step over it.', es: 'Lo leiste. Casi todos pasan por encima.' },
  'story.say.a1.shadow.1': { en: 'There are marks on the wall by the old root. Look at them if you must. Do not count them.', es: 'Hay marcas en el muro junto a la vieja raiz. Miralas si debes. No las cuentes.' },
  'story.say.a1.tally.1': { en: 'Five marks at Keeper height. Four struck through. Somebody has been counting Keepers.', es: 'Cinco marcas a la altura de un Guardian. Cuatro tachadas. Alguien ha estado contando Guardianes.' },
  'story.say.a1.hammer.1': { en: "I'll keep it under the anvil. I don't want to hold it when it's needed. I want to know where it is.", es: 'Lo guardare bajo el yunque. No quiero tenerlo en la mano cuando haga falta. Quiero saber donde esta.' },
  'story.say.a1.prices.1': { en: 'Those prices in the Grotto? My hand. Inventory, friend. Everybody has a past; mine is itemised.', es: 'Esos precios de la Gruta? Mi letra. Inventario, amigo. Todos tienen un pasado; el mio esta detallado.' },
  'story.say.a1.eater.1': { en: "That wasn't all of it. That was the part that fit in the room.", es: 'Eso no era todo. Era la parte que cabia en la sala.' },
  'story.say.a1.fresh.1': { en: 'Hold still. The new mark has a notch where the stroke turned. Your pick leaves that notch.', es: 'Quieto. La marca nueva tiene una muesca donde gira el trazo. Tu pico deja esa muesca.' },
  'story.say.a1.fresh.2': { en: "Every wall you've cut has it. That mark is yours, and I didn't see you make it.", es: 'Todos los muros que has cortado la tienen. Esa marca es tuya, y no te vi hacerla.' },
  'story.say.a1.dated.1': { en: 'That one is dated tomorrow. I have rechecked it four times. It remains dated tomorrow.', es: 'Esa esta fechada manana. La he revisado cuatro veces. Sigue fechada manana.' },
  'story.say.a1.break.1': { en: "Five witnesses. I've started five blank pages. They're my favourite kind.", es: 'Cinco testigos. He empezado cinco paginas en blanco. Son mis favoritas.' },

  // ── The journal: what was found (shown only once found) ──
  'story.beat.p.arrival.title': { en: 'A light on your shoulder', es: 'Una luz en tu hombro' },
  'story.beat.p.arrival.text': { en: 'At the Seamworks Waystone a moth made of lamplight landed on your shoulder. It keeps the maps, mostly the blank parts.', es: 'En el Waystone de Basalt Seamworks una polilla hecha de luz se poso en tu hombro. Guarda los mapas, sobre todo las partes en blanco.' },
  'story.beat.p.homestead.title': { en: 'A plot, and no reason', es: 'Una parcela, y ninguna razon' },
  'story.beat.p.homestead.text': { en: 'Somebody left you a plot off the Seamworks. You put up the first building. Glim says the reason will turn up.', es: 'Alguien te dejo una parcela junto a Basalt Seamworks. Levantaste el primer edificio. Glim dice que la razon aparecera.' },
  'story.beat.p.edge.title': { en: 'The Basalt Edge', es: 'El Basalt Edge' },
  'story.beat.p.edge.text': { en: 'You forged a blade made to show where a boundary is before anyone crosses it, and wore it.', es: 'Forjaste una hoja hecha para mostrar donde esta un limite antes de que alguien lo cruce, y te la pusiste.' },
  'story.beat.p.maw.title': { en: 'Bolts toward the shaft', es: 'Pernos hacia el pozo' },
  'story.beat.p.maw.text': { en: 'You felled a Rivet Maw. The Maws hoard joins, and they drag their bolts toward the Delve shaft. Glim marked it.', es: 'Derribaste una Fauce Remachada. Las Fauces acumulan juntas y arrastran sus pernos hacia el pozo de la Sima. Glim lo anoto.' },
  'story.beat.p.dig.title': { en: 'Down is a fact', es: 'Abajo es un hecho' },
  'story.beat.p.dig.text': { en: 'You dug into the Ember Delve, the way down the Godforge\'s fracture beneath the Seamworks. Glim became your lantern.', es: 'Cavaste en la Ember Delve, el camino hacia abajo por la fractura de la Godforge bajo Basalt Seamworks. Glim se volvio tu linterna.' },
  'story.beat.p.words.title': { en: 'Most people step over it', es: 'Casi todos pasan por encima' },
  'story.beat.p.words.text': { en: 'You read your first carving in the Delve. Kael noticed, without looking up from the Rune Forge.', es: 'Leiste tu primer grabado en la Sima. Kael se dio cuenta, sin levantar la vista de la Rune Forge.' },
  'story.beat.a1.shadow.title': { en: 'Do not count them', es: 'No las cuentes' },
  'story.beat.a1.shadow.text': { en: 'You brought Verrin cuttings of the World-Root\'s shadow. Verrin asked you to look at the marks by the old root, and not to count them.', es: 'Le llevaste a Verrin esquejes de la sombra de la World-Root. Verrin te pidio que miraras las marcas junto a la vieja raiz, y que no las contaras.' },
  'story.beat.a1.tally.title': { en: 'Five marks at Keeper height', es: 'Cinco marcas a la altura de un Guardian' },
  'story.beat.a1.tally.text': { en: 'In the Root Hollows: five tally marks at Keeper height. Four are crossed through. The fifth is worn smooth. You counted them.', es: 'En las Root Hollows: cinco marcas de cuenta a la altura de un Guardian. Cuatro estan tachadas. La quinta esta gastada. Las contaste.' },
  'story.beat.a1.hammer.title': { en: 'Under the anvil', es: 'Bajo el yunque' },
  'story.beat.a1.hammer.text': { en: 'Kael\'s hammer, from the old seam beside the four struck-out names. Kael turned it over twice and put it under the anvil.', es: 'El martillo de Kael, de la vieja veta junto a los cuatro nombres tachados. Kael le dio dos vueltas y lo puso bajo el yunque.' },
  'story.beat.a1.prices.title': { en: 'Mine is itemised', es: 'El mio esta detallado' },
  'story.beat.a1.prices.text': { en: 'The glowcap prices chalked in the Grotto are in the Merchant\'s own hand, years old. The Merchant has been down here before.', es: 'Los precios de glowcaps escritos con tiza en la Gruta son de puno y letra del Mercader, de hace anos. El Mercader ya habia bajado.' },
  'story.beat.a1.eater.title': { en: 'The part that fit in the room', es: 'La parte que cabia en la sala' },
  'story.beat.a1.eater.text': { en: 'The Seam Eater rose from the deepest failed repairs and guarded the fragment chamber. It unthreaded and sank into the slag. It did not die.', es: 'El Seam Eater surgio de las reparaciones fallidas mas hondas y guardaba la camara del fragmento. Se deshilo y se hundio en la escoria. No murio.' },
  'story.beat.a1.fresh.title': { en: 'The fresh mark', es: 'La marca fresca' },
  'story.beat.a1.fresh.text': { en: 'Deep in the Magma Halls: a single tally mark, and a fresh one beside it, with the notch your pick leaves. It is yours. You don\'t remember making it.', es: 'En lo hondo de Magma Halls: una marca de cuenta, y otra fresca al lado, con la muesca que deja tu pico. Es tuya. No recuerdas haberla hecho.' },
  'story.beat.a1.dated.title': { en: 'Dated tomorrow', es: 'Fechada manana' },
  'story.beat.a1.dated.text': { en: 'You copied every carving in the Delve for the Archivist, who found one entry they have never been able to close.', es: 'Copiaste todos los grabados de la Sima para el Archivista, que encontro una entrada que nunca ha podido cerrar.' },
  'story.beat.a1.break.title': { en: 'A line someone had already drawn', es: 'Una linea que alguien ya habia trazado' },
  'story.beat.a1.break.text': { en: 'You brought Kael the Godforge Fragment. The crack was drawn first and broken second. Kael asked for five witnesses.', es: 'Le llevaste a Kael el Godforge Fragment. La grieta se trazo primero y se rompio despues. Kael pidio cinco testigos.' },

  // ── Leads: where to look next, never what is there ──
  'story.lead.p.arrival': { en: 'Step into the world at the Seamworks Waystone.', es: 'Entra en el mundo por el Waystone de Basalt Seamworks.' },
  'story.lead.p.homestead': { en: 'Buy your first building on Your Homestead.', es: 'Compra tu primer edificio en Tu Hacienda.' },
  'story.lead.p.edge': { en: 'Forge the Basalt Edge at the Seamworks Forge, and wear it.', es: 'Forja el Basalt Edge en la Seamworks Forge, y ponetelo.' },
  'story.lead.p.maw': { en: 'Test your blade on a Rivet Maw, east of the Waystone.', es: 'Prueba tu hoja con una Fauce Remachada, al este del Waystone.' },
  'story.lead.p.dig': { en: 'Dig in the Ember Delve, down the shaft in the Seamworks.', es: 'Cava en la Ember Delve, bajando por el pozo de Basalt Seamworks.' },
  'story.lead.p.words': { en: 'Something is carved into the Delve\'s first rows. Stand by it and read it (E).', es: 'Hay algo grabado en las primeras filas de la Sima. Ponte al lado y leelo (E).' },
  'story.lead.a1.shadow': { en: 'Verrin wants cuttings from the Root Hollows. The Quest Board\'s Delve tab has the details.', es: 'Verrin quiere esquejes de las Root Hollows. La pestana Delve del Quest Board tiene los detalles.' },
  'story.lead.a1.tally': { en: 'Somewhere in the Root Hollows, at about Keeper height, there is a carving Glim wants a closer look at.', es: 'En algun lugar de las Root Hollows, mas o menos a la altura de un Guardian, hay un grabado que Glim quiere ver de cerca.' },
  'story.lead.a1.hammer': { en: 'Kael\'s old seam runs through the Basalt Caverns. Kael left something there.', es: 'La vieja veta de Kael cruza las Basalt Caverns. Kael dejo algo alli.' },
  'story.lead.a1.prices': { en: 'The Merchant buys glowcaps from the Grotto. Fill one order.', es: 'El Mercader compra glowcaps de la Gruta. Completa un pedido.' },
  'story.lead.a1.eater': { en: 'Something guards the fragment chamber in the Magma Halls. Go armed, and bring torches.', es: 'Algo guarda la camara del fragmento en Magma Halls. Ve armado y lleva antorchas.' },
  'story.lead.a1.fresh': { en: 'Read what is carved deepest in the Magma Halls. Glim says the deepest carving is the newest.', es: 'Lee lo que esta grabado mas hondo en Magma Halls. Glim dice que el grabado mas hondo es el mas nuevo.' },
  'story.lead.a1.dated': { en: 'The Archivist wants every carving in the Delve copied.', es: 'El Archivista quiere copiados todos los grabados de la Sima.' },
  'story.lead.a1.break': { en: 'Bring Kael the Godforge Fragment from the Magma Halls.', es: 'Llevale a Kael el Godforge Fragment de Magma Halls.' },
  'story.lead.chapter.prologue': { en: 'Read a carving in the Delve.', es: 'Lee un grabado en la Sima.' },
  'story.lead.chapter.act1': { en: 'Bring Kael the Godforge Fragment from the Magma Halls.', es: 'Llevale a Kael el Godforge Fragment de Magma Halls.' },
  'story.lead.chapter.act2': { en: 'Five witnesses, one from each realm. Kael is waiting for their accounts. Act II opens in a later update.', es: 'Cinco testigos, uno de cada reino. Kael espera sus relatos. El Acto II llega en una actualizacion futura.' },
};
