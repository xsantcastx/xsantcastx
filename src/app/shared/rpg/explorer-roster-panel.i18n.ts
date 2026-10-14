/**
 * explorer-roster-panel.i18n.ts — UI copy for the Explorer roster panel
 * (headings, sort/filter chips, status words, built sentences, the four
 * roster rewards). Lazy: merged by TranslationService.register(), checked by
 * scripts/check-i18n-keys.js. Explorer names, bios, passives, traits, realm
 * names and bonus chips are game content and stay English.
 * Glossary: docs/handoff/ux-consistency.md (ES: oro, mochila, Guardián).
 */
export const EXPLORER_ROSTER_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'rosterUi.eyebrow':       { en: 'The Roster', es: 'El Elenco' },
  'rosterUi.title':         { en: 'Who walks for you', es: 'Quién camina por ti' },
  'rosterUi.tagline':       { en: 'eighteen of them exist — you have met {{n}}', es: 'existen dieciocho — has conocido a {{n}}' },
  'rosterUi.meter.label':   { en: 'Explorers discovered', es: 'Exploradores descubiertos' },
  'rosterUi.meter.found':   { en: 'found', es: 'hallados' },
  'rosterUi.payout':        { en: 'expeditions pay +{{n}}%', es: 'las expediciones pagan +{{n}}%' },
  'rosterUi.next':          { en: '{{n}} more to go —', es: 'faltan {{n}} —' },
  'rosterUi.reward.slot':   { en: '+1 slot', es: '+1 espacio' },
  'rosterUi.reward.bonus':  { en: 'bonus', es: 'bonificación' },
  'rosterUi.reward.5.title':  { en: 'Scout Master', es: 'Maestro explorador' },
  'rosterUi.reward.5.detail': { en: 'Five of the cast found. Every expedition pays 5% more.', es: 'Cinco del elenco hallados. Cada expedición paga un 5% más.' },
  'rosterUi.reward.10.detail': { en: 'Ten found. A sixth expedition slot opens in the Sanctum.', es: 'Diez hallados. Se abre un sexto espacio de expedición en el Santuario.' },
  'rosterUi.reward.15.title':  { en: 'Expedition Commander', es: 'Comandante de expediciones' },
  'rosterUi.reward.15.detail': { en: 'Fifteen found. Expeditions pay 10% more, and the Commander’s charm is yours.', es: 'Quince hallados. Las expediciones pagan un 10% más y el amuleto del Comandante es tuyo.' },
  'rosterUi.reward.18.title':  { en: 'Lord of the Roster', es: 'Señor del Elenco' },
  'rosterUi.reward.18.detail': { en: 'Every one of them walks for you. All expedition rewards, permanently +10%.', es: 'Todos caminan por ti. Todas las recompensas de expedición, +10% de forma permanente.' },

  'rosterUi.sort.label':    { en: 'Sort the roster', es: 'Ordenar el elenco' },
  'rosterUi.filter.label':  { en: 'Filter the roster', es: 'Filtrar el elenco' },
  'rosterUi.sort.rarity':   { en: 'Rarity', es: 'Rareza' },
  'rosterUi.sort.level':    { en: 'Level', es: 'Nivel' },
  'rosterUi.sort.realm':    { en: 'Realm', es: 'Reino' },
  'rosterUi.sort.name':     { en: 'Name', es: 'Nombre' },
  'rosterUi.filter.all':    { en: 'All', es: 'Todos' },
  'rosterUi.filter.found':  { en: 'Found', es: 'Hallados' },
  'rosterUi.filter.locked': { en: 'Missing', es: 'Faltan' },
  'rosterUi.filter.idle':   { en: 'Idle', es: 'Libres' },
  'rosterUi.filter.deployed': { en: 'Out', es: 'Fuera' },
  'rosterUi.empty':         { en: 'nobody matches that — try another filter', es: 'nadie coincide con eso — prueba otro filtro' },

  'rosterUi.rarity.common':    { en: 'Common', es: 'Común' },
  'rosterUi.rarity.uncommon':  { en: 'Uncommon', es: 'Poco común' },
  'rosterUi.rarity.rare':      { en: 'Rare', es: 'Raro' },
  'rosterUi.rarity.epic':      { en: 'Epic', es: 'Épico' },
  'rosterUi.rarity.legendary': { en: 'Legendary', es: 'Legendario' },
  'rosterUi.rarity.mythic':    { en: 'Mythic', es: 'Mítico' },
  'rosterUi.rarity.singular':  { en: 'Singular', es: 'Singular' },
  'rosterUi.rarity.unknown':   { en: 'unknown', es: 'desconocido' },

  'rosterUi.levelOf':       { en: 'Level {{level}} of {{max}}', es: 'Nivel {{level}} de {{max}}' },
  'rosterUi.state.out':     { en: 'out', es: 'fuera' },
  'rosterUi.state.runs':    { en: '{{n}} run', es: '{{n}} salidas' },
  'rosterUi.state.runs.one': { en: '{{n}} run', es: '{{n}} salida' },
  'rosterUi.state.missing': { en: 'missing', es: 'falta' },

  'rosterUi.silhouette':       { en: 'A {{rarity}}. Their name is not yours to know yet.', es: 'De rareza {{rarity}}. Su nombre aún no te corresponde conocerlo.' },
  'rosterUi.silhouette.realm': { en: 'A {{rarity}} of {{realm}}. Their name is not yours to know yet.', es: 'De rareza {{rarity}}, de {{realm}}. Su nombre aún no te corresponde conocerlo.' },
  'rosterUi.recruit':       { en: '◈ Recruit for {{cost}} Gold', es: '◈ Reclutar por {{cost}} de oro' },
  'rosterUi.recruit.short': { en: '◈ {{cost}} Gold — you are short', es: '◈ {{cost}} de oro — te falta' },
  'rosterUi.capstone.label': { en: 'Collection Log progress', es: 'Progreso del Registro de Colección' },
  'rosterUi.capstone.foot': { en: 'Collection Log — {{n}}%', es: 'Registro de Colección — {{n}}%' },
  'rosterUi.capstone.claim': { en: 'The Log is complete — call them in', es: 'El Registro está completo — llámalos' },

  'rosterUi.strengthened':  { en: 'strengthened', es: 'reforzado' },
  'rosterUi.level':         { en: 'Level {{n}}', es: 'Nivel {{n}}' },
  'rosterUi.mastered':      { en: 'mastered', es: 'dominado' },
  'rosterUi.xp':            { en: '{{into}} / {{span}} XP', es: '{{into}} / {{span}} XP' },
  'rosterUi.level.next':    { en: 'Level {{level}} — {{detail}}', es: 'Nivel {{level}} — {{detail}}' },
  'rosterUi.stat.speed':    { en: 'speed', es: 'velocidad' },
  'rosterUi.stat.runs':     { en: 'runs', es: 'salidas' },
  'rosterUi.stat.deployed': { en: 'deployed', es: 'en misión' },
  'rosterUi.stat.bestFind': { en: 'best find', es: 'mejor hallazgo' },
  'rosterUi.speed.normal':  { en: 'normal', es: 'normal' },
  'rosterUi.speed.faster':  { en: '{{n}}× faster', es: '{{n}}× más rápido' },
  'rosterUi.bestFind.none': { en: 'nothing yet', es: 'nada aún' },

  'rosterUi.kit.carrying':  { en: 'Carrying ({{n}}/{{max}})', es: 'Lleva ({{n}}/{{max}})' },
  'rosterUi.kit.takeBack':  { en: 'Take {{name}} back', es: 'Recuperar {{name}}' },
  'rosterUi.kit.none':      { en: 'nothing', es: 'nada' },
  'rosterUi.kit.give':      { en: 'Hand them something', es: 'Entrégales algo' },
  'rosterUi.kit.full':      { en: 'their hands are full', es: 'tienen las manos llenas' },
  'rosterUi.kit.common':    { en: 'a Common carries nothing but what they find — level 15 changes that', es: 'un explorador Común no lleva más que lo que encuentra — el nivel 15 lo cambia' },
  'rosterUi.dismiss.confirm': { en: 'Certain? They will not come back', es: '¿Seguro? No volverán' },
  'rosterUi.dismiss':       { en: 'Let them go', es: 'Déjalos ir' },

  'rosterUi.foot':          { en: '{{n}} on the books · {{m}} hired all-time', es: '{{n}} en los libros · {{m}} contratados en total' },
  'rosterUi.foot.full':     { en: ' · the roster is full', es: ' · el elenco está lleno' },
};
