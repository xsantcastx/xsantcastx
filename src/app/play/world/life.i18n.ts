/**
 * life.i18n.ts: name tags and one-line chatter for the town keepers (world/life.ts).
 * Lazy: registered by the side-scroller (play chunk), checked by
 * scripts/check-i18n-keys.js.
 *
 * Canon keepers (Kael, the Merchant, Aureth, Verrin, the Archivist) say only
 * lines their character already says in npc.model.ts DIALOGUE; the engine
 * harness checks the English matches word for word. Role keepers carry role
 * titles only: personal names for the invented roles are not approved.
 */
export const LIFE_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Name tags ──
  'play.life.name.buyback-clerk': { en: 'Buyback Clerk', es: 'Comprador de materiales' },
  'play.life.name.bench-smith': { en: 'Bench Smith', es: 'Herrero del banco' },
  'play.life.name.kael': { en: 'Kael', es: 'Kael' },
  'play.life.name.enchanter': { en: 'Enchanter', es: 'Encantador' },
  'play.life.name.merchant': { en: 'The Merchant', es: 'El Mercader' },
  'play.life.name.aureth': { en: 'Aureth', es: 'Aureth' },
  'play.life.name.croupier': { en: 'Croupier', es: 'Crupier' },
  'play.life.name.broker': { en: 'Exchange Broker', es: 'Corredor de la Lonja' },
  'play.life.name.verrin': { en: 'Verrin', es: 'Verrin' },
  'play.life.name.archivist': { en: 'The Archivist', es: 'El Archivista' },
  'play.life.name.chart-clerk': { en: 'Chart Clerk', es: 'Escribano de las cartas' },
  'play.life.name.steward': { en: 'Expedition Steward', es: 'Intendente de expediciones' },
  'play.life.name.herald': { en: 'Board Herald', es: 'Heraldo del tablon' },
  'play.life.name.gatekeeper': { en: 'Arena Gatekeeper', es: 'Guardian de la arena' },
  'play.life.name.trials-warden': { en: 'Trials Warden', es: 'Custodio de las pruebas' },
  'play.life.name.lodge-warden': { en: 'Lodge Warden', es: 'Custodio del refugio' },

  // ── Infernal: Basalt Seamworks ──
  'play.life.line.buyback-clerk.1': { en: 'I buy what you carry. Selling is the Market\'s trade, not mine.', es: 'Compro lo que cargas. Vender es oficio del Mercado, no mio.' },
  'play.life.line.buyback-clerk.2': { en: 'Surplus ore weighs on a satchel. Let it weigh on my scales.', es: 'El mineral de sobra pesa en la bolsa. Deja que pese en mi balanza.' },
  'play.life.line.bench-smith.1': { en: 'Bring materials. The bench turns them into gear.', es: 'Trae materiales. El banco los convierte en equipo.' },
  'play.life.line.bench-smith.2': { en: 'Measure twice. The bench does not forgive a wasted ingot.', es: 'Mide dos veces. El banco no perdona un lingote perdido.' },
  'play.life.line.kael.1': { en: 'Every rune in here was somebody\'s bad week made useful.', es: 'Cada runa de aqui fue la mala semana de alguien, vuelta util.' },
  'play.life.line.kael.2': { en: 'Set the runes together and they stop being trinkets. That is the whole trick.', es: 'Junta las runas y dejan de ser baratijas. Ese es todo el truco.' },
  'play.life.line.enchanter.1': { en: 'A rune in a socket is a promise the gear has to keep.', es: 'Una runa engarzada es una promesa que el equipo debe cumplir.' },
  'play.life.line.enchanter.2': { en: 'Infusions fade. Sockets remember.', es: 'Las infusiones se apagan. Los engarces recuerdan.' },

  // ── Luminous: Heliograph Court ──
  'play.life.line.merchant.1': { en: 'Everything on this shelf is fairly priced. Fairly. To me.', es: 'Todo en este estante tiene un precio justo. Justo. Para mi.' },
  'play.life.line.merchant.2': { en: 'You are browsing. Browsing is free. Everything after browsing is not.', es: 'Estas mirando. Mirar es gratis. Todo lo que viene despues, no.' },
  'play.life.line.aureth.1': { en: 'Light is not a thing you are given. It is a thing you keep lit.', es: 'La luz no es algo que te dan. Es algo que mantienes encendido.' },
  'play.life.line.aureth.2': { en: 'The crystals need your hand, Convergent.', es: 'Los cristales necesitan tu mano, Convergente.' },

  // ── Umbral: Nocturne Archive ──
  'play.life.line.croupier.1': { en: 'Sealed boxes. Printed odds. Open one.', es: 'Cajas selladas. Probabilidades impresas. Abre una.' },
  'play.life.line.croupier.2': { en: 'What the box hands you and you do not want, the house buys back.', es: 'Lo que la caja te da y no quieres, la casa lo recompra.' },
  'play.life.line.broker.1': { en: 'Every trade in this hall is written down. Every one.', es: 'Cada trato en esta sala queda escrito. Cada uno.' },
  'play.life.line.broker.2': { en: 'Name your price. The ledger will tell you if it is fair.', es: 'Di tu precio. El libro te dira si es justo.' },
  'play.life.line.verrin.1': { en: 'The shadows reveal what light conceals.', es: 'Las sombras revelan lo que la luz oculta.' },
  'play.life.line.verrin.2': { en: 'Nothing here will hurt you. That is not the same as nothing here watching.', es: 'Nada aqui te hara dano. No es lo mismo que nada aqui te observe.' },

  // ── Celestial: Meridian Orrery ──
  'play.life.line.archivist.1': { en: 'Each fragment tells a piece of the truth.', es: 'Cada fragmento cuenta una parte de la verdad.' },
  'play.life.line.archivist.2': { en: 'Ask me what is missing. It is a better question than what is here.', es: 'Preguntame que falta. Es mejor pregunta que que hay aqui.' },
  'play.life.line.chart-clerk.1': { en: 'Every Keeper\'s renown is charted here, like a star.', es: 'El renombre de cada Guardian se traza aqui, como una estrella.' },
  'play.life.line.chart-clerk.2': { en: 'Renown rises and falls. The chart only records which.', es: 'El renombre sube y baja. La carta solo anota cual.' },

  // ── Verdant: Rootglass Canopy ──
  'play.life.line.steward.1': { en: 'Explorers set out from here. Send them well equipped.', es: 'Los exploradores parten de aqui. Envialos bien equipados.' },
  'play.life.line.steward.2': { en: 'Every expedition comes back with something. Not always what you sent it for.', es: 'Toda expedicion vuelve con algo. No siempre con lo que buscabas.' },
  'play.life.line.herald.1': { en: 'New orders on the board. The realms are asking.', es: 'Nuevas ordenes en el tablon. Los reinos piden.' },
  'play.life.line.herald.2': { en: 'Daily, weekly, epic. The board keeps them all.', es: 'Diarias, semanales, epicas. El tablon las guarda todas.' },
  'play.life.line.gatekeeper.1': { en: 'Past this gate, other Keepers test your might.', es: 'Tras esta puerta, otros Guardianes ponen a prueba tu fuerza.' },
  'play.life.line.gatekeeper.2': { en: 'Guard well. The ring remembers who held their ground.', es: 'Defiendete bien. El ruedo recuerda quien no cedio.' },
  'play.life.line.trials-warden.1': { en: 'The trials open to those who find the secrets.', es: 'Las pruebas se abren a quien encuentra los secretos.' },
  'play.life.line.trials-warden.2': { en: 'A gate, a test, an ending. Step through when you are ready.', es: 'Una puerta, una prueba, un final. Cruza cuando estes listo.' },
  'play.life.line.lodge-warden.1': { en: 'Every swing of a tool teaches a skill. The lodge keeps count.', es: 'Cada golpe de herramienta ensena un oficio. El refugio lleva la cuenta.' },
  'play.life.line.lodge-warden.2': { en: 'A better tool opens harder ground. Level the skill to match.', es: 'Una herramienta mejor abre terreno mas duro. Sube el oficio a la par.' },
};
