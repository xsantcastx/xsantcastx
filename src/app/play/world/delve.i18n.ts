/**
 * delve.i18n.ts: the Delve's player-facing lines (placing and taking back,
 * supports, blasting charges, loose rock, the camp, chests and the gear they
 * hold). Lazy: registered by the side-scroller (play chunk), checked by
 * scripts/check-i18n-keys.js. The hotbar's own labels and placeable names
 * (`play.hotbar.*`, `play.place.*`) live in the eager table.
 *
 * Engine lines carry their key on EngineState.messageKey; the English here
 * matches the engine's own English, which stays the fallback. `{{name}}` /
 * `{{lname}}` are a placeable's translated name (lname lower-cased).
 */
export const DELVE_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Engine: placing and taking back ──
  'play.delve.chooseFirst': { en: 'Choose something to place first (keys 1-0, or tap the bar).', es: 'Elige primero algo para colocar (teclas 1-0, o toca la barra).' },
  'play.delve.noSpaceBelow': { en: 'No open space under your feet for the {{lname}}.', es: 'No hay hueco libre bajo tus pies para: {{lname}}.' },
  'play.delve.noSpaceAhead': { en: 'No open space in front of you for the {{lname}}.', es: 'No hay hueco libre delante de ti para: {{lname}}.' },
  'play.delve.outside': { en: 'That is outside the Delve.', es: 'Eso queda fuera de la Sima.' },
  'play.delve.occupied': { en: 'Something is already there.', es: 'Ya hay algo ahi.' },
  'play.delve.needsGround': { en: 'The {{lname}} needs solid ground under it.', es: 'Necesita suelo firme debajo: {{lname}}.' },
  'play.delve.single': { en: 'You already have a {{lname}} in the Delve. Take it back first (X beside it).', es: 'Ya tienes esto en la Sima: {{lname}}. Recogelo primero (X a su lado).' },
  'play.delve.standing': { en: 'You are standing there.', es: 'Estas de pie ahi.' },
  'play.delve.creatureInWay': { en: 'A creature is in the way.', es: 'Una criatura estorba.' },
  'play.delve.cannotPlace': { en: 'That cannot be placed.', es: 'Eso no se puede colocar.' },
  'play.delve.placed': { en: '{{name}} placed.', es: 'Colocado: {{name}}.' },
  'play.delve.supportPlaced': { en: '{{name}} placed. Loose rock within {{n}} cells of it holds.', es: 'Colocado: {{name}}. La roca suelta a {{n}} casillas o menos aguanta.' },
  'play.delve.nothingToTake': { en: 'Nothing placed here to take back. Blocks are dug, like rock.', es: 'Aqui no hay nada colocado que recoger. Los bloques se excavan, como la roca.' },
  'play.delve.takenBack': { en: '{{name}} back in the satchel.', es: 'De vuelta en la mochila: {{name}}.' },
  'play.delve.noneLeft': { en: 'You have no {{lname}} left. Dig or craft more.', es: 'No te queda: {{lname}}. Excava o fabrica mas.' },
  'play.delve.emptyChestFirst': { en: 'Empty the chest first: open it (E) and take everything out.', es: 'Vacia primero el cofre: abrelo (E) y saca todo.' },

  // ── Engine: blasting charges ──
  'play.delve.needStaff': { en: 'You need a staff to light the fuse (Staff I or better).', es: 'Necesitas un baston para encender la mecha (Baston I o mejor).' },
  'play.delve.fuseLit': { en: 'Fuse lit! Stand back. (X beside it pinches the fuse out.)', es: 'Mecha encendida! Apartate. (X a su lado apaga la mecha.)' },
  'play.delve.fusePinched': { en: 'You pinch the fuse out. The charge is back in the satchel.', es: 'Apagas la mecha. La carga vuelve a la mochila.' },
  'play.delve.chargeCleared': { en: 'The charge goes off: {{n}} cells of rock come down.', es: 'La carga estalla: caen {{n}} casillas de roca.' },
  'play.delve.chargeNothing': { en: 'The charge goes off, but nothing here would give.', es: 'La carga estalla, pero aqui nada cede.' },

  // ── Host: a rock cell dug during the Mining seam's recovery (play/delve-reward.ts) ──
  'play.delve.restingXp': { en: '+0 XP · the seam is catching its breath', es: '+0 XP · la veta recupera el aliento' },

  // ── Engine: loose rock and supports ──
  'play.delve.rockGroans': { en: 'The rock groans. Loose rock! A timber or basalt support nearby would hold it.', es: 'La roca cruje. Roca suelta! Un puntal de madera o de basalto cerca la sostendria.' },
  'play.delve.rockHits': { en: 'Loose rock hits you (-{{n}}). Place a support near loose rock (cracked, dusting) before you dig it.', es: 'Te golpea roca suelta (-{{n}}). Coloca un puntal junto a la roca suelta (agrietada, soltando polvo) antes de excavarla.' },
  'play.delve.looseOverhead': { en: 'Loose rock overhead: cracked and shedding dust. Dig it out with a support nearby, or it comes down.', es: 'Roca suelta encima: agrietada y soltando polvo. Excavala con un puntal cerca, o se vendra abajo.' },

  // ── Engine: camp and inscriptions ──
  'play.delve.campBlocked': { en: 'Something fills the space round your camp. Take the Delve shaft and dig your way down.', es: 'Algo ocupa el espacio de tu campamento. Toma el pozo de la Sima y excava hacia abajo.' },
  'play.delve.campArrive': { en: 'You climb down the ropes to your camp. The fire is still warm.', es: 'Bajas por las cuerdas hasta tu campamento. El fuego sigue caliente.' },
  'play.delve.inscriptionTrace': { en: 'You trace the carving with a finger. The words are older than the Seamworks.', es: 'Recorres la talla con un dedo. Las palabras son mas antiguas que las Costuras.' },

  // ── HUD: prompt, objective, camp ──
  'play.delve.objective': { en: 'Dig down (hold S + J, or tap rock). Dug dirt and stone become blocks: pick one below and press B to place it.', es: 'Excava hacia abajo (manten S + J, o toca la roca). La tierra y la piedra excavadas se vuelven bloques: elige uno abajo y pulsa B para colocarlo.' },
  'play.delve.action.inscription': { en: 'Read the inscription', es: 'Leer la inscripcion' },
  'play.delve.action.chest': { en: 'Open the chest', es: 'Abrir el cofre' },
  'play.delve.action.camp': { en: 'Craft at your camp', es: 'Fabricar en tu campamento' },
  'play.delve.action.enterTop': { en: 'Enter the Delve at the top', es: 'Entrar en la Sima por arriba' },
  'play.delve.action.enter': { en: 'Enter the Ember Delve', es: 'Entrar en la Sima de Brasas' },
  'play.delve.yourDelve': { en: 'Your Delve', es: 'Tu Sima' },
  'play.delve.camp.title': { en: 'Your camp', es: 'Tu campamento' },
  'play.delve.camp.kicker': { en: 'Craft what you can now', es: 'Fabrica lo que puedas ahora' },
  'play.delve.camp.descend': { en: 'Descend to your camp', es: 'Bajar a tu campamento' },

  // ── Chests (and the gear they hold) ──
  'play.delve.chest.intro': { en: 'Put things in to keep them here. Take them out any time.', es: 'Mete cosas para guardarlas aqui. Sacalas cuando quieras.' },
  'play.delve.chest.inChest': { en: 'In the chest', es: 'En el cofre' },
  'play.delve.chest.kinds': { en: '{{n}} / {{total}} kinds', es: '{{n}} / {{total}} tipos' },
  'play.delve.chest.empty': { en: 'Empty. An empty chest can be taken back (X).', es: 'Vacio. Un cofre vacio se puede recoger (X).' },
  'play.delve.chest.takeAll': { en: 'Take all', es: 'Sacar todo' },
  'play.delve.chest.gearInChest': { en: 'Gear in the chest', es: 'Equipo en el cofre' },
  'play.delve.chest.noGear': { en: 'No gear stored.', es: 'No hay equipo guardado.' },
  'play.delve.chest.inSatchel': { en: 'In your satchel', es: 'En tu mochila' },
  'play.delve.chest.nothingToPut': { en: 'Nothing to put in.', es: 'Nada que meter.' },
  'play.delve.chest.putIn': { en: 'Put in', es: 'Meter' },
  'play.delve.chest.gearInSatchel': { en: 'Gear in your satchel', es: 'Equipo en tu mochila' },
  'play.delve.chest.noBagGear': { en: 'No unworn gear to put in.', es: 'No hay equipo sin llevar puesto que meter.' },
  'play.delve.chest.putQty': { en: '{{n}} {{name}} put in the chest.', es: '{{n}} {{name}} guardado en el cofre.' },
  'play.delve.chest.takeQty': { en: '{{n}} {{name}} back in the satchel.', es: '{{n}} {{name}} de vuelta en la mochila.' },
  'play.delve.chest.putGear': { en: '{{name}} put in the chest.', es: 'Guardado en el cofre: {{name}}.' },
  'play.delve.chest.takeGear': { en: '{{name}} back in the satchel.', es: 'De vuelta en la mochila: {{name}}.' },
  'play.delve.chest.refunded': { en: 'The Delve shifted. {{n}} things from a lost chest are back in your satchel.', es: 'La Sima se movio. {{n}} cosas de un cofre perdido vuelven a tu mochila.' },
  'play.delve.chest.gearOnlyBag': { en: 'Only gear in your satchel (not worn) can go in.', es: 'Solo puede entrar el equipo de tu mochila (no el que llevas puesto).' },
  'play.delve.chest.notReady': { en: 'The chest is not ready yet.', es: 'El cofre aun no esta listo.' },
  'play.delve.chest.gearFull': { en: 'The chest holds {{n}} pieces of gear. Take one out first.', es: 'El cofre admite {{n}} piezas de equipo. Saca una primero.' },
  'play.delve.chest.saveFailed': { en: 'That could not be saved. Try again.', es: 'No se pudo guardar. Intentalo de nuevo.' },
  'play.delve.chest.notInChest': { en: 'That is not in the chest.', es: 'Eso no esta en el cofre.' },
  'play.delve.chest.noneLeft': { en: 'You have none of that left.', es: 'No te queda nada de eso.' },
  'play.delve.chest.full': { en: 'The chest is full ({{n}} kinds of thing). Take something out first.', es: 'El cofre esta lleno ({{n}} tipos de cosas). Saca algo primero.' },
  'play.delve.chest.bagFull': { en: 'Your satchel is full. Make room first.', es: 'Tu mochila esta llena. Haz sitio primero.' },
};
