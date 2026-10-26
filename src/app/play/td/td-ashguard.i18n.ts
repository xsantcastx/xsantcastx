/**
 * td-ashguard.i18n.ts — the Ashguard's book in EN + ES (td-ashguard-skills.ts): the three trees' names, each skill's
 * name and its one plain line (numbers in {{}}, so the words always match the fight), and the new vars a rank moves.
 * Registered by the play view beside HUD_I18N; keys share its `skill.` and `play.td.tree.` namespaces.
 */
export const ASHGUARD_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'play.td.tree.brand': { en: 'Brand', es: 'Marca' },
  'play.td.tree.oath': { en: 'Oath', es: 'Juramento' },
  'play.td.tree.ash': { en: 'Ash', es: 'Ceniza' },
  'play.td.tree.var.arc': { en: 'Arc (degrees)', es: 'Arco (grados)' },
  'play.td.tree.var.burn': { en: 'Burn', es: 'Quemadura' },
  'play.td.tree.var.hits': { en: 'Turns', es: 'Vueltas' },
  'play.td.tree.var.stun': { en: 'Stun (s)', es: 'Aturdimiento (s)' },
  'play.td.tree.var.block': { en: 'Blocks (%)', es: 'Bloquea (%)' },
  'play.td.tree.var.guard': { en: 'Less damage (%)', es: 'Menos dano (%)' },
  'play.td.tree.var.below': { en: 'Below life (%)', es: 'Bajo la vida (%)' },
  'play.td.tree.var.knock': { en: 'Knock back (tiles)', es: 'Empuje (casillas)' },
  'play.td.tree.var.def': { en: 'Defense', es: 'Defensa' },
  'play.td.tree.var.regen': { en: 'Life a second', es: 'Vida por segundo' },
  'play.td.tree.var.back': { en: 'Return blow (%)', es: 'Golpe de vuelta (%)' },
  'play.td.tree.var.taunt': { en: 'Taunt (s)', es: 'Provocacion (s)' },
  'play.td.tree.var.resist': { en: 'Fire resist', es: 'Resistencia al fuego' },
  'play.td.tree.var.reflect': { en: 'Blow sent back (%)', es: 'Golpe devuelto (%)' },
  'play.td.tree.var.cut': { en: 'Less damage taken (%)', es: 'Menos dano recibido (%)' },
  'play.td.tree.var.self': { en: 'Less damage to you (%)', es: 'Menos dano para ti (%)' },
  'play.td.tree.var.share': { en: 'Share you take (%)', es: 'Parte que recibes (%)' },

  'skill.watch-blade': { en: 'Watch Blade', es: 'Hoja de la Guardia' },
  'skill.watch-blade.text': {
    en: 'Your blade swings in a {{arc}}° arc in front of you, {{reach}} tiles deep: {{min}}–{{max}} damage to every foe in it. No mana.',
    es: 'Tu hoja barre un arco de {{arc}}° frente a ti, a {{reach}} casillas: {{min}}–{{max}} de dano a cada enemigo en el. Sin mana.',
  },
  'skill.ember-brand': { en: 'Ember Brand', es: 'Marca de brasa' },
  'skill.ember-brand.text': {
    en: 'For {{secs}} seconds your blade burns: every blow lands {{pct}}% harder as fire and leaves the foe burning for {{burn}} over 3 seconds.',
    es: 'Durante {{secs}} segundos tu hoja arde: cada golpe pega un {{pct}}% mas fuerte como fuego y deja al enemigo ardiendo {{burn}} en 3 segundos.',
  },
  'skill.cinder-cleave': { en: 'Cinder Cleave', es: 'Tajo de ceniza' },
  'skill.cinder-cleave.text': {
    en: 'A wide {{arc}}° cut toward your target, {{reach}} tiles deep: {{pct}}% of your blade\'s blow as fire to every foe in it.',
    es: 'Un corte ancho de {{arc}}° hacia tu objetivo, a {{reach}} casillas: el {{pct}}% del golpe de tu hoja como fuego a cada enemigo en el.',
  },
  'skill.whirl-of-cinders': { en: 'Whirl of Cinders', es: 'Torbellino de ceniza' },
  'skill.whirl-of-cinders.text': {
    en: 'You spin for {{hits}} turns, one each half second: every turn strikes every foe within {{radius}} tiles for {{pct}}% of your blade\'s blow as fire.',
    es: 'Giras {{hits}} vueltas, una cada medio segundo: cada vuelta golpea a cada enemigo a {{radius}} casillas con el {{pct}}% del golpe de tu hoja como fuego.',
  },
  'skill.shield-bash': { en: 'Shield Bash', es: 'Golpe de escudo' },
  'skill.shield-bash.text': {
    en: 'Your shield slams the foe at your side: {{min}}–{{max}} damage, and it stands stunned for {{stun}} seconds (a boss, a fifth of that).',
    es: 'Tu escudo golpea al enemigo a tu lado: {{min}}–{{max}} de dano, y queda aturdido {{stun}} segundos (un jefe, una quinta parte).',
  },
  'skill.shield-oath': { en: 'Shield Oath', es: 'Juramento del escudo' },
  'skill.shield-oath.text': {
    en: 'For {{secs}} seconds your shield turns aside {{block}}% of the blows that reach you, whole.',
    es: 'Durante {{secs}} segundos tu escudo desvia por completo el {{block}}% de los golpes que te alcanzan.',
  },
  'skill.watch-cry': { en: 'Watch Cry', es: 'Grito de la Guardia' },
  'skill.watch-cry.text': {
    en: 'Every foe within {{radius}} tiles turns on you for {{secs}} seconds (your pet and your allies are spared), and you take {{guard}}% less meanwhile.',
    es: 'Cada enemigo a {{radius}} casillas se vuelve contra ti durante {{secs}} segundos (tu mascota y tus aliados quedan a salvo), y recibes un {{guard}}% menos mientras tanto.',
  },
  'skill.hold-the-line': { en: 'Hold the Line', es: 'Mantener la linea' },
  'skill.hold-the-line.text': {
    en: 'The watch does not step back: below {{below}}% life your Defense is {{pct}}% higher.',
    es: 'La Guardia no retrocede: bajo el {{below}}% de vida tu Defensa sube un {{pct}}%.',
  },
  'skill.ash-stride': { en: 'Ash Stride', es: 'Zancada de ceniza' },
  'skill.ash-stride.text': {
    en: 'You charge up to {{reach}} tiles to your target, strike it for {{pct}}% of your blade\'s blow and knock it {{knock}} tile back (never a boss).',
    es: 'Cargas hasta {{reach}} casillas hacia tu objetivo, lo golpeas con el {{pct}}% del golpe de tu hoja y lo empujas {{knock}} casilla atras (nunca a un jefe).',
  },
  'skill.aura-watchfire': { en: 'Watchfire', es: 'Hoguera de guardia' },
  'skill.aura-watchfire.text': {
    en: 'While it runs, the Pyre Watch\'s fire keeps you: +{{def}} Defense and {{regen}} life back a second.',
    es: 'Mientras dura, el fuego de la Guardia de la Pira te guarda: +{{def}} de Defensa y {{regen}} de vida por segundo.',
  },
  'skill.ember-blood': { en: 'Ember Blood', es: 'Sangre de brasa' },
  'skill.ember-blood.text': {
    en: 'The forge runs in you: {{pct}}% of the damage you deal comes back to you as life.',
    es: 'La forja corre por ti: el {{pct}}% del dano que haces vuelve a ti como vida.',
  },
  'skill.last-watch': { en: 'Vow of the Last Watch', es: 'Voto de la ultima guardia' },
  'skill.last-watch.text': {
    en: 'For {{secs}} seconds you cannot fall below 1 life. When the vow ends, {{heal}}% of the damage it held off comes back as life.',
    es: 'Durante {{secs}} segundos no puedes bajar de 1 de vida. Al terminar el voto, el {{heal}}% del dano que contuvo vuelve como vida.',
  },
  // ── S5: the tank's kit (skills-100.md §2; all of it makes threat ×2) ──
  'skill.brand-throw': { en: 'Brand Throw', es: 'Lanzar la marca' },
  'skill.brand-throw.text': {
    en: 'Throw the branded blade at the first foe within {{range}} tiles: it strikes at {{pct}}% of your blow and Taunts it {{taunt}} seconds, then flies back through it at {{back}}%.',
    es: 'Lanza la hoja marcada al primer enemigo a {{range}} casillas: golpea al {{pct}}% de tu golpe y lo Provoca {{taunt}} segundos, y vuelve atravesandolo al {{back}}%.',
  },
  'skill.cinder-skin': { en: 'Cinder Skin', es: 'Piel de ceniza' },
  'skill.cinder-skin.text': {
    en: 'For {{secs}} seconds: +{{resist}} fire resist, and a foe that strikes you at your side takes {{reflect}}% of its blow back as fire.',
    es: 'Durante {{secs}} segundos: +{{resist}} de resistencia al fuego, y un enemigo que te golpea a tu lado recibe el {{reflect}}% de su golpe de vuelta como fuego.',
  },
  'skill.banner-of-the-watch': { en: 'Banner of the Watch', es: 'Estandarte de la guardia' },
  'skill.banner-of-the-watch.text': {
    en: 'While it runs, allies within {{radius}} tiles take {{cut}}% less damage and you take {{self}}% less. One aura at a time: this or the Watchfire.',
    es: 'Mientras dura, los aliados a {{radius}} casillas reciben un {{cut}}% menos de dano y tu un {{self}}% menos. Una sola aura a la vez: esta o el Fuego de guardia.',
  },
  'skill.second-wind': { en: 'Second Wind', es: 'Segundo aliento' },
  'skill.second-wind.text': {
    en: 'Draw breath: {{heal}}% of your life back over {{secs}} seconds.',
    es: 'Recupera el aliento: el {{heal}}% de tu vida en {{secs}} segundos.',
  },
  'skill.intercept': { en: 'Intercept', es: 'Interceptar' },
  'skill.intercept.text': {
    en: 'Dash to an ally within {{reach}} tiles. For {{secs}} seconds you take {{share}}% of the damage it takes, through your own Defense, and it takes the rest.',
    es: 'Lanzate hacia un aliado a {{reach}} casillas. Durante {{secs}} segundos recibes el {{share}}% del dano que recibe, a traves de tu Defensa, y el recibe el resto.',
  },
  'skill.hold-the-gate': { en: 'Hold the Gate', es: 'Defender la puerta' },
  'skill.hold-the-gate.text': {
    en: 'Plant the shield for {{secs}} seconds: you cannot move, you take {{cut}}% less, and every foe within {{radius}} tiles is Taunted {{taunt}} seconds, again every 2 seconds.',
    es: 'Planta el escudo durante {{secs}} segundos: no puedes moverte, recibes un {{cut}}% menos y cada enemigo a {{radius}} casillas queda Provocado {{taunt}} segundos, otra vez cada 2 segundos.',
  },
};
