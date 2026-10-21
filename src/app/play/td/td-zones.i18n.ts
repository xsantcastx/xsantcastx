/**
 * The zone levels' words (td-zones.ts): the area card, the Map and the Bestiary, EN + ES. Lazy: registered by the play view.
 */
export const ZONES_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'play.zone.band': { en: 'Lv {{lo}}–{{hi}}', es: 'Nv {{lo}}–{{hi}}' },
  'play.zone.one': { en: 'Lv {{n}}', es: 'Nv {{n}}' },
  'play.zone.safe': { en: 'Safe ground', es: 'Terreno seguro' },
  'play.zone.danger': { en: 'Dangerous for your level', es: 'Peligroso para tu nivel' },
  'play.zone.mapHead': { en: 'Zone levels', es: 'Niveles de zona' },
  'play.zone.mapNote': { en: 'Creatures here are always these levels, whatever yours.', es: 'Las criaturas aqui siempre tienen estos niveles, sea cual sea el tuyo.' },
};
