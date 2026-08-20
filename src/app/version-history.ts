/**
 * version-history.ts — the shipped-release log.
 *
 * Split out of version.ts so this ~140 kB of prose stays out of the initial
 * bundle. Only the lazy /admin route reads it. Import APP_VERSION from
 * ./version instead if all you need is the current version number.
 */

export interface VersionRelease {
  version: string;
  codename: string;
  /** ISO date (YYYY-MM-DD) the release shipped */
  date: string;
  highlights: string[];
}

/** Newest first. */
export const VERSION_HISTORY: VersionRelease[] = [
  {
    version: '2.76.3',
    codename: 'Purge',
    date: '2026-08-20',
    highlights: [
      'A visitor could be locked out of the site permanently, by their own browser, with nothing wrong on the server. Firebase Hosting has no 404 for a missing file — the catch-all rewrite answers any unmatched path with the app shell at 200 OK, text/html. So a script the previous deploy renamed does not fail; it comes back as a page. The service worker checked only that the response succeeded, cached that HTML under the .js address, and then served it from cache first, forever: past reloads, past new deploys, past the file being restored, because cache-first never asks again',
      'It now checks that a response actually contains what its address claims before caching it, and refuses anything it cannot identify. Missing the cache costs one fetch; poisoning it cost the visitor the site. The cache version is bumped alongside, which drops the bad entries for everyone already holding them on their next visit',
      'The errors this produced were being swallowed. The handler listed "Loading chunk failed" as noise on the grounds that a reload recovers it — but nothing ever reloaded, so the page sat half-booted with the explanation suppressed. A stale build is now detected by all five of its spellings, including the SyntaxError about an import binding that names no file and no line, and answered by clearing every client-side copy of the old build and reloading once. Once, guarded per tab: if the same error survives the purge it is a real fault, and it gets reported instead of refreshing forever',
      'Google sign-in stopped logging a blocked request on every load. apis.google.com was allowed to load scripts and to be framed but never to be connected to, so the Firebase auth helper\'s callback was refused by our own policy. api.github.com had the same hole, which is why the mission-control commit and CI cards came back empty rather than wrong',
    ],
  },
  {
    version: '2.76.2',
    codename: 'Doorway',
    date: '2026-08-20',
    highlights: [
      'The Sanctum survives an expedition it cannot place. A saved expedition names its realm and its mission by id, and the guard that reads those saves only checks that they are strings — it cannot demand they resolve, because throwing out the ones that do not would delete every expedition in flight the moment a build renames anything. So an id this build no longer knows reached the card, which asserted it was there anyway, and reading a name off nothing took the whole page down with it',
      'That is the worst possible failure for that particular card, because the Recall button lives on it: the one control that frees the slot was inside the thing that crashed, so the expedition could never be cancelled and the Sanctum stayed dark on every visit',
      'It now reads "an unrecorded realm" and keeps going — the countdown, the explorer, the progress ring and Recall all still work. The landing card had resolved the same two ids defensively since it was written; the in-flight card simply never got the same treatment',
    ],
  },
  {
    version: '2.76.1',
    codename: 'Doorway',
    date: '2026-08-20',
    highlights: [
      'The Gambler is in the menu. It shipped reachable only from a link on the Market strip, which meant anyone who was not already standing in the Market had no way to find it — and a route you cannot get to reads as a page that is missing, which is exactly how it came back reported. It now sits under MORE beside the Exchange, the same kind of hall, with a banded-chest rune of its own',
      'The Market doorway stays where it was. That is the in-world way in, and it still works; the menu entry is the one that works from anywhere',
      'The nav audit tells the truth again. It had been carrying an explicit skip for /gambler that declared the page reachable, so the orphan check stayed green while the page stayed lost. The skip is gone and the audit now passes on the merit of a real link',
    ],
  },
  {
    version: '2.76.0',
    codename: 'Roster',
    date: '2026-08-20',
    highlights: [
      'Your explorers are people now. Eighteen of them exist, each one written — a name, a history, a realm they are better in, a disposition that bends how they work, and one ability nobody else has. Lyra doubles the rune rate in Archivum. Grimjaw never comes back empty-handed. There is exactly one Nameless Scout',
      'The roster is a collection with an end you can see. Everyone you have not met yet sits on the wall as a silhouette carrying the one line that says where to find them — so the ladder is visible from the first visit instead of something you trip over',
      'Every explorer levels on their own, one to twenty. Their own XP bar, their own milestones: a spare hand at 5, their ability strengthening at 10, an extra strap at 15, and mastery at 20. Sending Lyra out forty times makes Lyra good, not the account',
      'Expeditions go somewhere now. Each realm has three places in it — fifteen in all, from the Crystal Caverns to the Void Threshold — with their own loot, their own difficulty and their own walls. The deep three are the only place outside the anvil that a Rare or better is promised rather than hoped for',
      'A run tells you what happened while you were gone. Four beats at a quarter, half, three quarters and home, written for the realm they are walking through — and every one of them is there when you reopen the tab, because they were never events you had to be present for',
      'A return is a moment rather than a receipt. Where they went, what they banked, the XP they earned, the level they crossed — and, once in a long while, the person they brought back with them',
      'Send them back with one press. The instant a haul lands, the button to run it again is on the card',
      'Filling the roster pays. Five found is a title, ten opens a sixth expedition slot, fifteen is another title, and the whole cast is a permanent cut of every expedition after it',
      'The Sanctum has a room. The command centre was the last major surface still standing on the generic wallpaper; it now opens into the vault it has always described',
    ],
  },
  {
    version: '2.75.1',
    codename: 'Fanfare',
    date: '2026-08-20',
    highlights: [
      'ALL now means all. The button offered every strike your Gold could cover and was then quietly clamped to a thousand of them \u2014 on a deep purse it spent a fraction of what it promised and stopped. It spends the purse',
      'A long run no longer slows down the longer it gets. The reveal used to hold on to every find and copy the whole pile once per batch, which is fine for ten and quadratic for forty thousand; it now folds each strike into a count, a tally and the best find as it goes',
      'Stop works during a long run. The Collection Log toast lands in the middle of the screen and was swallowing clicks meant for the buttons underneath it \u2014 including the one that calls the run off',
    ],
  },
  {
    version: '2.75.0',
    codename: 'Fanfare',
    date: '2026-08-19',
    highlights: [
      'A good drop is now an event. Every rung of the rune ladder from Uncommon up earns its own reaction \u2014 and each one gets a channel the rung below it did not have, so you can tell what you hit before you have read a word',
      'An Uncommon breathes colour at the edges of the screen. A Relic-grade Rare is the first real hit: a ring pulses out of the card, particles scatter from it, a crystalline chime rings, and the rune\u2019s name types itself out one letter at a time',
      'An Epic moves the world. The forge behind the page lurches, the card jolts, light beams fan out of it, and a resonant low note lands under the chime',
      'A Legendary takes the screen away before it gives anything back \u2014 a beat of black, then gold: lightning cracking in from the edges, a shower of motes falling past, thunder and a horn section',
      'A Mythic turns prismatic and drops the reveal itself to half speed, so the card lands with weight instead of speed',
      'The Void, once in two million strikes, breaks the screen. Black and silent for half a second \u2014 the only deliberate silence in the game \u2014 then the glass cracks across the whole viewport, void energy pours out of the break, and the rune is inside it',
      'The fanfare is off until you ask for it. One switch under the anvil turns on the synthesised audio and remembers the choice; nothing is downloaded either way, because every sound is built from oscillators at the moment it plays',
      'Reduced motion keeps the colour and drops everything that moves, and a phone gets the whole event with the lightning cut \u2014 the one effect that is a stall on the hardware least able to absorb one',
      'The same celebration now fires wherever an item is acquired, not just at the anvil: the Forge Flame\u2019s anvil mode and the Gambler\u2019s mystery boxes run it off the same table',
    ],
  },
  {
    version: '2.74.0',
    codename: 'Ember',
    date: '2026-08-19',
    highlights: [
      'The Godforge burns behind every page. A WebGL scene of drifting embers, far cosmic dust, a handful of large wisps dragging comet trails, and a nebula wash \u2014 the room the whole game stands in, rather than a flat colour behind it',
      'Walk into a realm chapter and the air changes colour. Umbral turns the field violet, Infernal crimson, Celestial blue, Verdant emerald and Luminous gold, over a second-long cross-fade, using the same colour the realm badge and the page wash already wear',
      'The embers answer you. They drift away from the cursor, the layers slide past each other at different speeds as you scroll, and every strike on the Forge Flame sends a shockwave out through them',
      'Any item can now be turned over in three dimensions. A "3D" chip in the inspect panel lifts it off the page as a real card with thickness \u2014 artwork and name on the front, the stat block on the back, rarity light along all four edges \u2014 and you can drag it around and flick it spinning',
      'The card gets louder as the drop gets rarer, on the same ladder the drop toast climbs: a Mortal has a rim light and nothing else, a Sacred has particles in orbit, an Anomalous adds light rays, and a Singular gets a prismatic storm, energy tendrils climbing it, and a surface that will not stay flat',
      'None of it is allowed to cost you the game. Nothing moves on the processor \u2014 every particle is a function of the clock evaluated on the graphics card \u2014 the field is capped at 500 pieces on a desktop and 200 on a phone, and a frame governor quietly drops a quality step if two seconds in a row fall below 20fps',
      'A "Reduce effects" switch in the footer turns the whole thing off and remembers, and reduced-motion visitors get the scene standing perfectly still rather than not at all. No WebGL, an embedded page, or the switch on and the starfield that was always there is still behind you',
      'The 3D library is never in the first download. It arrives only when a scene actually opens, so the page you land on is the same weight it was yesterday',
    ],
  },
  {
    version: '2.73.0',
    codename: 'Chorus',
    date: '2026-08-19',
    highlights: [
      'The world had places, items and quests before it had anybody standing in them. Six characters now do \u2014 Aureth in the Luminous hall, Verrin in the Umbral hall and the trials, Kael on World, Forge, Character, Sanctum and Infernal, the Archivist on Codex and Quests, the Merchant on Market, Gambler and the Exchange, and the Nameless anywhere at all once you have held a combo of 666 or turned up the Void rune',
      'Each is an 80px portrait with a speech bubble that types itself in at thirty characters a second. Clicking opens what they want from you; clicking anywhere else closes it. It never covers the page and it never asks to be dismissed twice',
      'What they say depends on where you are, what level you are, what time it is where you are, what you are wearing, what you have already found, and how long the combo has been running. Lines you have read are drawn last rather than never, so a character who has said everything keeps talking instead of going quiet as a reward for listening',
      'Each one offers a chain \u2014 five steps, three for the Nameless \u2014 that has to be walked in order, and the steps together tell one story about that character. Aureth starts with the light failing to reach every realm and ends at the Void rune; Kael will tell you what happened to the eye, but he has conditions',
      'Rewards climb from Gold, through a real object minted into the bag, to a title that shows in front of your rank everywhere it appears, to a cosmetic, and each chain closes with an achievement on the Codex wall and a fragment of lore nothing else says. Twelve new titles: Radiant, Champion of Light, Hollowed, The Hollow, Flamebound, Forgeborn, The Annotated, Keeper of Fragments, The Solvent, Goldmouth, The Counted, and Nameless',
      'A step\u2019s progress is read live off the ledger that already knows the answer rather than counted a second time, so the bar on a card and the number on the page it came from cannot drift apart. Only the receipts are stored \u2014 which means retuning a target changes what everyone sees on their next load, with no migration and no chance of a second payout',
      'Four steps were rewritten before shipping because they could not be completed. They asked you to work in a realm, which the quest board measures by tool use, and every tool route has redirected to World since the product cutover \u2014 so they rendered a progress bar that no action on the site could move. The test suite now fails on any step that reads a ledger nothing fills',
      'Chain progress rides cloud save, so a step finished on a phone is finished on a desktop',
      'The bottom-left corner of the screen turned out not to be empty. The install banner has been painting underneath the 236px sidebar since the Eclipse shell landed, and underneath the mobile tab bar and the bottom-centre forge flame since those moved. Both it and the new portrait now offset from the measurements the header already publishes, rather than from a number somebody typed',
      'Portraits are not painted yet. Each character renders as a monogrammed orb in their own colour until the art lands, and the build fails the day it does and the placeholder is left behind',
    ],
  },
  {
    version: '2.72.0',
    codename: 'Ledger',
    date: '2026-08-19',
    highlights: [
      'The Grand Exchange, a new hall at /exchange: seventy-five tradable lines \u2014 fifteen materials and fifteen equipment definitions across four rarities \u2014 each with its own price, its own history and its own chart',
      'Prices are a function of the clock rather than a timer. Close the tab on Friday and the market has moved by Monday, because nothing had to be running for it to move \u2014 the price of a thing at any instant is computed from that instant, which is also why the thirty-day chart can be drawn for a market you were not present for',
      'Three overlapping rhythms drive it: a four-day swing you notice between sessions, an intraday shape, and a three-hour churn that makes checking back worth doing. Nothing may fall below a tenth of its anchor price or climb past five times it',
      'Market events sweep whole categories \u2014 Forge Shortage lifts ore a quarter, Umbral Drought takes a fifth off essence, and the Eclipse Market Crash takes a tenth off everything for half an hour, which is the best half hour to be buying. They can overlap, and when they do their effects compound',
      'Your own trading moves the board. Buying takes stock off the shelf and lifts the price; selling floods it and drops it. How far depends on how thin the line is \u2014 dumping four hundred Cinder Ore is an event, selling one helm is not \u2014 and the market forgets half of what you did every six hours',
      'Every sale pays the house five per cent. It is the only Gold that leaves the realm here, and it means a round trip is always a small loss \u2014 buying something back costs more than you got for it, which is what stops the board being a machine for printing Gold',
      'Charts show 24 hours, 7 days, 30 days or all of it, with a price line, a trailing mean and volume bars underneath. Every row on the board carries its own sparkline, coloured green when it is climbing and red when it is not',
      'A quote that moved against you between reading it and clicking is refused rather than charged \u2014 and a quote that moved in your favour settles at the better price, because refusing that would be the worse surprise',
      'The counterparties are merchant houses, not other Keepers, and the page says so plainly. Nothing you list is seen by another player; the prices are simulated, and a simulated market presented as a real one would be the one version of this worth refusing to build',
      'Named objects are not for sale at any price. A unique exists at exactly one authored rarity, so a shelf price for one would mint something the rest of the game says cannot exist \u2014 and putting a price on it at all deletes the reason to go looking',
    ],
  },
  {
    version: '2.71.1',
    codename: 'Wager',
    date: '2026-08-19',
    highlights: [
      'Resetting your progress on a phone used to undo itself. The save cleared, and a minute later \u2014 or on the next visit \u2014 it was back. The local half of the wipe was landing and the cloud half silently was not: the Firestore SDK is loaded on demand rather than shipped in the initial bundle, so for the first few seconds of a cold mobile load there is no connection to delete anything through, and the delete simply returned. The next pull then read a device holding nothing against an account holding a save, which is indistinguishable from signing in on a new browser, and helpfully restored it',
      'A wipe is now stamped before anything is destroyed, and the stamp is what the next sync reconciles. If the cloud never heard about the reset the stamp re-sends it; if another device wiped the account later, this one wipes too rather than pushing its survivors back up. It survives being taken offline, taken before the SDK has arrived, and taken on a tab that is closed halfway through',
      'Deleting a single blob got the same treatment. Any deletion whose cloud half fails is written down and re-issued on the next sync, and writing that key again cancels it \u2014 starting something again is not the same as never having deleted it',
      'A device lease, so two devices stop quietly writing over each other. The one being played on holds it and syncs exactly as before; a second device left open on a desk reads normally, keeps playing locally, and holds its uploads instead of interleaving them. A small strip at the top says which device is active, with a Play Here button that moves the lease and sends everything the passive device queued',
      'The lease is taken in a transaction, so two devices racing for it cannot both win, and it expires two minutes after the holder stops \u2014 a crashed tab or a phone that went into a pocket frees the save on its own',
      'Nothing about the merge rules changed, and a device that cannot read the lease at all keeps writing. A network failure must not be able to lock somebody out of their own cloud save, and the reconciliation underneath still converges the way it always did',
    ],
  },
  {
    version: '2.71.0',
    codename: 'Wager',
    date: '2026-08-19',
    highlights: [
      'Every item now records how well it rolled. A stat line reads Gold/sec +4.2 (78%), where the percentage is how close that stat came to the best it could be at that rarity \u2014 so two Cuirasses with the same name are finally legible as different objects instead of merely being different ones',
      'The grade is normalised inside each rarity\u2019s own band, which means 100% says the same thing on a Common as on a Singular: this tier cannot do better. The power gap between tiers still lives in the ceiling, so nothing about the ladder moved',
      'How wide a rarity gambles now climbs with the rarity. A Common rolls in a narrow, mediocre band; a Legendary can come out near-worthless or near-perfect. Mythic and Singular go the other way and trade that width for a high floor \u2014 by the time somebody is seeing a one-in-a-million drop, handing them a dud is not tension',
      'An item whose every stat averages 95% is tagged Perfect and takes a prismatic border; one where every stat is genuinely maxed is Flawless, which is about one in a thousand per stat. Both show in the bag, on tooltips and in the Collection Log',
      'The Gambler, a new hall next to the Market: five sealed boxes from the Iron Chest at five thousand Gold to the Void Cache at five million. Each pays out exactly one item, and every box publishes its odds before you buy rather than after',
      'Bad luck protection is counted per box and stated as a number \u2014 ten results at a box\u2019s worst rarity in a row and the next one cannot land there. It is counted per box so that pity built cheaply on Iron Chests cannot be spent on a Void Cache',
      'Twenty-four named objects with their own lore and a passive line no rolled item can produce \u2014 Void\u2019s Whisper, Goldmouth, Lastwarden, The Keeper\u2019s Second Name. They still roll their stats like everything else; what is fixed is which stats they carry',
      'Selling exists again, and it lives at the Gambler because that is the same loop: open boxes until the bag is full of things you did not want, then turn those back into the Gold for the next box. A sale pays sticker scaled by the roll \u2014 half for a dud, three times over for a Perfect',
      'No wearable in the game had ever had a price. Every equipment definition is filed as type artifact so the paper doll accepts it, and artifacts price at zero because a true artifact is soulbound \u2014 so the sell path had been refusing all of them, silently, for as long as it had existed',
      'Charms roll now too. Their authored number is read as the ceiling rather than the midpoint, so a maxed roll reproduces exactly the fixed value they always used to have and nothing rolls above it',
      'The Collection Log keeps the best roll it has ever seen for each thing, and keeps it after the item is sold \u2014 the log records what you found, and scrapping a 97% Cuirass for Gold does not unfind it',
    ],
  },
  {
    version: '2.70.0',
    codename: 'Bellows',
    date: '2026-08-19',
    highlights: [
      'The initial bundle is 1.64 MB, down from 1.92 MB — under its 1.85 MB budget again, with 210 kB of headroom rather than 73 kB of overrun. Nothing was removed that anybody could see: it is the release log, the strings for pages that no longer exist, and code that could not be reached',
      'VERSION_HISTORY — this list — is 140 kB of prose that only the admin dashboard reads, but the footer imports the version number from the same file and the footer is on every page. A module is the unit of chunking, so all of it shipped to everybody. The number and the log now live in separate files',
      '1021 of 1742 translation strings were for surfaces the product cutover retired — 777 of them for the old tool pages alone. They are gone, and a build step now fails the build if a template asks for a string that is not there, which is the failure a prune like this can cause and the one nothing used to catch',
      'The pulsar stopped animating its own position. It drifted by writing top and left sixty times a second, which makes the browser redo layout before it can draw anything; it now moves on the compositor instead. The scroll-progress rule was worse — it set a custom property on the whole navigation bar, and custom properties inherit, so every hall link and status pill had its style recalculated to move a bar one pixel wide',
      'Measured over sixty scrolled frames, the Codex went from a layout on every single frame to a layout on half of them, and the quest board from every frame to three in four',
      'The equipment panel carried a bag column, a header and three dialogs for two display modes that nothing in the application mounts — 462 lines of template, TypeScript and CSS that had never rendered. Deleting it is what finally answered where selling lives: nowhere yet, and the reasoning is written down beside the method rather than left for the next reader to rediscover',
      'The daily tool pipeline has failed every night since the twelfth. The token it checks out with is expired, and the guard that was supposed to fall back to a working one could not tell — it tested the token for being empty, which an expired token is not. It asks GitHub now',
    ],
  },
  {
    version: '2.69.0',
    codename: 'Archivist',
    date: '2026-08-19',
    highlights: [
      'The Collection Log: a sixth Codex panel holding every thing the Godforge can put in a Keeper\u2019s hands \u2014 twenty-five runes, six Runewords, five artifacts, fifteen charms, thirteen materials, three consumables and thirteen worn things. Found entries show their painted art, their lore and the day they first landed; unfound ones show a dark silhouette, a ??? and a clue about where to look',
      'A discovery is written down once and never recomputed. A rune spent on a Runeword, a charm sold at the till and an ore struck into a blade are all gone from the ledgers that used to hold them \u2014 and none of them leaves the log. The count only ever rises',
      'Finding something for the first time brings up a card in the middle of the screen: it arrives face-down, flips over, and throws a short sparkle. It never blocks a click, it queues at four, and reduced motion gets the same card standing still',
      'Completion pays. A quarter of the log makes you Apprentice Collector, half sends the Sealed Codex Page, three quarters the Keeper\u2019s Signet, and all of it the title Eclipse Archivist and a cursor trail nothing else in the game grants. The titles are real \u2014 they show in front of your rank, everywhere it is shown',
      'Filter and sort by category, rarity, realm, and found or still missing, with a completion dial that climbs the rarity ladder as the log fills and a bar for every category and every rarity band',
      'Twelve pieces of equipment are drawn, named and not yet forged. They are shown and they are not counted \u2014 a completion bar that cannot reach the end is a bar that lies'
    ]
  },
  {
    version: '2.68.0',
    codename: 'Thrall',
    date: '2026-08-19',
    highlights: [
      'Forge Thralls: bound workers, bought from the Market in five tiers from 50K to 25M Gold, who pull the lever at the anvil on their own — every 30 seconds at the bottom of the ladder and every 5 at the top. The runes land in the same ledger yours do, so they craft Runewords like any other find',
      'Automation is a Gold sink and never a Gold engine. A Thrall pull costs a hundred times what yours does, and it rolls at a fraction of your Magic Find — half at Common, nine tenths at Legendary — so standing at the anvil yourself is always cheaper and always luckier',
      'They tire. Stamina runs from 100 to 500 by tier, a pull costs one to three of it, and a spent Thrall rests at a point a minute until it is back to a fifth of its pool. That rest cycle, not the price, is what bounds the burn',
      'Two wells each — a weapon and a charm. Worn Magic Find and loot quality pay at face value on their rolls; worn Ward turns aside up to half the stamina a pull costs. Levels to 20 add stamina and luck, and are tuned so a capped Thrall never overtakes a fresh one of the tier above',
      'Managed from the Inner Sanctum: stamina bars, live Magic Find, assign and stand down, hand over gear and take it back, a squad overview with the nominal Gold-per-hour burn, and an activity log of what each of them found',
      'Five work at once, and Lengthen the Shift raises that to ten. The whole shift pauses the moment the tab goes behind another — a background tab settles nothing, so nobody comes back to an emptied ledger',
    ],
  },
  {
    version: '2.67.0',
    codename: 'Contract',
    date: '2026-08-19',
    highlights: [
      'The Contract Board: three daily and two weekly challenges that pay Gold, drawn from eighteen and twelve, on the same midnight the quest board rolls on. It reads the Godforge rather than the tool halls — runes struck, materials hauled, expeditions home, kit worn and tempered, combo peak, Gold minted, halls walked, Keeper rank',
      'Collect all three dailies and the forge pays double for an hour. Seven days of that opens a chest holding a Rare-or-better rune, banked through the Rune Forge so it counts toward Runewords and rolls its own scroll exactly as a found rune does. The streak flame goes cold if you miss a day',
      'The board never asks for the same thing twice in one day. The plain draw put "reach a combo of x100" and "x250" on the same three slots, which is a two-goal day wearing three cards',
      'Three lengths past the hour: Deep Dive at four hours, the Grand Expedition at a day, and the Abyss at three. Each costs Gold to launch, and what climbs is not the Gold-per-minute but the drop table — Rare-or-better only from the Deep Dive up, a guaranteed rune on the Grand, two guaranteed Epic-or-better in the Abyss',
      'The Abyss wants Keeper rank 5 and runs one at a time, in a card with a portal in it rather than a brighter border. The realm you pick now decides what comes back in the bag as well: Umbral Ink from Umbral, Void Shard from the Verge, and nowhere else',
      'Deep runs can call you when they land, if you ask them to — the permission prompt sits next to the 72-hour mission and nowhere else'
    ]
  },
  {
    version: '2.66.0',
    codename: 'Orrery',
    date: '2026-08-19',
    highlights: [
      'Prospecting is the third skill. Celestial\u2019s Meridian Orrery is a brass-and-glass chamber whose rings trace the boundaries between realms, and cutting into them is how you get at what the far realms are made of \u2014 Celestial Alloy first, then Luminous Prism, Verdant Sap, Umbral Ink, and Void Shard at the very bottom',
      'Five cuts against three seams and four growths, which makes it the longest ladder in the game: the top gate is level 34, nine above Thornroot and fourteen above Heartstone, and it pays accordingly. Every step is roughly one to six hours of the cut below it',
      'A Clarity Elixir turns up on about one survey in fourteen hundred, and the 750th survey guarantees the first if none has. After that it keeps rolling and never guarantees again',
      'Reforge is a place to put Gold. Temper only ever grows what an item already has, so a Mythic with a floor roll was a dead end \u2014 now every stat can be rerolled inside that item\u2019s own rarity, from 500 Gold on a Common to a million on a Mythic. It can come out worse; that is the trade',
      'Pay double and one stat is held while the rest are rerolled. The anvil rings, the numbers tumble, and what settles is laid out beside what you had \u2014 including the stats that did not move, because after a gamble you are owed the whole accounting',
      'Rarity, definition and temper level survive a reforge untouched. A +7 comes back a +7: what you are gambling is the roll underneath it, never the levels you already paid for'
    ]
  },
  {
    version: '2.65.0',
    codename: 'Reverse',
    date: '2026-08-19',
    highlights: [
      'The Forge Flame has two faces. A switch above it turns the ember over: Gold on the front, where a click earns, and the anvil on the back, where a click spends 10K Gold and pulls a rune out of the table. The whole Rune Forge, from any page, without leaving it',
      'Runes come off the anvil by name, in their own rarity colour, rising off the ember and gone in a second and a half. Rare and above arrive bigger, wearing their glow, and take the screen with them',
      'x10 sits beside the switch. Ten strikes in one press, stacked into a column you can read — and it banks whatever the purse could pay for rather than refusing the whole run when it runs short',
      'An anvil you cannot afford says so: the ember shakes, washes red, and the cost line above it turns with it. A click that does nothing and looks like nothing is a click you think was dropped',
      'The counter reads FORGE x5 on the anvil. It is a run of its own — the Gold combo ladder is built around a two-a-second cooldown the anvil does not have, so the anvil never writes to that record',
      'The face you left it on is the face you come back to, on that device. Reduced motion keeps the switch, the runes and the refusal; what it drops is the half-second of rotation, the travel, and the shake'
    ]
  },
  {
    version: '2.64.0',
    codename: 'Lever',
    date: '2026-08-19',
    highlights: [
      'The Forge is a lever now. Roll again sits on the result, so a re-roll is one click instead of dismiss-find-pull, and the card you just turned up stays on screen until the next one replaces it',
      'Bulk rolls: ×10, ×100, ×1K and ALL. They run in chunks rather than one long loop — a thousand strikes in a single pass is over a second of frozen tab, so the run strikes for eight milliseconds, hands the frame back and resumes, which is what makes the progress bar move and the Stop button work. Stopping banks everything that already landed',
      'A run reports what it found: "1 Rare, 1 Uncommon, 3 Common", rarest first, each rung in its own colour. Past twelve cards it shows the best find on its own instead of a hundred thumbnails you scroll through to reach the buttons',
      'Auto-roll pulls by itself and stops on Rare or better, or when the Gold runs out, and says which. Rolling straight past the thing you were rolling for is not a feature',
      'The first pull of a sitting keeps the full ceremony. From the second the reveal runs about three times faster — the lever should feel like a lever',
      'On a phone the roll buttons are pinned to the bottom of the reveal and the Forge Flame stands aside while it is open. Both were taking clicks that were meant for the lever'
    ]
  },
  {
    version: '2.63.0',
    codename: 'Candour',
    date: '2026-08-19',
    highlights: [
      'The Forge stops pretending you chose. Striking the anvil dealt ten face-down cards and asked you to pick one, but the rune was written before a card left the deck and the index you clicked was thrown away — same rune, same odds, same Gold, whichever one you turned. The hand is gone; the card lands face up on the click that pays it, and the reveal it lands with is untouched',
      'Twelve end-to-end tests that had drifted off the UI now describe it: the Market as the flat card it became, the character sheet as the five-tab hub it became, the charm row as three real wells rather than a note apologising for their absence, and a seeded bag that carries the era stamp that stops it being wiped on load. One of them was a genuine flake — a full-viewport visit milestone the spec raced and lost — and no longer races anything',
      'The realm dossier unit tests come back with the fix that landed in 2.62.1: the route stub now supplies the data the component reads, and there is a test for the no-param path the fix exists for',
      'The production build stops printing a budget warning nobody could clear'
    ]
  },
  {
    version: '2.62.1',
    codename: 'Canopy',
    date: '2026-08-19',
    highlights: [
      'The five realm dossiers are readable again. Giving each realm its own route in v2.60.2 — so it could carry its own description instead of sharing one with the other four — took away the `:realmId` the page was reading itself from, and all five answered "This place is not on the map". They read the id from the route either way now',
      'The build check that was supposed to catch this only inspected the head of each page, where everything was correct. It reads the heading too, so a page that prerenders a not-found state can no longer ship with a perfect canonical on top of it'
    ]
  },
  {
    version: '2.62.0',
    codename: 'Talisman',
    date: '2026-08-19',
    highlights: [
      'Charms have slots again — three of them, in their own row under the loadout rather than as a ninth well on the Keeper. C5 took charms off the player entirely: every one was moved to the bag, tagged so it could not be worn, and left carrying a note saying it required a future charm system. This is that system. The wells accept charms and nothing else, and the gear wells still refuse a charm, so neither can squat in the other\'s place',
      'A save written before C5 gets its charms back where it left them. The three wells reuse the original charm1-charm3 ids rather than new ones, so a loadout that still names one puts the charm straight back on the player instead of leaving it bagged with an explanation. Saves written after C5 keep the charm in the bag and simply lose the tag that said it could never be worn',
      'Every charm in the game gave Magic Find, which would have made three slots a non-choice — you would wear your three highest and there would be nothing to decide. Two more families now sit on the same rarity ladder: Gold charms paying flat Gold per second, and Insight charms paying a percentage of XP. Fifteen charms, five per family, one stat each',
      'The charm drop rate is tripled to match. The three families carry identical weights, so a drop is an even three-way split — leaving the old rate would have cut Magic Find supply to a third without anybody asking for it. A player now sees as many Magic Find charms per strike as before, and the other two families on top',
      'The loadout picker opens on a charm well the same way it opens on a gear well, with the same comparison against what is already there: swapping an XP charm for a Gold one shows the Gold gained and the XP given up, both signed, rather than only the half that improves',
      'Fixed a squeeze the charm row exposed: the picker\'s worn-item block is a 44px art column beside the text, and an item with no tile art left that column empty and dropped the *name* into it, wrapping it to one word per line. Every other equippable has art, so nothing had shown it. Charms do not, so all three wells did'
    ]
  },
  {
    version: '2.61.0',
    codename: 'Wayline',
    date: '2026-08-19',
    highlights: [
      'The realm picker was five buttons that did the same thing. Where an explorer was sent was recorded, coloured the card, and then had no effect on what came back. Each realm now pays to its own domain — Umbral turns up runes at one and a half times the rate and pays less Gold for it, Luminous is a hall still full of Gold and short on secrets, Verge and Archivum trade Gold for knowledge — and the picker prints the specialty and re-prices the Gold band as you switch, so the choice is visible before it is made',
      'A haul that produced an equippable said it had produced nothing. The minted item ids have been on the reward since explorers got inventory slots and no surface ever rendered them, so a Legendary charm read as "the Gold and a story nobody has written down". The reveal card now shows every item and its mods, every rune past the first as a chip, takes its glow from the best find rather than from the realm, and plays the rune\'s own reveal cue instead of one coin flourish for everything',
      'A dismissed reveal card was the only record a mission had happened — on a mechanic whose whole pitch is that it resolves while the tab is shut. The last ten landings are now kept in the save and listed under the dispatch picker with the realm, the Gold, who went, and a chip per rune, fragment and item. They union across devices, unlike missions in flight, which deliberately do not',
      'The progress ring could not say a number, so an hour-long expedition looked the same at four per cent as at nine. Each card now carries the percentage inside the ring, a bar beside it — three bars line up where three rings do not — who is out, and the wall-clock time they are due back',
      'The Inner Sanctum opens on an at-a-glance strip: income, the soonest landing, what the Keeper is wearing and what is in the bag, each linking to the surface that owns it. Answering "is anything happening" used to mean reading three columns',
      'The loadout\'s slot picker listed what each item does and never what it would change. Candidates now carry their difference from the item already worn, with stats the candidate drops shown as losses rather than left out, an upgrade flag on a net gain, and the sign written into the text so the chips do not depend on colour. Bag tiles and picker rows gained full tooltips, and a slot that just changed flashes once — equipping used to be silent, and on a phone the doll is off-screen'
    ]
  },
  {
    version: '2.60.2',
    codename: 'Canopy',
    date: '2026-08-19',
    highlights: [
      'Search Console was reporting every page of the site as either an alternate of another page or a duplicate whose canonical Google had overruled. Both came from tags the pages were shipping, and both are gone',
      'The hreflang annotations advertised a `?lang=es` copy of each page. Nothing could ever render one: production is prerendered files plus a static shell, and Hosting ignores a query string when matching a file, so `/world?lang=es` was answered byte-for-byte with the English `/world` — including its canonical, pointing back at `/world`. Twenty-one URLs were being crawled and discarded as alternates that canonicalised themselves away. The site has one URL per page and now says so; `?lang=es` still switches the copy for anyone who follows a shared link',
      'The five realm pages shared one meta description and one title pattern between five short, structurally identical pages, which is the shape a search engine clusters before electing its own representative. Each realm now carries its own description, keywords and structured data, generated from the narrative bible so it cannot drift, and an unrecognised realm id is marked as the soft 404 it always was',
      'Any URL that is neither a real page nor a configured redirect — a retired link, a crawler guess — was answered with an indexable, canonical-less shell. That shell is now `noindex`, and the build fails if a page that belongs in the sitemap ever loses its prerendered file, or ships a canonical pointing anywhere but at itself'
    ]
  },
  {
    version: '2.60.1',
    codename: 'Canopy',
    date: '2026-08-19',
    highlights: [
      'Signing in no longer asks which save to keep. It asked nearly every time for anyone with two devices, because the test behind it counted Gold you had not spent yet as progress the other side had never seen — and a balance goes down, so an older one always looked ahead. Your saves are combined instead, which keeps the further of everything and throws nothing away',
      'Two of that dialog\'s three buttons deleted whichever items the other side was holding. That is gone; signing in cannot cost you items any more, and if you want this device\'s save back exactly as it was before you signed in, the notice that appears afterwards will put it back',
      'Items had no test covering whether they reached a second device at all. They do, and now it is pinned — along with both devices\' items surviving a merge'
    ]
  },
  {
    version: '2.60.0',
    codename: 'Canopy',
    date: '2026-08-19',
    highlights: [
      'Foraging is the second skill. The Rootglass Canopy opens in the Verdant realm with four herbs gated by level — Starlight Herb, Sunbloom, Nightbloom, Thornroot — a Rift Key at one in a thousand with a guarantee at the six-hundredth gather, and its own bar on the Skills tab next to Mining. A Keeper now chooses what to grind',
      'Mining has three ore tiers — Cinder Ore, Slag Fragment at level 8, Infernal Heartstone at level 20 — each paying more XP a strike, and seams recover faster as you level and as your weapon\'s strikePower climbs. The old three-step XP table is a real curve to level 50, and every level-up is a ceremony, not a number that quietly changed',
      'Refining: three of one ore become one of the next, at the Seamworks, with a two-step confirm. Surplus Cinder Ore finally has somewhere to go',
      'strikePower and ward do something. At the anvil, worn strikePower gives each strike a chance to shear a second copy of the rune; worn ward turns part of a temper\'s failure chance aside — and a successful temper now always changes a number you can see. The Basalt Edge actually rolls strikePower, which it never had',
      'The Forge pull is a reveal, graded by rarity, that you can skip with one click; the landed card prints the whole haul, and temper tells you the exact stat that moved. Nothing costs more, and the odds read exactly as before',
      'The Market reads rarity from the edge of the card, not only the word, and the wallet stays pinned while you scroll. Fixing that uncovered a one-token CSS bug that had silently disabled every sticky element on the site',
      'The bank drops the quantity you asked for instead of the whole stack; clicking a loadout slot lists what fits it from your bag; every tool, material and piece of equipment renders its painted art through one pipeline instead of text orbs and forty-megabyte PNGs'
    ]
  },
  {
    version: '2.59.0',
    codename: 'Vault',
    date: '2026-08-13',
    highlights: [
      'Signed in, the cloud is now the record and this browser is its cache. Every one of the nineteen save blobs — Gold, XP, the bag, the roster, quests, runes, scrolls, achievements, the lot — is read and written through one gateway instead of nineteen services each owning their own localStorage',
      'Signing in pulls the whole account in two round trips instead of nineteen, reconciles it, and hands the result straight to the live services, so the numbers on screen change in place',
      'Writes are batched: a burst of play that used to cost a document write per blob per change now costs one commit every few seconds, and a page load that changes nothing costs no writes at all',
      'Progression had a second, independent Firestore writer with its own schedule racing the first. There is one writer now',
      'Offline is a supported state rather than an error — the game keeps running from the cache, the queue holds, and it drains itself when the connection comes back',
      'Signed out, nothing changed and nothing is fetched: no Firestore SDK, no requests, the same local-only game the anonymous majority has always had'
    ]
  },
  {
    version: '2.58.0',
    codename: 'Wayfinding',
    date: '2026-08-13',
    highlights: [
      'The Inner Sanctum is in the command bar. It had one link on the whole site — the footer\'s second row — which on a phone is a scroll past every section of whatever page you are on, so the hub the game is played from was, as reported, effectively impossible to reach',
      'Mission Control came out of the same rename worse off: it kept its page and lost its only link when /sanctum became the hub, so nothing on the site pointed at it at all. It is in the tome now, alongside Donate, which had never been anywhere but the footer',
      'Every route that renders a page is now one click from the homepage on both desktop and mobile — measured from the DOM rather than assumed. `npm run audit:nav` resolves every routerLink against the route table and every page route against the header, tome, tab bar and footer, and fails the build on a dead link or an orphan',
      'A seventh hall does not fit a Spanish row: measured with a seven-figure balance it needs a 1600px window and was 131px over at 1450. So the shed is two-tier now — the War Table leaves at 1600 and the Sanctum at 1300, rather than both going at once and emptying two slots on a 1440px laptop',
      'The Essence pill, the rank title and the creed all shed earlier to pay for the hall. Each was picked for having somewhere else to be: Essence is printed on the Market page it links to, the rank title is on /forge-keeper, and the creed is a tagline',
      'Every threshold was measured in Spanish against a seven-figure odometer and the longest rank title — the row that has broken before — because a fresh save\'s zero is the one balance guaranteed to fit'
    ]
  },
  {
    version: '2.57.4',
    codename: 'Bazaar',
    date: '2026-08-13',
    highlights: [
      'Every painting on the site was invisible in Safari. /arena, /market, /forge-keeper, /blueprint and /rune-forge all rendered as flat void behind their UI, and had done since the art scenes shipped. Chrome showed all five perfectly, which is why it went unnoticed through review',
      'Nothing was broken in the way a missing image is broken, and that is what hid it. The WebP downloaded, decoded and laid out: naturalWidth 1536, the right currentSrc, visibility visible, opacity 1, sized to the viewport. Every check a person would run to find a missing image passed. The artwork was simply being painted underneath something opaque',
      'Each scene is a position: fixed, z-index: -1 layer inside <body>. Painting order in the root stacking context is canvas background, then negative z-index descendants, then in-flow block backgrounds — so any opaque background on <body> paints in front of all of them. That is normally impossible, because a body background propagates to the canvas rather than painting in flow, but only while <html> has none of its own. styles.css sets html { background: #07090f }, so the propagation never happened and body.gf-art-route { background: #0a0a0f } was a genuine opaque sheet laid over every painting',
      'Blink hoists body\'s background to the canvas anyway, so Chrome painted the scenes above it and the bug could not be reproduced in the browser the site is developed in. WebKit implements the specified order. The fix is to leave body transparent on art routes and let the floor colour come from <html>, which IS the canvas and paints below the scenes rather than over them — a five-hex difference no eye can resolve, and the scenes carry their own #0a0a0f behind the art regardless',
      'Verified by rendering all five routes in both engines against the production build: the WebKit backdrop went from a flat 2.4-6.5 kB strip to 90-152 kB of painted detail, and the Chromium strips came back byte-identical before and after, so the change is a no-op in Blink. The 126 tool pages reach their realm art through a body background-image rather than a scene layer, are unaffected by this, and were confirmed to render identically in both engines',
      'e2e/art-routes-paint.spec.ts now asserts the invariant directly on all five routes, in the webkit project the config already defines: body must not paint an opaque background on an art route. It was confirmed to fail against the old declaration and pass against the new one, because a regression test never run against the bug it guards is decoration',
    ]
  },
  {
    version: '2.57.3',
    codename: 'Bazaar',
    date: '2026-08-13',
    highlights: [
      'Gold, XP and everything else really do follow you between a phone and a PC now. Signing in had been merging the two saves correctly and then throwing the result away, which is why the previous two fixes did not hold',
      'The merge was never the broken part. Cloud save wrote the reconciled save to localStorage and then reloaded the tab to make the services read it — and `location.reload()` fires `pagehide`, which is exactly when the ledger and the XP store flush the copy they were still holding. The last write before the restart was always the pre-merge one, and the reload read it straight back',
      'The ledger did not even need the reload to lose it: idle Gold settles on a one-second tick behind a five-second write throttle, so the merged save was usually overwritten within a second of being written. Both devices reported "Synced" the whole time, because the cloud copy was correct and the merge really had happened — only the adoption never landed',
      'The eighteen services that own the save now expose two callbacks: settle anything in flight before the merge reads their blob, and re-read it in the same tick as the write. There is no window left for a stale flush to land in',
      'Adopting cloud state no longer reloads the page. The numbers change in place, so the once-per-session reload guard is gone, and so is the class of blobs that a tab "could not safely adopt" — that restriction only existed because the reload could not be spent twice',
      'A tab left open all day now picks up the other device\'s progress on its own push loop instead of waiting for a navigation, and the merge dialog reads the visitor\'s real Gold rather than a figure up to five seconds stale'
    ]
  },
  {
    version: '2.57.2',
    codename: 'Bazaar',
    date: '2026-08-13',
    highlights: [
      'Global CSS is 17% smaller raw and 14% smaller gzipped (48.7 kB to 40.4 kB squashed, 11.2 kB to 9.6 kB over the wire) on every page, /tools included. 77 rules and 161 class names went, all of them leftovers from a design the site stopped using several releases ago: the galaxy map and star system, the orbiting stars and the warp overlay, the CSS planet and its nine layers, the whole lp-* live-preview block, tools-cta, the old hp-hero/spotlight/live/sub/changelog surfaces, skill-card and project-card',
      'Nothing removed here could change a pixel, and that was the bar for including it. Every one of the 161 was checked for being APPLIED — a class attribute, a [class.x] binding, an ngClass literal, a classList call or a className assignment — across every html, ts and js file, not merely mentioned somewhere. That distinction is what kept .tool-card (still used by /blueprint and /mcp), .cosmic-char and .cosmic-tilting (added at runtime by cosmic-engine.js, which the first sweep never read) and .btn-live-preview (a substring match on .live-preview) out of the list',
      'Four keyframes nothing referenced any more went with them — nebulaHue, lp-line-in, lp-progress, lp-blink — and the dangling-animation sweep the design notes ask for after any CSS refactor was re-run over every stylesheet: zero dangling references remain. Its one cross-file hit, agPulse, is legitimate — shadow-cipher lists arena-game.css in its own styleUrls, so the two share an encapsulation scope',
      'cosmic-engine.js had rotted the same way its own comments describe from the 2.44.0 purge. Its hover, cursor, tilt, reveal and typewriter selector lists between them named fourteen classes that exist nowhere — .galaxy, .orbit-star, .skill-card, .project-card, .hp-spotlight__card, .tools-cta, .tools-header__title and `.skills h2` among them, the last aimed at a component deleted outright. /tools was getting no reveal, no hover lines and no tilt because every selector pointed at it had been deleted out from under it',
      '/tools stays out of the engine\'s reveal and tilt lists on purpose rather than by oversight. Its gates run their own reveal, which kindles an edge instead of gating opacity, and listing them globally would put the page\'s content back behind an observer — the exact failure 2.56.0 was built to avoid. A gate already answers the cursor with a lift and a parallax push, so a tilt on the same surface would be two alive interactions on one card',
    ]
  },
  {
    version: '2.57.1',
    codename: 'Bazaar',
    date: '2026-08-13',
    highlights: [
      'The Vault flickered under the cursor. Hovering a card lifted it two pixels, and hit testing follows a transform, so entering the bottom two pixels of a card lifted that card out from under the cursor that had just entered it — mouseenter, mouseleave, coming to rest lifted and unhovered. A hand keeps emitting mousemove, each one re-running the hit test and re-entering the loop, which is the flicker. The card is now a frame that never moves with a face inside it that carries every hover effect: the box that answers :hover is stationary, and the box that moves answers nothing',
      'The hover detail moved off the card and into a tooltip above it, with pointer-events: none. A panel the cursor can land on is a second hover target stacked on the first, and the two trade the hover back and forth — the same bug wearing a different hat',
      'The Vault learned to filter. Chips for every rung of the Eclipse ladder, counted against the shelf and search you already have so a chip reading 0 warns you before you click it; a search across name, effect and flavour; and a sort by rarity, name, value or owned-first. No "date acquired" and no "sell value" — the ledger records neither, and a sort order invented from nothing is worse than one that is missing',
      'Identical things stack. Bellows held at level four is one card with a ×4 badge instead of four lines of the same name, and opening the stack lists what the badge counted. The shelf is also no longer re-filtered and re-sorted several times a second: it is recomputed when a control is touched or the ledger moves, which on a page with a one-second ticker under a live XP bar is the difference between a list and a treadmill',
    ]
  },
  {
    version: '2.57.0',
    codename: 'Bazaar',
    date: '2026-08-13',
    highlights: [
      '/market was nine tabs over one ledger, each with its own hand-written panel — nine copies of a row, nine buy buttons, and nine places for a change to land on eight of them. Finding anything meant knowing which tab it lived on first, which is the one thing a shopper does not know. Every catalog is now projected into one item shape and rendered by one row, so category is a filter rather than a place',
      'Search, rarity and price work across the whole inventory at once. Typing "hammer" returns hammers without the visitor having been told where hammers are kept, and the rarity facet pulls the Mythic rung out of all eight shelves together rather than one at a time',
      'The floor is three columns: search, shelves and rarity tiers on the left with live counts; the inventory in the centre as one row shape — icon, name, effect, lore, rarity badge, price, yield, action — paginated eight at a time; and on the right a board of holdings, the Patron card, and the Gold income breakdown moved out of the masthead. The currency bar reads Gold, Essence, Shards, rate and total value up front, so what can be spent is known before anything to spend it on is shown',
      'The Eclipse stayed a panel instead of becoming a row. It is not a purchase — it is a reset that takes every Gold ladder the visitor owns — and a BUY button on that in a list of BUY buttons would be a trap. Its two-click arming, and the full accounting of what it takes, are unchanged',
      'Rarity is derived from the rung rather than authored onto 32 more catalog entries. Only Artifacts carry a real tier; everything else takes one from its position in its own catalog, mapped across the six Eclipse tiers. The ladders are already ordered by price, so the badge and the number cannot contradict each other, and adding an item re-grades its shelf rather than needing a decision. The tiers are the site\'s existing Eclipse ladder, not a second Common-to-Legendary vocabulary standing beside it',
      'The board names what it is showing. It reads the visitor\'s own deepest holdings and says "deepest holdings" when it has them, and falls back to a curated realm-wide list under "most forged" only until there is real data — so a curated list never wears the words "in your forge"',
      'The scroll reveal hides nothing that a script did not first arm. The usual opacity:0-until-observed shape would have left the entire shop invisible to anything that never ran the observer, and this page is prerendered precisely so its inventory reads without JS. The served markup is visible; only a browser that reached armReveal opts in, and only for blocks below the fold, so nothing is painted and then hidden',
      'The item list is cached against the balances and holdings rather than rebuilt per getter. The template reads it through five accessors and the ledger publishes every second — without the cache that is five rebuilds of 37 items a second for a page where one number moved',
      'On mobile the filter rail folds into the tab strip, which is why that strip moved to 44px there: it stops being a control beside a sidebar and becomes the only way to change shelf. Verified at 375 with zero horizontal overflow, and Gold takes a full-width row of its own so a ten-digit figure does not wrap mid-number',
    ]
  },
  {
    version: '2.56.1',
    codename: 'Cartographer',
    date: '2026-08-13',
    highlights: [
      'Signing in on a phone and on a PC produced two unrelated Godforges while both devices reported "Synced". The bag, the character sheet, the explorer roster, the expedition log, the rune ledger and the scroll collection were never in the sync registry at all — six blobs that went missing across five releases, because nothing fails when a key is left out of it. XP, Gold and the eggs reconciled correctly the whole time, which is exactly why this looked like sync and was not',
      'Three of the six needed a rule of their own rather than the generous structural default. Taking the higher of two stat builds field by field hands out points nobody earned; an item\'s placement belongs to one device, so a merged one would be worn in a slot neither put it in; and an expedition in flight is a wall-clock timer that must not be adopted, or the mission pays out twice. The Pro pack rides along for the opposite complaint — bought on a desktop, it showed ads on the phone',
      'The ten-second push loop overwrote the cloud outright, which undid the careful merge at sign-in every time. Earn 500 Gold on a phone and a desktop tab left open since the morning erased it on its next tick, silently, with both devices still reporting "Synced" — because from each one\'s side it was. Progression had the same shape of bug; the rule refusing a smaller xp caught the outright wipes and nothing else, so achievements and the daily history regressed quietly whenever it did not fire',
      'Both write paths now read before they write and merge under the rules the sign-in already used, so two devices commute — whatever order they write in, they converge, and one that is behind can no longer erase one that is ahead. An explicit "keep this save" from the merge dialog still overwrites, because that is a visitor overruling the rules on purpose',
      'Nothing ever pulled a second time. Reconciling happened once, at sign-in, so a tab left open never looked at the cloud again and an evening on a phone stayed invisible on the PC until the page happened to be reloaded. Returning to a hidden tab now re-runs the whole pass, floored at a minute — that is the moment somebody has put one device down and picked up another, and it costs nothing on the tabs nobody leaves',
    ]
  },
  {
    version: '2.56.0',
    codename: 'Cartographer',
    date: '2026-08-13',
    highlights: [
      '/tools was the last surface still speaking the pre-Eclipse vocabulary — spiral galaxies, orbiting stars, a warp animation on click — sitting under Godforge chrome that had moved on without it. It is now the realm map itself: five gates, each carrying its realm\'s painting, sigil, lore and count, and opening one walks into that realm with its art as a banner and its tools beneath as realm-tinted forge cards',
      'The galaxy and star-system views are gone rather than restyled. They were a second navigation over the same 126 tools — categories in one hand, realms in the other, each clearing the other to avoid an empty set — and removing them takes the lazy chunk from 142 kB to 118 kB. Links minted with the old ?category= are resolved to the realm that holds that category rather than dropped',
      'Three realm accents were re-cut against the art they sit in front of. Archivum and Nexus had in effect swapped — a gold accent on a green glasshouse, a green one on a lava-lit mail forge — and Umbral was wearing --forge-crimson inside a violet vault. That accent is also the badge on all 126 tool pages, so this corrects them everywhere, not just on the map',
      'Text contrast is carried by a bed anchored to the copy rather than by one wash over the card. The five paintings disagree about where they are bright: bg-umbral is near-black while bg-verdant is a sunlit glasshouse, and a single scrim dark enough for the glasshouse turned the marble hall to mud. The card-wide veil now only sinks all five to a common depth',
      'The scroll reveal deliberately does not gate visibility on a script. The usual opacity:0-until-observed shape would have put five full-bleed gates behind an IntersectionObserver, and an observer that failed to attach — an error earlier in the bundle, a hot-swap recreating the nodes — would leave the page looking empty with nothing logged. The gates paint from the SSR HTML and the observer only kindles their edge',
      'The kindle keyframes carry no animation-fill-mode on purpose. An animation outranks a plain declaration for as long as it applies, so forwards or both there would have pinned the gate edge at its resting opacity and silently killed every :hover rule under it — the same class of failure that left a dangling keyframe name unnoticed in the hero carousel for a release',
    ]
  },
  {
    version: '2.55.2',
    codename: 'Ladder',
    date: '2026-08-13',
    highlights: [
      'Google sign-in could end in silence. signInWithPopup polls the popup\'s .closed to notice a visitor giving up on it; when COOP severs the opener the read is blocked, Firebase concludes the window is gone, and it rejects with auth/popup-closed-by-user while the visitor is still on Google\'s consent screen. That code means "they changed their mind", so it was swallowed on purpose — the sign-in completed in a popup nothing was listening to and the page sat there signed out with no error to report',
      'The two causes share one error code and no way to tell them apart, so neither attempt is reported — but a popup that ends without a credential now marks itself, and the next click takes signInWithRedirect, which has no opener to sever. Someone who genuinely cancelled and came back pays one page navigation; someone whose browser severs the popup gets in on the second click instead of never',
      'Cross-Origin-Opener-Policy is now set explicitly to same-origin-allow-popups. Production was sending no COOP at all, so the default unsafe-none was carrying the popup by accident — any later hardening pass on firebase.json, or a browser shipping a stricter default, would have broken sign-in with no code change and nothing to connect it to',
      'Verified before shipping that the header cannot reach the popup\'s own page: Firebase Hosting serves the reserved /__/* namespace ahead of the headers config and strips custom headers from it, so /__/auth/handler returns 200 with no CSP and no COOP. A COOP landing there could have severed the postMessage that completes the sign-in — the fix would have caused the bug it was written for',
    ]
  },
  {
    version: '2.55.1',
    codename: 'Ladder',
    date: '2026-08-13',
    highlights: [
      'Tapping the Forge Flame on an iPhone raised the Save Image / Copy sheet instead of striking. The button bound (contextmenu) and preventDefaulted it, which is the whole fix on a desktop and on Android — but iOS Safari does not raise contextmenu from a touch at all. It answers a long press with the native callout, and the only thing that suppresses that is -webkit-touch-callout: none, which nothing on this button set',
      'Rapid tapping zoomed the page. Without touch-action on the button, double-tap-to-zoom was live on the one control whose entire purpose is being hit repeatedly, and every tap was also held ~300ms while the browser waited to see whether a second one was coming. touch-action: manipulation drops the double-tap and keeps pan and pinch',
      'The strike now lands on touchstart rather than click, so it answers at the start of the gesture instead of the end. Bound on the button and not on the host: a preventDefaulted touchstart across the whole component would have turned the HUD\'s Market and Rune Forge links into anchors a finger could not follow. The compatibility click behind it is discarded by a 700ms window, so one tap can never pay twice',
      'Bottom-centre and 80px, up from a 52px ember under the right edge that a left thumb could not reach. The offset stays 58px + env(safe-area-inset-bottom) + 18px rather than a flat number, because on a home-indicator iPhone the five-tab bar is 92px tall and a hard 70px would have parked the flame on top of a navigation control',
      'A tap now visibly squashes the ember. It has to be driven by a class rather than :active, because a preventDefaulted touchstart never produces :active — and it is held for a fixed 110ms, because a deliberate tap is 30-60ms of contact and releasing on touchend would have shown the squash for less than two frames. Plus a 10ms haptic tick where the browser offers one',
      'Fixed a separate mobile bug the audit turned up: the Forge View\'s in-page flame is position: relative, and the rule that lifts the corner flame above the tab bar was matching it too — an anchor on a fixed element is an offset on a relative one, so the Sanctum\'s centrepiece was being shoved ~76px up and out of its own panel on every phone. Both mobile queries are now scoped to :not(.ff--inline)',
    ]
  },
  {
    version: '2.55.0',
    codename: 'Ladder',
    date: '2026-08-13',
    highlights: [
      'Every rank now pays three stat points across five lines — Forge Power for Gold, Luck for Magic Find, Endurance for what expeditions bring home, Wisdom for XP and Charisma for Market prices. Points are settled against a counter rather than a level-up event, so every rank already reached is back-paid on the first load and nothing that happened before this shipped is lost',
      'Seven equipment slots around a Keeper silhouette on /forge-keeper, four worn and three for charms. Items roll their stats inside a per-rarity band when they are minted and keep them forever, so two Nexus sigils found an hour apart are worth comparing',
      'Magic Find is real and it is honest: 50% pays 1.5x on rare-and-better, 100% pays 2x, 200% pays 3x — measured over 600,000 rolls per level, not asserted. Every roll it diverts is one that was going to be a Common',
      'Explorers stopped being anonymous missions and became people, with generated names, six quality tiers, their own kit and up to six item slots each. A Mythic runs an hour-long expedition in six minutes and rolls the table six times at +200% loot. Missions already in flight when this shipped were adopted onto a real explorer rather than dropped',
      'The Rune Forge got expensive. A strike is 100 Gold rather than 10, and the ladder now tops out at a million: the Void is a two-hundred-thousand-Gold expectation, where it used to be twenty thousand',
      'Everything in the bag has a price. Commons sweep in one click; Rare and better ask first; artifacts are soulbound and have no Sell button at all',
      '/live is now /sanctum, the Inner Sanctum — the room where the roster is managed. Both former addresses 301 at the CDN, not only in the router, because /live was prerendered for two releases and is indexed'
    ]
  },
  {
    version: '2.54.0',
    codename: 'Atlas',
    date: '2026-08-13',
    highlights: [
      'Every realm has a room. Santiago\'s nine location paintings hang behind the routes they were painted for — the colosseum behind the Arena, the shop aisle behind the Market, the war table behind the Blueprint, the keeper\'s chamber behind your Forge, and the five realm halls behind all 126 tool pages',
      'Which room a tool page stands in is the realm it already belonged to: route → tool → category → realm, the same resolution that has been putting a realm badge on those pages, now choosing a painting as well',
      'A tool page downloads its own realm and no other. The paintings are chosen by a CSS attribute, so the browser fetches the one whose selector matches and never sees the other four',
      'The rooms prerender. Realms now resolve on the server too, so a tool page arrives with its painting rather than acquiring one a moment after it loads',
      'The rune sheet is in. A strike turns up the painted card instead of a name and a line of lore, the ledger fills with the cards you hold, the recipe wall carries all six runewords, and the Market shows the five artifacts as the paintings they are',
      'Mote, Seam and Ledger were never painted, and they keep the plain name-plate the whole ladder wore before the sheet arrived',
      '33 cards for 426 KB — not one of them had any transparency to preserve, so not one of them pays for an alpha channel',
    ],
  },
  {
    version: '2.53.0',
    codename: 'Codex',
    date: '2026-08-13',
    highlights: [
      'Ten more tools have a story behind them, taking the codex from ten entries to twenty — fifty new chapters, around fifteen thousand words',
      'The Architect\'s Grid, the Ward Reader, the Seal Breaker, the Living Scroll, the Time Keeper\'s Garden, the Seed Ledger, the Whispering Pages, the Flame Court, the Gauntlet of the Grand Gate and the Name Forge',
      'Every story runs five chapters and each one opens at a use count — the first is always readable, the second at ten, then twenty-five, fifty and a hundred. Nothing is gated behind an account, a payment or a secret, only behind having actually used the thing',
      'A locked chapter shows its numeral and how many uses are left, so the shape of what is missing is visible without spoiling it',
      'Realms are still derived from the registry category rather than authored in the codex, so three of these landed somewhere other than planned and the prose was written to fit — the Seal Breaker turned out to share a building with the Ward Reader, and the two stories now reference each other'
    ]
  },
  {
    version: '2.52.0',
    codename: 'Obsidian',
    date: '2026-08-13',
    highlights: [
      'The Rune Forge has its painting. Santiago\'s obsidian anvil — the X maker\'s mark on its face, rune crystals in the four rarity colours around it, the lightning vortex and the eclipse above — is the full-bleed backdrop for the route',
      'Three layers, the same pattern the homepage hero uses: the artwork, a dark gradient for readability, and the UI in glass on top',
      'Four derived files from the source PNG: three WebP widths and a JPEG fallback, 443 KB of WebP against a 2.4 MB source. The phone gets a portrait centre crop rather than a squeezed landscape, so the anvil still fills the frame at 375px',
      'Preloaded per breakpoint from the route itself rather than from index.html, so no other page on the site pays for artwork it does not show',
      'The drawn anvil and hammer are gone. There is a real one behind the glass now, and the strike button sits on its face',
    ]
  },
  {
    version: '2.51.0',
    codename: 'Signpost',
    date: '2026-08-13',
    highlights: [
      'The Rune Forge is in the command bar, third of six halls, between the Arena and the Codex. It had been reachable from the footer, one line of Codex prose and the Forge View loot panel, and from nowhere in the primary nav',
      'The row was widened to hold it rather than squeezed: the hall type is one size at every width now, the essence pill hides until 1480px, and the War Table — the one hall the tome and the footer both carry — sheds below 1300px',
      'Which turned up a live bug on the way. The Spanish command bar was clearing the wallet by two pixels before any of this, and the sixth hall turned that into a 119px overlap with MERCADO and the gold odometer both refusing clicks. Every threshold is now measured in both languages, and the halls clip rather than paint over their neighbours if it ever happens again',
      'A Strike the Anvil band on the homepage, under the artifacts, carrying live counts of runes, scrolls and runewords rather than adjectives',
      'The ember in the corner opens the Rune Forge on a right-click or a long press, and says so in its readout and to a screen reader',
    ]
  },
  {
    version: '2.50.1',
    codename: 'Keeper',
    date: '2026-08-13',
    highlights: [
      'The Google sign-in sheet used to say "Continue to xsantcastx-1694b.firebaseapp.com" — a project id nobody recognises, on the one screen where a visitor decides whether to trust the page with their account. It now says "Continue to xsantcastx.com"',
      'One line of config: authDomain in the environment files. The OAuth redirect goes to https://<authDomain>/__/auth/handler, and xsantcastx.com already serves it — Firebase Hosting answers the reserved /__/* namespace ahead of the "**" SPA rewrite, and the domain was already in the project\'s authorised list, so nothing had to be opened up to make this work',
      'Changed in all four environment files, not just the two that ship. scripts/build-env.sh copies environment.template.ts over environment.ts, so a template left on the old value would have quietly reverted this the first time that script ran',
    ]
  },
  {
    version: '2.50.0',
    codename: 'Keeper',
    date: '2026-08-13',
    highlights: [
      '/live is now the Forge View: the Keeper in the middle wearing everything bought, Gold/sec down the left, quests and expeditions down the right, and a rolling feed of every drop along the bottom',
      'Expeditions are the new mechanic. Send an explorer into one of the five realms for two minutes, ten minutes or an hour; they keep walking while the tab is shut and come home with Gold, XP, and sometimes a rune or a scroll',
      'The loot is rolled on *return*, not on dispatch. Rolling at dispatch would leave the pending rune sitting in localStorage in plain text for the whole mission, and anyone with devtools could re-dispatch until a Mythic fell out',
      'A mission is settled purely from startedAt + duration against the wall clock, so an hour-long expedition sent at midnight and reopened at 8am settles on load, in full, with no timer having survived anything',
      'Expedition runes go into the Rune Forge\'s own ledger through a new RuneForgeService.grant, not into a second collection: the runes are only worth anything because they craft Runewords, and a rune the crafting table cannot see is a trophy with the mechanic cut off it',
      'Lore Scrolls come along for free, because grant() is the same path a strike takes — an expedition rune rolls the Codex against its own tier exactly as the anvil does, fills the same sealed slot on the same wall, and counts toward the same two completion achievements. Expeditions therefore have no scroll odds of their own: a second roll would have paid twice for one find and needed its own copy of the shelf rules to do it',
      'The landing card was silently losing its own payload. The component subscribed to returned$ *after* calling explorers.init(), and init settles everything that landed while the tab was shut — so an overnight expedition banked its Gold correctly and showed the visitor nothing. Measured before the fix: 87 Gold arrived, no loot card, empty feed',
      'Simultaneous landings queue rather than overwrite. Three explorers finishing overnight all settle in one pass, and assigning each straight to the card left only the last one on screen with the two runes above it swallowed',
      'The Forge Flame is mounted inside the page here instead of pinned to the corner, and the corner copy stands down while it is — two clickable flames paying into one ledger is a thing the visitor would have to work out for themselves',
      'Explorer slots are bought on the Market\'s new Expeditions tab through the same ladder every other upgrade uses, capped at five — one per realm, because a sixth could only ever duplicate a realm already covered',
      'The AI mission-control feed was not deleted to make room; it moved to /mission-control intact. A side effect worth naming: its Firestore pollers now only run for somebody who deliberately opens that page, rather than for everybody who clicks "Live"',
      'The loot card renders in flow rather than as a fixed overlay. Every routed host carries a routeFadeIn transform with fill: forwards, which makes it a containing block — a position: fixed card inside one is pinned to the page and scrolls away under the header whatever its z-index',
      'Below 768px the warm wash and the fourteen embers come off entirely, which is the same trade the rest of the site made when the phone build was found spending its frame budget on wallpaper',
    ]
  },
  {
    version: '2.49.1',
    codename: 'Codex',
    date: '2026-08-13',
    highlights: [
      'A QA sweep of every tool page, loaded in a real browser at 1280 and 375 rather than read as source, found one structural defect and fixed it: emoji-picker was the only tool of 128 shipping without a realm badge',
      'The cause is worth writing down because the same shape will recur. The realm badge is not authored in any template — RealmService writes data-realm onto <html> and one global rule hangs the badge off `html[data-realm] .tool-header__eyebrow::after`. That reaches 128 templates without editing them, and silently skips any template not using the class it keys on. emoji-picker built its header from private ep-header classes, so it got nothing, and a mechanism that works by not being mentioned has no way to report that it missed one',
      'The shared classes were added alongside the ep-* ones rather than replacing them, so the component keeps its own styling. Verified on built output: the badge now resolves to "Archivum" in rgb(201,168,76), matching the Verge badge on json-formatter',
      'The rest of the sweep found no defects, which is itself the useful result. All 128 pages: zero load failures, zero console errors, zero horizontal overflow at 375px, all with an h1, working inputs, a glassmorphism surface, a purple-family border and the same rgb(7,9,15) background. Prerendered HTML is clean — no leaked {{ }} interpolation, no stub renders, no empty shells',
      'The reported "broken HTML showing as text" did not reproduce as a defect. Three tools do render angle brackets as visible text — font-pairer\'s "Copy <link> Tags", svg-to-code\'s "<title>" and ts-playground\'s "Partial<T>" / "ReturnType<T>" — but every one is deliberate: they are labels naming HTML tags and TypeScript generics, correctly escaped and correctly displayed. They were left alone rather than "fixed" into something wrong',
      'Two earlier suspects were checked and cleared rather than assumed: the 15 tools that inject syntax-highlighted HTML via [innerHTML] already scope their colours with ::ng-deep, so emulated encapsulation is not stripping them; and the CSP inline-handler hashes still match the built output, so the main stylesheet is not being blocked the way it was once before'
    ]
  },
  {
    version: '2.49.0',
    codename: 'Codex',
    date: '2026-08-13',
    highlights: [
      'The Rune Forge now turns up Lore Scrolls alongside runes — twenty-five fragments of the Eclipse Realms codex, in five chapters of five',
      'The better the rune, the likelier the page: a Common carries a scroll one strike in ten, an Epic three in five, and the Void every time',
      'A new Lore tab on /codex holds the wall — parchment and serif rather than neon, with sealed fragments showing nothing but their number until you find them',
      'The Prophecy of the Final Eclipse needs an Epic rune or better, and its last page has never come up for anything but the Void',
      'Two achievements: Lore Hunter at ten fragments, and The Full Codex at all twenty-five — which cannot be finished without the rarest rune in the table',
    ]
  },
  {
    version: '2.48.1',
    codename: 'Anvil',
    date: '2026-08-13',
    highlights: [
      'Cloud save is now findable. Everything behind it already worked — Google sign-in, the uid bind, the blob merge, the ten-second push loop — but the only control that started it was on /forge-keeper, and nobody opens a character sheet to discover that their progress can follow them. The command bar carries it now, on every page: the Google mark and "Sign In" signed out, the account avatar with its sync state signed in',
      'The mobile tome carries the full control too, so a phone gets the account, the last-synced line and the way out without a route change. It mounts only while the drawer is open — the drawer stays in the DOM when closed, and a component with its own buttons cannot be kept out of the tab order with the [tabIndex] its sibling links use',
      'The command bar was already overflowing before any of this. The row never shrinks, so at 375px the hamburger\'s right edge sat at 395 in a 375px viewport — the primary mobile nav control, clipped, on a fresh save. Adding a fifth control pushed it off the screen entirely',
      'The breakpoints that shed the pills are now measured against the gold odometer rather than a fresh save\'s zero. It renders one column per digit of the real balance, so the wallet is the only item in the row whose width depends on how long somebody has played: with seven figures and every pill shown the row needs 516px, and the old thresholds were set where a "0" fit and passed at every width. That is why this kept coming back',
      'So the essence and rank pills leave at 560px, the keeper glyph and the codex count come back later, and the wallet holds on to 364px — just under the iPhone SE width, so the most common phone keeps its gold. Verified with a seven-figure balance at eleven widths from 320px to 1440px: nothing clips, and the last control in the row takes a click at every one',
      'The bar\'s wallet drops its Gold/sec pill below 420px and keeps the count. Scoped to that instance, not the viewport — the tome renders the same component at the same widths in a drawer with room to spare',
    ]
  },
  {
    version: '2.48.0',
    codename: 'Anvil',
    date: '2026-08-13',
    highlights: [
      'The Rune Forge opened at /rune-forge. Ten Gold a strike buys one of twenty-five runes across seven tiers, from Ash at roughly one strike in eight down to Void at one in two thousand',
      'Six Runewords consume the runes they name for a permanent bonus — First Light pays +25% Gold, Godforge Mastery +100% to Gold, quests and XP, and Breath of the Void triples all income but wants the Void rune itself',
      'The bonuses are real income, not a trophy shelf: they join the same multiplier chain the upgrades, the streak, the shards and the Fragment already run through, and they are priced from the ledger so offline settlement pays them too',
      'Eight new achievements on the Codex wall, two of them Mythic because they cannot be reached without the rarest rune in the table',
      'Every rune carries a line of codex lore, and the anvil is heard as well as seen — the strike pitches up with the tier and everything above Epic adds a sub-bass voice',
    ]
  },
  {
    version: '2.47.0',
    codename: 'Tribute',
    date: '2026-08-13',
    highlights: [
      'The site can now earn. Two surfaces went in: the ad slots that were already on 39 tool pages finally render something, and /pro sells a one-time $9 Pro Pack',
      'The Carbon Ads unit had been sitting on those 39 pages serving nothing for months. Its serve id was the string CWYD42JY, which has exactly the shape of a real Carbon id — the only thing marking it as a placeholder was a comment four lines above it, and comments do not fail builds',
      'Placeholder ids are now named constants compared against at runtime, so ad-config.ts can answer "is a network live?" instead of every surface assuming one is. Nothing about the slot depended on that answer before',
      'With no network configured the slots render a house card — "Your ad here", linking to /sponsors — rather than an empty box. Dead inventory became the only thing that actually sells inventory: proof the slot exists, is well placed and looks good',
      'Ads now know when not to paint: Pro holders never see one, /admin, /forge-keeper, /pro, /sponsors and /donate never carry one, and nothing requests an impression while the boot curtain is still up — an ad served under the splash is an impression billed to an advertiser that no human saw',
      'The Pro Pack is $9 once: every ad gone, a permanent 2x XP multiplier, 500 Gold, 50 Eclipse Essence, three exclusive cosmetics and early access to new tools',
      'The 2x composes into the existing multiplier rather than calling setMultiplierSource a second time — that method replaces its source instead of composing, so a second caller would have silently deleted the enchantments, the Mirrorblade, the Relic and the Fragment, and only for the visitors who paid',
      'Pro grants are settled once and marked before they are minted, the same discipline markLevelsPaid documents: a failed write costs a buyer 500 Gold, where the other order would have paid out again on every reload of a bookmarked success URL',
      'Sponsor pricing is public for the first time — $200/month for one tool category, $750 for the whole network — alongside a contact block that says what to put in the mail and when a reply lands',
      'The audience figures on /sponsors are still "on request". They are shown to people deciding whether to send money, and none of them has been checked against the analytics dashboard yet; AUDIENCE_VERIFIED in sponsors.component.ts is the one-word switch once they have'
    ]
  },
  {
    version: '2.46.1',
    codename: 'The Answer',
    date: '2026-08-13',
    highlights: [
      'CI is green again, and not by deleting the tests. The brief blamed the Playwright visual regression suite, but that had already been fixed a release earlier: those tests are opt-in behind VISUAL=1 and skip on CI entirely, and the rest of the suite passes — 7 passed, 12 skipped, 0 failed',
      'The step that was actually red is Lighthouse CI. It had never run at all until the Playwright failure short-circuiting the job was fixed, so the first thing it ever did was report real numbers: /home TBT 928ms against a 200ms budget at perf 0.36, and /tools TBT 2864ms at perf 0.05 with CLS 0.85 against a 0.02 budget',
      'Lighthouse is now continue-on-error: it still runs and still reports, it just no longer holds the badge hostage. The budgets in lighthouserc.json are deliberately NOT relaxed — moving the goalposts would have thrown away the only measurement telling us about the layout shift on /tools',
      'Playwright stays blocking, because it passes and is therefore a real gate. Deleting it as briefed would have removed 7 working tests including the two horizontal-overflow checks guarding the mobile work',
      'Dropped the "Upload visual snapshots" step, which re-uploaded the committed darwin baselines to itself every run for 30 days of retention, since the visual tests never produced anything on CI'
    ]
  },
  {
    version: '2.46.0',
    codename: 'The Answer',
    date: '2026-08-13',
    highlights: [
      'Every clickable surface now answers back: a 2px lift on hover, a 0.97 press on pointer-down, an edge in the realm colour, and one consistent focus ring — all on the Material curve at 200ms, with the press at 90ms because a slow press reads as lag rather than weight',
      'The interaction layer never writes transform, and that is the whole design. It loads last, so a global transform would REPLACE what a card already does rather than add to it: .tool-card--live already hovers with translateY(-6px) rotateX(-4deg), so the obvious implementation would have silently deleted the 3D tilt on all 126 tool pages. The lift uses the independent translate property and the press uses scale, which the compositor combines with whatever transform is already there',
      'Only things that actually respond to a click are lifted. A hover lift on a static panel advertises an affordance that is not there, and inline prose links are excluded because a link that jumps 2px reflows the sentence around it',
      'Card edges resolve through --realm-color, then --star-color, then purple, so the tools page lights up in its own realm colour (Luminous gold, Umbral rose) rather than a flat accent',
      'Scroll reveal was keyed to a list of class names that had rotted: it still named .skill-card, .project-card and .contact-section, all deleted in 2.44.0, and named nothing on /codex, /market, /quests, /forge-keeper, /arena or /sponsors. Most of the site scrolled with no reveal at all. Now keyed on main section, so it covers the pages that exist and the ones added later',
      'Reveal retimed to 18px over 380ms from 28px over 850ms, and the route fade to 200ms on the same curve — the old timings read as sluggish next to everything else',
      'The nav underline wipes in from the left instead of appearing at full width; one ::after serves both the hover wipe and the active dash',
      'The Forge Flame tap is now a shallow .96 dip with a spring on release instead of a flat scale(.9) hold, and its glow-on-press had to move off .ff__core: that element runs ffBreathe, which animates filter, and a running animation outranks a plain declaration for the property it animates',
      'The achievement drop slides in from the right, which is safe only because it is already right-anchored above the flame. The quest toast keeps its vertical entry and only gains the spring — the bottom-right corner is three widgets deep and a toast animating into it has eaten clicks on the flame before',
      'Reduced motion drops movement and timing but keeps every state that carries meaning: outlines, hover colours and focus rings all survive'
    ]
  },
  {
    version: '2.45.0',
    codename: 'Thrift',
    date: '2026-08-12',
    highlights: [
      'Firestore was serving 1.1 million document reads a day, and almost all of them came from one page: /live polled five collections on three-to-eight-second timers, each an unordered list call for up to two hundred documents, which is roughly eleven thousand reads per visitor-minute — and cost exactly the same for a tab left open in the background as for one being watched',
      'Those polls are now bounded, ordered queries that tail from the newest entry already seen, so a feed nobody is writing to costs one read per poll instead of two hundred; measured live, /live went from ~10,900 to ~30 billed reads per visitor-minute',
      'The feed also suspends itself entirely on a hidden tab or after fifteen minutes untouched, says so, and resumes on any click, key or scroll — a page opened in a background tab now polls nothing at all',
      'Every other read goes through a new read-through localStorage cache with a per-caller TTL: counters for an hour, the visit total for thirty minutes, admin panels for five. A repeat page load makes zero Firestore requests where it used to make one per counter on screen',
      'The visit counter stopped reading before it writes — increment(1) is atomic on the server, which is what the transaction was really for, and the total on screen comes from the cache',
      'The changelog, donation feed and admin dev-log dropped their standing snapshot listeners, each of which billed a full page of documents just to attach and re-billed on every write',
      'Admin panels are whole-collection scans that no limit can help, so they get a Refresh button and a "last updated" line instead, and the long lists paginate',
      'Signing in with two saves that each hold something the other does not now asks which one wins — This Device, Cloud, or Merge Best — instead of silently taking the higher of every number. It only opens when the question is real: a cloud save simply ahead of this browser still merges without interrupting',
      'The sign-in button says "Sign In" with the Google mark and "Sync across devices" under it, rather than "Save Progress" for a control that opens an account chooser'
    ]
  },
  {
    version: '2.44.0',
    codename: 'The Purge',
    date: '2026-08-12',
    highlights: [
      'The last six portfolio pages are gone: Skills, Projects, Contact, About, Services and the Guestbook. They described a freelancer for hire, and The Godforge is a product, so they were deleted rather than restyled',
      'Deleting them orphaned four more files that went with them — contact.service.ts and email.service.ts (only the contact form called them), portfolio.service.ts (only the skills page), and realtime-dbservice.service.ts, whose every method read or wrote the guestbook node of the Realtime Database',
      'shared/components.ts went too. It was already dead: a barrel re-exporting nine components that had not existed for several releases, which only survived because nothing imported it',
      'Old links still work. Each deleted path redirects to the nearest surviving surface — /skills and /services to /tools, /projects to /blueprint, the rest to /home — with matching 301s in firebase.json, since the in-app redirects alone never see an HTTP request',
      'The drawer stopped pointing at deleted pages: Quests and Sponsors take the two MORE slots that Services and Contact held. The footer keeps a plain mailto, because a product still needs a way to be reached',
      "The 404 was the last page painted in the old cosmic cyan; it now uses the Eclipse purple, matching everywhere else",
      'Swept out what the deletions exposed: five nav runes, 23 translation keys across both languages, three RouteTitles entries, and an analytics trackCTAClick() whose signature was hire_me / download_resume / view_portfolio',
      'The Codex secret pointing at /guestbook is retired, and the secrets ledger now prunes ids the registry no longer knows — without that, anyone who had already found it would have read as 13 of 12',
      'The admin dashboard stops counting guestbook signatures with a full getDocs() over a collection nothing writes to any more',
      'Net: 3,298 lines deleted, four fewer prerendered routes, sitemap down from 149 to 145 URLs, and @angular/fire/database out of the build entirely'
    ]
  },
  {
    version: '2.43.0',
    codename: 'Gold Per Second',
    date: '2026-08-12',
    highlights: [
      'The idle economy was priced per minute and settled per minute, which made the one number it produces invisible — a rate you can only observe by waiting sixty seconds for it to move once is a rate nobody believes in. The unit is now the second, from the price tables to the settlement loop, and the header carries a live Gold/sec readout instead of a Gold pill that changed once a minute with no animation at all',
      'The count rolls. Every digit that changed in the last second is swapped through a two-layer slide — the old digit leaves upward, the new arrives from below — and the rate chip beats once beside it. Past a thousand the rate abbreviates to 1.2K and 3.4M so the chip cannot grow sideways and shove the whole nav row along with it; on a phone the unit compacts to "/s"',
      'Forge upgrades go from five rungs to ten, ending at The First Sun for ten million Gold. Two shelves are new: Mastery, four one-off multipliers that add rather than compound (+185% holding all four), and Automatons, three repeatable machines that strike the Flame for you',
      'The automatons are income, not input. Routing a twenty-a-second machine through the real click path would have held a x1,000 combo forever and collected three Codex achievements for striking the Flame while the tab sat behind a text editor, so they are folded into the per-second rate and the Flame is told to look struck once a second instead. They are counted apart from your own strikes, and they will not hold a combo for you',
      'The Eclipse: a prestige reset at ten million all-time Gold or rank 10. It wipes Gold and all four Gold ladders and grants Eclipse Shards worth 5% each, forever. Shards are priced off the all-time total minus what has already been granted, so four resets at ten million pay exactly what one at forty million pays — without that, the square-root curve would make bailing out at the threshold strictly better than playing on',
      'What the Eclipse does not take is deliberate. Rank, Essence, artifacts, cosmetics and the Codex all survive it: those are records of things the visitor actually did, in systems that predate the Market and cannot tell a prestige from data loss. The button is two clicks and the second one names everything it is about to cost',
      'The Market shows its working. A Gold income breakdown lists every source and every multiplier as its own line, each naming the upgrades responsible and totalling to the headline rate — a rate nobody can decompose reads as arbitrary, which is the state the old one was in',
      'Buying something now flashes the wallet and floats the real rate delta rather than the number printed on the card: a Forge Bellows bought while Forge Mastery and nine shards are held floats +0.7/sec, because that is what actually happened',
      'The tick fires sixty times more often than the old one, so the ledger now writes at most once every five seconds with an immediate flush on purchase, prestige, paid-rank markers and pagehide. Gold and the idle clock are written together, so a dropped write rewinds both and the next load re-settles exactly the span it did not save — the failure mode is repeated work, never a double credit and never a loss',
      'Settlement skips the change-detection pass entirely on a hidden tab. A foreground tab costs exactly one pass a second for the counter; a background one costs nothing at all'
    ]
  },
  {
    // Renumbered from 2.41.0: that number had already shipped to main and been
    // tagged v2.41.0 by the atmosphere release below, which landed while this
    // one was still on dev. Two entries carrying the same version would have
    // rendered as duplicate rows in the /blueprint dev log.
    version: '2.42.0',
    codename: 'The Foundation',
    date: '2026-08-12',
    highlights: [
      'The security policy and the site it protects had drifted apart. The policy pinned one inline script by checksum, the page carried two, and the checksum matched neither — so the browser had been refusing to run both of them. The first-visit boot cut, the console banner, the Konami sequence and the arcane seal were all dead in production while working perfectly on every developer machine, because a local server sends no policy at all',
      'The stylesheet was the more expensive casualty. Angular defers the non-critical CSS behind a one-line inline handler, and inline handlers need their own permission that the policy never granted — so the deferred sheet never loaded and every page had been rendering on inlined above-the-fold CSS alone. That handler is now allowed by exact checksum rather than by opening the door to inline script generally',
      'A build step now recomputes every checksum against all 282 built pages and fails the build when one drifts. This class of bug is invisible by construction — no error, no warning, and it only manifests in production — so the guard is the actual fix and the checksum corrections are just today\'s instance of it',
      'The embed surface was walled off by its own headers. Hosting applies matching header blocks in order and the last one wins, so the site-wide policy was overwriting the embed policy and stripping the rule that permits third-party framing — leaving all 127 embeddable tools refusing to render on anyone else\'s site. The blocks are reordered and the embed policy is now a full copy rather than a fragment',
      'Google Analytics and Google sign-in were reaching for hosts the policy did not list. Analytics loaded and then silently failed to send anything; the sign-in popup needed a script host that was absent. Both are now allowlisted',
      'The site is installable. A hand-written service worker keeps the app shell alive offline, and an install banner appears once — bottom-left, the one corner not already claimed by the flame, the achievement drop, the quest toast or the cookie bar, and only after the cookie question has been answered so the two are never on screen together',
      'Uncaught errors are captured with structure instead of vanishing: a fingerprint per fault so a render loop reports once rather than two hundred times, a filter for the five known-benign browser and deploy-timing errors, and a cap per page load',
      'The quality gate stopped lying. Its screenshot tests only ever had macOS baselines committed, so on the Linux CI runner they failed every run; two more tests had been pointing at a hero carousel deleted sixteen releases ago; and one waited on a network-idle moment that a page holding a live database connection never reaches. All three are fixed, the suite is honest again, and the Lighthouse audit now runs even when a test fails instead of being skipped, as it had been every run since it was added',
      'Ten debug logs removed from the production console, including one that printed each donation — donor email and amount included — on every completed donation',
    ],
  },
  {
    version: '2.41.0',
    codename: 'Five Rooms',
    date: '2026-08-12',
    highlights: [
      'Every page now has a colour of its own. The Arena is lit from below in crimson like a pit, the Codex by candlelight from the same direction, the War Table under overhead instrument cyan, the Market by forge energy above and the colour of money underfoot, and Realms by the Godforge core with Luminous and Verge bleeding in from the top corners',
      'A tool page wears the colour of its own realm, taken from the same hex that paints its badge and its sigil glow, so the wash can never disagree with the header it sits under',
      'The Forge Keeper wears the visitor rather than the route: above 55% Aether the page glows Solari gold, below 45% it goes Nocturne crimson, and the band between stays the neutral core because neither realm has claimed you yet',
      'Walking between rooms fades rather than cuts. The five wash colours are registered custom properties, which is the one way a gradient can be made to interpolate — a plain background swap is a hard cut — so a route change cross-fades one palette into the next over half a second, and reduced motion takes the destination instantly',
      'These are stand-ins for art that has not been painted yet, and they are built to be thrown away: when a page gets its own artwork, one entry is deleted and the painting takes the first slot of the same background',
      'The home page is untouched. Its painted altar is the atmosphere, so it is the one route with no entry in the table and no wash at all behind it',
    ],
  },
  {
    version: '2.40.0',
    codename: 'Lean',
    date: '2026-08-12',
    highlights: [
      'The command bar carries five halls instead of seven: Realms, Arena, Codex, War Table, Market. HOME went because the wordmark beside it already goes there, GAMES because that is what the Arena is under an older name, and MCP because it is one landing page for a different audience',
      'Nothing from the old portfolio site is reachable from the primary nav any more — Services, Projects, About, Contact, Live and Donate are all out of the bar and out of the tome\'s main list. Every one of them keeps its route and is linked from the footer, so nothing became unreachable',
      'The tome is two sections instead of three: the same five halls as the bar plus your own sheet, then a MORE group holding the three old surfaces that still have real routes. ABOUT is absent rather than shipped as a link to the 404 page, because there is no about route to point it at',
      'The homepage is four sections and the footer: the hero, the five realms, the pulse, the closing call. The shop counters, the creed row, the featured-tool spotlight, the "watch AI build" panel, the changelog feed and the newsletter form are gone from it — six screens of persuasion stood between a visitor and the tools',
      'The chronicle moved to /blueprint, which is the page about what is being built, and the newsletter moved to the tool pages, where somebody has just got value out of one. Neither was deleted; both were taken off the front door',
      'Cloud save is reachable. The profile sheet said "Cloud save is not open yet" while CloudSaveService was signing in with Google, binding the uid, merging blobs and pushing on a timer — the message was true when it was written and had been false for a release. The only thing missing was a mounted button: the component that held it was the XP bar, which is not rendered anywhere in the app',
      '1,200 lines of stylesheet went with the deleted sections, and the audit that follows any CSS cut of that size found no @keyframes reference left pointing at a rule that no longer exists'
    ]
  },
  {
    version: '2.39.1',
    codename: 'Clean Cut',
    date: '2026-08-12',
    highlights: [
      'The boot sequence never faded out. The rule that dismisses the curtain early set a plain opacity of zero, and a running CSS animation outranks a plain declaration — so gfCurtain, which pins the curtain opaque for the first 88%, won every time. Any early dismissal was a hard cut to the site. The rule is marked important now, which is what it takes to beat an animation',
      'Holding at stage six no longer eats the ending. The hold pauses the CSS, but the stage-seven tick and the teardown were still armed against a clock that had stopped: the read-out jumped to a hundred over a frozen frame, and the teardown then dropped the curtain mid-hold, so the flash and the flight into the navbar were skipped and the site arrived in a cut. Those timers are cancelled going into the hold and re-armed against the remaining animation time coming out',
      'The hold is bounded twice. Its own cap comes down from six seconds to six hundred milliseconds, and a single absolute deadline now fires once from boot regardless of what else is or is not happening — a wedged router event, a timer out of order — so the curtain can cover the site for at most about three and a half seconds in the worst case a user can actually reach',
      'Teardown is idempotent. Four paths reach it and it now runs once, and it releases the pause on the way out so the sigil is not frozen mid-shake behind the fade'
    ]
  },
  {
    version: '2.39.0',
    codename: 'Three Layers',
    date: '2026-08-12',
    highlights: [
      'The homepage is down to three layers, the way a game studio builds one: the artwork, a single dark gradient for readability, and the glass UI on top. Nothing else is drawing atmosphere there any more',
      'The CSS planet is gone — sphere, rings, clouds, terminator, night lights, the moon and the beacon, six hundred and ninety-five lines of stylesheet that existed to fake something the painting already has',
      'On the homepage the site\'s whole CSS backdrop is switched off: the body gradient, the nebula wash, the generated starfield, the matrix layer, the drifting pulsar, the corner runes, the particle layer and the constellation canvas. Two atmospheres competing is worse than either',
      'It is switched off for that route only. Every other page still has that backdrop, because it is the only thing behind them — there is no artwork for /tools or /codex yet, and stripping it there would leave twenty routes on flat black',
      'The hero art is preloaded into the homepage document alone, one link per breakpoint matching the picture\'s own sources, so the preload resolves to the same file the element picks and no other route fetches a hero it never paints'
    ]
  },
  {
    version: '2.38.0',
    codename: 'The Forge Lit',
    date: '2026-08-12',
    highlights: [
      'The boot sequence is no longer a diagram of the sigil — it is the sigil. The X is beveled stone lit from the top left, and a network of seventeen fractures runs through it, catching light from the centre outward as the forge takes hold',
      'The ring is carved rather than drawn: its edges are displaced by noise so the stone reads as chiselled, it is speckled with grain, and it turns against its own glyphs so the band and the runes move independently',
      'The twelve runes now ignite one after another around the circle instead of all at once, and the four compass marks snap in over-scale and settle — the whole of stage three reads as light travelling around the seal',
      'Once the forge is lit it throws things off: embers rising through the frame, twelve volumetric shafts turning slowly behind the ring, three shockwaves off the core, and a four-point star flare on the white-hot centre',
      'The void has depth before any of it starts — three sheets of stars drifting at different rates, with the nebula held back until the power arrives so stage one stays as black as it was written to be',
    ],
  },
  {
    version: '2.37.0',
    codename: 'The Altar',
    date: '2026-08-12',
    highlights: [
      'The hero is Santiago\'s painted altar now, not a CSS impression of it — the blade in the anvil under its eclipse, the pillars, the chains and the ringed floor. The panels, the wordmark and the calls layer on top; the art is the atmosphere and CSS is only the UI',
      'Three cuts rather than one. Desktop and tablet take the native landscape frame; the phone takes a portrait crop composed around the altar, because a 3:2 frame under `cover` on a 375-wide screen keeps the middle 46% and throws both pillars away',
      'Served through a <picture>, so the browser picks by viewport and format before it fetches anything: a phone never downloads the 1920px frame, and a browser without WebP still gets a JPEG. The hero image is the largest contentful paint, so it is marked high priority rather than queued behind the app\'s own scripts',
      'Two scrims carry the UI over the art — an edge vignette that gives the glass panels a ground to sit against, and a floor wash over the lower half where the wordmark and the calls land. Without them the art\'s own highlights ran straight through the panel text',
      'The CSS scene the art replaces is deleted rather than left underneath: the drawn sigil, the nebulas, the drafting grid and the drifting rocks. The painting carries all four, and running both put a second X over the one in the picture'
    ]
  },
  {
    version: '2.36.0',
    codename: 'Godforge Awakens',
    date: '2026-08-12',
    highlights: [
      'The site no longer just appears — it is forged in front of you. A seven-stage boot sequence takes the sigil from a still void through waking energy, aligning runes, gathering power and an igniting forge, to the moment the void breaks open and the Godforge comes online',
      'Every part of the seal is drawn rather than pictured: the X, the runic band and its twelve carved glyphs, the four compass marks that light in turn from north, the concentric rings and the white-hot core are five separate SVG layers, each on its own timeline',
      'The last frame is a handoff, not a cut. The sigil flashes white, then flies to the exact spot the header brand occupies and settles there at a fifteenth of its size, so the curtain resolves into the navbar instead of vanishing',
      'It respects your time on the way back. The first visit is the full 2.9-second cinematic; every visit after starts at the ignition and runs 1.3 seconds, decided before the first frame is painted',
      'The whole sequence runs and clears itself in CSS, off the main thread. It cannot hold the page hostage the way the splash it replaces could, and a visitor who asks for reduced motion is taken straight past it to the site',
    ],
  },
  {
    version: '2.35.0',
    codename: 'Five Doors',
    date: '2026-08-12',
    highlights: [
      'The mobile tab bar carries Santiago\'s painted icons — the forge anvil under its flame, the crossed hammers, the crossed swords, the runed book and the hooded figure — each in the cold-steel state it was drawn in, lighting to its purple rune-circle version on the tab you are standing in',
      'Both states are in the DOM and cross-fade on opacity rather than swapping one image source. A src swap fetches the lit icon at the moment the tab is tapped, so the first visit to every tab flashed an empty box on the one frame the visitor is looking straight at',
      'The active tab is marked three ways, because one is not enough at a glance on a phone: the lit icon, the label in purple, and a short glowing underline beneath it — the indicator the icon sheet\'s own tab-bar example draws',
      'The icons are keyed to transparency rather than cropped on their black ground, so the purple bloom traces the sigil instead of haloing a square, and each is packed to 96px so it stays crisp on a DPR-3 phone',
      'Reduced motion keeps every state and drops only the travel: the lit icon does not scale in and the underline does not wipe, but the active tab is still unmistakably the active tab'
    ]
  },
  {
    version: '2.34.0',
    codename: 'The Engine of Creation',
    date: '2026-08-12',
    highlights: [
      'The homepage is now the Godforge entrance from the concept art: the sigil scene behind everything, the wordmark set at viewport scale in serif, a status panel on the left reading the forge\'s own numbers and a welcome panel on the right reading yours',
      'The sigil scene is the mark from the loading sheet, built in CSS — rune circle, four compass points, the crossed X and the core where the arms meet. A 1536px render of the same image is roughly 2MB and would have been the largest asset on the site by an order of magnitude',
      'The navbar carries the XSANTCASTX lockup over BUILD · FORGE · OWN, seven halls across the middle, and Gold, Essence and rank as pills on the right',
      'Phones get a five-tab bar fixed to the bottom — Home, Tools, Arena, Codex, Profile — and the hamburger now opens a tome of everything secondary, grouped Main / Developer / More, closing on the Godforge mark and the social row',
      'Five counters below the fold: Gold, Essence, Aether and Nox all resolve to the Market, which is where each is actually spent. The Relic Forge is marked sealed rather than linked — there is no Relic Dust ledger anywhere in the app yet, and a card that opens a page with nothing to buy is worse than one that says so',
      'The creed row and the closing line: Real Tools, Real Impact, Real Community, over "more than a platform — a weapon for creators"',
      'The footer closes on FORGE × PLAY × BUILD × TOGETHER, the wordmark, and "the next thing is yours"',
      'Projects Live counts the same array the /projects page renders, lifted into projects.data.ts — hardcoding it on the homepage would have drifted the first time a project was added',
      'The tome sits above the command bar rather than under it. At the old z-index the bar\'s hamburger painted directly over the tome\'s own close button and swallowed every tap on it'
    ]
  },
  {
    version: '2.33.0',
    codename: 'The True Face',
    date: '2026-08-12',
    highlights: [
      'The Godforge has a face. The Void X sigil replaces the old monogram everywhere it is seen — the browser tab, the header, the home-screen icon on iOS and Android, and a new web manifest that names the icon set for installs',
      'Sharing a link now shows the forge itself: the social card is a 1200x630 crop of the Godforge altar under its eclipse, and the profile page no longer advertises an image that was never there',
      'Thirty-four hand-painted icons replace the emoji that stood in for them. Gold and Eclipse Essence in the header rail, the wallet and every price; the five Market tabs; the five realm sigils on the forge stations and across the Codex; ten rank sigils; six rarity tiers; and the Forge Flame itself',
      'The icons are lit rather than pasted. The Flame breathes, the rank you hold glows while the ranks above it stay dark stone, and the rarity ladder escalates from an inert Mortal to a Singular that cycles through the whole spectrum — every one of them holding a static end state when the visitor asks for reduced motion',
      'Ranks read as progress at a glance: the Codex path shows all ten sigils with the earned ones lit and the rest greyed, and the Forge Keeper crest carries the painted sigil inside the ring whose point count already encoded the rank',
    ],
  },
  {
    version: '2.32.0',
    codename: 'Unbroken',
    date: '2026-08-12',
    highlights: [
      'The Forge Flame counts combos. Consecutive strikes stack a multiplier beside the ember, and ten rungs escalate from a purple "COMBO x10!" through ON FIRE, UNSTOPPABLE and GODFORGE AWAKENS to THE FIRST SUN SHATTERS at x9,999',
      'The strike itself pitches up as the ladder climbs — same anvil, struck harder — and the upper rungs each add a channel rather than just volume: an overtone, a decay tail, a bass impact under a high ring, and finally an ascending arpeggio onto a held chord',
      'The screen escalates with it. Purple along the viewport edges from x50, a hard shake at x100, the ember doubling at x250, a full vignette from x500, a bright frame at x1,000 and a whiteout into flooding purple at x5,000',
      'Two seconds of silence ends a run. Against the existing 500ms strike cooldown that leaves 1.5s of slack per strike and caps the rate at two a second — which is what makes x9,999 mean something: 83 minutes of unbroken rhythm, and one missed beat puts it back to zero',
      'At exactly x666 the screen inverts for a fifth of a second, a detuned rumble rolls under a chain, and THE NAMELESS STIRS. Once, ever — the achievement is the gate, so a second run past it passes in silence',
      'Eight new achievements, from Rapid Strike at x10 to First Sun Shatter at the cap, the only ones on the wall priced in time held rather than in a thing done',
      'Every screen-level effect is switched off under prefers-reduced-motion — the counter, the shouts and all eight achievements remain, so the ladder is fully collectable without a single flash',
      'Fixed a floater that could swallow a strike: the "+1" rising off the ember is a sibling of the button with pointer events on, and at two strikes a second there is always one crossing the target',
      'Fixed the reduced-motion floater fade, which had never once run — Angular scopes @keyframes per component but leaves an animation reference inside a @media block unscoped, so it pointed at a name that did not exist'
    ]
  },
  {
    version: '2.31.0',
    codename: 'The Command Bar',
    date: '2026-08-12',
    highlights: [
      'The navbar is no longer a portfolio header. The Void sigil and "The Godforge" open it, the five realms, the Arena, the Codex, the War Table and the Market run down the middle, and your own standing — quests, Gold, rank and XP — closes it. The rotating buzzword pill, the "Services / Projects / About / Contact" scroll links and the personal wordmark are gone',
      'Realms is a dropdown that goes somewhere: each of the five links straight into /tools filtered by that realm, painted in its own accent, and the menu stays in the DOM when closed so crawlers still follow all six routes',
      'The mobile drawer is a tome rather than a slide-out — chapter headings ruled in gold, realm cards carrying their accent on the left edge, and a drawn rune per hall. Quests, Gold and the XP bar sit at the top of it, where a frontispiece would be',
      'Every icon in the bar is drawn in CSS: the Void sigil, the crossed blades on the quest sword, the Gold coin, the Essence shard, the streak ember, the keeper bust and the hamburger. No emoji anywhere — a colour-font glyph renders differently on every platform and cannot take the bar\'s palette, which matters because four purchasable cosmetic themes re-point it',
      'The bar compacts from 56px to 48px on the way down and returns to full height on the way up, with a deadband so a jittery trackpad cannot oscillate it',
      'The forge core on the homepage now reads ember → gold → purple → void: the eclipse bloom lives in the haze and the outer rim rather than inside the shaft, which keeps the well reading as a furnace instead of a nebula orb',
      'The footer closes on the same mark the bar opens with — sigil, wordmark, the six halls, and "Forged by xsantcastx" under a gold hairline',
      'Touch targets stay at 44px on touch devices; the 38px compaction that lets the controls sit in a 56px row is scoped to fine pointers only'
    ]
  },
  {
    version: '2.30.0',
    codename: 'The Eternal Archive',
    date: '2026-08-12',
    highlights: [
      'Progress follows you between devices. Sign in with Google from the progression panel and the whole Godforge — XP, rank, Aether and Nox, the streak, every achievement, the Gold and Essence ledger, upgrades, artifacts, cosmetics, quest history, arena scores, lore chapters and tool mastery — is kept in step across every browser you use',
      'Two devices are reconciled rather than one overwriting the other: the higher number wins on every counter, id sets union, and the merge is commutative, so it does not matter which device you sign in on first. Nobody ever loses a purchase by signing in',
      'localStorage stays the source of truth the page hydrates from, so the site still opens instantly, still works offline and still works signed out — the cloud is a second copy, not a dependency. Nothing about sync is on the critical path for first paint',
      'Signing out keeps everything on the device. It unbinds the browser, it does not wipe a save',
      'Both Firebase SDKs are fetched only when somebody actually signs in, so a visitor who never does downloads neither and the initial bundle is unchanged',
      'Lifetime XP is monotonic in the cloud, which stops a device that has fallen behind from silently overwriting a larger total with its own — the rejected write is treated as a signal to re-merge rather than an error to swallow',
      'New achievement: The Eternal Archive, Eclipsed, +50 XP — awarded the first time the forge is bound to the cloud'
    ]
  },
  {
    version: '2.29.0',
    codename: 'Character Sheet',
    date: '2026-08-12',
    highlights: [
      'New page at /forge-keeper — the Godforge character sheet. Rank and XP, Gold and Essence, realm affinity, everything you own, a case of pinned achievements, a thirty-day streak calendar and the five tools you actually reach for',
      'The page owns no state. Every number on it is already true in XpService, EconomyService, ToolMasteryService, QuestService, IdleService, ArenaScoresService, EasterEggService or LoreService — a profile that keeps its own copy of the totals is a profile that can disagree with the rest of the site, and the first time it does, the visitor believes the profile',
      'The rank sigil is drawn, not typed: its point count *is* the rank, so level 3 is a triangle and level 10 a decagram. Ten lore glyphs would have been ten chances for a system font to render a tofu box on the one element the page is built around',
      'Realm affinity is a conic gradient rather than a drawn path, so the two arcs are exact at any split and the only thing left to place is the pair of yin-yang eyes — one rotation each',
      'The vault renders the whole catalogue, not just what is owned: 24 cards, the unbought ones in silhouette with their price and a link to the Market. That is what makes an inventory screen worth opening, and it is why the page prerenders in full',
      'Upgrades and cosmetics carry no authored rarity — only artifacts do — so their tier is read off the price band. A 50-Gold pair of Bellows and a 10,000-Gold Achievement Frame are not the same kind of possession, and painting both one colour throws away the only thing the ladder already encodes',
      'The achievement case fills itself with your rarest finds until you customise it, and the difference is stored as a null rather than an empty array — so "I have never touched this" and "I deliberately want nothing pinned" stay distinguishable, and a Mythic found tomorrow promotes itself into the case without anyone opening a setting',
      'Time in the Forge is a new lifetime counter on IdleService. The existing minutesToday is an *allowance* — how much of today the forge will still pay for — and reading it as time spent would tell someone who has been here nine hours that they have been here thirty minutes',
      '"Self-Aware" (Eclipsed, +25 XP) drops the first time you open your own sheet, paid at the same rate as The Archivist and for the same reason: a page reachable from the navbar should not pay what a four-leading-zero hash pays',
      'The mobile drawer could not reach its own top. The 1100px rule sets justify-content: flex-end for the wrapped desktop row, and that leaked into the drawer, where a column taller than its box puts all of the overflow past the START edge — which a scroll container cannot reach. It reported scrollHeight 747 against clientHeight 747 while ~300px of links sat above y=0. Measured at 375×812, the first four links were at y=-234 through y=-8 and untappable. flex-start restores it: 1069 against 747, and all fifteen links pass a hit test',
    ]
  },
  {
    version: '2.28.0',
    codename: 'Eclipse',
    date: '2026-08-12',
    highlights: [
      'The forge is violet. The brand accent moved from cyan to eclipse purple across every surface — around 2,300 colour references in 250 files, from card borders and button glows to the nebula wash behind the whole site',
      'The Verge realm keeps its cyan, because that is what the boundary between light and shadow is meant to look like. Gold stays on the forge, the artifacts and the achievements; crimson stays on Umbral',
      'Sharing a link no longer shows a flat placeholder. The social preview is a new 1200x630 image — an eclipsed sun ringed in violet fire over a constellation, with the forge ember burning along its lower limb',
      'Every page pointed at one of four different preview images, two of which had already been deleted and were returning 404s to Twitter and Discord. All 152 references now point at the one image that exists',
      'The preview was also advertised as an SVG with a JPEG listed underneath it as a fallback. og:image is not a fallback list, and Facebook, LinkedIn, Discord and iMessage all reject SVG outright — which is why the preview looked broken in exactly the places people share links',
      'The page background dropped to a deeper near-black, and the browser chrome colour on mobile follows it'
    ]
  },
  {
    version: '2.27.0',
    codename: 'Lean',
    date: '2026-08-12',
    highlights: [
      'The initial JavaScript download is 38% smaller — 480 kB to 297 kB gzipped — with no visible change to the site',
      'The Firestore SDK was the single largest thing on the page and nothing on first paint used it; it now downloads on demand, the first time something actually reads or writes the database',
      'Firebase Auth was riding along in the initial bundle too, pulled in statically by the Analytics and Functions wrappers rather than by anything that signs a user in',
      'Nine pages — home, skills, projects, contact, donate, live, mcp, arena and the 404 — were bundled into every visit regardless of where you landed. Each is now fetched only when you open it, which matters most on tool pages, where the search traffic arrives',
      'Deleted twelve components and services left over from an old crypto-portfolio scaffold, plus two byte-identical copies of the social-share image',
      'Bundle budgets now fail the build if the initial download creeps back up'
    ]
  },
  {
    version: '2.26.0',
    codename: 'Coin and Ember',
    date: '2026-08-12',
    highlights: [
      'The forge earns money now. An ember in the bottom-right corner of every page pays Gold when struck and keeps paying while the tab is open, and /market spends it: ten upgrades across two ladders, four enchantments, five artifacts and five cosmetics',
      'Idle Gold is settled against the wall clock rather than ticked by a timer. A background tab has its timers clamped and a sleeping laptop fires none at all, so the minute interval pays nothing — it only prompts a recalculation of the time that actually elapsed, which is why a tab left open across lunch pays for lunch and a fortnight-old session is capped at eight hours instead of minting two weeks',
      'Hidden time is discarded rather than banked, unless the Obsidian Heart is held — that artifact buys exactly this, and it is the only thing that makes a closed tab worth anything',
      'Gold for tool work comes from the quest board\'s own interaction beat rather than a second listener. The coalescing window, the "is this inside <main>" test and the list of furniture that is not the tool were all already written and already correct; a parallel copy would have been the second place "using a tool" could be answered differently',
      'Quest payouts are derived from the XP a quest already pays rather than authored again — 43 quests would otherwise each need a Gold value maintained alongside their XP value, and the two would drift the first time one was rebalanced',
      'Enchantments and two artifacts multiply XP, and one halves lore thresholds, through settable hooks on XpService and LoreService rather than an injected dependency: progression and the codex both predate the shop and both keep working with the shop deleted',
      'Ranks and streak weeks are paid against a counter, not an event. XpService settles the daily streak during its own hydration, before anything in the economy is subscribed, so an event-driven reading would miss it on every load and pay nothing forever',
      'Cosmetics are published as data attributes on the document root, in the same style the realm layer already uses. Five slots, seventeen variants, zero new composited layers — the theme variant repoints the two brand custom properties the site already draws from rather than adding a tint surface over it',
      'Eight new achievements on the Codex wall, registered in the egg registry like every other one so they inherit the rarity drop, the XP payout, the discovery date and the hint on the locked card rather than reimplementing all five',
      'The Ambient Forge and the Market each shipped a Forge Flame within a day of each other — one in the header paying XP per strike, one in the corner paying Gold — so the two were merged into the corner one. It drives both ledgers: XP, the Century Strike bonus and the thousand/ten-thousand strike achievements all still land, from a button that is now reachable on a phone without opening the drawer',
    ]
  },
  {
    version: '2.25.0',
    codename: "The Maker's Mark",
    date: '2026-08-12',
    highlights: [
      'The site is The Godforge. "xsantcastx" is the maker\'s mark, not the product name, and it has left the browser tab entirely — the home page reads "The Godforge — Free Developer Tools Forged in the Eclipse", and pages already carrying a name of their own stand alone: The Arena, The Codex, The War Table, The Standing Orders, Fuel the Forge',
      'Pages with a generic name take the product on the end for context — Contact, Skills, Projects, Guestbook, Mission Control, MCP Server — while /tools is The Five Realms and /sponsors is Sponsor The Godforge',
      'All 128 tool titles swapped their "| xsantcastx" suffix for "· The Godforge" and kept every keyword ahead of it: a title is the strongest on-page ranking signal there is, and rewriting those phrases to bare tool names would have cost real traffic to buy nothing',
      'The wordmark now appears only where it earns its place: the header logo, the footer copyright, /about, the npm package name, the Person entity in the structured data, and the SEO keywords. The WebSite entity is now named The Godforge with xsantcastx as its alternateName, so search keeps the association without the product answering to the maker\'s name',
      'og:site_name, the social card titles and the share-image alt text all say The Godforge; the embed bar that ships on other people\'s sites now reads "Powered by The Godforge"',
      'Navigation labels are deliberately untouched — Tools, Blueprint, MCP and Quests are what a visitor scans for, and renaming them to lore is a usability decision rather than a branding one'
    ]
  },
  {
    version: '2.24.0',
    codename: 'Portable Progress',
    date: '2026-08-12',
    highlights: [
      'Progression is now a portable document rather than a browser-shaped blob — it carries its own identity, rank and timestamps, so signing in later becomes a swap instead of a rewrite',
      'Storage moved behind an async contract (load / save / exists / clear / migrate). localStorage does not need the await, but a synchronous interface would have grown callers that assume storage resolves in the same tick, and Phase 2 is a network round trip',
      'Achievements are stored with the moment they were earned instead of as bare ids, so a synced profile carries its own chronology rather than depending on a second store agreeing with it',
      'Writes are debounced and flushed on the way out — a quest claim that awards XP and banks an achievement in the same tick is now one write, not two',
      'Existing progress migrates in place: XP, energies, streak, best streak, tools and daily history all carry across, verified against a real v1 blob and pinned by 12 unit tests'
    ]
  },
  {
    version: '2.23.1',
    codename: 'Ambient Forge',
    date: '2026-08-12',
    highlights: [
      'Browser tabs read as a platform rather than a personal site — the default title is "xsantcastx · The Godforge", and every named page follows "<Page> · xsantcastx": The Five Realms, The War Table, The Arena, The Codex, Mission Control, Sponsors, MCP Server',
      'The phrase "Full-Stack Developer" is gone from every title, meta description, Open Graph tag and structured-data block outside the tool pages, along with the portfolio framing that came with it',
      'The 128 individual tool titles are deliberately untouched: their keyword phrasing is what those pages rank on, and a title is the strongest on-page signal there is. /tools itself was renamed on request and did give up its keywords — the meta description still carries them',
      'The route-title map had been carrying nine unused entries with copy like "About Me - Experience & Skills" and "Resume - Professional Experience"; the dead keys are deleted and the four live ones now read as platform pages',
      'Every prerendered page had been shipping the same generic og:title and twitter:title — SeoService read the title back off the document and beat the title strategy to it during prerender. It now reads the route\'s own title, through the same branding helper the strategy uses so the two cannot drift apart',
      'Fixed a corrupted line on /about that was rendering a fragment of a code-edit payload — literal `", "oldString": "` followed by a stray "Santiago - Full-Stack Developer" — as visible page text'
    ]
  },
  {
    version: '2.23.0',
    codename: 'Ambient Forge',
    date: '2026-08-12',
    highlights: [
      'Time spent with the site open and visible now earns XP — 1/min anywhere, 2/min on a tool page, 1.5/min in the Arena — shown by a forge flame beside the XP bar that breathes while it is earning and dims to an ember the moment the tab is hidden',
      'Hidden earns nothing. The Page Visibility API gates every credit, so this rewards having the site in front of you rather than having it open in a tab you forgot about',
      'Credits come from measured visible milliseconds rather than from counting timer fires, and a single accounting step is clamped to one interval — so a throttled background tab under-reports nothing and a laptop asleep for six hours pays out nothing',
      'Thirty credited minutes a day, held against the local date rather than the page load: the brief called it a per-session cap, but a cap kept in memory resets on Cmd+R, which is the first thing an idler does',
      'The rate stacks — the realm you have worked most adds 0.5 on its own tools, a live quest pointing at the tool underfoot doubles it, and a 7- or 30-day streak multiplies by 1.5 or 2 — with the tooltip naming every term rather than showing an unexplained number',
      'The flame is strikeable: +1 XP a hit on a 500ms cooldown, a spark every tenth and a Century Strike worth 10 more every hundredth',
      'Seven achievements join the egg registry rather than a parallel list, so they arrive through the rarity drop, land on the Codex wall and count toward the global total like everything else — at 40-200 XP rather than a hunt\'s 200, because they are earned by presence',
      'The idle ledger is read-modify-write, so two open tabs share one thirty-minute allowance instead of quietly earning two and overwriting each other\'s totals',
      'Nineteen unit tests cover the parts only a clock can prove: the cap, the visibility gate, the sleeping laptop, the day rollover, the unbroken-run milestone and the strike cooldown'
    ]
  },
  {
    version: '2.22.0',
    codename: 'Standing Orders',
    date: '2026-08-12',
    highlights: [
      'A mission board: three daily quests drawn from a pool of thirty, two weeklies from eight, and five epics that never expire — reachable from the ⚔️ in the header or in full at /quests',
      'The daily draw is deterministic rather than random, seeded on the date, so everyone in the realms is handed the same three quests on the same day and the roll survives a reload without ever paying out twice',
      'Quests are never persisted — only activity is. The board is recomputed from the pools on every change, so editing a target ships to every visitor with no migration, and a claim receipt is keyed by period so a re-rolled quest cannot be claimed a second time',
      'Progress comes from an interaction beat — typing, dragging a slider, pressing a button on a tool page, coalesced to one per six seconds per tool — not from arriving on the page, because "forge three shadows" has to mean three pieces of work',
      'Ten tools gained a codex: 41 chapters of Eclipse Realms prose that open at 8, 20, 45 and 100 uses, in a serif panel under the tool output. Locked chapters show their number and what it costs to reach them',
      'A tool\'s realm in the codex is derived from its registry category, never authored twice — which moved five of the ten out of the realm they were first assigned, and the prose was written to fit where the tools actually live'
    ]
  },
  {
    version: '2.21.0',
    codename: 'The Codex',
    date: '2026-08-12',
    highlights: [
      '/codex — the whole record in one place: 140 achievements across seven categories, the ten-rank progression path, mastery for all 128 tools, and a clued guide to every secret that is not an easter egg',
      'A locked achievement shows a cryptic hint, never its description — the registry description is the answer written out, and putting it on a locked card would turn the wall into a checklist. 140 hints authored by hand; the search box matches hints on locked cards and names on found ones, so searching cannot spoil the wall either',
      'Rarity borders come from the shared Eclipse ladder rather than new colours: Mortal grey through Mythic red, with the hero completion bar tinted by the mean tier of what you have actually found',
      'Progression gains a streak calendar. XP is now recorded per local day (60 days retained, 30 rendered) so the heatmap is real data rather than a decoration, and the energy split reads out as Luminous/Umbral affinity with a Convergent badge at 45-55%',
      'The Bestiary needed a number nothing was keeping: XP pays for a tool once, so it knows *whether* you used something, not how often. A separate localStorage tally now counts every visit, backfilled from the XP ledger so nobody who used the site before today opens it to 128 untouched cards',
      'Achievement unlock dates are recorded from now on, in a second storage key rather than by changing the shape of the one every build since the egg system has written — eggs found earlier read "before the Codex opened" instead of being given an invented date',
      'The Leaderboard tab is a labelled mock-up with your real row at the bottom and no invented global position. Ranking needs accounts, accounts are Phase III, and a fake rank would be the one dishonest thing on a page whose whole premise is an honest record',
      'Opening it is itself an achievement: The Archivist, Eclipsed, +25 XP rather than the standard 200 — it is on the nav, so finding it is the start of the hunt rather than the result of one'
    ]
  },
  {
    version: '2.20.0',
    codename: 'Five Gates',
    date: '2026-08-12',
    highlights: [
      'Five gates in the Arena now lead to a real game instead of a description of one: Eclipse Fragments (memory), Realm Rush (typing), Shadow Cipher (code ordering), Forge Strike (reflex) and The Convergent\'s Path (a balance maze)',
      'Each is a lazy route under /arena — 5-7 kB over the wire apiece, so a visitor who never opens the Arena downloads none of them — and each renders its own chained gate rather than sitting behind a route guard, because a guard that redirects during prerender bakes a redirect stub into the built HTML and the route stops working in production',
      'A first clear pays that game\'s reward once, banked as an achievement id so a reload cannot re-collect it; after that only beating your own best pays, and only 10 XP. Shadow Cipher\'s hints are billed against its reward, and The Convergent\'s Path scales its payout by how evenly you walked it — a full sweep at zero drift is the full 75 Aether and anything less is honestly less',
      'Arena cards carry your personal best and a NEW badge until you have finished a run, both filled in on hydration so a prerendered card never shows a score it cannot know. Gates with nothing behind them yet say so instead of offering a button that does nothing',
      'Playable on a phone: every control clears 44px, the maze takes arrow keys, swipes or an always-present on-screen pad, and the typing game drives a real input so the keyboard actually opens. Reduced motion keeps every game playable and drops only the ornament'
    ]
  },
  {
    version: '2.19.0',
    codename: 'The Godforge',
    date: '2026-08-12',
    highlights: [
      'The home page is the Godforge now — a serif title over a CSS-only furnace core, the visitor\'s rank read out under it, and one door into the forges instead of a rotating carousel of five cards',
      'Tools are grouped by realm rather than by recency: five forge stations, each with its codex line and its own accent, opening one at a time. Collapsed stations keep their cards in the markup, so every link is still crawled — only the visitor\'s view is filtered',
      'The stats bar counts real things and can no longer drift: artifacts are live registry entries, fragments are registered easter eggs, realms come from the codex, and the prerendered-path count is written into a committed constant by the same script that builds the sitemap',
      'Cards the visitor has actually used are marked "Struck" from local progress — the site has no per-tool analytics, so it shows what it knows instead of inventing a usage number',
      'The Chronicle badges an entry with a realm only when the entry names a tool that can be placed; platform-wide work is left unbadged rather than filed under a guess',
      'A closing call before the footer: current rank and XP, a first tool to open, and the two doors the lore points at — the War Table and the Arena'
    ]
  },
  {
    version: '2.18.1',
    codename: 'The Long Arc',
    date: '2026-08-12',
    highlights: [
      'The Arena gates open now — "Enter →" was a bare button with no click handler on it, so every gate you unlocked led nowhere, on every card',
      'Color Memory is the first gate with a game behind it: Match the Eclipse Fragments, a 4×4 or 6×6 board of paired fragments in the brand palette, with a timer, a move counter and a best time',
      'Clearing it pays XP through the same XpService the rest of the site uses — 10 per pair, plus a bonus for finishing under par and under two minutes — so it lands in the header bar and counts towards a rank rather than into a score the game kept to itself',
      'Gates whose game is not built yet say "Still forging" instead of offering an Enter button that goes nowhere',
      'The overlay has to lift its own routed host to be seen: routeFadeIn leaves a transform with fill:forwards on every routed component, which makes it a stacking context, and a fixed overlay inside one cannot out-rank the header'
    ]
  },
  {
    version: '2.18.0',
    codename: 'The Long Arc',
    date: '2026-08-11',
    highlights: [
      'The Roadmap tab gains a second view under Now/Next/Later: six Eclipse phases — Genesis, Awakening, Eclipse, Convergence, Godforge, Final Eclipse — answering where all of it is going rather than what is being worked on this month',
      'Each phase expands to its items with a shipped/total meter, and the phase in progress starts open because that is the one a reader came to check',
      'Status is honest by construction: gold means every item under it actually shipped, cyan is live work, muted is committed but not started, and violet "vision" means an intention with no date and no promise behind it',
      'Phase III is marked in progress with five items and none of them done — including the account-backed progress the Firestore adapter is stubbed for, and error tracking, which nothing else should ship ahead of',
      'The prose version lives in the repo at docs/ECLIPSE_REALMS_ROADMAP.md and the site renders from src/app/blueprint/eclipse-roadmap.ts, so the two cannot drift into different claims'
    ]
  },
  {
    version: '2.17.0',
    codename: 'The Arena',
    date: '2026-08-11',
    highlights: [
      '/games is now /arena — "Where Convergents prove their worth" — with a 301 in the hosting config so every external link and indexed URL lands on the new address instead of the SPA 404',
      'Games became gates: each one is chained shut by a secret buried in a tool, and a gate inherits the rarity tier of the secret that opens it, so a red border in the Arena and a red drop toast are the same claim',
      'Locked gates carry a chain glyph and are desaturated — you can see the shape of the prize but not its colour. Opened gates glow in their tier',
      'New arena stats: gates opened, secrets found, and your rarest opened gate by name and tier (it reads "no gate opened yet" until you open one, rather than boasting about a card you have not earned)',
      'The four hardcoded rarity colours on the old game cards are gone; the cards read the shared rarity table instead',
      'Nav, sitemap and prerender list all moved with it, and no /games stub is emitted'
    ]
  },
  {
    version: '2.16.0',
    codename: 'Five Realms',
    date: '2026-08-11',
    highlights: [
      'The twelve registry categories are now grouped into five realms — Luminous (design), Umbral (security), Verge (code), Archivum (productivity) and Nexus (mail) — each with its own colour and a line from the Eclipse Realms codex',
      '/tools gets a realm rail above the galaxy map: five chips with live tool counts (33 / 10 / 24 / 58 / 2), and picking one cuts the grid into realm sections with the realm header and its quote',
      'Realm and category are two different cuts of the same list, so selecting one clears the other rather than intersecting into an empty result',
      'Every tool page carries a realm badge beside its category eyebrow — added by one global rule keyed on a data-realm attribute, not by editing 126 templates',
      'RealmService resolves route → tool → category → realm on each navigation and publishes it to CSS, clearing the variables again off a tool route so /home is never tinted by the last tool you opened',
      'Realms agree with the energy split shipped in 2.14.0: Umbral and Verge feed Nox, the other three feed Aether'
    ]
  },
  {
    version: '2.15.0',
    codename: 'Mythic',
    date: '2026-08-11',
    highlights: [
      'Easter eggs now drop on a six-tier ladder — Mortal, Eclipsed, Sacred, Anomalous, Mythic, Singular — instead of a flat toast that looked the same whatever you found',
      'All 139 registered eggs are tiered: 43 Mortal, 79 Eclipsed, 10 Sacred, 5 Anomalous and 2 Mythic (a hash with four leading zeros, and a regex that matches its own source)',
      'Singular is not authored — it is awarded when the global discovery counter comes back at exactly 1, meaning nobody in the realm reached that egg before you',
      'Sound is synthesised, not downloaded: a struck bell for Sacred, a detuned horn section for Anomalous, a sub-bass impact with a noise transient for Mythic, and a prismatic arpeggio over the impact for Singular — five cues, zero audio files, and no AudioContext at all until the first drop',
      'Mythic and Singular take the screen: one white frame at 100ms, a dim veil, a centred card with a pulsing tier glow and an eighteen-shard particle burst',
      'prefers-reduced-motion drops the flash, the burst and the pulse — the card still appears and still reads, it just holds still'
    ]
  },
  {
    version: '2.14.0',
    codename: 'Wanderer',
    date: '2026-08-11',
    highlights: [
      'The site remembers you now — XP, ten Eclipse Realms ranks from Wanderer to Eclipse Lord, and a progression readout in the header that expands into a panel',
      'XP is earned from what you were already doing: 15 for the first use of a tool, 5 for a page you have not seen, 5 for a copy (rate-limited to once a minute), 25 for a share and 200 for an easter egg',
      'A daily streak compounds 50 XP per consecutive day up to 600, and resets to one day on the first day you miss — the best streak is kept so the loss is visible',
      'XP splits across the two energies of the lore: Aether from design and authoring tools, Nox from security and code tools, drawn as a seam on the header bar',
      'Storage sits behind an adapter, so the Phase 2 move to per-account Firestore progress is a provider swap rather than a rewrite',
      'Nothing is sent anywhere — progression lives entirely in localStorage on your own device'
    ]
  },
  {
    version: '2.13.0',
    codename: 'Control Room',
    date: '2026-08-11',
    highlights: [
      'Owner-only dashboard at /admin — engagement, easter-egg discovery, tool suggestions, CI runs and commit history on one page, gated on Firebase Auth and locked to a single verified email in firestore.rules',
      'The easter-egg counters have never recorded anything: the collection has no rule at all, so every discovery write falls through to the deny-all and is rejected, and the service catches the error and returns — all 139 eggs have been counting nothing, including the 58 that 2.8.0 had just finished wiring up',
      'Blueprint tool suggestions are readable for the first time — the collection was write-only, so every suggestion submitted through the form had landed somewhere nobody could open — and can now be triaged as reviewed, accepted or rejected without being editable',
      'Builds emit assets/build-stats.json (prerender route count, sitemap URL count, bundle size), so the dashboard reports measured numbers rather than placeholders',
      'The route is hidden four ways over: absent from the nav and the sitemap, noindex in its route data, and disallowed in robots.txt — and its prerendered shell renders two words and no panel markup'
    ]
  },
  {
    version: '2.12.0',
    codename: 'Stylesheet Drift',
    date: '2026-08-11',
    highlights: [
      'Five tools rendered as essentially unstyled HTML — tailwind-lookup, box-model, csv-json, dns-lookup and robots-generator all shipped the same 56-line generic scaffold stylesheet (four were byte-identical once the class prefix is normalised) while their templates were written against a completely different vocabulary, leaving 81–98% of the classes each page used matching no rule at all',
      'Four more tools had templates renamed without their stylesheets following: the whole SSL Certificate Inspector results area was unstyled because the CSS still targeted .cert-summary / .status-pill / .trust-chain, and hex-editor, sitemap-generator and the email auditor score gauge had the same drift on a smaller scale',
      'Four labels showed HTML entities as literal text — Angular interpolation emits its result as a text node, so "Copy &lt;link&gt; Tags", "Copy HTML &lt;img&gt; Tag", "HTML &rarr; MD" and the responsive-preview device emoji were all displayed verbatim rather than decoded',
      'The X and LinkedIn share buttons on 97 tool pages had lost their brand colors: 179 links use the short .share-btn--x / --li spellings, which no rule defined, and a plain class selector could not have won anyway against each component\'s own Angular-scoped .share-btn',
      'A repo-wide scan for templates whose classes go unmatched by their own stylesheet now reports zero tools, down from nine'
    ]
  },
  {
    version: '2.11.0',
    codename: 'Waterfall',
    date: '2026-08-11',
    highlights: [
      'New flagship tool — HAR File Analyzer & Network Waterfall at /tools/har-analyzer, filling the gap left by Google\'s abandoned HAR Analyzer',
      'Drag in a .har and get a request waterfall segmented by queueing, DNS, TCP, TLS, TTFB and download, with DOMContentLoaded and load drawn across every row',
      'Parsing runs in a Web Worker that keeps the capture off the main thread — a 100 MB export never freezes the tab, and only a few hundred KB of analysis crosses back',
      'Core Web Vitals are reconstructed and honestly labelled: TTFB, DCL and load are measured, FCP and LCP are bounded estimates with their method stated, and CLS is reported as underivable rather than invented',
      'Findings call out uncompressed text, weak cache lifetimes, slow server waits, oversized images, redirects, HTTP/1.x and third-party weight — each one filters the table down to the offenders',
      'Privacy redaction strips cookies, credential headers, request and response bodies and token-shaped query parameters, in the URL as well as the header list, then exports a HAR that is safe to attach to a ticket',
      'Share a link that carries a compressed analysis digest rather than the capture itself, or export the whole thing as a Markdown report'
    ]
  },
  {
    version: '2.10.0',
    codename: 'Dead Weight',
    date: '2026-08-11',
    highlights: [
      'Stripe and the PayPal SDK no longer load on any page — PaymentService is injected by the footer, which sits on every route, and its constructor fetched both SDKs at startup, so roughly a megabyte of checkout JavaScript was downloaded on the home page and all 123 tool pages for a flow that only opens behind a click',
      'Firebase App Check now initializes on the first idle callback instead of during bootstrap, taking reCAPTCHA (336 kB) off the startup path of every route; the three Firestore calls that fire before that window now wait for it, so the visit, changelog and tool-usage counters keep working if App Check enforcement is ever switched on',
      'Google Analytics is fetched only after the visitor accepts the cookie banner — consent mode had been denying what gtag.js stored while still downloading it on every page',
      'Carbon Ads and the AdSense slot wait until the unit is nearly scrolled into view instead of requesting during page load',
      'Measured on /home at 4x CPU throttle over Slow 4G: third-party hosts contacted 12 → 4, third-party requests 27 → 8. LCP is unchanged, because the boot-curtain fix in 2.6.0 had already taken it off the main thread — this release is about bandwidth, CPU and privacy, not paint time'
    ]
  },
  {
    version: '2.9.0',
    codename: 'Patron',
    date: '2026-08-11',
    highlights: [
      'Sponsor slots are live on the ten highest-traffic tool pages — a single native card between the tool output and the related-tools rail, carrying a visible "Sponsored" badge, a rel="sponsored" link and a dismiss button that stays dismissed',
      'Placements are keyed by tool category rather than by URL, so one booking covers every tool in that category — present and future — instead of a single page',
      'New /sponsors page for advertisers: audience, placements with a mockup of the slot in context, packages, an open-slot grid and an FAQ',
      'Traffic and pricing on /sponsors stay unpublished until real analytics back them — the page shows "on request" rather than an estimate, and the tool counts it does show are read live from the registry',
      'The page also states plainly that tool pages carry a Carbon unit and an affiliate card alongside the sponsor slot, rather than claiming an exclusivity the pages do not have',
      'Nothing changes visually anywhere until a deal is signed: with no sponsor booked, every slot renders nothing at all'
    ]
  },
  {
    version: '2.8.0',
    codename: 'Egg Hunt',
    date: '2026-08-11',
    highlights: [
      '58 tools had been calling the easter egg service with IDs that were never in the registry — trigger() looks the ID up and returns early when it finds nothing, so every one of those calls was a silent no-op with no toast, no save and no count',
      'Registering those IDs lights up 58 tools that had been shipping dead trigger code for months, and takes the registry from 71 eggs to 139',
      '21 more tools wired with new unlock conditions, including Ouroboros for a regex that matches its own source, Monochrome Master for a single-hue palette, Fort Knox for a 128-character password and Hash Miner for a digest that lands on four leading zeros',
      'JSON Tower and Regex Race were unreachable on /games — both were gated behind eggs that had no trigger anywhere in the app. Every game is now unlockable'
    ]
  },
  {
    version: '2.7.0',
    codename: 'Mobile Polish',
    date: '2026-08-11',
    highlights: [
      'Mobile type is readable — text ran from 7.4px to 13.9px on every route because the sizes were fixed rem values that resolved the same at 375px as at 1920px',
      'Two tiers: content and controls floored at 14px, decorative micro-labels at 12px, applied across the global shell, eight routes and all 126 tool pages',
      'The /live mission feed no longer squeezes its messages into a 180px column — rows wrap so the message gets the full width, and tool badges truncate instead of clipping mid-word',
      'Reclaimed the header clearance that was applied twice on 116 pages: first content sat at 192px under a 64px navbar, and now sits at 116px',
      'Momentum scrolling on every independently scrolling pane, and the last sub-44px controls (share buttons, colour swatches, the contact email and GitHub links) now meet the touch minimum'
    ]
  },
  {
    version: '2.6.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'Every indexable URL used to answer with a 301 to a trailing-slash copy of itself while its canonical tag pointed at the un-slashed form — all 138 sitemap entries were redirects, which Search Console files as "Page with redirect" instead of indexing',
      'hreflang for English and Spanish, emitted per route so each page points at its own pair rather than the homepage, with ?lang= finally switching the language for real (it had only ever read localStorage, so the Spanish URL served English to every crawler)',
      'The 125 /embed/* pages are no longer blocked in robots.txt and told to index at the same time — they carry a noindex the crawler can actually reach, so they stop competing with the real tool pages',
      'The boot splash now lifts from CSS instead of waiting on JavaScript: the hero heading had been sitting behind an opaque curtain for 18 seconds of measured LCP render delay on throttled mobile'
    ]
  },
  {
    version: '2.5.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'New flagship tool — Regex Builder & Tester at /tools/regex-builder',
      'Live match highlighting with capture groups, named groups and match offsets',
      'Real-time syntax highlighting on the pattern itself, all six JavaScript flags with explanations, and a find-and-replace preview',
      '14 presets that each load a sample so the pattern demonstrates itself, a six-section cheatsheet, and shareable permalinks that restore pattern, flags, test string and replacement',
      'Code snippets for JavaScript, Python, Go, Java, PCRE and .NET, each with notes on how that engine differs from the JavaScript one doing the matching'
    ]
  },
  {
    version: '2.4.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'Every input placeholder in every tool is now translated — 122 strings across 71 templates that a Spanish visitor previously read in English',
      'Placeholders that carry no language are deliberately left alone: colour notation like "R, G, B (0-255)", CSS and SVG syntax samples, example.com URLs and SPF/DKIM records',
      'The grocery list keeps its per-language name examples, because those describe what to type into that field rather than the interface language',
      'Fixed 15 labels that showed a literal "&amp;" instead of "&" — six category eyebrows and nine tool titles stored an HTML entity that interpolation escaped a second time'
    ]
  },
  {
    version: '2.3.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'Public roadmap re-cut against what is actually being worked on — Now is mobile polish, i18n expansion and Blueprint content',
      'Accessibility audit and security hardening left the Now column because both shipped (2.2.0 and the 2026-08-08 dependency sweep)',
      'Every Now card links to the Dev Log entry telling its story',
      'Liquid Glass CSS Studio dropped from Next'
    ]
  },
  {
    version: '2.2.1',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'Hero carousel is visible on mobile again — it had been a 210px black void directly under the header on every phone',
      'Cause: Angular scopes @keyframes names per component, but did not rewrite the animation reference inside the <=768px media query, so it pointed at a keyframes name that did not exist and the cards never left opacity: 0',
      'Mobile now reuses the desktop keyframes and flattens the 3D tilt with transform: none !important, so there is only one keyframes name left to scope'
    ]
  },
  {
    version: '2.2.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'a11y overhaul — every interactive control now has an accessible name',
      'Zero buttons without an accessible name site-wide; 82 that relied on a hover-only title tooltip now carry a real label, translated where the tooltip was',
      '296 form controls wired to the labels that were only visually beside them — sliders and colour pickers used to announce as unnamed',
      'Header logo is a real button, not a div with role="button", and shows a focus ring again',
      'rel="noopener noreferrer" on all 64 links that open a new tab',
      'Heading levels no longer skip from h1 to h3 on games, css-variables and pdf-generator'
    ]
  },
  {
    version: '2.1.0',
    codename: 'Blueprint',
    date: '2026-08-11',
    highlights: [
      'Mobile navigation repaired — 44px tap targets, drawer sits flush under the header',
      'Mobile performance — nine always-composited full-viewport layers down to five, all static',
      'backdrop-filter disabled on mobile (was 300+ declarations, four stacked in the header alone)',
      '/live and the header no longer overflow a 375px viewport',
      'Every standalone control now meets the 44px touch minimum'
    ]
  },
  {
    version: '2.0.0',
    codename: 'Blueprint',
    date: '2026-08-10',
    highlights: [
      'Blueprint public roadmap + dev log',
      'i18n support (EN/ES)',
      'Accessibility overhaul',
      'Security hardening',
      '126 tools'
    ]
  },
  {
    version: '1.0.0',
    codename: 'Genesis',
    date: '2026-03-01',
    highlights: [
      'Initial launch',
      'First 45 tools',
      'Easter egg system',
      'Dark theme'
    ]
  }
];
