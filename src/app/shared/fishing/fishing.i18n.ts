/**
 * The Fishing words, EN + ES. Lazy: registered by the play view, the Skills
 * panel (the Lodge), the Codex (the Catalogue) and the level-up banner on a
 * Fishing level, never by the app shell's eager table.
 */
export const FISHING_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── The skill ──
  'skills.name.fishing': { en: 'Fishing', es: 'Pesca' },
  'skills.hint.fishing': { en: 'Cast a rod into the Delve\'s water (or lava, with a Seam Rod) and press E when the bob dips.', es: 'Lanza una cana al agua de la Grieta (o a la lava, con una Cana de veta) y pulsa E cuando el corcho se hunda.' },
  'skills.unlock.rod': { en: '{{name}} works at its own tier', es: '{{name}} rinde a su propio nivel' },
  'skills.unlock.fish.bite': { en: 'Bites come {{n}}% faster', es: 'Pican un {{n}}% mas rapido' },
  'skills.unlock.fish.crate': { en: 'Crates +{{n}}% more often', es: 'Cajas un +{{n}}% mas a menudo' },
  'skills.unlock.fish.double': { en: '{{n}}% chance of a double catch', es: '{{n}}% de probabilidad de captura doble' },
  'skills.unlock.fish.window': { en: 'The Line Tension window {{n}}% wider', es: 'La ventana de Tension del sedal un {{n}}% mas ancha' },
  'skills.unlock.fish.lava': { en: 'Lava fishing in the Magma Halls (with a Seam Rod)', es: 'Pesca en lava en las Salas de Magma (con una Cana de veta)' },

  // ── The play view: the prompt, the reel, the catch ──
  'play.fish.ui.fish': { en: 'Fish here', es: 'Pescar aqui' },
  'play.fish.ui.fishLava': { en: 'Fish the lava', es: 'Pescar en la lava' },
  'play.fish.ui.waiting': { en: 'Line in the water', es: 'Sedal en el agua' },
  'play.fish.ui.water': { en: 'Still water', es: 'Agua quieta' },
  'play.fish.ui.lava': { en: 'Molten lava', es: 'Lava fundida' },
  'play.fish.ui.biteCall': { en: 'A bite!', es: 'Pican!' },
  'play.fish.ui.hook': { en: 'Hook it', es: 'Engancha' },
  'play.fish.ui.bite': { en: 'A bite! Hook it', es: 'Pican! Engancha' },
  'play.fish.ui.reelIn': { en: 'Reel in', es: 'Recoger' },
  'play.fish.ui.hold': { en: 'Hold E (or the button) to keep fishing on your own.', es: 'Manten E (o el boton) para seguir pescando solo.' },
  'play.fish.ui.title': { en: 'Line Tension', es: 'Tension del sedal' },
  'play.fish.ui.how': { en: 'Hold to lift the window, let go to drop it. Keep the fish inside.', es: 'Manten para subir la ventana, suelta para bajarla. Manten el pez dentro.' },
  'play.fish.ui.holdBtn': { en: 'Hold', es: 'Mantener' },
  'play.fish.ui.reel': { en: 'Reel it in', es: 'Recoger' },
  'play.fish.ui.always': { en: 'Once hooked, it is always landed. Playing well only adds.', es: 'Una vez enganchado, siempre se saca. Jugar bien solo suma.' },
  'play.fish.ui.grade.perfect': { en: 'Perfect! +50% XP', es: 'Perfecto! +50% XP' },
  'play.fish.ui.grade.good': { en: 'Good! +20% XP', es: 'Bien! +20% XP' },
  'play.fish.ui.grade.off': { en: 'Landed', es: 'Sacado' },
  'play.fish.ui.landed': { en: '{{name}} ×{{n}} · +{{xp}} Fishing XP', es: '{{name}} ×{{n}} · +{{xp}} XP de Pesca' },
  'play.fish.ui.first': { en: 'New in the Catalogue of Strange Fish.', es: 'Nuevo en el Catalogo de peces extranos.' },
  'play.fish.ui.saveFailed': { en: 'The catch could not be saved. Make room in your satchel and try again.', es: 'No se pudo guardar la captura. Haz sitio en la mochila e intentalo de nuevo.' },
  'play.fish.ui.rod': { en: '{{name}}', es: '{{name}}' },
  'play.fish.ui.rodWorks': { en: '{{name}} (works as {{works}} until your Fishing level catches up)', es: '{{name}} (rinde como {{works}} hasta que tu Pesca lo alcance)' },
  'play.fish.ui.bait': { en: 'Bait: {{name}}', es: 'Cebo: {{name}}' },
  'play.fish.ui.noBait': { en: 'No bait (dig dirt for Ember Grubs)', es: 'Sin cebo (excava tierra para sacar Larvas de brasa)' },
  'play.fish.ui.open': { en: 'Open', es: 'Abrir' },
  'play.fish.ui.opened': { en: 'In the crate: {{items}}', es: 'En la caja: {{items}}' },

  // ── The Lodge Warden: the Ledger Catch (Skills panel, Rootglass Canopy) ──
  'skills.lodge.title': { en: 'The Ledger Catch', es: 'La captura del libro' },
  'skills.lodge.kicker': { en: 'Kesh Arbo, Lodge Warden', es: 'Kesh Arbo, Guardian del Pabellon' },
  'skills.lodge.line1': { en: 'Today\'s ledger wants one fish. Only one. It only swims on days like this.', es: 'El libro de hoy pide un pez. Solo uno. Solo nada en dias como este.' },
  'skills.lodge.line2': { en: 'Bring it to me wet. The ledger can tell.', es: 'Traemelo mojado. El libro lo nota.' },
  'skills.lodge.line3': { en: 'Thirty catches. You may now call yourself patient. I never have.', es: 'Treinta capturas. Ya puedes llamarte paciente. Yo nunca he podido.' },
  'skills.lodge.today': { en: 'Today: one {{name}}, in {{water}}.', es: 'Hoy: un {{name}}, en {{water}}.' },
  'skills.lodge.turnIn': { en: 'Hand it in', es: 'Entregar' },
  'skills.lodge.need': { en: 'Catch it first', es: 'Pescalo primero' },
  'skills.lodge.done': { en: 'Turned in. A new fish swims tomorrow.', es: 'Entregado. Manana nada otro pez.' },
  'skills.lodge.paid': { en: '+{{gold}} Gold · +{{xp}} Fishing XP', es: '+{{gold}} de oro · +{{xp}} XP de Pesca' },
  'skills.lodge.gift': { en: 'The Warden gives you: {{name}}.', es: 'El Guardian te da: {{name}}.' },
  'skills.lodge.count': { en: '{{n}} turned in', es: '{{n}} entregados' },
  'skills.lodge.next': { en: 'Next gift: {{name}} at {{n}}.', es: 'Proximo regalo: {{name}} a las {{n}}.' },
  'skills.lodge.reward': { en: 'Pays Gold and Fishing XP.', es: 'Paga oro y XP de Pesca.' },
  'skills.lodge.water.seep': { en: 'a Delve seep (Root Hollows or the flooded seam)', es: 'un manantial de la Grieta (Huecos de Raiz o la veta inundada)' },
  'skills.lodge.water.mere': { en: 'the Grotto Mere', es: 'el Lago de la Gruta' },
  'skills.lodge.water.magma': { en: 'Magma Halls lava (a Seam Rod)', es: 'la lava de las Salas de Magma (una Cana de veta)' },
  'skills.lodge.water.hearth': { en: 'the Underhearth\'s lava (a lava rod)', es: 'la lava del Hogar Hondo (una cana para lava)' },

  // ── The Codex: the Catalogue of Strange Fish ──
  'codex.fish.shelf': { en: 'Catalogue of Strange Fish', es: 'Catalogo de peces extranos' },
  'codex.fish.note': { en: 'Fish are terrible witnesses. They remember everything and testify to nothing. (The Archivist)', es: 'Los peces son pesimos testigos. Lo recuerdan todo y no declaran nada. (El Archivero)' },
  'codex.fish.unknown': { en: 'Not caught yet', es: 'Aun sin pescar' },
  'codex.fish.where': { en: 'Found in: {{where}}', es: 'Se encuentra en: {{where}}' },
  'codex.fish.used': { en: 'Used for: {{use}}', es: 'Sirve para: {{use}}' },
  'codex.fish.caught': { en: 'Caught', es: 'Pescados' },
};
