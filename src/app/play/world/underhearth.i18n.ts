/**
 * underhearth.i18n.ts: the Underhearth's player-facing lines (Phase 8,
 * docs/world/delve-and-beyond.md §2.2, §6.2-6.3, §7.4; lore-addendum.md "The
 * Four Who Went Down"). Lazy: registered by the side-scroller (play chunk),
 * checked by scripts/check-i18n-keys.js.
 *
 * Engine lines carry their key on EngineState.messageKey; the English here
 * matches the engine's own English, which stays the fallback. Spanish keeps
 * the Delve table's plain ASCII style.
 */
export const UNDERHEARTH_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Engine: the stratum ──
  'play.uh.reached': { en: 'Under the Halls. The heat here is heavy, not hot: fire pressed so long it became something else.', es: 'Bajo las Salas. El calor aqui pesa, no quema: fuego apretado tanto tiempo que se volvio otra cosa.' },
  'play.uh.mark.rubbing': { en: 'A hammer-mark, cut where one of the Four stood. You take a rubbing of it.', es: 'Una marca de martillo, tallada donde estuvo uno de los Cuatro. Haces un calco.' },
  'play.uh.sentinel.caveIn': { en: 'The Sentinel shoulders the ceiling and loose rock comes down. A support nearby holds it.', es: 'El Centinela empuja el techo con los hombros y cae roca suelta. Un puntal cerca la sostiene.' },

  // ── Engine: Bark Rope ──
  'play.uh.rope.noTie': { en: 'Nothing to tie the rope to here. Tie it at a ledge or under rock.', es: 'Aqui no hay donde atar la cuerda. Atala en un borde o bajo la roca.' },
  'play.uh.rope.spooled': { en: 'The rope unrolls {{n}} cells down. Climb it like a ladder.', es: 'La cuerda se desenrolla {{n}} casillas hacia abajo. Subela como una escalera.' },
  'play.uh.rope.taken': { en: 'The rope rolls back up: {{n}} coils in the satchel.', es: 'La cuerda se recoge: {{n}} rollos en la mochila.' },

  // ── Engine: the Thornroot Grapple ──
  'play.uh.grapple.none': { en: 'You need a Thornroot Grapple (Crafting Bench, Smithing 20).', es: 'Necesitas un Garfio de Espinarraiz (Banco de Fabricacion, Herreria 20).' },
  'play.uh.grapple.miss': { en: 'Nothing in reach for the grapple to bite there.', es: 'No hay nada a tu alcance donde muerda el garfio.' },
  'play.uh.grapple.thrown': { en: 'The thornroot grows to the rock and pulls. Jump to let go.', es: 'La espinarraiz crece hasta la roca y tira. Salta para soltarte.' },
  'play.uh.grapple.lost': { en: 'The rock it bit is gone. The line drops.', es: 'La roca que mordia ya no esta. La linea cae.' },

  // ── Engine: Kael's rails and the Seam Cart ──
  'play.uh.cart.none': { en: 'You need a Seam Cart to ride the rails. Kael has the pattern.', es: 'Necesitas una Vagoneta de Veta para recorrer los rieles. Kael tiene el patron.' },
  'play.uh.cart.blocked': { en: 'No room to stand in the cart there.', es: 'No hay sitio para ir en la vagoneta ahi.' },
  'play.uh.cart.board': { en: 'In the cart. Left and Right push it, Down brakes, Jump leaps out, E steps off.', es: 'En la vagoneta. Izquierda y Derecha la empujan, Abajo frena, Saltar te lanza fuera, E te bajas.' },
  'play.uh.cart.launched': { en: 'Off the end of the line! The cart stays; you do not.', es: 'Fin de la via! La vagoneta se queda; tu no.' },
  'play.uh.cart.off': { en: 'You step off the cart.', es: 'Te bajas de la vagoneta.' },

  // ── Engine: Rift Anchors ──
  'play.uh.anchor.max': { en: 'Eight anchors already hold in your Delve. Take one back first (X beside it).', es: 'Ya hay ocho anclas en tu Sima. Recoge una primero (X a su lado).' },
  'play.uh.anchor.blocked': { en: 'Something fills the space round that anchor. Dig it clear from this side first.', es: 'Algo ocupa el espacio de esa ancla. Despejalo primero desde este lado.' },
  'play.uh.anchor.arrive': { en: 'The anchor holds, and both ends agree. You step through.', es: 'El ancla aguanta y los dos extremos estan de acuerdo. Cruzas.' },

  // ── Engine: the Banked Furnace ──
  'play.uh.furnace.wakes': { en: 'The Banked Furnace wakes, and the hall breathes with it. Douse its four vents with water from the trough, then strike its core.', es: 'El Horno Cubierto despierta y la sala respira con el. Apaga sus cuatro respiraderos con agua del abrevadero y golpea su nucleo.' },
  'play.uh.furnace.doused': { en: 'Steam! One vent out. {{n}} still burn.', es: 'Vapor! Un respiradero apagado. Quedan {{n}} ardiendo.' },
  'play.uh.furnace.breath': { en: 'The vents flare: it is about to breathe in. Walk away from the mouth.', es: 'Los respiraderos llamean: va a inspirar. Alejate de la boca.' },
  'play.uh.furnace.open': { en: 'All four vents out: its core shows. Strike it now!', es: 'Los cuatro respiraderos apagados: se ve su nucleo. Golpealo ya!' },
  'play.uh.furnace.rebanked': { en: 'It banks itself again: the vents relight and the trough refills. Douse them again.', es: 'Se cubre otra vez: los respiraderos se encienden y el abrevadero se llena. Apagalos de nuevo.' },
  'play.uh.furnace.remembers': { en: 'It remembers what it was banked for. It breathes harder now.', es: 'Recuerda para que lo cubrieron. Ahora respira con mas fuerza.' },
  'play.uh.furnace.out': { en: 'The Banked Furnace goes dark. The fire the Four banked is out.', es: 'El Horno Cubierto se apaga. El fuego que cubrieron los Cuatro se extinguio.' },

  // ── Host: the furnace's hearth, the marks, the shrines ──
  'play.uh.furnace.needMarks': { en: 'The hearth is cold to your hand. It answers to the Four\'s hammer-marks: Kael has the rubbings once you find all four.', es: 'El hogar esta frio al tacto. Responde a las marcas de martillo de los Cuatro: Kael guarda los calcos cuando encuentres las cuatro.' },
  'play.uh.furnace.restDay': { en: 'The furnace has banked itself again. It will not wake twice in one day.', es: 'El horno se ha vuelto a cubrir. No despertara dos veces el mismo dia.' },
  'play.uh.furnace.already': { en: 'The furnace is already awake.', es: 'El horno ya esta despierto.' },
  'play.uh.mark.filed': { en: 'Rubbing taken: {{n}} of the Four\'s four marks. Kael will want to see it.', es: 'Calco hecho: {{n}} de las cuatro marcas de los Cuatro. Kael querra verlo.' },
  'play.uh.mark.again': { en: 'You already have a rubbing of this one ({{n}} of 4).', es: 'Ya tienes un calco de esta ({{n}} de 4).' },
  'play.uh.shrine.shard': { en: '+1 Waystone Shard', es: '+1 Fragmento de Waystone' },

  // ── Host: the Rift Anchor travel sheet ──
  'play.uh.travel.title': { en: 'Rift Anchors', es: 'Anclas de grieta' },
  'play.uh.travel.lead': { en: 'A passage that holds only because both ends agree to. Choose where to step through.', es: 'Un paso que solo aguanta porque ambos extremos estan de acuerdo. Elige por donde cruzar.' },
  'play.uh.travel.row': { en: 'Anchor {{n}} · {{place}} · depth {{depth}}', es: 'Ancla {{n}} · {{place}} · profundidad {{depth}}' },
  'play.uh.travel.home': { en: 'The Seamworks Waystone (climb home)', es: 'El Waystone de las Costuras (subir a casa)' },
  'play.uh.travel.none': { en: 'No anchors yet. Craft one (a Waystone Shard from a rift shrine) and set it down.', es: 'Aun no hay anclas. Fabrica una (un Fragmento de Waystone de un santuario) y colocala.' },
  'play.uh.travel.descend': { en: 'Descend to an anchor', es: 'Bajar a un ancla' },
  'play.uh.travel.failed': { en: 'That anchor does not answer. Something fills the space round it.', es: 'Esa ancla no responde. Algo ocupa su espacio.' },

  // ── HUD: what E does here ──
  'play.uh.action.mark': { en: 'Take a rubbing', es: 'Hacer un calco' },
  'play.uh.action.anchor': { en: 'Travel by the anchor', es: 'Viajar por el ancla' },
  'play.uh.action.furnace': { en: 'Wake the Banked Furnace', es: 'Despertar el Horno Cubierto' },
  'play.uh.action.rail': { en: 'Ride the rail', es: 'Montar en el riel' },

  // ── The map's legend ──
  'play.map.legend.anchor': { en: 'Rift Anchor', es: 'Ancla de grieta' },
  'play.map.legend.mark': { en: 'Hammer-mark', es: 'Marca de martillo' },
  'play.map.legend.furnace': { en: 'The Banked Furnace', es: 'El Horno Cubierto' },

  // ── The hotbar's names for the Underhearth's kit ──
  'play.place.seam-rail': { en: 'Seam Rail', es: 'Riel de veta' },
  'play.place.bark-rope': { en: 'Bark Rope', es: 'Cuerda de corteza' },
  'play.place.rift-anchor': { en: 'Rift Anchor', es: 'Ancla de grieta' },
  'play.place.thornroot-grapple': { en: 'Thornroot Grapple', es: 'Garfio de espinarraiz' },
};
