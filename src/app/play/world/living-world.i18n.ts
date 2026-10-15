/**
 * living-world.i18n.ts — every word of the Living World (docs/handoff/living-world.md), EN + ES
 * (lazy: registered by the play view; checked by scripts/check-i18n-keys.js and the meaning check).
 * Lore is pre-approved: docs/world/lore-addendum.md, "The Living World" (shipped — owner reviews in play).
 */
export const LIVING_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  // ── Carved words: signposts, ruins, camps, cellars, seam-engines, the vault's riddle ──
  'play.living.note.wild-two-days': { en: 'A signpost, its arms long gone. Someone carved on the post: "Two days to the Seamworks. One if you do not stop to look."', es: 'Un poste sin brazos. Alguien grabo en el: "Dos dias hasta la Forja de Costuras. Uno si no te paras a mirar."' },
  'play.living.note.wild-ash-remembers': { en: '"The ash here is old fire. Plant in it and it remembers being warm." Under it, a row of little red ashwoods.', es: '"La ceniza aqui es fuego viejo. Siembra en ella y recordara el calor." Debajo, una fila de fresnos rojos pequenos.' },
  'play.living.note.wild-stones-count': { en: 'Notches on the post, one for every Waystone the carver passed. They stop at eleven, mid-notch.', es: 'Muescas en el poste, una por cada Piedra de Paso que paso quien las tallo. Se detienen en once, a media muesca.' },
  'play.living.note.wild-finches': { en: '"Follow the finches. They nest where people slept, and people sleep where it is worth stopping."', es: '"Sigue a los pinzones. Anidan donde la gente durmio, y la gente duerme donde vale la pena parar."' },
  'play.living.note.ruin-waystation': { en: 'An old Keepers\' waystation: one wall, a lintel, a hearthstone. Someone has swept it, not long ago.', es: 'Una vieja posta de Guardianes: un muro, un dintel, una piedra de hogar. Alguien la barrio hace poco.' },
  'play.living.note.ruin-lintel': { en: 'The lintel reads "WELCOME" on the side facing the road, and "COME BACK" on the side facing in.', es: 'El dintel dice "BIENVENIDO" del lado del camino, y "VUELVE" del lado de dentro.' },
  'play.living.note.ruin-lamp-hook': { en: 'A lamp hook, bent from years of a lamp hanging on it. The lamp is gone. The hook still points the way the light went.', es: 'Un gancho de lampara, doblado por anos de peso. La lampara no esta. El gancho aun senala hacia donde se fue la luz.' },
  'play.living.note.camp-left-in-a-hurry': { en: 'A camp left in a hurry: the bedroll still warm in the shape of someone, a pot on its side, a bundle of torches nobody took.', es: 'Un campamento dejado con prisa: el saco aun con la forma de alguien, una olla volcada, un hato de antorchas que nadie se llevo.' },
  'play.living.note.camp-boots': { en: 'Two boots by the cold fire, set side by side, laces tucked in. Whoever left them meant to come back for them.', es: 'Dos botas junto al fuego frio, lado a lado, cordones guardados. Quien las dejo pensaba volver por ellas.' },
  'play.living.note.camp-torches': { en: 'Chalked on a stone: "Torches in the cache. Take three, leave a word." The stone is covered in words.', es: 'Con tiza en una piedra: "Antorchas en el escondite. Toma tres, deja una palabra." La piedra esta llena de palabras.' },
  'play.living.note.cellar-stores': { en: 'A cellar dug under the loam and lined with ruin stone. Shelves, a strongbox, and a list of stores with every line crossed out but one: "patience".', es: 'Un sotano cavado bajo la marga y forrado de piedra de ruina. Estantes, un cofre, y una lista de provisiones tachada salvo una linea: "paciencia".' },
  'play.living.note.cellar-for-winter': { en: '"For the winter the Delve has instead of winter." The strongbox is still locked. The key is still in it.', es: '"Para el invierno que la Sima tiene en lugar de invierno." El cofre sigue cerrado. La llave sigue puesta.' },
  'play.living.note.machine-ticking': { en: 'A seam-engine: brass older than the Seamworks, still ticking. Every tick, a seam somewhere far off closes by a hair.', es: 'Un motor de costuras: laton mas viejo que la Forja de Costuras, aun en marcha. Con cada tic, una costura lejana se cierra un pelo.' },
  'play.living.note.machine-no-maker': { en: 'No maker\'s mark, no seal, no Bailiff stamp. Just a small hand-cut word on the housing: "Sorry."', es: 'Sin marca de fabricante, sin sello, sin estampa de Alguacil. Solo una palabra tallada a mano en la carcasa: "Perdon."' },
  'play.living.note.machine-oil': { en: 'Someone still oils this one. The rag is folded on the rail beside it, and the oil is this week\'s.', es: 'Alguien aun engrasa este. El trapo esta doblado sobre el riel, y el aceite es de esta semana.' },
  'play.living.note.vault-riddle': { en: 'Cut beside a cracked wall: "No pick has opened me and none will. Breathe on me the way the staff breathes." (A staff\'s blast breaks a cracked wall.)', es: 'Tallado junto a un muro agrietado: "Ningun pico me ha abierto ni me abrira. Soplame como sopla el baculo." (La rafaga de un baculo rompe un muro agrietado.)' },
  // ── The hermits: a line on their door, a name over their head, a hello ──
  'play.living.note.hermit-orla': { en: 'Orla the Surveyor\'s door: "I measured the Wilds once. They grew while I was measuring. Take these torches, the Wilds are darker than my numbers."', es: 'La puerta de Orla la Agrimensora: "Medi las Tierras Salvajes una vez. Crecieron mientras media. Toma estas antorchas, las Tierras son mas oscuras que mis numeros."' },
  'play.living.note.hermit-tobb': { en: 'Tobb, once of the Seamworks forge: "I keep ashberries now instead of fires. The grubs in the roots bite better than any bait Kael sells. Here, for your line."', es: 'Tobb, antes de la forja de la Forja de Costuras: "Ahora cuido moras de ceniza en vez de fuegos. Los gusanos de sus raices pican mejor que cualquier cebo de Kael. Toma, para tu sedal."' },
  'play.living.note.hermit-mira': { en: 'Mira, who fishes the wells: "The fish leap where the water is kind. Watch for the leap, then cast. These glowcaps are for the dark under the hills."', es: 'Mira, que pesca en los pozos: "Los peces saltan donde el agua es amable. Mira el salto y luego lanza. Estos hongos luz son para la oscuridad bajo las colinas."' },
  'play.living.hermit.hermit-orla.name': { en: 'Orla, surveyor', es: 'Orla, agrimensora' },
  'play.living.hermit.hermit-tobb.name': { en: 'Tobb, ex-smith', es: 'Tobb, ex herrero' },
  'play.living.hermit.hermit-mira.name': { en: 'Mira, well-fisher', es: 'Mira, pescadora de pozos' },
  'play.living.hermit.hermit-orla.hello': { en: 'Read my door, traveller.', es: 'Lee mi puerta, viajero.' },
  'play.living.hermit.hermit-tobb.hello': { en: 'Mind the bushes. Grubs.', es: 'Cuidado con los arbustos. Gusanos.' },
  'play.living.hermit.hermit-mira.hello': { en: 'Watch the water.', es: 'Mira el agua.' },
  'play.living.note.new': { en: 'New words found. ', es: 'Palabras nuevas. ' },
  'play.living.hermit.gift': { en: '{{name}} hands you {{qty}} {{item}}.', es: '{{name}} te da {{qty}} {{item}}.' },
  // ── Critters ──
  'play.living.critter.cinder-finch': { en: 'Cinder finch', es: 'Pinzon de ceniza' },
  'play.living.critter.ash-hare': { en: 'Ash hare', es: 'Liebre de ceniza' },
  'play.living.critter.ember-beetle': { en: 'Ember beetle', es: 'Escarabajo brasa' },
  'play.living.critter.dusk-moth': { en: 'Dusk moth', es: 'Polilla del ocaso' },
  'play.living.critter.glowworm': { en: 'Glowworm', es: 'Gusano de luz' },
  'play.living.critter.leaping-fish': { en: 'Leaping fish', es: 'Pez saltarin' },
  'play.living.catch': { en: 'Caught a {{critter}}: +{{qty}} {{item}}.', es: 'Atrapaste un {{critter}}: +{{qty}} {{item}}.' },
  'play.living.catch.again': { en: 'You let the {{critter}} go: you already have one from today.', es: 'Sueltas el {{critter}}: ya tienes uno de hoy.' },
  // ── The day's mysteries ──
  'play.living.mystery.wisp.found': { en: 'The light settles into your hands, and goes out. Something is left in them.', es: 'La luz se posa en tus manos y se apaga. Algo queda en ellas.' },
  'play.living.mystery.door.found': { en: 'The door opens on nothing but the rock behind it, and a little something left on the step.', es: 'La puerta se abre a nada mas que la roca detras, y algo pequeno dejado en el umbral.' },
  'play.living.mystery.whisper': { en: 'A whisper, close by, in no voice you know: "Not this way. That way. No, this way." Then nothing.', es: 'Un susurro, cerca, en ninguna voz que conozcas: "Por aqui no. Por alla. No, por aqui." Luego nada.' },
  'play.living.mystery.reward': { en: '+{{xp}} Delving XP', es: '+{{xp}} XP de Sima' },
  'play.living.mystery.again': { en: 'It was here today already. Come back tomorrow: it will be somewhere else.', es: 'Ya estuvo aqui hoy. Vuelve manana: estara en otro lugar.' },
  // ── Glim reacts ──
  'play.living.glim.wisp': { en: 'Glim: That light is not a lantern. It is waiting for you. Go gently.', es: 'Glim: Esa luz no es una linterna. Te esta esperando. Ve con calma.' },
  'play.living.glim.door': { en: 'Glim: That door was not there yesterday. I would remember. I remember doors.', es: 'Glim: Esa puerta no estaba ayer. Lo recordaria. Recuerdo las puertas.' },
  'play.living.glim.whisper': { en: 'Glim: You heard it too? Good. I thought it was only me.', es: 'Glim: Tu tambien lo oiste? Bien. Crei que era solo yo.' },
};
