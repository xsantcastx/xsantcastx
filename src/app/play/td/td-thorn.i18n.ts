/**
 * td-thorn.i18n.ts — the Thornstrider's book in EN + ES (td-thorn-skills.ts): the three trees' names, each skill's name
 * and its one plain line (numbers in {{}}, so the words always match the fight), the new vars a rank moves, the spirit
 * beast's name and the ranger's lines on the message strip. Registered by the play view beside LANTERN_I18N.
 */
export const THORN_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'play.td.tree.thorn': { en: 'Thorn', es: 'Espina' },
  'play.td.tree.wild': { en: 'Wild', es: 'Salvaje' },
  'play.td.tree.briar': { en: 'Briar', es: 'Zarza' },
  'play.td.tree.var.pierce': { en: 'Pierce chance (%)', es: 'Probabilidad de atravesar (%)' },
  'play.td.tree.var.root': { en: 'Roots (s)', es: 'Enraiza (s)' },
  'play.pet.name.spirit-beast': { en: 'Spirit beast', es: 'Bestia espiritu' },
  'thorn.spirit': {
    en: 'No pet walks with you: a spirit beast of the wild stands in.',
    es: 'Ninguna mascota te acompana: una bestia espiritu de lo salvaje ocupa su lugar.',
  },

  'skill.thorn-shot': { en: 'Thorn Shot', es: 'Disparo de espina' },
  'skill.thorn-shot.text': {
    en: 'Your bow looses an arrow at a foe within {{range}} tiles: {{min}}–{{max}} damage, a short knock back, and a {{pierce}}% chance it goes clean through to the next foe behind. No mana.',
    es: 'Tu arco suelta una flecha a un enemigo a {{range}} casillas: {{min}}–{{max}} de dano, un pequeno empuje, y un {{pierce}}% de que lo atraviese hasta el siguiente enemigo detras. Sin mana.',
  },
  'skill.barbed-shot': { en: 'Barbed Shot', es: 'Disparo dentado' },
  'skill.barbed-shot.text': {
    en: 'A barbed arrow: {{min}}–{{max}} damage, and the foe bleeds {{dps}} a second for {{secs}} seconds. A second barb keeps the longer, harder bleed.',
    es: 'Una flecha dentada: {{min}}–{{max}} de dano, y el enemigo sangra {{dps}} por segundo durante {{secs}} segundos. Una segunda pua conserva el sangrado mas largo y mas fuerte.',
  },
  'skill.volley': { en: 'Volley', es: 'Andanada' },
  'skill.volley.text': {
    en: '{{count}} arrows at once in a fan toward a foe, {{min}}–{{max}} damage each, every arrow striking the first foe in its line.',
    es: '{{count}} flechas a la vez en abanico hacia un enemigo, {{min}}–{{max}} de dano cada una, cada flecha golpea al primer enemigo en su linea.',
  },
  'skill.heartwood': { en: 'Heartwood', es: 'Duramen' },
  'skill.heartwood.text': {
    en: 'A bow of the old wood: every arrow you loose hits {{pct}}% harder and is {{pierce}}% likelier to pierce.',
    es: 'Un arco de madera vieja: cada flecha que sueltas golpea un {{pct}}% mas fuerte y tiene un {{pierce}}% mas de atravesar.',
  },
  'skill.command': { en: 'Command', es: 'Ordenar' },
  'skill.command.text': {
    en: 'Point and send your beast at a foe: for {{secs}} seconds it runs to it wherever it is, bites {{pct}}% harder and more often, and a tired beast gets back up.',
    es: 'Senala y lanza a tu bestia contra un enemigo: durante {{secs}} segundos corre hacia el donde este, muerde un {{pct}}% mas fuerte y mas a menudo, y una bestia cansada se levanta.',
  },
  'skill.pack-bond': { en: 'Pack Bond', es: 'Lazo de manada' },
  'skill.pack-bond.text': {
    en: 'While it runs and your beast is within {{radius}} tiles, the two of you share the blows: each takes {{guard}}% less, and every beast of yours bites {{pct}}% harder.',
    es: 'Mientras dura y tu bestia esta a {{radius}} casillas, los dos os repartis los golpes: cada uno recibe un {{guard}}% menos, y cada bestia tuya muerde un {{pct}}% mas fuerte.',
  },
  'skill.call-of-the-wilds': { en: 'Call of the Wilds', es: 'Llamada de lo salvaje' },
  'skill.call-of-the-wilds.text': {
    en: 'A second beast answers out of the green for {{secs}} seconds: it hunts beside your own, {{min}}–{{max}} a bite.',
    es: 'Una segunda bestia responde desde la espesura durante {{secs}} segundos: caza junto a la tuya, {{min}}–{{max}} por mordisco.',
  },
  'skill.wild-heart': { en: 'Wild Heart', es: 'Corazon salvaje' },
  'skill.wild-heart.text': {
    en: 'Every beast that runs with you — your pet, a called beast, the stampede — strikes {{pct}}% harder.',
    es: 'Cada bestia que corre contigo —tu mascota, una bestia llamada, la estampida— golpea un {{pct}}% mas fuerte.',
  },
  'skill.stampede': { en: 'Stampede', es: 'Estampida' },
  'skill.stampede.text': {
    en: 'The wild runs through: {{count}} spectral beasts charge {{length}} tiles from behind you toward a foe, {{min}}–{{max}} to each foe they trample and a knock back of {{knock}} tile.',
    es: 'Lo salvaje pasa en tromba: {{count}} bestias espectrales cargan {{length}} casillas desde detras de ti hacia un enemigo, {{min}}–{{max}} a cada enemigo que pisotean y un empuje de {{knock}} casilla.',
  },
  'skill.thornroot-snare': { en: 'Thornroot Snare', es: 'Lazo de raiz espinosa' },
  'skill.thornroot-snare.text': {
    en: 'Thorned roots break the ground in a line {{length}} tiles long across a foe\'s path for {{secs}} seconds: whatever crosses takes {{min}}–{{max}} and is rooted {{root}} seconds (a boss, a fifth of that).',
    es: 'Raices espinosas rompen el suelo en una linea de {{length}} casillas en el camino de un enemigo durante {{secs}} segundos: lo que la cruza recibe {{min}}–{{max}} y queda enraizado {{root}} segundos (un jefe, una quinta parte).',
  },
  'skill.bramble-trap': { en: 'Bramble Trap', es: 'Trampa de zarzas' },
  'skill.bramble-trap.text': {
    en: 'Hide a trap at your feet for {{secs}} seconds (two at most): the first foe to step on it springs it — {{min}}–{{max}} to all within {{radius}} tiles, rooted {{root}} seconds.',
    es: 'Esconde una trampa a tus pies durante {{secs}} segundos (dos como mucho): el primer enemigo que la pisa la dispara — {{min}}–{{max}} a todos a {{radius}} casillas, enraizados {{root}} segundos.',
  },
  'skill.rootwalk': { en: 'Rootwalk', es: 'Paso de raiz' },
  'skill.rootwalk.text': {
    en: 'For {{secs}} seconds the forest opens in front of you and closes behind: you walk {{pct}}% faster and creatures lose your track.',
    es: 'Durante {{secs}} segundos el bosque se abre delante de ti y se cierra detras: caminas un {{pct}}% mas rapido y las criaturas pierden tu rastro.',
  },
};
