/**
 * first-goals.i18n.ts: the first-session goal line in the play HUD (world/first-goals.ts).
 * Lazy: registered by the side-scroller (play chunk), checked by
 * scripts/check-i18n-keys.js. Plain words, no jargon: each line says what to do
 * and where, and the button walks there. Place and item names stay in English
 * in ES, like the rest of the play HUD.
 */
export const FIRST_GOALS_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'play.goal.label': { en: 'Goal {{n}} of {{total}}', es: 'Objetivo {{n}} de {{total}}' },
  'play.goal.go': { en: 'Show me', es: 'Llevame' },
  'play.goal.goAria': { en: 'Walk there: {{goal}}', es: 'Ir alli: {{goal}}' },

  'play.goal.buy.town': { en: 'Buy your first building. Walk to Your Homestead.', es: 'Compra tu primer edificio. Ve a Tu Hacienda.' },
  'play.goal.buy.home': { en: 'Strike the Forge to 15 Gold, then buy Forge Bellows in the Gold list.', es: 'Golpea la Forja hasta tener 15 de oro y compra Forge Bellows en la lista de oro.' },
  'play.goal.buy.back': { en: 'Buy your first building. Head back to the Seamworks, then to Your Homestead.', es: 'Compra tu primer edificio. Vuelve a Basalt Seamworks y ve a Tu Hacienda.' },

  'play.goal.hunt.town': { en: 'Defeat a Rivet Maw. Walk east past the Waystone and attack (J).', es: 'Derrota a una Fauce Remachada. Camina al este, mas alla del Waystone, y ataca (J).' },
  'play.goal.hunt.here': { en: 'Defeat a Rivet Maw. Walk up to one and attack (J).', es: 'Derrota a una Fauce Remachada. Acercate y ataca (J).' },
  'play.goal.hunt.back': { en: 'Defeat a Rivet Maw. Head back to the Seamworks; they wait east of the Waystone.', es: 'Derrota a una Fauce Remachada. Vuelve a Basalt Seamworks; esperan al este del Waystone.' },

  'play.goal.craft.mine': { en: 'Forge your first blade. Mine the Cinder Ore seam (E) for 6 ore and 1 ember.', es: 'Forja tu primera hoja. Pica la veta de Cinder Ore (E) hasta tener 6 de mineral y 1 de brasa.' },
  'play.goal.craft.forge': { en: 'You have the ore. Use the Seamworks Forge to make your Basalt Edge.', es: 'Ya tienes el mineral. Usa la Seamworks Forge para hacer tu Basalt Edge.' },
  'play.goal.craft.back': { en: 'Forge your first blade. Head back to the Seamworks and mine the Cinder Ore seam.', es: 'Forja tu primera hoja. Vuelve a Basalt Seamworks y pica la veta de Cinder Ore.' },

  'play.goal.delve.town': { en: 'Dig in the Ember Delve. Walk into the mine shaft.', es: 'Excava en la Sima de Brasas. Entra por el pozo de la mina.' },
  'play.goal.delve.dig': { en: 'Hold Down (S) and attack (J) to dig your first block.', es: 'Manten Abajo (S) y ataca (J) para excavar tu primer bloque.' },
  'play.goal.delve.back': { en: 'Dig in the Ember Delve. Head back to the Seamworks and enter the mine shaft.', es: 'Excava en la Sima de Brasas. Vuelve a Basalt Seamworks y entra por el pozo.' },

  // The Seamworks Forge's own lines (were "a first-craft tutorial ember is available after 8 accepted strikes").
  'play.goal.forge.need': { en: 'The forge needs 6 Cinder Ore and 1 Ember Residue. Keep mining the seam: an ember turns up by your 8th ore.', es: 'La forja necesita 6 de Cinder Ore y 1 de Ember Residue. Sigue picando la veta: aparece una brasa antes de tu octavo mineral.' },
  'play.goal.forge.ember': { en: 'You found an Ember Residue. Bring 6 Cinder Ore and the ember to the Seamworks Forge.', es: 'Encontraste una Ember Residue. Lleva 6 de Cinder Ore y la brasa a la Seamworks Forge.' },

  'play.goal.away': { en: 'Your first goals are in the Basalt Seamworks. Take the Waystone to Infernal.', es: 'Tus primeros objetivos estan en Basalt Seamworks. Toma el Waystone a Infernal.' },
};
