/**
 * td-ux.i18n.ts: the HUD's helper words (owner's player notes, 2026-10-21), EN + ES. Lazy: registered by the play view.
 * The key caps on the prologue card, the experience bar's tooltip, the Skills page of the character sheet, the HUD
 * layout reset, and the Map window (sections, zoom, key, search).
 */
export const TD_UX_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // The prologue card's keys (desktop) and taps (phones).
  'ux.keys.title': { en: 'Keys', es: 'Teclas' },
  'ux.keys.satchel': { en: 'Satchel', es: 'Morral' },
  'ux.keys.spells': { en: 'Spellbook', es: 'Hechizos' },
  'ux.keys.character': { en: 'Character', es: 'Personaje' },
  'ux.keys.map': { en: 'Map', es: 'Mapa' },
  'ux.keys.interact': { en: 'Interact', es: 'Usar' },
  'ux.keys.skills': { en: 'Skills', es: 'Habilidades' },
  'ux.keys.close': { en: 'Close', es: 'Cerrar' },
  'ux.taps': { en: 'Tap Satchel, Spells, Character or Places at the bottom; tap the world to walk and to use things.', es: 'Toca Morral, Hechizos, Personaje o Lugares abajo; toca el mundo para caminar y usar cosas.' },

  // The experience bar along the bottom of the HUD (Diablo II).
  'ux.xp.aria': { en: 'Experience: level {{level}}, {{pct}}% of the way to {{next}}', es: 'Experiencia: nivel {{level}}, {{pct}}% hacia el {{next}}' },
  'ux.xp.tip': { en: 'Level {{level}} · {{xp}} / {{need}} XP · {{pct}}%', es: 'Nivel {{level}} · {{xp}} / {{need}} XP · {{pct}}%' },
  'ux.xp.tipLeft': { en: '{{left}} XP to level {{next}}', es: '{{left}} XP para el nivel {{next}}' },
  'ux.xp.top': { en: 'Level {{level}} · the top of the ladder', es: 'Nivel {{level}} · la cima de la escalera' },

  // The character sheet's Skills page (RuneScape's skills tab).
  'ux.skills.tab': { en: 'Skills', es: 'Habilidades' },
  'ux.skills.lead': { en: 'Every craft levels on its own, by doing it.', es: 'Cada oficio sube por su cuenta, practicandolo.' },
  'ux.skills.total': { en: 'Total level {{n}}', es: 'Nivel total {{n}}' },
  'ux.skills.toNext': { en: '{{n}} XP to {{level}}', es: '{{n}} XP para el {{level}}' },
  'ux.skills.max': { en: 'Mastered', es: 'Dominada' },
  'ux.skills.xp': { en: '{{n}} XP', es: '{{n}} XP' },

  // The HUD layout (desktop: party frames, the goal card, the chat, the minimap and the plate can be dragged).
  'ux.hud.drag': { en: 'Drag to move', es: 'Arrastra para mover' },
  'ux.hud.reset': { en: 'Reset HUD layout', es: 'Restablecer el HUD' },
  'ux.hud.resetDone': { en: 'The HUD is back where it started.', es: 'El HUD vuelve a su sitio.' },

  // The Map window.
  'ux.map.title': { en: 'Map', es: 'Mapa' },
  'ux.map.section': { en: 'Area', es: 'Zona' },
  'ux.map.surface': { en: 'Surface', es: 'Superficie' },
  'ux.map.zoomIn': { en: 'Zoom in', es: 'Acercar' },
  'ux.map.zoomOut': { en: 'Zoom out', es: 'Alejar' },
  'ux.map.centre': { en: 'Centre on me', es: 'Centrar en mi' },
  'ux.map.here': { en: 'You are here', es: 'Estas aqui' },
  'ux.map.away': { en: 'You are not on this floor', es: 'No estas en este piso' },
  'ux.map.find': { en: 'Find a place', es: 'Buscar un lugar' },
  'ux.map.noMatch': { en: 'Nothing by that name here.', es: 'Aqui no hay nada con ese nombre.' },
  'ux.map.band1': { en: 'Lv {{n}}', es: 'Nv {{n}}' },
  'ux.map.band': { en: 'Lv {{min}}-{{max}}', es: 'Nv {{min}}-{{max}}' },
  'ux.map.go': { en: 'Click a pin to go there.', es: 'Haz clic en un pin para ir.' },
  'ux.map.goTouch': { en: 'Tap a pin to go there.', es: 'Toca un pin para ir.' },
  'ux.map.legend': { en: 'Key', es: 'Leyenda' },
  'ux.map.legend.stall': { en: 'Stall or bench', es: 'Puesto o banco' },
  'ux.map.legend.hearth': { en: 'Hearth', es: 'Hogar' },
  'ux.map.legend.dungeon': { en: 'Cave or dungeon', es: 'Cueva o mazmorra' },
  'ux.map.legend.way': { en: 'Stairs or a way on', es: 'Escalera o paso' },
  'ux.map.legend.quest': { en: 'Task to hand in', es: 'Tarea para entregar' },
  'ux.map.legend.npc': { en: 'Townsfolk', es: 'Vecino' },
  'ux.map.legend.ship': { en: 'Ship', es: 'Barco' },
  'ux.map.legend.party': { en: 'Party member', es: 'Miembro del grupo' },
  'ux.map.legend.you': { en: 'You', es: 'Tu' },
  'ux.map.legend.mob': { en: 'Creature (minimap)', es: 'Criatura (minimapa)' },
  'ux.map.legend.champion': { en: 'Champion', es: 'Campeon' },
  'ux.map.legend.unique': { en: 'Unique', es: 'Unico' },
  'ux.map.legend.boss': { en: 'Boss', es: 'Jefe' },
};
