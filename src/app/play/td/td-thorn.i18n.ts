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
    en: 'A bow of the old wood: every arrow you loose hits {{pct}}% harder.',
    es: 'Un arco de madera vieja: cada flecha que sueltas golpea un {{pct}}% mas fuerte.',
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
  // ── S5's wait and S9: the rows to level 50 (skills-100.md §4) ──
  'skill.hunters-mark': { en: 'Hunter\'s Mark', es: 'Marca del cazador' },
  'skill.hunters-mark.text': {
    en: 'Mark one foe within {{range}} tiles for {{secs}} s: it takes {{pct}}% more from you and your beasts. One mark at a time.',
    es: 'Marca a un enemigo a {{range}} casillas durante {{secs}} s: recibe un {{pct}}% mas de ti y de tus bestias. Una marca a la vez.',
  },
  'skill.pinning-shot': { en: 'Pinning Shot', es: 'Disparo clavado' },
  'skill.pinning-shot.text': {
    en: 'An arrow at {{pct}}% of your Thorn Shot that pins its foe: Rooted {{root}} s and Hushed {{hush}} s (a cast in its wind-up is broken).',
    es: 'Una flecha al {{pct}}% de tu Disparo de espina que clava a su enemigo: Enraizado {{root}} s y Silenciado {{hush}} s (un conjuro a medio preparar se rompe).',
  },
  'skill.heartseeker': { en: 'Heartseeker', es: 'Buscacorazones' },
  'skill.heartseeker.text': {
    en: 'Draw for {{draw}} s, then loose one arrow at {{pct}}% of your Thorn Shot that pierces everything in its line for {{range}} tiles; ×{{marked}} on the Marked. Walking spoils the draw.',
    es: 'Tensa {{draw}} s y suelta una flecha al {{pct}}% de tu Disparo de espina que atraviesa todo lo que hay en su linea durante {{range}} casillas; ×{{marked}} sobre el Marcado. Andar estropea el tensado.',
  },
  'skill.thornrain': { en: 'Thornrain', es: 'Lluvia de espinas' },
  'skill.thornrain.text': {
    en: 'Arrows rain round the foe {{radius}} tiles wide for {{secs}} s, {{rate}} a second on random ground: each strikes what stands within a step of it for {{min}}–{{max}}.',
    es: 'Llueven flechas alrededor del enemigo a {{radius}} casillas durante {{secs}} s, {{rate}} por segundo en suelo al azar: cada una golpea lo que este a un paso con {{min}}–{{max}}.',
  },
  'skill.feral-leap': { en: 'Feral Leap', es: 'Salto feral' },
  'skill.feral-leap.text': {
    en: 'Leap {{length}} tiles away from the nearest foe; your beast bites that foe for {{pct}}% of its bite, and the foe you left is Rooted {{root}} s.',
    es: 'Salta {{length}} casillas lejos del enemigo mas cercano; tu bestia muerde a ese enemigo al {{pct}}% de su mordisco, y el enemigo que dejas queda Enraizado {{root}} s.',
  },
  'skill.elder-beast': { en: 'Elder Beast', es: 'Bestia anciana' },
  'skill.elder-beast.text': {
    en: 'Your called beast grows into an elder for {{secs}} s: it stands with {{life}}% of your life as its own, bites {{bite}}% harder, each bite strikes everything within {{radius}} tiles and taunts what it strikes onto it.',
    es: 'Tu bestia llamada crece hasta ser anciana durante {{secs}} s: tiene como vida propia el {{life}}% de la tuya, muerde un {{bite}}% mas fuerte, cada mordisco golpea todo lo que este a {{radius}} casillas y provoca a lo que golpea para que vaya a por ella.',
  },
  'skill.call-the-rain': { en: 'Call the Rain', es: 'Llamar la lluvia' },
  'skill.call-the-rain.text': {
    en: 'A rain cloud {{radius}} tiles wide hangs over the foe for {{secs}} s: everything under it is Wet, fire there burns lower and fire on the ground goes out. Where the world already rains, the cloud thunders: a strike every {{every}} s on a foe under it for {{min}}–{{max}} lightning.',
    es: 'Una nube de lluvia de {{radius}} casillas cuelga sobre el enemigo durante {{secs}} s: todo lo que hay debajo queda Mojado, el fuego alli arde menos y el fuego del suelo se apaga. Donde el mundo ya llueve, la nube truena: un rayo cada {{every}} s sobre un enemigo debajo con {{min}}–{{max}} de rayo.',
  },
  'skill.fogwalk': { en: 'Fogwalk', es: 'Paso de niebla' },
  'skill.fogwalk.text': {
    en: 'A fog bank {{radius}} tiles wide where you stand, for {{secs}} s: creatures lose you inside it past {{lose}} tiles, and their shots cannot aim in. Your first arrow from inside strikes {{first}}% harder. In the world\'s fog it costs no mana.',
    es: 'Un banco de niebla de {{radius}} casillas donde estas, durante {{secs}} s: las criaturas te pierden dentro a mas de {{lose}} casillas, y sus disparos no pueden apuntar dentro. Tu primera flecha desde dentro golpea un {{first}}% mas fuerte. Con la niebla del mundo no cuesta mana.',
  },
  'skill.lightning-call': { en: 'Lightning Call', es: 'Llamar el rayo' },
  'skill.lightning-call.text': {
    en: 'A ring marks the foe for {{tell}} s, then lightning strikes everything within {{radius}} tiles for {{min}}–{{max}}. On a Wet foe it chains to {{chain}} more (one more in a storm); in a storm its cooldown is halved.',
    es: 'Un anillo marca al enemigo durante {{tell}} s, luego un rayo golpea todo lo que este a {{radius}} casillas con {{min}}–{{max}}. Sobre un enemigo Mojado encadena a {{chain}} mas (uno mas en tormenta); en tormenta su recarga se reduce a la mitad.',
  },
};
