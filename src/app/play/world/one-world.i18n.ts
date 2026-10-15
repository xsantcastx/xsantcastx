/**
 * one-world.i18n.ts: One World's player-facing lines in the world itself (the
 * settlement's walls, the mine head, the Waystones, the keepers' evenings, the
 * preview's menu row). Lazy: registered by the side-scroller (play chunk),
 * checked by scripts/check-i18n-keys.js. The Travel map's own strings are in
 * world-travel/world-travel.i18n.ts.
 *
 * Engine lines carry their key on EngineState.messageKey; the English here
 * matches the engine's own English, which stays the fallback.
 * Lore (docs/world/lore-addendum.md, "One World"): every Waystone is a Meridian
 * transit aperture of Sera Quill's Compact.
 */
export const ONE_WORLD_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Engine ──
  'play.world.townWalls': { en: 'The town keeps its walls.', es: 'El pueblo conserva sus muros.' },
  'play.world.mineHead': { en: 'The Delve is under your feet: dig down beside the headframe. A camp or an anchor below is a way down from here.', es: 'La Sima esta bajo tus pies: excava junto al castillete. Un campamento o un ancla abajo son un camino desde aqui.' },
  'play.world.stone.hold': { en: 'A dark Waystone. Hold E (or hold the button) to light it.', es: 'Una Piedra de Paso apagada. Manten E (o manten el boton) para encenderla.' },

  // ── HUD: the prompt at a stone ──
  'play.world.stone.light': { en: 'Hold to light the stone', es: 'Manten para encender la piedra' },
  'play.world.stone.lighting': { en: 'Lighting the stone…', es: 'Encendiendo la piedra…' },
  'play.world.stone.travel': { en: 'Travel', es: 'Viajar' },
  'play.world.stone.lit': { en: 'The stone wakes: its seams burn gold. It agrees with every other lit stone now. +{{n}} Delving XP', es: 'La piedra despierta: sus vetas arden en oro. Ahora concuerda con todas las piedras encendidas. +{{n}} XP de Exploracion' },
  'play.world.stone.litAgain': { en: 'The stone wakes: its seams burn gold. It agrees with every other lit stone now.', es: 'La piedra despierta: sus vetas arden en oro. Ahora concuerda con todas las piedras encendidas.' },
  'play.world.stone.mark': { en: 'Meridian Survey: {{name}}.', es: 'Inspeccion Meridiana: {{name}}.' },
  'play.world.stone.label': { en: 'Waystone', es: 'Piedra de Paso' },

  // ── Glim, the first dark stone seen (once) ──
  'play.world.glim.firstStone': { en: 'Glim: A Waystone gone dark. When the fracture moved "down", the wild ones stopped agreeing. Light it, and it will agree with the town stone again.', es: 'Glim: Una Piedra de Paso apagada. Cuando la fractura movio el "abajo", las salvajes dejaron de concordar. Enciendela y volvera a concordar con la piedra del pueblo.' },

  // ── The keepers' evenings and nights (routines.ts): the station still opens ──
  'play.world.keeper.hearth': { en: '{{name}} is at the fire', es: '{{name}} esta junto al fuego' },
  'play.world.keeper.bell': { en: 'Ring the bell', es: 'Tocar la campana' },
  'play.world.keeper.bellLine': { en: 'A window lights upstairs, a yawn, the bolt. "Coming, coming."', es: 'Se enciende una ventana arriba, un bostezo, el cerrojo. "Ya voy, ya voy."' },

  // ── The arrival and the save's move (delve-migration-v3.ts) ──
  'play.world.arrive': { en: 'The Basalt Seamworks, on the Ember surface. The Delve is under your feet; the stone in the square takes you anywhere you have lit.', es: 'Las Costuras de Basalto, en la superficie de las Brasas. La Sima esta bajo tus pies; la piedra de la plaza te lleva a cualquier piedra que hayas encendido.' },
  'play.world.migrated': { en: 'Your Delve moved under the town. What you had earned came with you; what your chests held is back in your Satchel and Vault.', es: 'Tu Sima se movio bajo el pueblo. Lo que habias ganado vino contigo; lo que guardaban tus cofres esta de vuelta en tu Mochila y tu Boveda.' },

  // ── Menu → One World (preview) ──
};
