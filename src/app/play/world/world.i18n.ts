/**
 * world.i18n.ts — the room-run world (Hearth protocol 7; docs/design/online.md "Phase 8"), EN + ES. Lazy: registered
 * by the play view. Said when the room answers a reach for a piece of its ground with a no.
 */
export const WORLD_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'world.take.gone': { en: 'Someone else picked that up.', es: 'Alguien más lo recogió.' },
  'world.take.owned': { en: 'That loot is still theirs for a moment.', es: 'Ese botín aún es suyo un momento.' },
  'world.take.far': { en: 'Too far away to reach that.', es: 'Demasiado lejos para alcanzarlo.' },
  'world.take.offline': { en: 'The hearth did not answer. It stays on the ground.', es: 'El hogar no respondió. Sigue en el suelo.' },
  'world.take.full': { en: 'Your satchel is full. It stays on the ground.', es: 'Tu morral está lleno. Sigue en el suelo.' },
};
