/**
 * td-prologue.i18n.ts: the top-down prologue's words (td-prologue.ts), EN + ES. Lazy: registered by the play view.
 * One short line per step, saying what to do and how, with the keyboard's keys or the phone's taps; Glim's tip is
 * the warmer line it says as the step begins. Place, item and spell names stay in English in ES, like the HUD.
 */
export const TD_PROLOGUE_I18N: Readonly<Record<string, { en: string; es: string }>> = {
  'play.pro.label': { en: 'Step {{n}} of {{total}}', es: 'Paso {{n}} de {{total}}' },
  'play.pro.skip': { en: 'Skip tutorial', es: 'Saltar tutorial' },
  'play.pro.skipAria': { en: 'Skip the tutorial for this Keeper', es: 'Saltar el tutorial con este Guardian' },
  'play.pro.skipped': { en: 'Tutorial skipped. Glim is still on your shoulder if you need a hint.', es: 'Tutorial saltado. Glim sigue en tu hombro si necesitas una pista.' },
  'play.pro.none': { en: 'Nothing to find right here yet: walk on, and follow Glim\'s little arrows.', es: 'Aqui no hay nada todavia: sigue andando y sigue las flechitas de Glim.' },
  'play.pro.done': { en: 'Prologue done. The Sexton\'s Count is your story now: its row is on the scroll.', es: 'Prologo terminado. La Cuenta del Sacristan es tu historia ahora: su fila esta en el pergamino.' },

  // The quest scroll's rows.
  'play.pro.title.walk': { en: 'Look around', es: 'Mira a tu alrededor' },
  'play.pro.title.hearth': { en: 'Light the hearth', es: 'Enciende el hogar' },
  'play.pro.title.fight': { en: 'Win a first fight', es: 'Gana una primera pelea' },
  'play.pro.title.gold': { en: 'Pick up the Gold', es: 'Recoge el oro' },
  'play.pro.title.book': { en: 'Open the Spellbook', es: 'Abre el Libro de hechizos' },
  'play.pro.title.bag': { en: 'Open the Satchel', es: 'Abre el Morral' },
  'play.pro.title.story': { en: 'Meet the Sexton', es: 'Conoce al Sacristan' },

  // The goal line: one plain sentence, keyboard or touch.
  'play.pro.walk.keys': { en: 'Walk with W A S D (or the arrow keys), or click where to go.', es: 'Camina con W A S D (o las flechas), o haz clic donde quieras ir.' },
  'play.pro.walk.touch': { en: 'Drag on the ground to walk, or tap where to go.', es: 'Arrastra por el suelo para caminar, o toca donde ir.' },
  'play.pro.hearth.keys': { en: 'Light the town hearth: walk to the fire and press E. You wake here if you fall.', es: 'Enciende el hogar del pueblo: ve al fuego y pulsa E. Despiertas aqui si caes.' },
  'play.pro.hearth.touch': { en: 'Light the town hearth: tap the fire. You wake here if you fall.', es: 'Enciende el hogar del pueblo: toca el fuego. Despiertas aqui si caes.' },
  'play.pro.fight.warlock.keys': { en: 'Leave town and click a creature: your staff casts at range (or hold J). Press 1 for {{skill}}.', es: 'Sal del pueblo y haz clic en una criatura: tu baston lanza a distancia (o manten J). Pulsa 1 para {{skill}}.' },
  'play.pro.fight.warlock.touch': { en: 'Leave town and tap a creature: your staff casts at range. Tap {{skill}} on the left.', es: 'Sal del pueblo y toca una criatura: tu baston lanza a distancia. Toca {{skill}} a la izquierda.' },
  'play.pro.fight.ashguard.keys': { en: 'Leave town, walk up to a wolf and hold J to swing your blade. Press 1 for {{skill}}.', es: 'Sal del pueblo, acercate a un lobo y manten J para blandir tu hoja. Pulsa 1 para {{skill}}.' },
  'play.pro.fight.ashguard.touch': { en: 'Leave town and tap a wolf: you close in and swing. Tap {{skill}} on the left.', es: 'Sal del pueblo y toca un lobo: te acercas y golpeas. Toca {{skill}} a la izquierda.' },
  'play.pro.fight.lanternwright.keys': { en: 'Leave town and click a creature: your lantern burns it (or hold J). Press 1 to cast {{skill}}.', es: 'Sal del pueblo y haz clic en una criatura: tu farol la quema (o manten J). Pulsa 1 para lanzar {{skill}}.' },
  'play.pro.fight.lanternwright.touch': { en: 'Leave town and tap a creature: your lantern burns it. Tap {{skill}} on the left.', es: 'Sal del pueblo y toca una criatura: tu farol la quema. Toca {{skill}} a la izquierda.' },
  'play.pro.fight.thornstrider.keys': { en: 'Leave town and click a creature: your bow looses arrows and your beast runs in (or hold J). Press 1 for {{skill}}.', es: 'Sal del pueblo y haz clic en una criatura: tu arco dispara y tu bestia ataca (o manten J). Pulsa 1 para {{skill}}.' },
  'play.pro.fight.thornstrider.touch': { en: 'Leave town and tap a creature: your bow looses arrows and your beast runs in. Tap {{skill}} on the left.', es: 'Sal del pueblo y toca una criatura: tu arco dispara y tu bestia ataca. Toca {{skill}} a la izquierda.' },
  'play.pro.fight.any.keys': { en: 'Leave town and click a creature to fight it (or hold J). Press 1 for {{skill}}.', es: 'Sal del pueblo y haz clic en una criatura para luchar (o manten J). Pulsa 1 para {{skill}}.' },
  'play.pro.fight.any.touch': { en: 'Leave town and tap a creature to fight it. Tap {{skill}} on the left.', es: 'Sal del pueblo y toca una criatura para luchar. Toca {{skill}} a la izquierda.' },
  'play.pro.gold': { en: 'It dropped Gold: walk over the coins to pick them up. Gold only comes from the hunt.', es: 'Solto oro: pasa por encima de las monedas para recogerlas. El oro solo sale de la caza.' },
  'play.pro.book.keys': { en: 'Press K for your Spellbook: your skills, and where level-up points go.', es: 'Pulsa K para tu Libro de hechizos: tus habilidades y donde van los puntos al subir.' },
  'play.pro.book.touch': { en: 'Tap Spells: your skills, and where level-up points go.', es: 'Toca Hechizos: tus habilidades y donde van los puntos al subir.' },
  'play.pro.bag.keys': { en: 'Press I for your Satchel: loot lands here. Click an item to wear it.', es: 'Pulsa I para tu Morral: el botin llega aqui. Haz clic en un objeto para ponertelo.' },
  'play.pro.bag.touch': { en: 'Tap the Satchel: loot lands here. Tap an item to wear it.', es: 'Toca el Morral: el botin llega aqui. Toca un objeto para ponertelo.' },
  'play.pro.story': { en: 'Sexton Aldous Wren has a "!" over him. Talk to him for your first story.', es: 'El sacristan Aldous Wren tiene un "!" encima. Habla con el para tu primera historia.' },

  // Glim, as each step begins.
  'play.pro.tip.walk': { en: 'Welcome to Ember Isle. Stretch your legs; I\'ll keep up.', es: 'Bienvenido a Ember Isle. Estira las piernas; yo te sigo.' },
  'play.pro.tip.hearth': { en: 'See my little arrows? That way is the hearth. Light it and it\'s yours to wake beside.', es: 'Ves mis flechitas? Por ahi esta el hogar. Enciendelo y despertaras a su lado.' },
  'play.pro.tip.fight': { en: 'The wilds start past the town\'s edge. I\'ll point at the nearest thing with teeth.', es: 'Lo salvaje empieza pasado el borde del pueblo. Te senalo lo mas cercano con dientes.' },
  'play.pro.tip.gold': { en: 'Coins! Everything here is paid for by the hunt. Go on, they\'re yours.', es: 'Monedas! Aqui todo se paga con la caza. Anda, son tuyas.' },
  'play.pro.tip.book': { en: 'Every level gives you a point to spend. Your Spellbook is where they go.', es: 'Cada nivel te da un punto para gastar. Tu Libro de hechizos es donde van.' },
  'play.pro.tip.bag': { en: 'What you find goes in the Satchel. Wear the good bits; I\'ll admire them.', es: 'Lo que encuentres va al Morral. Ponte lo bueno; yo lo admirare.' },
  'play.pro.tip.story': { en: 'The sexton counts his graves twice. Lately the count is off. Go and ask him.', es: 'El sacristan cuenta sus tumbas dos veces. Ultimamente no le salen las cuentas. Ve a preguntarle.' },

};
