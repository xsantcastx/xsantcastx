/**
 * rift.i18n.ts: the Rift Gates' and the Ink Deeps' player-facing lines
 * (shared/delve/rift-gates.model.ts, engine/umbral.ts; lore-addendum.md "The
 * Rift Gates"). Lazy: registered by the side-scroller (play chunk), checked by
 * scripts/check-i18n-keys.js.
 *
 * Engine lines carry their key on EngineState.messageKey; the English here
 * matches the engine's own English, which stays the fallback. The rule lines
 * are Glim's (said once each, the first time the rule applies). Spanish keeps
 * the Delve table's plain ASCII style.
 */
export const RIFT_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── The gates ──
  'play.rift.realm.umbral': { en: 'Umbral', es: 'Umbral' },
  'play.rift.realm.luminous': { en: 'Luminous', es: 'Luminoso' },
  'play.rift.realm.celestial': { en: 'Celestial', es: 'Celestial' },
  'play.rift.realm.verdant': { en: 'Verdant', es: 'Verdante' },
  'play.rift.action.gate': { en: 'Rift gate', es: 'Portal de grieta' },
  'play.rift.action.brazier': { en: 'Light brazier', es: 'Encender brasero' },
  'play.rift.settling': { en: 'The {{realm}} rift is still settling. The frame hums; nothing answers yet.', es: 'La grieta {{realm}} aun se esta asentando. El marco zumba; nada responde todavia.' },
  'play.rift.needDelving': { en: 'The gate will not hold for you yet. Needs Delving {{n}}.', es: 'El portal aun no te sostiene. Necesitas Exploracion {{n}}.' },
  'play.rift.needSigil': { en: 'Dormant. It wants a {{sigil}}: rift splinters from this frame and the realm\'s own material, at a Crafting Bench.', es: 'Dormido. Pide un {{sigil}}: astillas de grieta de este marco y el material del reino, en un Banco de Artesania.' },
  'play.rift.attuned': { en: 'The sigil sinks into the frame. The gate is attuned to you.', es: 'El sello se hunde en el marco. El portal queda sintonizado contigo.' },
  'play.rift.enterFailed': { en: 'The gate flickers and will not take you. Try again.', es: 'El portal parpadea y no te lleva. Intentalo de nuevo.' },
  'play.rift.backFailed': { en: 'The gate on this side will not open. Try again.', es: 'El portal de este lado no se abre. Intentalo de nuevo.' },
  'play.rift.firstStep': { en: 'You stand under another realm. +{{n}} Delving XP.', es: 'Estas bajo otro reino. +{{n}} XP de Exploracion.' },
  'play.rift.seenXp': { en: '+{{n}} Delving XP: a Rift Gate', es: '+{{n}} XP de Exploracion: un Portal de grieta' },
  'play.rift.glim.seenOpen': { en: 'Glim: That frame is older than the Delve. The {{realm}} side is awake behind it. It wants a sigil.', es: 'Glim: Ese marco es mas viejo que la Profundidad. El lado {{realm}} esta despierto detras. Pide un sello.' },
  'play.rift.glim.seenSettling': { en: 'Glim: A rift gate. The {{realm}} side is still settling: I can feel it, not see it. One day.', es: 'Glim: Un portal de grieta. El lado {{realm}} aun se asienta: lo siento, no lo veo. Algun dia.' },
  'play.map.legend.gate': { en: 'Rift gate', es: 'Portal de grieta' },

  // ── Engine: arriving, leaving ──
  'play.rift.arrive': { en: 'You step out into the Ink Deeps. The gate behind you holds.', es: 'Sales a las Profundidades de Tinta. El portal detras de ti aguanta.' },
  'play.rift.back': { en: 'Back through the gate. The Underhearth\'s heat feels like a welcome after that.', es: 'De vuelta por el portal. El calor del Bajohogar parece una bienvenida despues de eso.' },
  'play.rift.travel.back': { en: 'Back through the rift (the gate you came in by)', es: 'Volver por la grieta (el portal por el que entraste)' },
  'play.rift.travel.row': { en: 'Anchor {{n}}: {{place}}, row {{depth}}', es: 'Ancla {{n}}: {{place}}, fila {{depth}}' },

  // ── Engine: the broken rule, said once each (Glim) ──
  'play.rift.rule.dark': { en: 'Glim: Ink-blind down here. My light barely reaches past your hands. Torches push the dark back; set them as you go.', es: 'Glim: Ciegos de tinta aqui abajo. Mi luz apenas pasa de tus manos. Las antorchas empujan la oscuridad; ponlas al avanzar.' },
  'play.rift.rule.tide': { en: 'Glim: The ink is rising. At high tide it stands over the low passages and puts out braziers. It never drowns you; it blinds you. Wait high, or cross at low tide.', es: 'Glim: La tinta sube. En marea alta cubre los pasos bajos y apaga los braseros. Nunca te ahoga; te ciega. Espera en alto o cruza con marea baja.' },
  'play.rift.rule.ink': { en: 'Glim: Under the ink I can hardly see you. It does not drown you. It just takes the light.', es: 'Glim: Bajo la tinta apenas te veo. No te ahoga. Solo se lleva la luz.' },
  'play.rift.rule.shift': { en: 'Glim: Somewhere behind us a passage just moved. Rock here does not stay put while nobody looks. A torch inside one pins it.', es: 'Glim: En algun lugar detras de nosotros un paso acaba de moverse. La roca aqui no se queda quieta si nadie mira. Una antorcha dentro la fija.' },
  'play.rift.rule.mirror': { en: 'Glim: Look up. The ceiling is ink, polished by the tide. That is you up there, walking a step behind.', es: 'Glim: Mira arriba. El techo es tinta pulida por la marea. Ese de ahi arriba eres tu, un paso por detras.' },
  'play.rift.rule.shade': { en: 'Glim: A shade. In the dark it is fast; in light it cannot move at all. Keep it in the light: a torch, a brazier, my glow right beside you.', es: 'Glim: Una sombra. En la oscuridad es rapida; en la luz no puede moverse. Mantenla en la luz: una antorcha, un brasero, mi brillo junto a ti.' },
  'play.rift.tide.rising': { en: 'The ink is rising.', es: 'La tinta sube.' },
  'play.rift.ink.bucket': { en: 'The ink runs straight back out of the bucket. It will not be carried out of the dark.', es: 'La tinta se escurre del cubo. No se deja sacar de la oscuridad.' },

  // ── Engine: braziers and the Warden ──
  'play.rift.brazier.lit': { en: 'The brazier takes the torch. Anything standing in its light stands still.', es: 'El brasero toma la antorcha. Todo lo que este en su luz se queda quieto.' },
  'play.rift.brazier.out': { en: 'A brazier gutters out.', es: 'Un brasero se apaga.' },
  'play.rift.brazier.tide': { en: 'The tide puts a brazier out.', es: 'La marea apaga un brasero.' },
  'play.rift.brazier.drowned': { en: 'The tide is over it. Wait for the ink to fall.', es: 'La marea lo cubre. Espera a que baje la tinta.' },
  'play.rift.brazier.noTorch': { en: 'You need a torch to light it.', es: 'Necesitas una antorcha para encenderlo.' },
  'play.rift.warden.calls': { en: 'The Warden calls two shades out of the dark.', es: 'El Guardian llama a dos sombras de la oscuridad.' },

  // ── HUD: the tide ──
  'play.rift.hud.tide.low': { en: 'Ink tide: low', es: 'Marea de tinta: baja' },
  'play.rift.hud.tide.rising': { en: 'Ink tide: rising', es: 'Marea de tinta: subiendo' },
  'play.rift.hud.tide.high': { en: 'Ink tide: high', es: 'Marea de tinta: alta' },
  'play.rift.hud.tide.falling': { en: 'Ink tide: falling', es: 'Marea de tinta: bajando' },
  'play.rift.hud.tide.aria': { en: 'Ink tide {{phase}}, changes in {{n}} seconds', es: 'Marea de tinta {{phase}}, cambia en {{n}} segundos' },
};
