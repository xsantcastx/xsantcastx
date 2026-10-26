/**
 * td-lantern.i18n.ts — the Lanternwright's book in EN + ES (td-lantern-skills.ts): the three trees' names, each skill's
 * name and its one plain line (numbers in {{}}, so the words always match the fight), the new vars a rank moves, and the
 * lantern's own lines on the message strip. Registered by the play view beside ASHGUARD_I18N.
 */
export const LANTERN_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'play.td.tree.lamp': { en: 'Lamp', es: 'Lampara' },
  'play.td.tree.hearth': { en: 'Hearth', es: 'Hogar' },
  'play.td.tree.moth': { en: 'Moth', es: 'Polilla' },
  'play.td.tree.var.light': { en: 'Light (tiles)', es: 'Luz (casillas)' },
  'play.td.tree.var.slow': { en: 'Slows (%)', es: 'Ralentiza (%)' },
  'play.td.tree.var.every': { en: 'Once every (s)', es: 'Una vez cada (s)' },

  'skill.kindle': { en: 'Kindle', es: 'Prender' },
  'skill.kindle.text': {
    en: 'Your lantern throws a flare at a foe within {{range}} tiles: {{min}}–{{max}} light damage, half again on the dead and the dark-born. No mana.',
    es: 'Tu farol lanza un destello a un enemigo a {{range}} casillas: {{min}}–{{max}} de dano de luz, la mitad mas contra los muertos y los nacidos de la oscuridad. Sin mana.',
  },
  'skill.blinding-flash': { en: 'Blinding Flash', es: 'Destello cegador' },
  'skill.blinding-flash.text': {
    en: 'The lantern flares all at once: {{min}}–{{max}} light damage to every foe within {{radius}} tiles (half again on the dead and the dark-born), and the dead and the dark-born stand stunned for {{stun}} seconds (a boss, a fifth of that).',
    es: 'El farol estalla de golpe: {{min}}–{{max}} de dano de luz a cada enemigo a {{radius}} casillas (la mitad mas contra los muertos y los nacidos de la oscuridad), y los muertos y los nacidos de la oscuridad quedan aturdidos {{stun}} segundos (un jefe, una quinta parte).',
  },
  'skill.lantern-aura': { en: 'Lantern Aura', es: 'Aura del farol' },
  'skill.lantern-aura.text': {
    en: 'While it runs your light reaches {{light}} tiles further, and every foe within {{radius}} tiles bites {{weaken}}% weaker.',
    es: 'Mientras dura tu luz llega {{light}} casillas mas lejos, y cada enemigo a {{radius}} casillas muerde un {{weaken}}% mas debil.',
  },
  'skill.shutter-lantern': { en: 'Shutter the Lantern', es: 'Cerrar el farol' },
  'skill.shutter-lantern.text': {
    en: 'Close the lantern\'s shutters, or open them again. Shut, your light burns as low as anyone\'s (the Light spell goes out too), so what only shows in the dark dares to show.',
    es: 'Cierra las contraventanas del farol, o abrelas otra vez. Cerrado, tu luz arde tan baja como la de cualquiera (el hechizo de Luz se apaga tambien), y lo que solo se muestra en la oscuridad se atreve a mostrarse.',
  },
  'skill.banish': { en: 'Banish', es: 'Desterrar' },
  'skill.banish.text': {
    en: 'A white-hot column on one foe within {{reach}} tiles: {{min}}–{{max}} light damage, half again on the dead and the dark-born. One of the dead or the dark-born left at {{below}}% life or less is unmade outright (a boss of the dead is not: it takes half again on top instead).',
    es: 'Una columna al rojo blanco sobre un enemigo a {{reach}} casillas: {{min}}–{{max}} de dano de luz, la mitad mas contra los muertos y los nacidos de la oscuridad. Un muerto o un nacido de la oscuridad que quede con el {{below}}% de vida o menos se deshace del todo (un jefe de los muertos no: recibe ademas la mitad mas).',
  },
  'skill.dawn-at-noon': { en: 'Dawn at Noon', es: 'Alba a mediodia' },
  'skill.dawn-at-noon.text': {
    en: 'A disc of daylight {{radius}} tiles wide for {{secs}} seconds, even at midnight, even in an eclipse: the dead and the dark-born inside burn for {{dps}} a second, the shapes in the dark are unveiled and flee, and every foe inside takes 15% more.',
    es: 'Un disco de luz de dia de {{radius}} casillas durante {{secs}} segundos, aun a medianoche, aun en un eclipse: los muertos y los nacidos de la oscuridad arden {{dps}} por segundo, las formas de la oscuridad quedan al descubierto y huyen, y cada enemigo dentro recibe un 15% mas.',
  },
  'skill.hearthlight': { en: 'Hearthlight', es: 'Luz del hogar' },
  'skill.hearthlight.text': {
    en: 'A warm glow rises at the feet of the lowest ally within {{reach}} tiles, you among them: {{heal}} life back over {{secs}} seconds, 3% more for every level you hold.',
    es: 'Un brillo calido sube a los pies del aliado mas herido a {{reach}} casillas, tu incluido: {{heal}} de vida en {{secs}} segundos, un 3% mas por cada nivel que tengas.',
  },
  'skill.hearth-circle': { en: 'Hearth Circle', es: 'Circulo del hogar' },
  'skill.hearth-circle.text': {
    en: 'A ring of warm stones round a little fire, {{radius}} tiles wide, for {{secs}} seconds: you and every ally inside mend {{heal}} life a second (3% more for every level you hold), foes walk {{slow}}% slower, and the Hush cannot rise.',
    es: 'Un anillo de piedras calidas alrededor de un fuego pequeno, de {{radius}} casillas, durante {{secs}} segundos: tu y cada aliado dentro recuperais {{heal}} de vida por segundo (un 3% mas por cada nivel que tengas), los enemigos caminan un {{slow}}% mas lento y el Silencio no puede crecer.',
  },
  'skill.lantern-ward': { en: 'Lantern Ward', es: 'Guarda del farol' },
  'skill.lantern-ward.text': {
    en: 'A brass frame of hearthlight round the lowest ally within {{reach}} tiles (you, alone) drinks {{absorb}} damage for {{secs}} seconds. When yours breaks it flashes: every foe within {{radius}} tiles stands blinded for {{stun}} seconds.',
    es: 'Un marco de laton de luz del hogar rodea al aliado mas herido a {{reach}} casillas (a ti, si estas solo) y absorbe {{absorb}} de dano durante {{secs}} segundos. Al romperse el tuyo destella: cada enemigo a {{radius}} casillas queda cegado {{stun}} segundos.',
  },
  'skill.last-light': { en: 'Last Light', es: 'Ultima luz' },
  'skill.last-light.text': {
    en: 'The Lanternwright never goes fully dark: once every {{every}} seconds a blow that would fell you leaves you at 1 life, and for {{secs}} seconds nothing can touch you.',
    es: 'El Farolero nunca se apaga del todo: una vez cada {{every}} segundos un golpe que te tumbaria te deja con 1 de vida, y durante {{secs}} segundos nada puede tocarte.',
  },
  'skill.lamp-wisp': { en: 'Lamp-Wisp', es: 'Fuego fatuo del farol' },
  'skill.lamp-wisp.text': {
    en: 'Call {{count}} lamp-wisp(s) to your shoulder for {{secs}} seconds: each lights the dark round you and flicks a mote at a foe within {{range}} tiles each second, {{min}}–{{max}} light damage (half again on the dead and the dark-born).',
    es: 'Llama a {{count}} fuego(s) fatuo(s) a tu hombro durante {{secs}} segundos: cada uno ilumina la oscuridad a tu alrededor y lanza una chispa a un enemigo a {{range}} casillas cada segundo, {{min}}–{{max}} de dano de luz (la mitad mas contra los muertos y los nacidos de la oscuridad).',
  },
  'skill.moth-kin': { en: 'Moth-Kin', es: 'Parentela de polillas' },
  'skill.moth-kin.text': {
    en: 'Glim\'s wild kin answer you: your wisps\' and your beacon\'s motes strike {{pct}}% harder.',
    es: 'La parentela salvaje de Glim te responde: las chispas de tus fuegos fatuos y de tu faro golpean un {{pct}}% mas fuerte.',
  },
  'skill.beacon': { en: 'Beacon', es: 'Faro' },
  'skill.beacon.text': {
    en: 'Plant a lantern on a pole at your feet for {{secs}} seconds: it lights the ground round it and drops a mote on a foe within {{range}} tiles each second, {{min}}–{{max}} light damage (half again on the dead and the dark-born).',
    es: 'Planta un farol en un poste a tus pies durante {{secs}} segundos: ilumina el suelo a su alrededor y deja caer una chispa sobre un enemigo a {{range}} casillas cada segundo, {{min}}–{{max}} de dano de luz (la mitad mas contra los muertos y los nacidos de la oscuridad).',
  },

  'lamp.shut': { en: 'The lantern is shuttered. Your light burns low.', es: 'El farol esta cerrado. Tu luz arde baja.' },
  'lamp.open': { en: 'The lantern is open again.', es: 'El farol vuelve a estar abierto.' },
  'lamp.lastlight': { en: 'Last Light. You do not go dark.', es: 'Ultima luz. No te apagas.' },
  'dark.chest.shutter': { en: 'Only the dark can see it. Shutter the Lantern to let your light burn low.', es: 'Solo la oscuridad puede verlo. Cierra el farol para que tu luz arda baja.' },
  'play.td.tree.var.immune': { en: 'Grace (s)', es: 'Gracia (s)' },
  'play.td.tree.var.channel': { en: 'Kneel (s)', es: 'De rodillas (s)' },
  'play.td.tree.var.window': { en: 'After a fall (s)', es: 'Tras una caida (s)' },
  'play.td.tree.var.flat': { en: 'Life each pulse', es: 'Vida por pulso' },
  // ── S5: the healer's kit (skills-100.md §3) ──
  'skill.cleanse': { en: 'Cleanse', es: 'Purificar' },
  'skill.cleanse.text': {
    en: 'Lifts every Burn, Chill, Freeze, Bleed, Root, Stun, Blind and Weaken from the lowest ally within {{reach}} tiles (you, alone), never Wet; for {{immune}} seconds after, none of them takes hold again.',
    es: 'Quita toda Quemadura, Escarcha, Congelacion, Sangrado, Enraizado, Aturdido, Ceguera y Debilidad del aliado mas herido a {{reach}} casillas (a ti, si estas solo), nunca Mojado; durante {{immune}} segundos despues, ninguno vuelve a prender.',
  },
  'skill.rekindle': { en: 'Rekindle', es: 'Reavivar' },
  'skill.rekindle.text': {
    en: 'Kneel {{channel}} seconds where a party member fell, within {{window}} seconds of the fall and {{reach}} tiles of the spot: they stand up there with {{pct}}% of their life, and the fall costs them nothing. A blow breaks the kneel.',
    es: 'Arrodillate {{channel}} segundos donde cayo un companero, antes de {{window}} segundos de la caida y a {{reach}} casillas del sitio: se levanta alli con el {{pct}}% de su vida, y la caida no le cuesta nada. Un golpe rompe el arrodillarse.',
  },
  'skill.hearthsong': { en: 'Hearthsong', es: 'Cancion del hogar' },
  'skill.hearthsong.text': {
    en: 'Sing up to {{secs}} seconds, standing still, mana every second: every half second you and every ally within {{radius}} tiles mend {{heal}}% of their life and {{flat}} more. A blow ends the song.',
    es: 'Canta hasta {{secs}} segundos, quieto, gastando mana cada segundo: cada medio segundo tu y cada aliado a {{radius}} casillas recuperais el {{heal}}% de vuestra vida y {{flat}} mas. Un golpe acaba la cancion.',
  },
};
