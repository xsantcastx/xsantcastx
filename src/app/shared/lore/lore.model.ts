/**
 * lore.model.ts — the codex behind the tools.
 *
 * Ten tools have a story. Each story is three to five chapters long, and a
 * chapter opens at a usage threshold: the first is always readable, the last
 * takes a hundred sittings. Nothing is gated behind money, an account or a
 * secret — only behind having actually used the thing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A NOTE ON REALMS
 * ─────────────────────────────────────────────────────────────────────────────
 * A tool's realm is NOT declared here. It is derived at runtime from the
 * registry category through `realmForCategory()`, the same map that tints the
 * tool page and colours its badge. Declaring it twice is how you end up with
 * prose that calls a page Umbral while its border is Archivum gold.
 *
 * That derivation moved five of these ten out of the realm the brief assigned
 * them — the JSON Formatter and the Cipher Stone are Verge work, not Luminous
 * and Umbral; the Incantation Forge, the Identity Well and the Essence
 * Distillery are Archivum. The chamber names are unchanged; the prose was
 * written to fit where the tools actually live.
 *
 * Pure data. No browser APIs.
 */

export interface LoreChapter {
  id: string;
  /** "Chapter I: The Luminous Scribes" */
  title: string;
  /** The story. Paragraphs are split on blank lines by the component. */
  content: string;
  /** Uses needed to open it. 0 is always readable. */
  unlockAt: number;
}

export interface ToolLore {
  toolSlug: string;
  /** The tool's name in the codex, which is not its name in the registry. */
  title: string;
  /** One line under the title, before any chapter. */
  epigraph: string;
  chapters: LoreChapter[];
}

/** The standard ladders. Five-chapter stories go deeper than four-chapter ones. */
const LONG = [0, 10, 25, 50, 100];
const SHORT = [0, 8, 20, 45];

