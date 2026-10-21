/**
 * Spellstones and Soul (spellstones.model.ts), EN + ES. Lazy: registered by the play view and the vendor's counter,
 * never by the app shell's eager table. The Seamworks' voice: practical, a little proud of its stone.
 */
export const SPELLSTONES_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Soul, by the mana bar ──
  'play.stone.soul': { en: 'Soul', es: 'Alma' },
  'play.stone.soulAria': { en: 'Soul: {{n}} of {{cap}}', es: 'Alma: {{n}} de {{cap}}' },
  'play.stone.soulTitle': { en: 'Soul {{n}}/{{cap}}: kills near your level give it; Spellstones are inscribed with it.', es: 'Alma {{n}}/{{cap}}: las presas cerca de tu nivel la dan; con ella se inscriben Piedras de hechizo.' },
  // ── The belt's Spellstone slot ──
  'play.stone.slot': { en: 'Spellstone', es: 'Piedra de hechizo' },
  'play.stone.slotTitle': { en: '{{name}} Spellstone · rank {{rank}} · {{n}} charges (F)', es: 'Piedra de {{name}} · rango {{rank}} · {{n}} cargas (F)' },
  'play.stone.slotEmpty': { en: 'No Spellstone on the belt. Inscribe one in the Spellbook (K).', es: 'No hay piedra en el cinturon. Inscribe una en el Libro de hechizos (K).' },
  'play.stone.cast': { en: '{{name}}, from the stone (rank {{rank}}). {{n}} charges left.', es: '{{name}}, desde la piedra (rango {{rank}}). Quedan {{n}} cargas.' },
  'play.stone.spent': { en: 'The {{name}} Spellstone crumbles to grit. It gave all it had.', es: 'La piedra de {{name}} se deshace en arena. Dio todo lo que tenia.' },
  'play.stone.cooldown': { en: 'The last stone is still warm.', es: 'La ultima piedra sigue caliente.' },
  // ── Inscribing, in the Spellbook ──
  'play.stone.title': { en: 'Spellstone', es: 'Piedra de hechizo' },
  'play.stone.inscribe': { en: 'Inscribe · 1 Blank + {{soul}} Soul', es: 'Inscribir · 1 bloque + {{soul}} de Alma' },
  'play.stone.gives': { en: '{{n}} charges at rank {{rank}}. No mana; any vocation can use it.', es: '{{n}} cargas a rango {{rank}}. Sin mana; cualquier vocacion puede usarla.' },
  'play.stone.have': { en: '{{blanks}} Basalt Blanks · {{soul}} Soul · {{held}} charges held', es: '{{blanks}} bloques de basalto · {{soul}} de Alma · {{held}} cargas guardadas' },
  'play.stone.belt': { en: 'Put on the belt (F)', es: 'Al cinturon (F)' },
  'play.stone.onBelt': { en: 'On the belt (F)', es: 'En el cinturon (F)' },
  'play.stone.inscribed': { en: 'The cant takes in the basalt: {{name}}, rank {{rank}}, {{n}} charges.', es: 'El canto prende en el basalto: {{name}}, rango {{rank}}, {{n}} cargas.' },
  'play.stone.need.blank': { en: 'No Basalt Blank. Creatures drop them; Edrin Kade sells them.', es: 'No tienes bloque de basalto. Las criaturas los sueltan; Edrin Kade los vende.' },
  'play.stone.need.soul': { en: 'Not enough Soul (needs {{n}}). Kills near your level give Soul.', es: 'No tienes Alma suficiente (hacen falta {{n}}). Las presas cerca de tu nivel dan Alma.' },
  'play.stone.need.rank': { en: 'Learn the spell first: a stone keeps the rank you hold.', es: 'Aprende el hechizo primero: la piedra guarda el rango que tienes.' },
  'play.stone.lore': { en: 'The Seamworks scribes cut the cant into basalt because basalt remembers being fire.', es: 'Los escribas de Seamworks tallan el canto en basalto porque el basalto recuerda haber sido fuego.' },
  'play.stone.pouch': { en: 'Stone pouch', es: 'Bolsa de piedras' },
  // ── The blank at Edrin Kade's counter ──
  'vendor.blank.does': { en: 'Cut to take the cant: inscribe it in the Spellbook with a ranked spell and Soul.', es: 'Tallado para el canto: inscribelo en el Libro de hechizos con un hechizo aprendido y Alma.' },
};
