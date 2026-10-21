/**
 * The Cold Hearth's words (lighting a hearth, waking by one, the Ember debt, the Hearth Shrine's five blessings),
 * EN + ES. Lazy: registered by the play view and the shrine, never by the app shell's eager table.
 * Cozy, a little ominous: the dark took something, the hearth gave you back.
 */
export const COLD_HEARTH_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Lighting a hearth ──
  'play.coldHearth.act.light': { en: 'Light the hearth', es: 'Encender el hogar' },
  'play.coldHearth.act.again': { en: 'Wake here again', es: 'Despertar aqui de nuevo' },
  'play.coldHearth.act.warm': { en: 'Warm your hands', es: 'Calentarte las manos' },
  'play.coldHearth.act.shrine': { en: 'Hearth Shrine', es: 'Santuario del hogar' },
  'play.coldHearth.lit.first': { en: 'The hearth at {{town}} takes your flame. Whatever finds you out there, you wake here.', es: 'El hogar de {{town}} acepta tu llama. Pase lo que pase ahi fuera, despertaras aqui.' },
  'play.coldHearth.lit.again': { en: 'The hearth at {{town}} knows your hand. You will wake here.', es: 'El hogar de {{town}} conoce tu mano. Despertaras aqui.' },
  'play.coldHearth.lit.glim': { en: 'Warm. I will remember the way back.', es: 'Calido. Recordare el camino de vuelta.' },
  // ── Waking ──
  'play.coldHearth.wake.title': { en: 'You wake by the hearth', es: 'Despiertas junto al hogar' },
  'play.coldHearth.wake.where': { en: '{{town}}. Someone kept the fire in for you.', es: '{{town}}. Alguien mantuvo el fuego para ti.' },
  'play.coldHearth.wake.square': { en: 'The square, cold stone under you. Light a hearth and it will keep you.', es: 'La plaza, piedra fria bajo ti. Enciende un hogar y te guardara.' },
  'play.coldHearth.wake.grace': { en: 'Under level {{n}} the dark only borrows you. Nothing is lost but the walk.', es: 'Antes del nivel {{n}} la oscuridad solo te toma prestado. No pierdes nada salvo el camino.' },
  'play.coldHearth.wake.purse': { en: '{{n}} Gold lies where you fell. Walk back for it before the dark does.', es: '{{n}} de Oro yace donde caiste. Vuelve a por el antes que la oscuridad.' },
  'play.coldHearth.wake.noPurse': { en: 'Your purse came home whole.', es: 'Tu bolsa volvio entera.' },
  'play.coldHearth.wake.debt': { en: 'Ember debt: {{n}} XP. Half of each kill pays it back. No level is ever lost.', es: 'Deuda de brasa: {{n}} XP. La mitad de cada presa la paga. Nunca pierdes un nivel.' },
  'play.coldHearth.wake.blessed': { en: '{{n}} of your blessings burned away to soften the fall.', es: '{{n}} de tus bendiciones se consumieron para suavizar la caida.' },
  'play.coldHearth.wake.ok': { en: 'Sit. Soup first.', es: 'Sientate. Primero, sopa.' },
  // ── The Ember debt ──
  'play.coldHearth.debt.hud': { en: 'Ember debt', es: 'Deuda de brasa' },
  'play.coldHearth.debt.aria': { en: 'Ember debt: {{n}} XP still owed', es: 'Deuda de brasa: faltan {{n}} XP' },
  'play.coldHearth.debt.sheet': { en: 'Ember debt: {{n}} XP. Half of each kill pays it back; you never lose a level.', es: 'Deuda de brasa: {{n}} XP. La mitad de cada presa la paga; nunca pierdes un nivel.' },
  'play.coldHearth.debt.paid': { en: '+{{n}} XP ({{paid}} to the Ember debt)', es: '+{{n}} XP ({{paid}} a la deuda de brasa)' },
  'play.coldHearth.debt.clear': { en: 'The Ember debt is paid. The cold lets go of you.', es: 'La deuda de brasa esta pagada. El frio te suelta.' },
  // ── The shrine ──
  'play.coldHearth.shrine.title': { en: 'Hearth Shrine', es: 'Santuario del hogar' },
  'play.coldHearth.shrine.lead': { en: 'Each realm keeps a fire for the Keeper. The first five did not come home, so the realms decided the sixth would.', es: 'Cada reino guarda un fuego para el Guardian. Los cinco primeros no volvieron, asi que los reinos decidieron que el sexto si.' },
  'play.coldHearth.shrine.rule': { en: 'Each blessing takes a fifth off what a fall costs: the Gold left where you fell and the Ember debt. All five, and a fall costs only the walk. A fall burns every blessing you hold.', es: 'Cada bendicion quita una quinta parte de lo que cuesta una caida: el Oro que dejas donde caes y la deuda de brasa. Con las cinco, una caida solo cuesta el camino. Una caida consume todas las que tengas.' },
  'play.coldHearth.shrine.grace': { en: 'Under level {{n}} a fall costs nothing but the walk. Come back when the dark has learned your name.', es: 'Antes del nivel {{n}} una caida solo cuesta el camino. Vuelve cuando la oscuridad sepa tu nombre.' },
  'play.coldHearth.shrine.held': { en: '{{n}} of 5 kindled', es: '{{n}} de 5 encendidas' },
  'play.coldHearth.shrine.kindle': { en: 'Kindle · {{n}} Gold', es: 'Encender · {{n}} de Oro' },
  'play.coldHearth.shrine.kindled': { en: 'Kindled', es: 'Encendida' },
  'play.coldHearth.shrine.bought': { en: '{{name}} is kindled. It will burn for you once.', es: '{{name}} esta encendida. Ardera por ti una vez.' },
  'play.coldHearth.shrine.noGold': { en: 'Not enough Gold. The hunt pays it.', es: 'No tienes Oro suficiente. La caza lo paga.' },
  'play.coldHearth.shrine.help': { en: 'What the blessings do', es: 'Que hacen las bendiciones' },
  // ── The five blessings ──
  'play.coldHearth.bless.pyre.name': { en: 'Pyre Ember', es: 'Brasa de la Pira' },
  'play.coldHearth.bless.pyre.blurb': { en: 'Pyrehold\'s coal, carried in a clay cup.', es: 'Carbon de Pyrehold, en una taza de barro.' },
  'play.coldHearth.bless.root.name': { en: 'Rootglass Sap', es: 'Savia de Rootglass' },
  'play.coldHearth.bless.root.blurb': { en: 'A bead of warm sap from the Bole\'s heart.', es: 'Una gota de savia tibia del corazon del Bole.' },
  'play.coldHearth.bless.gloam.name': { en: 'Gloam Lantern-wick', es: 'Mecha de Gloam' },
  'play.coldHearth.bless.gloam.blurb': { en: 'Gloamhaven trims a wick for every Keeper it waits for.', es: 'Gloamhaven recorta una mecha por cada Guardian al que espera.' },
  'play.coldHearth.bless.meridian.name': { en: 'Meridian Star-salt', es: 'Sal estelar de Meridian' },
  'play.coldHearth.bless.meridian.blurb': { en: 'A pinch of fallen star, salted on the coals.', es: 'Una pizca de estrella caida, sobre las brasas.' },
  'play.coldHearth.bless.dawn.name': { en: 'Dawnspire Morning', es: 'Alba de Dawnspire' },
  'play.coldHearth.bless.dawn.blurb': { en: 'The first light of a day, folded and kept.', es: 'La primera luz de un dia, doblada y guardada.' },
};
