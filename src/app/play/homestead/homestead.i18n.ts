/**
 * homestead.i18n.ts — the Homestead's own words: building panel, buildings
 * column, purchase receipts, the model's labels and the plot's canvas lines.
 * Lazy (the /play chunk), merged by TranslationService.register(), checked by
 * scripts/check-i18n-keys.js. Glossary: docs/handoff/ux-consistency.md
 * (Gold / oro, Keeper / Guardián, Satchel / mochila).
 *
 * The pure model (homestead.model.ts) and the canvas renderer have no
 * Angular; they read this table through `setHomesteadTranslator()` and fall
 * back to the English column when nothing has registered.
 */
export const HOMESTEAD_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // Building names
  'homestead.name.forge':      { en: 'The Forge', es: 'La Forja' },
  'homestead.name.treasury':   { en: 'Treasury', es: 'Tesorería' },
  'homestead.name.furnace':    { en: 'Furnace', es: 'Horno' },
  'homestead.name.automatons': { en: 'Forge Automatons', es: 'Autómatas de la Forja' },
  'homestead.name.camp':       { en: 'Explorer Camp', es: 'Campamento de exploradores' },
  'homestead.name.workshop':   { en: 'Thrall Workshop', es: 'Taller de Thralls' },

  // Panel
  'homestead.panel.empty':     { en: 'Walk up to a building on your Homestead to see what it can do.', es: 'Acércate a un edificio de tu Hacienda para ver qué puede hacer.' },
  'homestead.panel.details':   { en: 'Details', es: 'Detalles' },
  'homestead.panel.owned':     { en: 'Owned {{n}}', es: 'Tienes {{n}}' },
  'homestead.panel.notYet':    { en: 'Not yet', es: 'Aún no' },
  'homestead.panel.fine':      { en: "Prices are the Market's own. Buying here is the same purchase as buying there.", es: 'Los precios son los del Mercado. Comprar aquí es la misma compra que allí.' },
  'homestead.panel.grow':      { en: 'Look at your {{name}} grow.', es: 'Mira cómo crece tu {{name}}.' },

  // Receipts
  'homestead.buy.ok':          { en: 'Built!', es: '¡Construido!' },
  'homestead.buy.funds':       { en: 'Not enough Gold yet.', es: 'Aún no tienes suficiente oro.' },
  'homestead.buy.stale':       { en: 'The price just changed. Try again.', es: 'El precio acaba de cambiar. Inténtalo de nuevo.' },
  'homestead.buy.maxed':       { en: 'That is fully built.', es: 'Eso ya está al máximo.' },
  'homestead.buy.inFlight':    { en: 'Still building the last one…', es: 'Aún se construye el anterior…' },
  'homestead.buy.failed':      { en: 'That did not go through. Try again.', es: 'No se pudo. Inténtalo de nuevo.' },
  'homestead.built':           { en: '{{name}} built!', es: '¡{{name}} construido!' },

  // Column
  'homestead.column.aria':     { en: 'Homestead buildings', es: 'Edificios de la Hacienda' },
  'homestead.column.gold':     { en: '{{n}} Gold', es: '{{n}} de oro' },
  'homestead.column.strike':   { en: 'Strike the Forge · +{{n}} Gold', es: 'Golpear la Forja · +{{n}} de oro' },
  'homestead.column.unlocksAt': { en: 'Unlocks at {{n}} Gold earned', es: 'Se desbloquea con {{n}} de oro ganado' },
  'homestead.column.each':     { en: '{{rate}} each', es: '{{rate}} c/u' },
  'homestead.column.buyAria':  { en: 'Buy {{name}} for {{n}} Gold', es: 'Comprar {{name}} por {{n}} de oro' },
  'homestead.column.maxed':    { en: 'Maxed', es: 'Máximo' },
  'homestead.column.free':     { en: 'Free', es: 'Gratis' },
  'homestead.column.need':     { en: 'Need {{n}} more', es: 'Faltan {{n}}' },

  // Model: the one action a building offers
  'homestead.action.fullyBuilt': { en: 'Fully built', es: 'Totalmente construido' },
  'homestead.action.maxedWhy':   { en: 'This building is as big as it gets.', es: 'Este edificio ya no puede crecer más.' },
  'homestead.action.line':       { en: '{{verb}}: {{rung}} · {{price}}', es: '{{verb}}: {{rung}} · {{price}}' },
  'homestead.action.free':       { en: 'Free', es: 'Gratis' },
  'homestead.action.price':      { en: '{{n}} Gold', es: '{{n}} de oro' },
  'homestead.action.needMore':   { en: 'You need {{n}} more Gold.', es: 'Te faltan {{n}} de oro.' },
  'homestead.rate':              { en: '+{{n}} Gold/s', es: '+{{n}} de oro/s' },

  // Model: "since you were last here"
  'homestead.since.gold':      { en: '+{{n}} Gold', es: '+{{n}} de oro' },
  'homestead.since.rune.one':  { en: '+{{n}} rune', es: '+{{n}} runa' },
  'homestead.since.rune.many': { en: '+{{n}} runes', es: '+{{n}} runas' },
  'homestead.since.home.one':  { en: '{{n}} explorer home', es: '{{n}} explorador de vuelta' },
  'homestead.since.home.many': { en: '{{n}} explorers home', es: '{{n}} exploradores de vuelta' },
  'homestead.since.line':      { en: '{{parts}} since you were last here', es: '{{parts}} desde tu última visita' },

  // Service: verbs on the one big button
  'homestead.verb.upgradeFurnace': { en: 'Upgrade Furnace', es: 'Mejorar horno' },
  'homestead.verb.build':          { en: 'Build', es: 'Construir' },
  'homestead.verb.addAutomaton':   { en: 'Add Automaton', es: 'Añadir autómata' },
  'homestead.verb.unlock':         { en: 'Unlock', es: 'Desbloquear' },
  'homestead.verb.upgradeTreasury': { en: 'Upgrade Treasury', es: 'Mejorar tesorería' },
  'homestead.verb.addTent':        { en: 'Add a tent', es: 'Añadir una tienda' },
  'homestead.verb.addSpot':        { en: 'Add a work spot', es: 'Añadir un puesto de trabajo' },
  'homestead.gate.thrall':         { en: 'Recruit a Thrall at the Market first.', es: 'Recluta primero un Thrall en el Mercado.' },
  'homestead.sign.thrall':         { en: 'Recruit a Thrall at the Market', es: 'Recluta un Thrall en el Mercado' },
  'homestead.sign.furnace':        { en: 'Build a Furnace', es: 'Construye un horno' },
  'homestead.sign.automatons':     { en: 'Unlock Forge Automatons', es: 'Desbloquea los autómatas' },
  'homestead.grew.tent':           { en: '+1 tent', es: '+1 tienda' },
  'homestead.grew.spot':           { en: '+1 work spot', es: '+1 puesto' },
  'homestead.grew.upgraded':       { en: 'Upgraded!', es: '¡Mejorado!' },

  // Service: one plain sentence per building
  'homestead.sentence.forge':      { en: 'Every strike makes {{n}} Gold. Click it as fast as you like.', es: 'Cada golpe da {{n}} de oro. Púlsala tan rápido como quieras.' },
  'homestead.sentence.treasury':   { en: 'You hold {{n}} Gold. Treasury upgrades raise ALL Gold income.', es: 'Tienes {{n}} de oro. Las mejoras de la tesorería suben TODOS los ingresos de oro.' },
  'homestead.sentence.furnace':    { en: 'Your buildings make {{rate}}, even while you are away.', es: 'Tus edificios producen {{rate}}, incluso cuando no estás.' },
  'homestead.sentence.automatons': { en: '{{n}} automatons strike for you: {{rate}}.', es: '{{n}} autómatas golpean por ti: {{rate}}.' },
  'homestead.sentence.camp':       { en: '{{out}} of {{slots}} explorers are out. Send them from the Sanctum.', es: '{{out}} de {{slots}} exploradores están fuera. Envíalos desde el Santuario.' },
  'homestead.sentence.workshop':   { en: '{{working}} of {{owned}} Thralls are pulling runes (room for {{slots}}).', es: '{{working}} de {{owned}} Thralls extraen runas (hay sitio para {{slots}}).' },
  'homestead.sentence.noThralls':  { en: 'No Thralls yet. Recruit one at the Market and it works here.', es: 'Aún no tienes Thralls. Recluta uno en el Mercado y trabajará aquí.' },

  // Canvas lines
  'homestead.canvas.spark':        { en: 'Golden spark!', es: '¡Chispa dorada!' },
  'homestead.canvas.perSecond':    { en: '{{n}} Gold every second', es: '{{n}} de oro por segundo' },
  'homestead.canvas.pressE':       { en: 'Press E to strike!', es: '¡Pulsa E para golpear!' },
  'homestead.canvas.clickMe':      { en: 'Click me!', es: '¡Púlsame!' },
  'homestead.canvas.perStrike':    { en: '+{{n}} Gold a strike', es: '+{{n}} de oro por golpe' },
  'homestead.canvas.purse':        { en: '{{n}} Gold', es: '{{n}} de oro' },
  'homestead.canvas.part.one':     { en: '{{n}} part', es: '{{n}} pieza' },
  'homestead.canvas.part.many':    { en: '{{n}} parts', es: '{{n}} piezas' },
  'homestead.canvas.rune.one':     { en: '+{{n}} rune', es: '+{{n}} runa' },
  'homestead.canvas.rune.many':    { en: '+{{n}} runes', es: '+{{n}} runas' },
  'homestead.canvas.home':         { en: '{{n}} home', es: '{{n}} de vuelta' },
};
