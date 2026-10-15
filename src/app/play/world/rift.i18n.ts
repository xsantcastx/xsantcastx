/**
 * rift.i18n.ts: the Rift Gates', the Ink Deeps', the Root Deeps', the Prism Mines' and the Orrery Wells' player-facing lines
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

  // ── The Root Deeps (the Verdant's underside; engine/verdant.ts) ──
  'play.rift.arrive.verdant': { en: 'You step out into the Root Deeps. The gate behind you holds.', es: 'Sales a las Raices Hondas. El portal detras de ti aguanta.' },
  'play.rift.back.verdant': { en: 'Back through the gate. The Root Hollows\' roots lie still, the way roots should.', es: 'De vuelta por el portal. Las raices de las Oquedades se quedan quietas, como deben.' },
  'play.rift.rule.roots': { en: 'Glim: The walls are wood here, and the wood is awake. Listen: it creaks when nobody is digging.', es: 'Glim: Aqui las paredes son madera, y la madera esta despierta. Escucha: cruje aunque nadie cave.' },
  'play.rift.rule.regrow': { en: 'Glim: Did you see the wood flinch? What you dig here grows back. Burn it with a torch, prop it with a support, or cut it clean, or it closes behind you.', es: 'Glim: Viste como se encogio la madera? Lo que cavas aqui vuelve a crecer. Quemalo con una antorcha, apuntalalo o cortalo limpio, o se cierra detras de ti.' },
  'play.rift.rule.cut': { en: 'Glim: The billhook cuts the root clean. That one stays open.', es: 'Glim: La podadera corta la raiz limpia. Ese hueco se queda abierto.' },
  'play.rift.rule.burn': { en: 'Glim: The roots pulled back from the torch. Fire holds a tunnel open here.', es: 'Glim: Las raices se apartaron de la antorcha. Aqui el fuego mantiene abierto un tunel.' },
  'play.rift.rule.held': { en: 'Glim: The support held it. The roots went round.', es: 'Glim: El puntal lo sostuvo. Las raices lo rodearon.' },
  'play.rift.rule.spore': { en: 'Glim: A spore pod. They burst if you tread on them. Strike one from the side with a sickle and it gives its sap instead.', es: 'Glim: Una vaina de esporas. Revientan si las pisas. Golpeala de lado con una hoz y te da su savia.' },
  'play.rift.rule.vine': { en: 'Glim: The vines are alive, and they hold. Climb them like a ladder: Up and Down.', es: 'Glim: Las enredaderas estan vivas y aguantan. Trepalas como una escalera: Arriba y Abajo.' },
  'play.rift.rule.graft': { en: 'Glim: The Graftmother. Those red roots on the floor hold her: while one stands, she heals and shrugs off your blows. Cut them, and burn the stumps.', es: 'Glim: La Madre Injerto. Esas raices rojas del suelo la sostienen: mientras quede una, se cura y aguanta tus golpes. Cortalas y quema los tocones.' },
  'play.rift.spore': { en: 'A spore pod bursts.', es: 'Revienta una vaina de esporas.' },
  'play.rift.graft.unrooted': { en: 'The last heart-root is cut. The Graftmother staggers: nothing holds her now.', es: 'La ultima raiz corazon esta cortada. La Madre Injerto se tambalea: ya nada la sostiene.' },
  'play.rift.graft.calls': { en: 'The Graftmother grows two graftlings out of the wall.', es: 'La Madre Injerto hace brotar dos injertitos de la pared.' },

  // ── The Prism Mines (the Luminous's underside; engine/luminous.ts) ──
  'play.rift.action.mirror': { en: 'Turn mirror', es: 'Girar espejo' },
  'play.rift.arrive.luminous': { en: 'You step out into the Prism Mines. The gate behind you holds.', es: 'Sales a las Minas de Prisma. El portal detras de ti aguanta.' },
  'play.rift.back.luminous': { en: 'Back through the gate. The Grotto\'s glowcaps seem very dim after that.', es: 'De vuelta por el portal. Las setas de la Gruta parecen muy apagadas despues de eso.' },
  'play.rift.rule.light': { en: 'Glim: The light here is heavy. Where a beam crosses open air, you can stand on it. Where it falls down, you can climb it.', es: 'Glim: Aqui la luz pesa. Donde un rayo cruza el aire, puedes pisarlo. Donde cae, puedes trepar por el.' },
  'play.rift.rule.bridge': { en: 'Glim: You are standing on the light. It holds as long as the beam does.', es: 'Glim: Estas de pie sobre la luz. Aguanta mientras aguante el rayo.' },
  'play.rift.rule.glass': { en: 'Glim: That black glass is a floor while the light is on it. In the dark it is a hole. Bring a torch.', es: 'Glim: Ese cristal negro es suelo mientras le da la luz. A oscuras es un agujero. Trae una antorcha.' },
  'play.rift.rule.fall': { en: 'Glim: Shadow glass. No light on it, so nothing under you. You will land; there is always a way back up.', es: 'Glim: Cristal de sombra. Sin luz encima, no hay nada bajo tus pies. Aterrizaras; siempre hay un camino de vuelta.' },
  'play.rift.rule.mirrors': { en: 'Glim: A prism mirror. Press E and it turns the beam a corner.', es: 'Glim: Un espejo de prisma. Pulsa E y el rayo dobla la esquina.' },
  'play.rift.rule.mirror.turn': { en: 'Glim: The mirror turned the beam. Look: where it crosses the dark, it is a floor now.', es: 'Glim: El espejo giro el rayo. Mira: donde cruza la oscuridad, ahora hay suelo.' },
  'play.rift.rule.prism': { en: 'Glim: The Hollow Sun. Blows pass through it while it is free. Turn the mirror by the shaft and catch it in the beam; then it cannot move.', es: 'Glim: El Sol Hueco. Los golpes lo atraviesan mientras esta libre. Gira el espejo junto al pozo y atrapalo en el rayo; entonces no puede moverse.' },
  'play.rift.mirror.turned': { en: 'The mirror turns. The beam turns with it.', es: 'El espejo gira. El rayo gira con el.' },
  'play.rift.prism.caught': { en: 'Caught in the beam: the Hollow Sun cannot move. Strike now.', es: 'Atrapado en el rayo: el Sol Hueco no puede moverse. Golpea ahora.' },
  'play.rift.prism.flare': { en: 'The Hollow Sun flares, and the mirrors turn away. Turn them back.', es: 'El Sol Hueco destella y los espejos se apartan. Vuelve a girarlos.' },

  // ── The Orrery Wells (the Celestial's underside; engine/celestial.ts) ──
  'play.rift.action.ring': { en: 'Turn ring', es: 'Girar anillo' },
  'play.rift.arrive.celestial': { en: 'You step out into the Orrery Wells. The gate behind you holds.', es: 'Sales a los Pozos del Orrery. El portal detras de ti aguanta.' },
  'play.rift.back.celestial': { en: 'Back through the gate. The Magma Halls\' floor is exactly where you left it.', es: 'De vuelta por el portal. El suelo de las Salas de Magma esta justo donde lo dejaste.' },
  'play.rift.rule.orrery': { en: 'Glim: Feel that? Down is only a suggestion here. The brass rings decide it, field by field.', es: 'Glim: Lo notas? Aqui abajo es solo una sugerencia. Los anillos de laton lo deciden, campo por campo.' },
  'play.rift.rule.field': { en: 'Glim: We are falling up. Stand on the ceiling, walk out of the field, and the ordinary down comes back. Nothing here lets you fall hard.', es: 'Glim: Estamos cayendo hacia arriba. Pisa el techo, sal del campo y vuelve el abajo de siempre. Aqui nada te deja caer fuerte.' },
  'play.rift.rule.well': { en: 'Glim: A star-well. It falls up, always. The brass chain beside it is the way back down.', es: 'Glim: Un pozo estelar. Siempre cae hacia arriba. La cadena de laton de al lado es el camino de vuelta.' },
  'play.rift.rule.ring': { en: 'Glim: An orrery ring. Press E and its whole field turns over: up becomes down, down becomes up.', es: 'Glim: Un anillo del orrery. Pulsa E y todo su campo se da la vuelta: arriba es abajo, abajo es arriba.' },
  'play.rift.rule.turn': { en: 'Glim: The whole field turned over. Everything in it falls the other way now, us included. Turn it again and it turns back.', es: 'Glim: Todo el campo se dio la vuelta. Ahora todo cae al reves, nosotros tambien. Giralo otra vez y vuelve.' },
  'play.rift.rule.chain': { en: 'Glim: A star-chain. Climb it like a ladder, whatever down is doing up here.', es: 'Glim: Una cadena estelar. Trepala como una escalera, haga lo que haga el abajo por aqui.' },
  'play.rift.rule.ephemeris': { en: 'Glim: The Fallen Ephemeris. While its hall falls up it rides the ceiling and nothing lands. Turn a ring and drop it into its own well, then strike.', es: 'Glim: La Efemeride Caida. Mientras su sala cae hacia arriba, recorre el techo y ningun golpe entra. Gira un anillo, dejala caer en su propio pozo y golpea.' },
  'play.rift.ring.up': { en: 'The ring turns brass. Its field falls up.', es: 'El anillo se vuelve de laton. Su campo cae hacia arriba.' },
  'play.rift.ring.down': { en: 'The ring turns blue. Its field falls down again.', es: 'El anillo se vuelve azul. Su campo vuelve a caer hacia abajo.' },
  'play.rift.ephemeris.fallen': { en: 'The Fallen Ephemeris drops into its own well. Strike now, before it gathers itself.', es: 'La Efemeride Caida se desploma en su propio pozo. Golpea ahora, antes de que se recomponga.' },
  'play.rift.ephemeris.gather': { en: 'The Ephemeris gathers itself. The rings are about to turn: the hall will fall up.', es: 'La Efemeride se recompone. Los anillos van a girar: la sala caera hacia arriba.' },
  'play.rift.ephemeris.rises': { en: 'The Ephemeris rises, and its hall falls up again. Turn a ring to bring it down.', es: 'La Efemeride se eleva y su sala vuelve a caer hacia arriba. Gira un anillo para bajarla.' },
  'play.rift.hud.down.up': { en: 'Falling up', es: 'Cayendo hacia arriba' },
};
