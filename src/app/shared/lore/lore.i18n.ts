/**
 * The lore log's pages (lore.ts), EN + ES. Lazy: registered by whoever shows a page (the character sheet, the Glass).
 */
export const LORE_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'lore.tab': { en: 'Lore', es: 'Saber' },
  'lore.lead': { en: 'Pages the realms have told you. More are found as you go.', es: 'Paginas que los reinos te han contado. Se encuentran mas por el camino.' },

  'lore.wanewalkers.kicker': { en: 'A calling not yet open', es: 'Una vocacion aun cerrada' },
  'lore.wanewalkers.title': { en: 'The Wanewalkers', es: 'Los Menguantes' },
  'lore.wanewalkers.p1': {
    en: 'When the sun went dark, a handful of Keepers walked into the eclipse instead of away from it. They came back thin: lamplight shows through them, their steps make no sound, and the Archive\'s moon-mirror will not hold their faces.',
    es: 'Cuando el sol se apago, un punado de Guardianes camino hacia el eclipse en vez de huir de el. Volvieron delgados: la luz de las lamparas los atraviesa, sus pasos no suenan y el espejo lunar del Archivo no retiene sus rostros.',
  },
  'lore.wanewalkers.p2': {
    en: 'The Dawn Archive files them among the witnesses it cannot measure, and struck their names from its rolls. The Hushed Barrow keeps no graves for them either; Sexton Wren says you cannot bury someone who only half left.',
    es: 'El Archivo del Alba los clasifica entre los testigos que no puede medir, y borro sus nombres de sus registros. El Tumulo Callado tampoco les guarda tumba; el Sacristan Wren dice que no se puede enterrar a quien solo se fue a medias.',
  },
  'lore.wanewalkers.p3': {
    en: 'They fight from the far side of the Hush: a step half out of the world lets a blow pass through them, and a cold hand lays a chill on what the living cannot touch. No Glass will make one yet. They are waiting, the old Keepers say, for someone to remember them.',
    es: 'Luchan desde el otro lado del Silencio: un paso medio fuera del mundo deja que un golpe los atraviese, y una mano fria hiela lo que los vivos no pueden tocar. Ningun Cristal crea uno todavia. Esperan, dicen los viejos Guardianes, a que alguien los recuerde.',
  },
  'lore.wanewalkers.quote': {
    en: 'The Wanewalkers walked into the eclipse and came back thin. No Glass will make one yet. (Lore: the character sheet.)',
    es: 'Los Menguantes caminaron hacia el eclipse y volvieron delgados. Ningun Cristal crea uno todavia. (Saber: la hoja de personaje.)',
  },
  'lore.locked': { en: 'A fifth calling, not yet open', es: 'Una quinta vocacion, aun cerrada' },
};
