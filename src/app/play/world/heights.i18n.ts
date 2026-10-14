/**
 * heights.i18n.ts: the high ground (world/heights.ts) — the finds' names, the
 * carvings and summit texts, the HUD's prompts and toasts, the summit titles
 * and Hollis Fenn's lines. Lazy: registered by the side-scroller.
 *
 * Lore: docs/world/lore-addendum.md, "The High Roads" (shipped — owner
 * reviews in play). Before the Waystones, the Ridge Couriers carried the
 * realms' post over the high ground and cached what they could not carry.
 */
export const HEIGHTS_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Finds ──
  'play.height.find.cache': { en: 'Courier cache', es: 'Alijo de correo' },
  'play.height.find.carving': { en: 'Courier carving', es: 'Talla de correo' },
  'play.height.find.lookout': { en: 'Look-out cairn', es: 'Mojón mirador' },
  'play.height.summit.infernal': { en: 'Seamworks Summit cairn', es: 'Mojón de la Cima de Seamworks' },
  'play.height.summit.luminous': { en: 'Dawn Spire cairn', es: 'Mojón de la Aguja del Alba' },
  'play.height.summit.umbral': { en: 'Unrecorded Summit cairn', es: 'Mojón de la Cima No Registrada' },
  'play.height.summit.celestial': { en: 'Meridian Summit cairn', es: 'Mojón de la Cima Meridiana' },
  'play.height.summit.verdant': { en: 'Canopy Crown cairn', es: 'Mojón de la Corona del Dosel' },

  // ── The prompt (one plain action) ──
  'play.height.act.cache': { en: 'Open the courier cache', es: 'Abrir el alijo de correo' },
  'play.height.act.cacheOpened': { en: 'Cache already opened', es: 'Alijo ya abierto' },
  'play.height.act.carving': { en: 'Read the carving', es: 'Leer la talla' },
  'play.height.act.lookout': { en: 'Look out from the cairn', es: 'Otear desde el mojón' },
  'play.height.act.summit': { en: 'Add your stone to the cairn', es: 'Añadir tu piedra al mojón' },
  'play.height.act.summitDone': { en: 'Read the summit cairn', es: 'Leer el mojón de la cima' },
  'play.height.opened': { en: 'Already opened. Nobody restocks the high road any more.', es: 'Ya abierto. Ya nadie reabastece el camino alto.' },

  // ── What a find gives ──
  'play.height.toast.cache': { en: 'Courier cache: {{gold}} Gold and {{items}}.', es: 'Alijo de correo: {{gold}} de Oro y {{items}}.' },
  'play.height.toast.summit': { en: 'Summit reached: {{gold}} Gold, {{items}} and the title "{{title}}".', es: 'Cima alcanzada: {{gold}} de Oro, {{items}} y el título «{{title}}».' },
  'play.height.toast.lookout': { en: 'From the look-out every find left on this high road shows as a light.', es: 'Desde el mirador, cada hallazgo que queda en este camino alto se ve como una luz.' },

  // ── Carvings (a courier's road mark per realm) ──
  'play.height.carving.infernal': { en: 'A flame over an arrow pointing up, cut by a courier: "Road open. Rock warm. Keep climbing; the post is heavier down there."', es: 'Una llama sobre una flecha hacia arriba, tallada por un correo: «Camino abierto. Roca tibia. Sigue subiendo; abajo el correo pesa más».' },
  'play.height.carving.luminous': { en: 'A sun with one ray missing: "Wait here for the dawn. The prisms will show you the next ledge."', es: 'Un sol al que le falta un rayo: «Espera aquí al alba. Los prismas te mostrarán la siguiente cornisa».' },
  'play.height.carving.umbral': { en: 'Two arrows that disagree: "Both are true. Take the one that is still there when you look back."', es: 'Dos flechas que discrepan: «Las dos son ciertas. Toma la que siga ahí cuando mires atrás».' },
  'play.height.carving.celestial': { en: 'A ring cut through by a straight line: "The rings turn. The road does not. Climb when they line up."', es: 'Un anillo cortado por una línea recta: «Los anillos giran. El camino no. Sube cuando se alineen».' },
  'play.height.carving.verdant': { en: 'A leaf over a road mark, half grown over: "The Thicket takes the road back every spring. Cut it again; leave the flowers."', es: 'Una hoja sobre una marca de camino, medio cubierta: «El Matorral recupera el camino cada primavera. Córtalo otra vez; deja las flores».' },

  // ── Summits: the cairn's text and its title ──
  'play.height.summitText.infernal': { en: 'Every courier who reached the top of the Seamworks ridge added one stone. There are hundreds, warm on one side. You add yours.', es: 'Cada correo que llegó a lo alto de la cresta de Seamworks añadió una piedra. Hay cientos, tibias por un lado. Añades la tuya.' },
  'play.height.summitText.luminous': { en: 'From the Dawn Spire the Court\'s prisms catch the light twice: once now, once as the memory it keeps. The couriers timed their post by it.', es: 'Desde la Aguja del Alba, los prismas de la Corte captan la luz dos veces: ahora y como el recuerdo que guardan. Los correos medían su ruta con ellos.' },
  'play.height.summitText.umbral': { en: 'The Unrecorded Summit was never on any chart; that was the point. The stones here carry no names, only marks. You leave yours unnamed too.', es: 'La Cima No Registrada nunca estuvo en ningún mapa; esa era la idea. Las piedras no llevan nombres, solo marcas. Dejas la tuya sin nombre también.' },
  'play.height.summitText.celestial': { en: 'Only from the Meridian Summit do the Orrery\'s rings line up for someone on foot. The couriers knew it before the Compact did.', es: 'Solo desde la Cima Meridiana se alinean los anillos del Orrery para quien va a pie. Los correos lo sabían antes que el Pacto.' },
  'play.height.summitText.verdant': { en: 'The Canopy Crown is a cairn the Thicket has tried to swallow for a hundred springs. Someone keeps cutting it clear. Today, you.', es: 'La Corona del Dosel es un mojón que el Matorral intenta tragarse desde hace cien primaveras. Alguien sigue despejándolo. Hoy, tú.' },
  'play.height.title.infernal': { en: 'Cinder Ridgewalker', es: 'Caminacrestas de Ceniza' },
  'play.height.title.luminous': { en: 'Dawn Ridgewalker', es: 'Caminacrestas del Alba' },
  'play.height.title.umbral': { en: 'Unrecorded Ridgewalker', es: 'Caminacrestas No Registrado' },
  'play.height.title.celestial': { en: 'Meridian Ridgewalker', es: 'Caminacrestas Meridiano' },
  'play.height.title.verdant': { en: 'Canopy Ridgewalker', es: 'Caminacrestas del Dosel' },

  // ── The Codex entry ──
  'play.height.codex.title': { en: 'The High Roads', es: 'Los Caminos Altos' },
  'play.height.codex.sub': { en: 'Before the Waystones, the Ridge Couriers carried the realms\' post over the high ground. Every hunting ground still has their road: a tree, a shelf, a ruin, and a summit cairn at the top.', es: 'Antes de las Piedras de Paso, los Correos de las Crestas llevaban el correo de los reinos por las alturas. Cada coto de caza conserva su camino: un árbol, una cornisa, una ruina y un mojón en la cima.' },
  'play.height.codex.caches': { en: 'Courier caches found: {{n}} of {{total}}.', es: 'Alijos de correo encontrados: {{n}} de {{total}}.' },
  'play.height.codex.notYet': { en: 'Not reached yet. The cairn waits at the top of this realm\'s high road.', es: 'Aún sin alcanzar. El mojón espera en lo alto del camino de este reino.' },

  // ── Hollis Fenn, the last Ridge Courier (one realm's mesa a day) ──
  'play.height.folk.hollis': { en: 'Hollis Fenn', es: 'Hollis Fenn' },
  'play.height.folk.hollisTitle': { en: 'Last Ridge Courier', es: 'Último Correo de las Crestas' },
  'play.height.hollis.1': { en: 'Post used to go over the top. The Waystones are quicker. Quicker isn\'t the same as seen.', es: 'El correo iba por arriba. Las Piedras de Paso son más rápidas. Más rápido no es lo mismo que visto.' },
  'play.height.hollis.2': { en: 'Find a strongbox up here, it\'s yours. Nobody\'s coming back for it. I checked the ledger.', es: 'Si encuentras un cofre aquí arriba, es tuyo. Nadie vendrá a buscarlo. Revisé el registro.' },
  'play.height.hollis.infernal': { en: 'Every courier came down this ridge coughing. The forge breathes uphill.', es: 'Todos los correos bajaban tosiendo de esta cresta. La forja respira cuesta arriba.' },
  'play.height.hollis.luminous': { en: 'Watch the prisms from the spire. Twice, if you\'re quick.', es: 'Mira los prismas desde la aguja. Dos veces, si eres rápido.' },
  'play.height.hollis.umbral': { en: 'This road was never on a map. Rook Sable would like it kept that way.', es: 'Este camino nunca estuvo en un mapa. A Rook Sable le gustaría que siguiera así.' },
  'play.height.hollis.celestial': { en: 'The rings only line up from the summit. Sera hates that a courier knew it first.', es: 'Los anillos solo se alinean desde la cima. A Sera le molesta que un correo lo supiera antes.' },
  'play.height.hollis.verdant': { en: 'Kesh says the Thicket is learning the road. I say it\'s in the way.', es: 'Kesh dice que el Matorral está aprendiendo el camino. Yo digo que estorba.' },
};
