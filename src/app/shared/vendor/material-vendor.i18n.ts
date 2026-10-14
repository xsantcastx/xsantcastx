/**
 * material-vendor.i18n.ts — the Material Vendor's copy (buyback counter).
 * Lazy: ships in the vendor panel's chunk, merged by TranslationService.register(),
 * checked by scripts/check-i18n-keys.js. Glossary: docs/handoff/ux-consistency.md.
 */
export const VENDOR_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'vendor.title':       { en: 'Material Vendor', es: 'Vendedor de materiales' },
  'vendor.detailsHint': { en: 'Where it comes from, which recipes use it, quick amounts and your last sale', es: 'De dónde viene, qué recetas lo usan, cantidades rápidas y tu última venta' },
  'vendor.hint':        { en: 'The Vendor buys surplus at a low floor price. The market pays more.', es: 'El Vendedor compra el excedente a un precio mínimo bajo. El mercado paga más.' },
  'vendor.list':        { en: 'Materials the counter buys', es: 'Materiales que compra el mostrador' },
  'vendor.rowSub':      { en: '{{held}} held · {{price}} Gold each', es: '{{held}} en mano · {{price}} de oro c/u' },
  'vendor.sellLine':    { en: 'Sell 1 {{name}} for {{price}} Gold', es: 'Vender 1 {{name}} por {{price}} de oro' },
  'vendor.youHold':     { en: 'You hold {{n}}. Gold goes straight to your purse.', es: 'Tienes {{n}}. El oro va directo a tu monedero.' },
  'vendor.holdNone':    { en: 'You hold no {{name}}.', es: 'No tienes {{name}}.' },
  'vendor.wouldShort':  { en: 'Selling {{n}} leaves too few for {{recipe}} (it takes {{need}}).', es: 'Vender {{n}} deja muy pocos para {{recipe}} (necesita {{need}}).' },
  'vendor.sell':        { en: 'Sell for {{n}} Gold', es: 'Vender por {{n}} de oro' },
  'vendor.sellAll':     { en: 'Sell all', es: 'Vender todo' },
  'vendor.kicker':      { en: 'Sold', es: 'Vendido' },
  'vendor.rewardName':  { en: '{{n}} × {{name}}', es: '{{n}} × {{name}}' },
  'vendor.rewardCaption': { en: '+{{n}} Gold', es: '+{{n}} de oro' },
  'vendor.sold':        { en: 'Sold {{n}} {{name}} for {{gold}} Gold.', es: 'Vendiste {{n}} {{name}} por {{gold}} de oro.' },
  'vendor.meta':        { en: '{{name}}: the Vendor pays {{price}} Gold each, {{pct}}% of its {{worth}} Gold base worth.', es: '{{name}}: el Vendedor paga {{price}} de oro c/u, el {{pct}}% de su valor base de {{worth}} de oro.' },
  'vendor.foundOn':     { en: 'Found on {{source}}.', es: 'Se encuentra en {{source}}.' },
  'vendor.usedIn.one':  { en: 'You hold {{held}}. Used in 1 recipe.', es: 'Tienes {{held}}. Se usa en 1 receta.' },
  'vendor.usedIn.many': { en: 'You hold {{held}}. Used in {{n}} recipes.', es: 'Tienes {{held}}. Se usa en {{n}} recetas.' },
  'vendor.needsLabel':  { en: 'Recipes that use it', es: 'Recetas que lo usan' },
  'vendor.takes':       { en: 'takes {{n}}', es: 'necesita {{n}}' },
  'vendor.short':       { en: '{{n}} short', es: 'faltan {{n}}' },
  'vendor.covered':     { en: 'covered', es: 'cubierto' },
  'vendor.surplus':     { en: 'Only the surplus ({{n}})', es: 'Solo el excedente ({{n}})' },
  'vendor.last':        { en: 'Last sale: {{n}} {{name}} for {{gold}} Gold.', es: 'Última venta: {{n}} {{name}} por {{gold}} de oro.' },
  'vendor.refuse.unknown':      { en: 'The counter does not buy that.', es: 'El mostrador no compra eso.' },
  'vendor.refuse.badQuantity':  { en: 'Choose between 1 and {{max}}.', es: 'Elige entre 1 y {{max}}.' },
  'vendor.refuse.stale':        { en: 'The price changed. Check it and try again.', es: 'El precio cambió. Compruébalo e inténtalo de nuevo.' },
  'vendor.refuse.short':        { en: 'You do not hold that many.', es: 'No tienes tantos.' },
  'vendor.refuse.delivery':     { en: 'The goods could not be handed over. Nothing was taken. Try again.', es: 'No se pudo entregar la mercancía. No se tomó nada. Inténtalo de nuevo.' },
  'vendor.src.nexus':    { en: 'Nexus expeditions', es: 'expediciones al Nexus' },
  'vendor.src.verge':    { en: 'Verge expeditions', es: 'expediciones al Verge' },
  'vendor.src.umbral':   { en: 'Umbral expeditions', es: 'expediciones a Umbral' },
  'vendor.src.luminous': { en: 'Luminous expeditions', es: 'expediciones a Luminous' },
  'vendor.src.archivum': { en: 'Archivum expeditions', es: 'expediciones a Archivum' },
  'vendor.src.every':    { en: 'Every realm, rarely', es: 'Todos los reinos, rara vez' },
};

/** Model source text (English, owned by material-vendor.model.ts) → table key. */
export const VENDOR_SOURCE_KEY: Readonly<Record<string, string>> = {
  'Nexus expeditions': 'vendor.src.nexus',
  'Verge expeditions': 'vendor.src.verge',
  'Umbral expeditions': 'vendor.src.umbral',
  'Luminous expeditions': 'vendor.src.luminous',
  'Archivum expeditions': 'vendor.src.archivum',
  'Every realm, rarely': 'vendor.src.every',
};
