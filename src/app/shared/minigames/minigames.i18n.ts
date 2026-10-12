/**
 * minigames.i18n.ts — copy for the anvil game and the rune ritual. Lazy:
 * registered by each game component, checked by scripts/check-i18n-keys.js.
 */
export const MINIGAMES_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // Anvil
  'minigame.anvil.title':      { en: 'Strike the anvil', es: 'Golpea el yunque' },
  'minigame.anvil.how':        { en: 'Press Strike when the spark is in the bright middle.', es: 'Pulsa Golpear cuando la chispa este en el centro brillante.' },
  'minigame.anvil.strike':     { en: 'Strike!', es: '¡Golpear!' },
  'minigame.anvil.count':      { en: 'Strike {{n}} of {{total}}', es: 'Golpe {{n}} de {{total}}' },
  'minigame.anvil.bar':        { en: 'Heat bar', es: 'Barra de calor' },
  'minigame.anvil.skip':       { en: 'Skip the game', es: 'Saltar el juego' },
  'minigame.anvil.skipToggle': { en: 'Skip the anvil game (no bonus)', es: 'Saltar el juego del yunque (sin bonus)' },
  'minigame.anvil.result':     { en: 'Quality {{q}}% — {{verdict}}', es: 'Calidad {{q}}% — {{verdict}}' },
  'minigame.anvil.masterful':  { en: 'masterful!', es: '¡magistral!' },
  'minigame.anvil.fine':       { en: 'fine work', es: 'buen trabajo' },
  'minigame.anvil.rough':      { en: 'rough, but it holds', es: 'tosco, pero aguanta' },
  'minigame.anvil.xp':         { en: '+{{n}} Smithing XP', es: '+{{n}} XP de Herreria' },
  'minigame.anvil.bonusNote':  { en: 'Good strikes push the roll toward the top of its range and earn Smithing XP.', es: 'Los buenos golpes acercan la tirada a lo alto de su rango y dan XP de Herreria.' },
  'minigame.grade.perfect':    { en: 'Perfect!', es: '¡Perfecto!' },
  'minigame.grade.good':       { en: 'Good', es: 'Bien' },
  'minigame.grade.off':        { en: 'Off', es: 'Fallo' },
  // Ritual
  'minigame.ritual.title':     { en: 'The rune ritual', es: 'El ritual de la runa' },
  'minigame.ritual.place':     { en: 'Drag the rune onto the glowing circle — or just tap it.', es: 'Arrastra la runa al circulo brillante, o simplemente tocala.' },
  'minigame.ritual.pulse':     { en: 'Tap the circle when the light touches the gold ring.', es: 'Toca el circulo cuando la luz toque el anillo dorado.' },
  'minigame.ritual.confirm':   { en: 'Set the rune into the circle.', es: 'Coloca la runa en el circulo.' },
  'minigame.ritual.setBtn':    { en: 'Set the rune', es: 'Colocar la runa' },
  'minigame.ritual.circle':    { en: 'Ritual circle — tap now', es: 'Circulo ritual: toca ahora' },
  'minigame.ritual.rune':      { en: 'Place {{name}} on the circle', es: 'Coloca {{name}} en el circulo' },
  'minigame.ritual.miss':      { en: 'Almost! The light slipped — try again. Nothing was lost.', es: '¡Casi! La luz se escapo: intentalo otra vez. No perdiste nada.' },
  'minigame.ritual.hit':       { en: 'The rune takes hold!', es: '¡La runa se asienta!' },
  'minigame.ritual.cancel':    { en: 'Cancel', es: 'Cancelar' },
  'minigame.ritual.xp':        { en: '+{{n}} Enchanting XP', es: '+{{n}} XP de Encantamiento' },
};
