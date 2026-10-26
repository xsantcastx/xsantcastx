/**
 * crafting.i18n.ts — the stations' recipe copy (Kael's Anvil; the Enchanting Table's charms and brews). Lazy: ships in
 * this route's chunk, merged by TranslationService.register(), checked by
 * scripts/check-i18n-keys.js.
 */
export const CRAFTING_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'crafting.name':          { en: 'Kael\'s Anvil', es: 'El yunque de Kael' },
  'crafting.name.enchanting': { en: 'Charms and brews', es: 'Amuletos y brebajes' },
  'crafting.ctaWorking':    { en: 'Crafting… {{s}}s', es: 'Fabricando… {{s}}s' },
  'crafting.why.level':     { en: 'Reach crafting level {{n}} first', es: 'Primero llega al nivel {{n}} de fabricacion' },
  'crafting.why.smithing':  { en: 'Reach Smithing {{n}} first', es: 'Primero llega a Herreria {{n}}' },
  'crafting.why.fishing':  { en: 'Reach Fishing {{n}} first', es: 'Primero llega a Pesca {{n}}' },
  'crafting.why.bag':       { en: 'Your satchel is full — make room first', es: 'Tu mochila esta llena: haz sitio primero' },
  'crafting.readyBadge':    { en: 'Ready', es: 'Listo' },
  'crafting.made':          { en: 'Crafted!', es: '¡Fabricado!' },
  'crafting.madeMastered':  { en: 'Crafted — recipe mastered!', es: '¡Fabricado y receta dominada!' },
  'crafting.quality':       { en: 'Quality {{q}}', es: 'Calidad {{q}}' },
  'crafting.details.hint':  { en: 'Every recipe, filters, stats, your crafting level', es: 'Todas las recetas, filtros, estadisticas, tu nivel' },
  'crafting.details.recipe': { en: 'About this recipe', es: 'Sobre esta receta' },
  'crafting.details.book':  { en: 'All recipes', es: 'Todas las recetas' },
  'crafting.tab.ready':     { en: 'Ready now', es: 'Listo ya' },
  'crafting.tabs':          { en: 'Recipe types', es: 'Tipos de receta' },
  'crafting.tool.anvil':    { en: 'Anvil & hammer', es: 'Yunque y martillo' },
  'crafting.craftN':        { en: 'Craft {{n}} {{name}}', es: 'Fabricar {{n}} {{name}}' },
  'crafting.craftBtn':      { en: 'Craft', es: 'Fabricar' },
  'crafting.craftAll':      { en: 'Craft all', es: 'Fabricar todo' },
  'crafting.batch':         { en: '{{n}} of {{total}}', es: '{{n}} de {{total}}' },
  'crafting.skillHint':     { en: 'Gather materials in the realms, then craft them here.', es: 'Reune materiales en los reinos y fabricalos aqui.' },
  'crafting.xpLine':        { en: '{{into}} / {{span}} XP', es: '{{into}} / {{span}} XP' },
  'crafting.maxed':         { en: 'Max level', es: 'Nivel maximo' },
  'crafting.details.level': { en: 'Your crafting level', es: 'Tu nivel de fabricacion' },
};
