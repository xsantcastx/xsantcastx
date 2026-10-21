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
    en: 'The lantern flares all at once: {{min}}–{{max}} light damage to every foe within {{radius}} tiles, and the dead and the dark-born stand stunned for {{stun}} seconds (a boss, a fifth of that).',
    es: 'El farol estalla de golpe: {{min}}–{{max}} de dano de luz a cada enemigo a {{radius}} casillas, y los muertos y los nacidos de la oscuridad quedan aturdidos {{stun}} segundos (un jefe, una quinta parte).',
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
    en: 'A white-hot column on one foe within {{reach}} tiles: {{min}}–{{max}} light damage. One of the dead or the dark-born left at {{below}}% life or less is unmade outright (a boss takes half again instead).',
    es: 'Una columna al rojo blanco sobre un enemigo a {{reach}} casillas: {{min}}–{{max}} de dano de luz. Un muerto o un nacido de la oscuridad que quede con el {{below}}% de vida o menos se deshace del todo (un jefe recibe la mitad mas).',
  },
  'skill.dawn-at-noon': { en: 'Dawn at Noon', es: 'Alba a mediodia' },
  'skill.dawn-at-noon.text': {
    en: 'A disc of daylight {{radius}} tiles wide for {{secs}} seconds, even at midnight, even in an eclipse: the dead and the dark-born inside burn for {{dps}} a second, the shapes in the dark are unveiled and flee, and every foe inside takes 15% more.',
    es: 'Un disco de luz de dia de {{radius}} casillas durante {{secs}} segundos, aun a medianoche, aun en un eclipse: los muertos y los nacidos de la oscuridad arden {{dps}} por segundo, las formas de la oscuridad quedan al descubierto y huyen, y cada enemigo dentro recibe un 15% mas.',
  },
  'skill.hearthlight': { en: 'Hearthlight', es: 'Luz del hogar' },
  'skill.hearthlight.text': {
    en: 'A warm glow rises from your feet: {{heal}} life back over {{secs}} seconds.',
    es: 'Un brillo calido sube desde tus pies: {{heal}} de vida en {{secs}} segundos.',
  },
  'skill.hearth-circle': { en: 'Hearth Circle', es: 'Circulo del hogar' },
  'skill.hearth-circle.text': {
    en: 'A ring of warm stones round a little fire, {{radius}} tiles wide, for {{secs}} seconds: inside it you mend {{heal}} life a second, foes walk {{slow}}% slower, and the Hush cannot rise.',
    es: 'Un anillo de piedras calidas alrededor de un fuego pequeno, de {{radius}} casillas, durante {{secs}} segundos: dentro recuperas {{heal}} de vida por segundo, los enemigos caminan un {{slow}}% mas lento y el Silencio no puede crecer.',
  },
  'skill.lantern-ward': { en: 'Lantern Ward', es: 'Guarda del farol' },
  'skill.lantern-ward.text': {
    en: 'A brass frame of hearthlight round you drinks {{absorb}} damage for {{secs}} seconds. When it breaks it flashes: every foe within {{radius}} tiles stands blinded for {{stun}} seconds.',
    es: 'Un marco de laton de luz del hogar te rodea y absorbe {{absorb}} de dano durante {{secs}} segundos. Al romperse destella: cada enemigo a {{radius}} casillas queda cegado {{stun}} segundos.',
  },
  'skill.last-light': { en: 'Last Light', es: 'Ultima luz' },
  'skill.last-light.text': {
    en: 'The Lanternwright never goes fully dark: once every {{every}} seconds a blow that would fell you leaves you at 1 life, and for {{secs}} seconds nothing can touch you.',
    es: 'El Farolero nunca se apaga del todo: una vez cada {{every}} segundos un golpe que te tumbaria te deja con 1 de vida, y durante {{secs}} segundos nada puede tocarte.',
  },
  'skill.lamp-wisp': { en: 'Lamp-Wisp', es: 'Fuego fatuo del farol' },
  'skill.lamp-wisp.text': {
    en: 'Call {{count}} lamp-wisp to your shoulder for {{secs}} seconds: it lights the dark round you and flicks a mote at a foe within {{range}} tiles each second, {{min}}–{{max}} light damage.',
    es: 'Llama a {{count}} fuego fatuo a tu hombro durante {{secs}} segundos: ilumina la oscuridad a tu alrededor y lanza una chispa a un enemigo a {{range}} casillas cada segundo, {{min}}–{{max}} de dano de luz.',
  },
  'skill.moth-kin': { en: 'Moth-Kin', es: 'Parentela de polillas' },
  'skill.moth-kin.text': {
    en: 'Glim\'s wild kin answer you: your wisps\' and your beacon\'s motes strike {{pct}}% harder.',
    es: 'La parentela salvaje de Glim te responde: las chispas de tus fuegos fatuos y de tu faro golpean un {{pct}}% mas fuerte.',
  },
  'skill.beacon': { en: 'Beacon', es: 'Faro' },
  'skill.beacon.text': {
    en: 'Plant a lantern on a pole at your feet for {{secs}} seconds: it lights the ground round it and drops a mote on a foe within {{range}} tiles each second, {{min}}–{{max}} light damage.',
    es: 'Planta un farol en un poste a tus pies durante {{secs}} segundos: ilumina el suelo a su alrededor y deja caer una chispa sobre un enemigo a {{range}} casillas cada segundo, {{min}}–{{max}} de dano de luz.',
  },

  'lamp.shut': { en: 'The lantern is shuttered. Your light burns low.', es: 'El farol esta cerrado. Tu luz arde baja.' },
  'lamp.open': { en: 'The lantern is open again.', es: 'El farol vuelve a estar abierto.' },
  'lamp.lastlight': { en: 'Last Light. You do not go dark.', es: 'Ultima luz. No te apagas.' },
  'dark.chest.shutter': { en: 'Only the dark can see it. Shutter the Lantern to let your light burn low.', es: 'Solo la oscuridad puede verlo. Cierra el farol para que tu luz arda baja.' },
};
