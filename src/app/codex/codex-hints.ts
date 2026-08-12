/**
 * codex-hints.ts — what a locked achievement is allowed to tell you.
 *
 * The registry already carries a `description`, but a description is a
 * *confession*: "Created a box shadow with 5+ layers" is the answer written out.
 * Showing it on a locked card would turn the wall into a checklist and the site
 * into a chore. So a locked card shows the hint instead, and only flips to the
 * description once the thing has actually been found.
 *
 * Rules the hints follow:
 *   1. Gesture at the act, never name the tool or the exact threshold.
 *   2. Stay inside the Eclipse Realms voice — this is a codex, not a tooltip.
 *   3. Be solvable. A hint nobody can act on is just a locked door with a poem
 *      on it, and the point is for people to go and try something.
 *
 * Any egg without an entry here falls back to `genericHint()`, which is vague
 * but honest — better a dull hint than a crash or an empty card if an egg lands
 * in the registry before its hint does.
 */
import { EASTER_EGGS } from '../shared/easter-eggs/easter-egg.service';

export const EGG_HINTS: Record<string, string> = {
  // ── Global ────────────────────────────────────────────────────────────────
  'konami': 'Up, up, and the rest of it. The oldest incantation in the trade still opens things.',
  'night-owl': 'The realm is thinnest in the hours nobody admits to being awake for.',
  'speed-demon': 'Pass through five doors before a single minute closes behind you.',
  'explorer': 'Walk the whole length of the first hall before you leave it.',
  'codex-archivist': 'You are already here. The record notices when it is opened.',
  'forge-self-aware': 'Somewhere in the Godforge there is a sheet with your own name on it.',
  'cloud-eternal-archive': 'Your progress transcends devices. The Godforge remembers across all realms.',

  // ── Luminous — light, colour and the making of surfaces ───────────────────
  'shadow-lord': 'A shadow with five layers holds power.',
  'monochrome': 'Ask which of two identical things is brighter, and listen to the silence.',
  'palette-void': 'Pull colour out of something that has almost none left to give.',
  'palette-monochrome': 'Find a palette where every colour is the same colour wearing different clothes.',
  'gradient-mono': 'A gradient that travels nowhere is still, technically, a gradient.',
  'gradient-rainbow-bridge': 'Eight stops. Build the bridge all the way across.',
  'gradient-brand': 'Write the name of this realm and let the light run through it.',
  'font-disco': 'Refuse to settle. Ten times.',
  'img-tiny': 'Squeeze a picture under ten thousand bytes and let it keep its dignity.',
  'img-pixel-pincher': 'Squeeze harder. Under a single kilobyte.',
  'svg-code': 'Translate a drawing assembled from fifty separate pieces.',
  'svg-complex-path': 'Take a single line and give it fifty separate instructions.',
  'flex-dozen': 'Twelve children, one row, no mercy.',
  'grid-matrix': 'Twelve by twelve. Enter it.',
  'br-circle': 'Round every corner until the box forgets it was ever a box.',
  'ar-square': 'One to one. Nothing wider, nothing taller.',
  'css-zero': 'Convert nothing into every other kind of nothing.',
  'css-important': 'Insist. Then insist again. Five times, in one stylesheet.',
  'css-var-system': 'Name twenty things at once and the realm starts calling it a system.',
  'clip-complex': 'Cut a shape with twelve corners or more.',
  'filter-chaos': 'Push every filter to its limit at the same time.',
  'anim-seizure': 'Loop forever, and make each loop shorter than a blink.',
  'transform-full-spin': 'Turn all the way around and end exactly where you began.',
  'transition-instant': 'A transition that takes no time at all is a very fast transition.',
  'text-shadow-deep': 'Stack five shadows behind your letters and watch the depth arrive.',
  'shades-blank': 'Ask for the shades of a colour that has none to give.',
  'color-void': 'Convert the absence of all light.',
  'color-badass': 'Somewhere in the hex space is a colour that reads like a boast.',
  'color-rebecca': 'A shade of purple named after a girl the web decided to remember.',
  'cb-gray-world': 'Simulate the loss of colour on something that never had any.',
  'apca-invisible': 'Tune the contrast until it reads exactly zero and the text stops existing.',
  'spacing-zero': 'Build an entire scale on a foundation of nothing.',
  'snap-2d': 'Snap both ways at once.',
  'button-forbidden': 'Label a button with the two words that guarantee it gets pressed.',
  'box-reset': 'Set every margin and every padding to nothing and start again.',
  'mq-print': 'Write a query for the one medium nobody targets any more. Somebody still prints.',

  // ── Umbral — secrets, keys and the things that guard them ─────────────────
  'ssl-localhost': 'Point the inspector at the machine you are already sitting at.',
  'ssl-self': 'Audit the certificate of the realm you are standing in.',
  'hash-meaning': 'Digest the answer to everything.',
  'hash-miner': 'Keep hashing until four zeros walk out in front. Nobody reaches this on the first try.',
  'jwt-expired': 'Read a token that died years before you opened it.',
  'jwt-insecure': 'Sign something with nothing at all and see if anyone stops you.',
  'jwt-none-ref': 'Look up the algorithm that is not an algorithm.',
  'pw-one-char': 'Generate the shortest password that could possibly exist. Security theatre needs a stage.',
  'pw-fort-knox': 'A hundred and twenty-eight characters. Nobody is typing that twice.',
  'hmac-inception': 'Sign the word "secret" using the word "secret".',
  'env-secret': 'Hide something in the file whose entire job is holding hidden things.',
  'html-xss': 'Try to smuggle a script past the encoder. It will be polite about it.',
  'chmod-god': 'Grant everyone everything.',
  'caesar-uryyb': 'Rotate a greeting thirteen places and read what falls out.',
  'binary-hi': 'Two bytes are trying to say hello. Decode them.',
  'encoding-invisible': 'Encode a string made entirely of things you cannot see.',
  'b64-mirror': 'Feed the forge its own name and read what comes back.',
  'b64-decoder-ring': 'Encode the one word that should never be trusted to this.',
  'morse-sos': 'Three short. Three long. Three short.',
  'emoji-skull': 'Copy the reminder that all things end.',
  'char-infinity': 'Copy the symbol that never finishes.',
  'ip-localhost': 'Look up the address that always points back at you.',
  'dns-localhost': 'Resolve the name that resolves to home.',
  'ua-bot': 'Parse the fingerprint of something that is not a person.',
  'robots-blackout': 'Tell every crawler to leave and never come back.',

  // ── Verge — code translated from one form into another ────────────────────
  'json-inception': 'Go down ten floors into a structure with no basement.',
  'json-abyss': 'Fifteen levels down, and still going.',
  'json-tree-forest': 'Grow a tree with a thousand branches and see if it still renders.',
  'json-ts-hidden': 'Convert an object that is hiding an egg inside it.',
  'json-newlines': 'Escape three line breaks standing in a row.',
  'json-diff-same': 'Compare two documents that have nothing to say to each other.',
  'json-ultra-compress': 'Shrink a document to less than a tenth of what it was.',
  'schema-mega': 'Describe a shape with twenty properties at its very top level.',
  'yaml-hidden': 'Convert a config that is hiding an egg.',
  'regex-master': 'Look both ways at once — ahead and behind, in a single expression.',
  'regex-ouroboros': 'Write a pattern that matches the pattern you just wrote. Very few ever have.',
  'regex-all-flags': 'Raise every flag at the same time.',
  'regex-danger': 'Look up the failure that eats processors alive.',
  'sql-drop': 'Format the query that ends a school district.',
  'base-meaning': 'Enter the answer, then watch it change shape in every base.',
  'data-leet': 'Convert exactly the number that hackers spell with letters.',
  'timestamp-epoch': 'Travel back to the first second time was ever asked to count.',
  'url-rickroll': 'Encode the link everyone regrets clicking.',
  'api-teapot': 'Ask the server for coffee. It will refuse, politely, with a number.',
  'webhook-pong': 'Send the word that expects an answer.',
  'http-teapot-ref': 'Look up the status code that should never have been standardised.',
  'mime-binary': 'Look up the type that means "I have absolutely no idea".',
  'diff-identical': 'Compare a thing to itself and find nothing at all.',
  'lines-clone': 'Sort a list in which every line is the same line.',
  'case-monotone': 'Type a line where every character is the same character.',
  'string-laughing': 'Laugh a hundred times without stopping.',
  'js-eval-danger': 'Minify code that calls the function everyone warns you about.',
  'html-blink': 'Minify a tag the browsers took out behind the shed.',
  'html-marquee': 'Convert markup that still, after all this time, wants to scroll.',
  'md-hello-world': 'Begin the way every programmer began.',
  'md-lonely-cell': 'Build a table with one cell and no company.',
  'csv-lonely': 'One cell. One row. One lonely value.',
  'ts-any': 'Search the playground for the type that means giving up.',
  'git-yolo': 'Look up the command you are told never, ever to run.',
  'gitignore-everything': 'Select every technology on the list. All of them.',
  'docker-whale': 'Search the container reference for the animal on the logo.',
  'cron-chaos': 'Schedule something to happen every single minute, forever.',
  'cron-midnight': 'Search the schedule reference for the hour of witches.',
  'npm-trivial': 'Search for the package that decides whether a number is odd.',
  'pkg-zero': 'Ship a version that admits it is nothing yet.',
  'license-wtf': 'Pick the licence that gives up on the whole idea of licences.',
  'hex-executable': 'Open a file whose first two bytes are a man\'s initials.',
  'ascii-hello': 'Draw a greeting out of nothing but keyboard characters.',

  // ── Archivum — records, counts and the keeping of things ──────────────────
  'meta-ego': 'Put your own name where the whole world will read it.',
  'og-testing': 'Leave the word you always forget to remove in the title.',
  'seo-perfect-title': 'Write a title exactly sixty characters long. Not fifty-nine.',
  'heading-perfect': 'Use all six levels and make not one mistake.',
  'sitemap-lonely': 'Map a realm containing exactly one road.',
  'lorem-42': 'Fill exactly as many paragraphs as there are answers to everything.',
  'text-hello': 'Analyse the two words every program says first.',
  'slug-classic': 'Slugify the oldest greeting in the trade.',
  'uuid-lucky': 'Roll until three zeros lead the way. You cannot aim at this.',
  'uuid-factory': 'Generate a hundred of them in one sitting.',
  'mock-42': 'Generate the answer, in rows.',
  'countdown-y2k': 'Count down to the night the world was supposed to break.',
  'pomodoro-speedrun': 'A tomato that lasts one minute.',
  'checklist-complete': 'Leave nothing unticked.',
  'snippet-collector': 'Hoard ten fragments of other people\'s cleverness.',
  'progress-almost': 'Stop the bar one step from done and leave it there.',
  'tz-same': 'Convert a time between one zone and that exact same zone.',
  'ph-pixel': 'Generate the smallest image it is possible to generate.',
  'favicon-x': 'Mark the spot with a single letter.',
  'qr-self': 'Fold the name of this realm into a square and let a phone read it back.',
  'ks-konami': 'Search the shortcut list for a code that is not a shortcut.',
  'tw-hidden': 'Search for the class whose whole job is making things disappear.',
  'screen-classic': 'Only the ones on a display that never doubled will see this.',
  'responsive-pixel': 'Preview a page exactly one pixel wide.',
  'resize-pixel': 'Resize until a single pixel is all that is left.',
  'resize-batch': 'Feed the machine ten images at once and step back.',
  'pdf-catalog': 'Print a catalogue twenty items long.',
  'token-branded': 'Name a token after the thing you are actually selling.',
  'grocery-big-shop': 'Check out with twenty things in the basket.',

  // ── Nexus — messages, and whether they arrive ─────────────────────────────
  'email-santa': 'Test delivery to the one address every child already knows by heart.',
  'gmail-self': 'Check whether your own mail arrives before you check anyone else\'s.',

  // ── The Ambient Forge — presence, not pursuit ─────────────────────────────
  'idle-patient-one': 'The flame gives to whoever is still watching it. A hundred of anything is a start.',
  'idle-forge-meditation': 'Half an hour. Do not look away, and do not go anywhere.',
  'idle-vigil': 'Five hundred, gathered a minute at a time. There is no faster road to it.',
  'idle-eternal-flame': 'Two thousand. At this rate that is a season of afternoons.',
  'idle-never-sleeps': 'Be watching when one day becomes the next.',
  'idle-forge-striker': 'A thousand blows. The flame counts every one.',
  'idle-obsidian-hammer': 'Ten thousand. Nobody arrives here by accident.',

  // ── The Godforge Market — spending, not finding ───────────────────────────
  // Six that are earned rather than hidden. The hints say what kind of effort
  // reaches them without naming the number, because on three of these the
  // number *is* the whole secret.
  //
  // The two strike-count achievements this release would otherwise have added
  // are deliberately absent: 'idle-forge-striker' and 'idle-obsidian-hammer'
  // above already pay out at a thousand and ten thousand strikes, and the
  // Market's flame drives the same counter. Two cards for one act would be two
  // wrong numbers on the wall.
  'forge-first-purchase': 'The ember in the corner is not the only thing that takes coins.',
  'forge-investor': 'A handful of the furnace ladder, in any combination you like.',
  'forge-market-mogul': 'Three times a handful. The price climbs 15% every time you say yes.',
  'forge-artifact-collector': 'Essence buys permanence. Own enough permanence to make a shelf.',
  'forge-complete-collection': 'Every shelf, empty. Nothing left in the case with a price on it.',
  'forge-click-frenzy': 'The ember pays twice a second at most. Spend a whole minute finding out.',
};

/**
 * Fallback for an egg with no authored hint. Deliberately unhelpful about the
 * *how* and specific about the *where* — enough to send someone to the right
 * door without opening it for them.
 */
export function genericHint(toolTitle?: string): string {
  return toolTitle
    ? `Something in ${toolTitle} responds to an input nobody would type by accident.`
    : 'The realm is keeping this one to itself. For now.';
}

export function hintFor(eggId: string, toolTitle?: string): string {
  return EGG_HINTS[eggId] ?? genericHint(toolTitle);
}

/**
 * Ids present in EGG_HINTS that no longer match a registered egg. Nothing in the
 * app reads this — it exists so the unit test can fail loudly when an egg is
 * renamed and its hint is left behind pointing at nothing.
 */
export function orphanedHintIds(): string[] {
  const live = new Set(EASTER_EGGS.map(e => e.id));
  return Object.keys(EGG_HINTS).filter(id => !live.has(id));
}

/** Registered eggs with no authored hint — they fall back to `genericHint()`. */
export function unhintedEggIds(): string[] {
  return EASTER_EGGS.filter(e => !EGG_HINTS[e.id]).map(e => e.id);
}