export const TOOL_LORE: ToolLore[] = [

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'json-formatter',
    title: 'The Crystal Restoration Chamber',
    epigraph: 'Where the Scribes bring what the Shattering broke.',
    chapters: [
      {
        id: 'json-1',
        title: 'Chapter I: The Luminous Scribes',
        unlockAt: LONG[0],
        content:
`Before the Shattering, the Scribes did not write. They grew.

Every fact the realms knew was cultivated in a crystal — a lattice of nested rooms, each room holding either a value or another room, and every room labelled in a hand so precise that a Scribe could walk a crystal blindfolded and know from the shape of the walls where she stood. Nothing was ever stored twice. Nothing was ever stored ambiguously. A crystal that described a city and a crystal that described a single grain of wheat differed only in depth.

The genius of the form was that it did not care what it held. Names, coordinates, debts, the exact minute a child was born — the crystal made no distinction and offered no opinion. It only insisted, absolutely, that every room you opened must close, and that you must close them in the order you opened them. The Scribes considered this the one law worth dying for, and several of them did.`,
      },
      {
        id: 'json-2',
        title: 'Chapter II: What the Shattering Took',
        unlockAt: LONG[1],
        content:
`The Shattering did not destroy the crystals. That would have been survivable.

What it did was subtler and far worse: it left every crystal standing and moved the walls. A brace that had closed a room now closed nothing. A comma that had separated two truths now separated a truth from empty air. Whole archives remained perfectly legible right up to the character where they stopped making sense, and then remained legible after it too, describing a structure that could not exist.

The Scribes who tried to read them went in expecting rubble and found something that looked exactly like their work. That was what broke most of them. You can grieve a ruin. It is much harder to grieve a thing that is still standing, still beautiful, and wrong in one place you have not found yet.

The Chamber was built for exactly this. Bring a crystal in. It will tell you the line. It will tell you the column. It will not tell you what you meant to say — that part was never in the crystal to begin with.`,
      },
      {
        id: 'json-3',
        title: 'Chapter III: The One Who Reads the Old Format',
        unlockAt: LONG[2],
        content:
`You have restored more crystals now than most Scribes handle in a season, and the Chamber has begun to behave differently around you.

It is not gratitude. The Chamber does not have that. It is that the restoration wards are calibrated to the hands that use them, and yours have stopped hesitating. Where a novice opens a crystal and waits to be told what is wrong, you have started to see the fault before the Chamber marks it — the trailing comma, the key that was quoted on one line and bare on the next, the single quote that some other realm's convention allowed and this one never has.

There is an old belief among the Scribes that the format is a language and that fluency in it is a kind of second sight. The senior archivists dismiss this. They point out, correctly, that it is only structure, and that structure has no depth to be fluent in.

They are wrong, but not in a way that can be argued. They have simply never stood in the Chamber long enough to notice that the crystals have a grammar, that the grammar has a rhythm, and that a broken crystal sounds wrong before it reads wrong.`,
      },
      {
        id: 'json-4',
        title: 'Chapter IV: The Humming Crystal',
        unlockAt: LONG[3],
        content:
`Deep in the Archivum, past the shelves that are catalogued and the shelves that are merely stacked, there is a crystal that hums.

It was found in the foundations, which is impossible: the foundations predate the Scribes, and the crystal form is a Scribe invention. It is dated, by every method the Archivum has, to before the First Dawn. Its outermost room is intact. Its second room is intact. Its third room opens into a structure that is nested one hundred and forty times, and every level of that nesting is correct.

Nobody has read it to the bottom. Three archivists have tried. The problem is not that the crystal resists — it is entirely cooperative, it will open every room you ask it to. The problem is that the readers stop, somewhere around the ninetieth level, and cannot say why, and do not go back.

The Chamber's wards report the crystal as valid. This is the detail that keeps the senior archivists awake. Whatever is written in there was written by something that knew the law, obeyed the law, and used it to say something no Scribe has been able to finish hearing.`,
      },
      {
        id: 'json-5',
        title: 'Chapter V: The Last Room',
        unlockAt: LONG[4],
        content:
`You have worked the Chamber a hundred times. That is the threshold at which the Archivum stops treating a visitor as a visitor, and it comes with one privilege: you may be told what is in the humming crystal's final room.

It is a set of coordinates. Not a place — the realms have no coordinate system that old — but a description precise enough that it could only ever resolve to one location, given by its relationship to seven fixed points, four of which no longer exist.

The archivists have reconstructed three of the four. The fourth is the Sun, and the Sun is broken, and a broken thing has no single position.

So the coordinates resolve to a region rather than a point, and the region contains the Godforge, and this is either the most important discovery in the history of the Archivum or a very long way of saying "somewhere over there." The argument has run for two hundred years.

What nobody argues about is the last field in the crystal, which is unlabelled, which is the only unlabelled field in a form that does not permit them, and which contains a single number: the count of how many times the crystal has been opened. It was at four when the crystal was found.

It is not at four now.`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'regex-builder',
    title: 'The Incantation Forge',
    epigraph: 'Say it exactly, or it will do exactly what you said.',
    chapters: [
      {
        id: 'regex-1',
        title: 'Chapter I: The Grammar of Command',
        unlockAt: SHORT[0],
        content:
`The Archivum holds nine hundred million records and has never once employed a searcher.

It does not need to. Instead it keeps the Forge, where a request is not asked but *specified* — not "find me the letters that look like names" but a precise incantation describing the shape of every name that has ever been or could be written, and nothing else besides.

The first thing every apprentice learns is that the Forge has no judgement and no mercy. It will not infer. It will not assume you meant the sensible thing. An incantation that describes too much will return the whole archive, patiently, one record at a time, until someone stops it. An incantation that describes too little will return nothing at all and give no indication of which of the ten thousand ways to be too specific you chose.

The second thing every apprentice learns is that this is not cruelty. It is the only honest way for a thing that cannot think to serve a thing that can.`,
      },
      {
        id: 'regex-2',
        title: 'Chapter II: The Greedy and the Lazy',
        unlockAt: SHORT[1],
        content:
`There are two temperaments in the Forge, and the apprentices are taught to hear the difference before they are taught to write it.

A greedy quantifier takes everything it can reach and then gives back only what it must. It is the temperament of the collector, the hoarder, the archivist who will not release a document until someone proves they need it. Set one loose on a line of text and it will swallow the line, then reluctantly retreat, character by character, until the rest of the incantation can be satisfied.

A lazy quantifier takes the least it can and only asks for more when forced. It is the temperament of the courier who carries what was asked for and not one item more.

Both are correct. Both are correct *differently*, and an apprentice who has not yet learned which situation wants which will write an incantation that works on every example she tested and fails on the first real record it meets. The Forge does not warn her. The Forge has already done exactly what she said.`,
      },
      {
        id: 'regex-3',
        title: 'Chapter III: Looking Without Taking',
        unlockAt: SHORT[2],
        content:
`The deeper craft is the assertion — the part of an incantation that looks at the text without consuming it.

To assert is to say: *there must be something here, and I will not take it.* A price preceded by a currency mark, where you want the number and not the mark. A word followed by a boundary, where the boundary must exist but is not part of the word. The incantation reaches past what it wants, confirms the world is arranged correctly, and withdraws without disturbing anything.

Apprentices find this genuinely difficult, and not for technical reasons. Every other part of the craft is about taking. The assertion is about the discipline of verifying and letting go, and the hands do not want to do it.

The Archivum's own catalogue incantations are almost entirely assertions. This is why the catalogue can be read a thousand times a second by a thousand different readers and never once come back altered. The Forge's oldest inscription says it plainly, on the lintel over the door, where every apprentice walks under it daily and most do not look up: *what you consume, you change.*`,
      },
      {
        id: 'regex-4',
        title: 'Chapter IV: The Pattern That Reads Itself',
        unlockAt: SHORT[3],
        content:
`Every generation, an apprentice discovers the ouroboros problem and believes they are the first.

The idea is irresistible: write an incantation that matches its own text. Not a description of incantations in general — that is a schoolroom exercise — but *this* incantation, these exact characters, matching themselves and nothing else. The Forge treats a pattern as text and text as a pattern, and the apprentice sees that symmetry and thinks: then it must be possible to close the loop.

It is possible. Eleven apprentices in the Archivum's history have done it. Each of their solutions is different, none of them are short, and all eleven are kept in a case in the Forge's east wall with no explanation beside them.

What the case does not say is what happened to the twelfth, who did not write one, but proved — in nine pages that the senior archivists have never released — that the eleven solutions form a family, that the family is infinite, and that the Forge therefore contains an unbounded number of statements that are about nothing except their own correctness.

She left the Archivum that season and did not say where she was going. The nine pages end with a line that is not an argument and was not, the archivists agree, meant to be one: *this is what the Godforge does. This is the whole of what it does.*`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'color-palette',
    title: 'The Prismatic Sanctum',
    epigraph: 'The oldest argument in the realms, still unsettled.',
    chapters: [
      {
        id: 'palette-1',
        title: 'Chapter I: The Breaking of the Light',
        unlockAt: SHORT[0],
        content:
`When the Sun broke, it did not go out. It came apart.

What had been one thing became a spectrum — not a loss but an unfolding, and the Luminous were the first to understand that this was the only interesting thing that had ever happened to light. A whole sun is a single fact. A broken one is a vocabulary.

The Sanctum was raised within a year, on the argument that a vocabulary nobody organises is just noise. Its founders set out to catalogue every colour the shattered Sun could produce and had to stop, humiliated, when they proved the set was uncountable.

So they changed the question. Not *what colours exist* — all of them do — but *which colours belong together*, and why, and whether the why can be written down. Nine hundred years later the Sanctum is still working on it, which its critics call failure and its keepers call the correct amount of progress on a genuinely hard problem.`,
      },
      {
        id: 'palette-2',
        title: 'Chapter II: The Rule of Harmony',
        unlockAt: SHORT[1],
        content:
`The Sanctum's first real result was the wheel, and the wheel's first real result was that harmony is geometric.

Colours that sit opposite each other fight, and the fight is legible — put them together and the eye cannot settle, which is either the worst thing you can do to a room or precisely the thing you wanted. Colours that sit adjacent agree so completely they risk saying nothing at all. Colours at the corners of a triangle inscribed in the wheel hold a tension that resolves, which is the closest the Sanctum has come to a definition of beauty that survives contact with an actual argument.

The keepers are careful to teach this as a description and not a law. The wheel does not say what is good. It says what the eye does, reliably, across every visitor the Sanctum has ever tested, which is a smaller claim and a much more useful one.

Apprentices who mistake the description for the law produce work that is correct and dead. The Sanctum has a room of it. Nobody visits.`,
      },
      {
        id: 'palette-3',
        title: 'Chapter III: The Colours With No Names',
        unlockAt: SHORT[2],
        content:
`You have drawn enough palettes now to have noticed the gaps.

There are regions of the wheel the Sanctum's vocabulary does not reach — not because they are rare, but because no realm ever needed to distinguish them. The Nocturne have eleven words for the near-blacks and the Luminous have one. The Nexus couriers, who read signal lamps at distance in bad weather, carry a distinction between two greens that the Sanctum's own instruments confirm are different and that no Luminous keeper has ever been able to see.

This was, for two centuries, treated as a curiosity. Then a keeper named Vashti made the observation that ended her career and founded the Sanctum's modern era: the palette does not describe the light. It describes the describer.

She was expelled for it. She was reinstated eleven years later, posthumously, with an apology carved above the west arch. The Sanctum has never been comfortable about this, and the discomfort is the point — every apprentice walks under the apology on the way in.`,
      },
      {
        id: 'palette-4',
        title: 'Chapter IV: The Contrast Law',
        unlockAt: SHORT[3],
        content:
`There is one rule in the Sanctum that is not up for discussion, and it is not about beauty.

Light that cannot be read by everyone is not light. It is decoration wearing light's clothes.

The keepers established the ratio after a decade of measurement across every visitor who would sit for it — the young, the old, the ones who saw the greens the Luminous could not, the ones who saw no greens at all. The number they arrived at is unlovely and arbitrary-looking and has survived every attempt to make it more elegant, because it was never derived from theory. It was counted.

Apprentices resent this rule more than any other. It disqualifies palettes they have fallen in love with. It says, flatly, that a combination can be exquisite and still be a failure, and that the failure is not a matter of taste.

The Sanctum's answer has not changed in nine hundred years, and is inscribed on the working bench where every apprentice will read it a thousand times: *you are not making it for you.*`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'password-generator',
    title: 'The Vault of Infinite Keys',
    epigraph: 'It has never run out. Nobody has ever proved it cannot.',
    chapters: [
      {
        id: 'vault-1',
        title: 'Chapter I: The Vault With No Door',
        unlockAt: SHORT[0],
        content:
`The Vault is not a building. It is a claim, and the claim is this: for any lock that has ever been made or will be made, there is a key here, and you may have it.

The Nocturne who keep it are not guards. There is nothing to guard — the Vault contains no keys until one is asked for, and the key that is produced has never existed before and will not exist again once it leaves. What the keepers do is more like arithmetic than security. They maintain the machinery that guarantees the drawing is fair, and they audit it, constantly, with the paranoid attention of people who understand exactly what a rigged draw would be worth.

There is no door because there is nothing to shut in. The famous inscription on the outer wall was written by the first keeper and has confused visitors for centuries: *the vault is empty. that is the security.*`,
      },
      {
        id: 'vault-2',
        title: 'Chapter II: The Length Argument',
        unlockAt: SHORT[1],
        content:
`Every apprentice arrives believing that a good key is a clever key. The Vault spends their first year unteaching it.

Cleverness is a pattern, and a pattern is a shortcut, and a shortcut is exactly what an attacker is looking for. The substitution of a numeral for a letter that it resembles, the punctuation at the end because the rules demanded punctuation, the name of something loved with a year appended — these feel like ingenuity and are, measurably, the first thousand guesses anyone makes.

What actually works is length, and length is boring, and the boredom is the whole lesson. A long key drawn at random from a large alphabet is not interesting to look at, cannot be remembered, and cannot be reasoned about by anyone including the person holding it. That is the property you want.

The keepers put it as a question rather than a rule, because the rule form gets argued with and the question form does not: *if you can explain why you chose it, what have you told them?*`,
      },
      {
        id: 'vault-3',
        title: 'Chapter III: The Draw',
        unlockAt: SHORT[2],
        content:
`You have drawn from the Vault often enough now to have wondered whether it repeats.

It is the right question and the keepers welcome it, because the honest answer is more interesting than the reassuring one. The Vault does not promise never to repeat. It promises that the space it draws from is large enough that a repeat, in the whole history of the realms, would be an event worth recording — and it does not promise this on faith. It counts.

The keepers maintain the count publicly, on the north wall, in a script small enough that visitors mistake it for decoration. The number of keys ever drawn from the Vault sits beneath the number of keys the Vault could draw, and the ratio between them is what the apprentices are made to compute by hand in their first month, so that they will feel it rather than merely know it.

Nobody who has done the computation asks about repeats again. What they ask about instead — and this is the question the keepers have no good answer to — is what happens to a key after it leaves.`,
      },
      {
        id: 'vault-4',
        title: 'Chapter IV: The Keys That Came Back',
        unlockAt: SHORT[3],
        content:
`Three times in the Vault's history, a key has been brought back.

Not returned — the Vault has no facility for that, and would not know what to do with one. Brought *back*, by someone who had found it somewhere it should not have been: written on a wall in the Verge, spoken aloud in a Nexus courier's sleep, and once, most troublingly, engraved on the underside of a bench in the Vault's own waiting hall, in a hand that predated the drawing of that key by eleven years.

The keepers investigated all three. The first two resolved — a leak, and a coincidence of short strings that the Vault no longer permits. The third did not resolve, and the bench is still there, and the engraving is still on it, and the keepers have declined every proposal to remove it.

Their reasoning is recorded in the minutes and is the most Nocturne sentence ever committed to the Vault's archive: *a thing we cannot explain is data. destroying it would only make us comfortable.*`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'box-shadow-generator',
    title: 'The Shadow Weaver\'s Loom',
    epigraph: 'Three anchors. Two drift. Four fight.',
    chapters: [
      {
        id: 'shadow-1',
        title: 'Chapter I: The First Shadow',
        unlockAt: SHORT[0],
        content:
`Before the Sun broke there were no shadows, and the Luminous have never entirely forgiven themselves for how much better things look now.

A whole sun illuminates from everywhere at once. Nothing casts, nothing recedes, nothing has a near side. The world under it was perfectly visible and completely flat, and the Luminous accounts of that age read like descriptions of a painting rather than a place.

The first shadow appeared four minutes into the Shattering. It was cast by a doorframe, it fell to the northeast, and a Luminous apprentice whose name is not recorded is said to have sat down on the ground and wept, because for the first time in the history of the realm she could see that the door was in front of the wall.

The Loom was built where that doorframe stood. It teaches one thing, and it teaches it for years: a shadow is not darkness. A shadow is information about where the light is.`,
      },
      {
        id: 'shadow-2',
        title: 'Chapter II: The Rule of Three Anchors',
        unlockAt: SHORT[1],
        content:
`A single shadow reads as a sticker. Two read as a mistake. Three read as an object.

The weavers arrived at this by exhaustion rather than theory. A near shadow, tight and dark, tells the eye how far the object sits from its surface. A middle shadow, softer and wider, tells it how large the object is. A far shadow, barely present, tells it that there is an atmosphere between the two — and it is this third one, the one nobody notices, that separates a shape that floats from a shape that is merely drawn.

Apprentices reliably skip the third. It costs the most effort and shows the least, and the temptation to declare the work finished at two is enormous.

The weavers have a demonstration for this, and every apprentice gets it exactly once: the same object, woven at two anchors and at three, side by side, and the apprentice is asked which is which. Nobody has ever failed to pick correctly. Almost nobody can say why. That gap — between what the eye knows and what the mouth can defend — is what the remaining years of the apprenticeship are for.`,
      },
      {
        id: 'shadow-3',
        title: 'Chapter III: The Inward Shadow',
        unlockAt: SHORT[2],
        content:
`There is a weave that turns the shadow inward, and the Loom teaches it late and reluctantly.

An outward shadow says: this object sits above the surface. An inward one says: this object is a hole in it. The weave is nearly identical — the same anchors, the same softness, one inversion — and the effect on the eye is total and immediate. A pressed button. A carved recess. A window rather than a picture of one.

The reluctance is not superstition. It is that the inward weave is the easiest way in the whole craft to lie convincingly. An apprentice who learns it early will use it to make things look interactive that are not, and depth is a promise: a surface that appears to be a hole and turns out to be a wall is a small betrayal, and the eye remembers small betrayals.

The senior weavers put it the way they put everything, which is bluntly and only once: *do not carve a door into a wall you are not going to open.*`,
      },
      {
        id: 'shadow-4',
        title: 'Chapter IV: The Weaver Who Used Forty',
        unlockAt: SHORT[3],
        content:
`Her name was Ilsabet and the Loom's records describe her, in the flat institutional voice of a body that has decided not to have feelings about something, as *technically without equal.*

She held that the rule of three was a floor, not a ceiling, and set out to prove it. Her final work used forty anchors. It is preserved in the Loom's upper gallery. Visitors are permitted, one at a time.

The accounts agree on what it looks like and disagree entirely on what it is. It is a rectangle. It is unmistakably, physically present in a way that no other work in the gallery manages — people reach for it, every time, and the gallery has a rail now because of this. Standing in front of it, you would swear the light in the room had changed. It has not; this has been measured.

Ilsabet did not weave again. The record says she found the result *sufficient*, which the weavers who knew her insist is not what she said, and the weavers who knew her are all dead now.

The rule of three is still what the Loom teaches. The gallery is still open. The Luminous have never resolved this and have stopped trying to, which is, in its way, the most honest thing the realm has ever done.`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'base64-encoder',
    title: 'The Cipher Stone',
    epigraph: 'The most common lock in the realms has no key at all.',
    chapters: [
      {
        id: 'b64-1',
        title: 'Chapter I: The Stone That Hides Nothing',
        unlockAt: SHORT[0],
        content:
`The Verge is where things change form, and the Cipher Stone is the oldest changing-place on it.

Feed it anything — a name, a portrait, a contract, a sound — and it returns the same thing rewritten in sixty-four characters that every realm can carry without damage. That is its entire function, and the function is genuinely necessary: the roads between realms mangle anything unusual, and the Stone's alphabet is the largest set of symbols that survives every road.

What it is not, and has never been, is a lock. Anyone may reverse it. The Stone will do the reversing for them, cheerfully, without asking who they are.

Newcomers to the Verge find this disappointing and say so. The keepers have heard it ten thousand times and have a standard reply, delivered without heat: *a bridge is not a wall. Stop being angry at the bridge.*`,
      },
      {
        id: 'b64-2',
        title: 'Chapter II: The Cost of Passage',
        unlockAt: SHORT[1],
        content:
`Nothing crosses the Verge without paying, and the Stone's toll is a third.

Three units in, four units out — that is the arithmetic of the alphabet, and it cannot be negotiated. A portrait that crosses the Stone arrives a third heavier than it left. A message small enough to send freely may, after passage, be too large.

The Verge has always been honest about this in a way the other realms find slightly crude. There is no pretence that the crossing is free. The toll is posted at the Stone's foot, in the original hand, and the couriers who use the road most heavily are the ones who complain least — because the alternative is not a cheaper crossing, it is a road their cargo does not survive.

The keepers' only real advice, repeated to every apprentice: pay the toll for things that need the road. Do not pay it out of habit for things that were never leaving.`,
      },
      {
        id: 'b64-3',
        title: 'Chapter III: The Padding',
        unlockAt: SHORT[2],
        content:
`At the end of many passages there are one or two marks that carry nothing.

They are there because the arithmetic does not always come out even, and the Stone will not emit a partial unit. So it pads — it fills the remainder with a symbol that means *this space is deliberately empty* — and the receiving end knows to discard it.

Apprentices find the padding ugly and periodically propose removing it. The proposal has been made, by the Verge's own count, sixty-one times. It is always refused, and always for the same reason, which is worth sitting with: without the padding, a truncated message and a complete one look identical.

The mark is not decoration. It is the Stone stating, in the only vocabulary it has, that it finished. A message with no mark might have finished. A message with the mark did.

The Nocturne, who trust nothing, consider the padding the single most important character on the road.`,
      },
      {
        id: 'b64-4',
        title: 'Chapter IV: The Nested Passages',
        unlockAt: SHORT[3],
        content:
`Every so often a courier arrives with something that has crossed the Stone twice.

It is always a mistake, and it is always the same mistake: an automatic hand somewhere upstream that encodes whatever it is given, applied to something that had already been encoded. The result is legitimate. It reverses correctly. It is also a third heavier again, for nothing.

The keepers log these, and the log is the closest thing the Verge has to a comedy. Six passages. Eleven. The record stands at thirty-one, a single word that arrived weighing more than a portrait, sent by a courier system that had been quietly encoding its own output for nine years without anyone noticing, because at every individual step the operation was correct.

The Verge keeps the record on the wall not to mock the sender but as its central lesson, the one it would carve into every apprentice if it could: *the road does not check whether you needed to be on it. Every step of a wrong journey can be perfectly legal.*`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'hash-generator',
    title: 'The Soul Furnace',
    epigraph: 'It takes anything and returns the same length of nothing.',
    chapters: [
      {
        id: 'hash-1',
        title: 'Chapter I: The Furnace',
        unlockAt: LONG[0],
        content:
`The Nocturne built the Furnace to answer one question: *is this the same thing I saw before?*

It is a harder question than it sounds. Two documents may differ by a single character in a hundred thousand. Two portraits may be identical except for a corner nobody looks at. Comparing them directly means holding both, and holding both is often exactly what you are not permitted to do.

So the Furnace takes a thing and burns it down to a fixed residue — the same length every time, whether you fed it a word or a library. The residue is not the thing. You cannot rebuild the thing from it; the Furnace consumed everything that made rebuilding possible. What you can do is burn a second thing and compare the residues, and if they match, you know.

That is the whole of it. The Nocturne consider it their finest work and are quietly aware that it is also the most misunderstood object in the five realms.`,
      },
      {
        id: 'hash-2',
        title: 'Chapter II: The One-Way Road',
        unlockAt: LONG[1],
        content:
`The misunderstanding is always the same, and it always arrives confidently.

Someone learns that the Furnace turns a name into an unreadable residue and concludes that the Furnace hides the name. They burn a list of names, publish the residues, and announce that the list is now safe.

The Nocturne then burn every name they can think of, compare the residues, and hand the list back, complete, usually within the hour. The Furnace is not secret. Anyone may use it. If the set of possible inputs is small — names, dates, four-digit codes, the words people actually choose — then burning all of them is not an attack, it is an afternoon.

The Furnace does not hide. It *proves*. The road runs one way, and the Nocturne's oldest warning about it has been repeated so often it has worn smooth: a one-way road stops you going back. It does not stop anyone walking the same way you did.`,
      },
      {
        id: 'hash-3',
        title: 'Chapter III: The Salt',
        unlockAt: LONG[2],
        content:
`The remedy is old, cheap, and still routinely skipped.

Before the burning, throw in a handful of something random — unique to this thing, stored openly beside the residue, never reused. Now the residue is not the residue of the name. It is the residue of *this* name in *this* furnace on *this* occasion, and the attacker who burned every name in the realms has to do it again, from scratch, for every single entry on your list.

The Nocturne call the handful salt and are amused that other realms assume the word is poetic. It is not. It comes from preservation: the thing that stops a store of the same substance from spoiling all at once.

The failure the Furnace-keepers see most often is not skipping the salt. It is reusing it — one handful for the whole list, which feels like salting and provides almost none of the protection, because the attacker's second pass costs him nothing.`,
      },
      {
        id: 'hash-4',
        title: 'Chapter IV: The Collision',
        unlockAt: LONG[3],
        content:
`Somewhere in the mathematics there is a horizon, and past it the Furnace's promise thins.

The residue is fixed in length. The set of things you can burn is not. So there must exist two different things that burn to the same residue — this is not a flaw anyone introduced, it is arithmetic, and the Nocturne have never pretended otherwise.

The question was only ever whether anyone could *find* such a pair on purpose. For the old furnaces, the answer turned out to be yes. It took years, then months, then an afternoon, and each time the Nocturne retired the furnace and said so publicly, in plain language, with the date.

This is the part other realms find hardest to believe about the Umbral: that the people who build the locks are the ones who announce, loudly and first, when a lock has failed. The Nocturne find the surprise insulting. A keeper who conceals a broken furnace is not protecting anyone. He is only choosing which people get to keep trusting it.`,
      },
      {
        id: 'hash-5',
        title: 'Chapter V: What the Furnace Remembers',
        unlockAt: LONG[4],
        content:
`You have worked the Furnace a hundred times, which in the Umbral realm is not mastery but merely the point at which someone will tell you the thing they do not tell visitors.

The Furnace keeps no records. This is architectural, deliberate, and audited — there is no ledger, no cache, nothing that could be seized or subpoenaed or leaked. Everything the Furnace is given is destroyed in the giving. That is the property the whole realm rests on.

And yet.

Every residue the Furnace has ever produced is still, in a sense, out there — in the ledgers of those who received them, in the seals on old contracts, in the verification stones of a hundred systems that were built to trust this one. The Furnace forgets perfectly. The realms remember everything it ever said.

The keepers' final lesson is not about mathematics, and the apprentices who reach it are usually not expecting it: *you are not building a thing that forgets. You are building a thing that will be quoted, by people you will never meet, long after you have stopped being able to explain what you meant.*

That, they say, is why the Furnace was built by people who trusted nobody. Anyone who trusted anybody would have built it worse.`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'gradient-generator',
    title: 'The Aurora Bridge',
    epigraph: 'One colour becomes another, and no one can say where.',
    chapters: [
      {
        id: 'grad-1',
        title: 'Chapter I: The Bridge',
        unlockAt: SHORT[0],
        content:
`Nothing in the Luminous realm changes all at once. The Bridge is the proof.

It spans the gap between two of the Sanctum's holdings and it is not, structurally, remarkable. What is remarkable is its surface, which begins at one end as one colour and arrives at the other as a different one, and which no visitor has ever been able to divide.

People try. It is the first thing everyone does. You walk the Bridge slowly, watching for the place where it stops being the first colour, and you never find it, because there isn't one — every point on the Bridge is a little more of the destination than the point behind it, and the difference between any two adjacent points is below what an eye can resolve.

The Luminous consider this the most important structure they have ever built, and it carries no traffic. It was never meant to. It was built to demonstrate a claim about change that the realm had been arguing about for a century, and it settled the argument by being walkable.`,
      },
      {
        id: 'grad-2',
        title: 'Chapter II: The Banding',
        unlockAt: SHORT[1],
        content:
`The first Bridge failed, and the failure is more instructive than the success.

Its builders worked in steps — a hundred and twenty of them, each a slightly different colour, laid end to end. On paper the steps were far too small to see. In practice the completed Bridge was hideous: a stack of visible stripes, each one obvious, the whole thing looking less like a transition than like someone had run out of paint a hundred and twenty times.

The eye, it turned out, is not good at judging absolute colour and is extraordinarily good at finding edges. A difference invisible in isolation becomes a hard line the moment it runs straight and long enough for the eye to track it.

The second Bridge added noise — a fine, random unevenness scattered across every step, breaking the lines before the eye could follow them. It cost nothing, it made every individual point measurably *less* accurate, and it is the only reason the Bridge works.

The Luminous find this lesson deeply uncomfortable and teach it anyway: sometimes the honest way to look continuous is to be slightly, deliberately wrong everywhere.`,
      },
      {
        id: 'grad-3',
        title: 'Chapter III: The Muddy Middle',
        unlockAt: SHORT[2],
        content:
`Choose two colours from opposite sides of the wheel and the Bridge between them will pass, somewhere in the centre, through something grey and unpleasant that neither builder intended.

This is not a flaw in the Bridge. It is what the straight path between those two points actually contains. The builders asked for a direct route and the direct route goes through the middle, and the middle of the wheel is where colour goes to cancel out.

The Sanctum's remedy is to refuse the straight line — to bend the path outward, around the dead centre, through a third colour nobody asked for and everybody prefers. The result is longer, less defensible on paper, and better.

Apprentices resist this the way they resist everything that cannot be justified from first principles. The keepers let them build the straight one first. It is faster than arguing, and the muddy middle makes the case better than any keeper has ever managed to.`,
      },
      {
        id: 'grad-4',
        title: 'Chapter IV: The Bridge to Nowhere',
        unlockAt: SHORT[3],
        content:
`On the Bridge's south side there is a second span that begins at the same anchor and ends in open air.

It was commissioned by a keeper named Oro, who argued that if a gradient is a claim about change, then the realm had only ever built claims about change *between two known things*, and had never once asked what a change with no destination looks like.

The span he built begins in the same colour as the Bridge and fades, over its length, into full transparency. It ends nine metres above a drop. There is a rail.

The Luminous debated demolishing it for forty years. The argument for demolition was that it is dangerous and means nothing. The argument against was that people kept walking it, all the way to the end, and coming back changed in a way they could not articulate — and that a realm which has spent nine hundred years insisting the eye knows things the mouth cannot defend was in a poor position to demand an articulation now.

The span is still there. The rail is checked twice a year. Oro's inscription at the anchor is four words: *not everything arrives somewhere.*`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'uuid-generator',
    title: 'The Identity Well',
    epigraph: 'It has never repeated itself. Nobody has ever checked.',
    chapters: [
      {
        id: 'uuid-1',
        title: 'Chapter I: The Naming Problem',
        unlockAt: SHORT[0],
        content:
`The Archivum's founding crisis was not fire, or war, or funding. It was two ledgers.

Two provinces, keeping records independently, each numbering their entries from one. When the provinces merged, so did the ledgers, and every number in the combined archive now meant two things. The reconciliation took eleven years. Four hundred thousand records were lost, not destroyed but *dissolved* — still legible, still complete, and no longer attached to anything.

The Archivum's response was the Well, and the Well's design principle is the opposite of every naming scheme that came before it: a name must be assigned without asking anyone whether it is taken.

If you must ask, you must have someone to ask, and that someone becomes the thing that fails. The Well never asks. It draws from a space so large that the answer is always, effectively, no — and it can therefore be used by a thousand provinces at once, none of which have ever spoken to each other.`,
      },
      {
        id: 'uuid-2',
        title: 'Chapter II: The Shape of a Name',
        unlockAt: SHORT[1],
        content:
`A name from the Well is thirty-two symbols in five groups, and every part of that shape was argued over.

The groups exist because a human being must occasionally read one aloud, and a human being reading thirty-two undifferentiated symbols will lose their place at symbol nine. The lengths are not equal because the earliest Well encoded meaning in the segments — a timestamp, a machine, a counter — and the shape outlived the meaning.

This is the Archivum's most quietly radical position: they kept the shape after the reason for it died. Every keeper knows the segments no longer signify. Every proposal to regularise them has been refused.

The reasoning is recorded and is characteristically archival: a form that thousands of systems recognise on sight is worth more than a form that is internally tidy. The Archivum does not optimise for elegance. It optimises for still being readable in two hundred years by someone who has never heard of the Archivum.`,
      },
      {
        id: 'uuid-3',
        title: 'Chapter III: The Weight of the Well',
        unlockAt: SHORT[2],
        content:
`You have drawn from the Well often enough now to be told what it costs.

Nothing, at the Well. Everything, downstream. A name from the Well is large, and it is unordered, and both of those are the price of never having to ask permission.

Large means every ledger that carries it carries more. Unordered means that two names drawn a second apart sit nowhere near each other, so an archive sorted by name is an archive in random order — and an archive in random order is one whose indexes must be rebuilt constantly, forever, at a cost that scales with everything.

The Archivum has known this since the Well opened and has published it since the Well opened. There are newer wells now that trade a little of the independence back for order, and the keepers recommend them freely, which visitors find surprising.

They should not. The Archivum's business is records, not loyalty. A keeper who recommends the Well for a problem the Well is wrong for has failed at the only thing the Archivum does.`,
      },
      {
        id: 'uuid-4',
        title: 'Chapter IV: The Name Nobody Drew',
        unlockAt: SHORT[3],
        content:
`There is one name the Well will never produce, and it is written above the drawing floor: thirty-two zeroes.

It is not reserved by rule. It is reserved by probability — it is exactly as likely as any other name, which is to say so unlikely that the Archivum has been comfortable, for nine hundred years, treating it as impossible and using it to mean *nothing here yet.*

Every system built on the Well does this. The empty name. The not-yet-assigned. It works perfectly, and it works on the understanding that the Well will never, in the lifetime of the realms, actually draw it.

The keepers are entirely aware that this is a bet rather than a guarantee, and they are aware that the bet is with the same arithmetic that makes the Well work at all. You cannot have one without the other: a Well that could not draw the zero name would be a Well that asks permission.

There is a book on the drawing floor for recording the day it happens. It has one page. It is blank, and it is bound in the same leather as the ledgers, and it is reprinted every fifty years with the rest of them.`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'image-compressor',
    title: 'The Essence Distillery',
    epigraph: 'Can you still tell what you have lost?',
    chapters: [
      {
        id: 'img-1',
        title: 'Chapter I: The Question at the Door',
        unlockAt: SHORT[0],
        content:
`The Distillery asks every visitor the same question before it will take their work, and the question is not *what do you want removed.*

It is: *what would you not notice?*

The distinction is the whole craft. An image is not a picture — it is a vast enumeration of every point in it, and the overwhelming majority of those points carry information no eye has ever used. Sky that is a hundred nearly-identical blues. Shadow with detail in it that no viewer will ever raise to the light. Edges recorded to a precision finer than the eye can resolve at any viewing distance a human being will ever adopt.

The Distillery removes those and leaves the rest. It is not destroying the image. It is declining to carry the parts of it that were never being looked at.`,
      },
      {
        id: 'img-2',
        title: 'Chapter II: The Two Doors',
        unlockAt: SHORT[1],
        content:
`There are two doors out of the Distillery and choosing wrongly is the most common mistake in the building.

Through the first, nothing is lost. The work comes out smaller by pure economy — repetitions noted rather than repeated, order found and exploited — and every point that went in comes out identical. Diagrams go through this door. Text. Anything with hard edges, flat regions, and a reader who will look closely.

Through the second, the work comes out very much smaller and *not the same*. Photographs go this way. Faces, landscapes, anything the eye reads as continuous.

Send a diagram through the second door and it returns smeared, its clean edges surrounded by a faint grey hesitation that everyone can see and nobody can name. Send a photograph through the first and it returns unchanged in every respect including its size, having gained nothing at all.

The distillers do not choose for you. They only ask, at the door, what the thing is — and they have learned that most visitors have never once been asked that about their own work.`,
      },
      {
        id: 'img-3',
        title: 'Chapter III: The Generation Loss',
        unlockAt: SHORT[2],
        content:
`The Distillery's saddest room holds a sequence of ninety portraits.

They are the same portrait. The first is the original. Each subsequent one was distilled from the one before it, through the second door, at a setting the distillers describe as *entirely reasonable.*

By the tenth, nothing is visibly wrong. By the thirtieth, the background has developed a texture that was not there. By the sixtieth, the face has begun to acquire a kind of smeared halo, an artefact of an artefact of an artefact. By the ninetieth it is a portrait of the compression rather than of the woman.

Every individual step in that sequence was defensible. Every one of them removed only what would not be noticed. The room exists because the distillers needed a way to say the thing they cannot get visitors to believe: *the losses do not know about each other.*

Keep the original. The distillers will say it at the door, at the counter, and on the way out. Keep the original. Distil from it every time. Never distil a distillation.`,
      },
      {
        id: 'img-4',
        title: 'Chapter IV: The Thing Worth Carrying',
        unlockAt: SHORT[3],
        content:
`You have brought enough work through the Distillery now to have found its real subject, which is not images at all.

The Archivum did not build this place to make things smaller. It built it because it had discovered, over centuries of keeping everything, that keeping everything is a way of keeping nothing — that an archive which never decides what matters becomes an archive nobody can move, nobody can copy, and nobody, in the end, can read.

Every distillation is a judgement about what the thing is *for*. The sky in the portrait is not the portrait. The precision below the eye's resolution is not the picture. Somebody has to decide that, and the Distillery's position — unfashionable in a realm devoted to preservation — is that refusing to decide is also a decision, and a worse one.

The inscription is at the exit rather than the entrance, which the distillers insist is deliberate, because it only makes sense on the way out:

*everything you carry, you carry instead of something else.*`,
      },
    ],
  },
];

const BY_SLUG = new Map(TOOL_LORE.map(l => [l.toolSlug, l]));

/** The codex entry for a tool, or null when it has none. Most tools have none. */
export function loreForTool(slug: string): ToolLore | null {
  return BY_SLUG.get(slug) ?? null;
}

/** Tool slugs that have a codex entry, for the /quests page and future indexes. */
export const LORE_SLUGS: string[] = TOOL_LORE.map(l => l.toolSlug);
