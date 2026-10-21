/**
 * game-menu.i18n.ts: the Game Menu (Esc, or the Menu button): its groups and the lines under rows that had none, EN + ES.
 * Lazy: registered by the play view.
 */
export const GAME_MENU_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'menu.title': { en: 'Menu', es: 'Menu' },
  'menu.group.world': { en: 'World', es: 'Mundo' },
  'menu.group.character': { en: 'Character', es: 'Personaje' },
  'menu.group.social': { en: 'Social', es: 'Social' },
  'menu.group.settings': { en: 'Settings', es: 'Ajustes' },
  'menu.map': { en: 'Map', es: 'Mapa' },
  'menu.mapBlurb': { en: 'Where you are, and the places you can walk to.', es: 'Donde estas y los lugares a los que puedes ir.' },
  'menu.bestiaryBlurb': { en: 'Every creature you have met, and what it drops.', es: 'Cada criatura que has encontrado y lo que suelta.' },
  'menu.loreBlurb': { en: 'The pages of the world you have found.', es: 'Las paginas del mundo que has encontrado.' },
  'menu.resetHudBlurb': { en: 'Put the movable windows back where they started.', es: 'Devuelve las ventanas movibles a su lugar original.' },
};
