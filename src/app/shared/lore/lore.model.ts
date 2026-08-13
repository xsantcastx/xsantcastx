/**
 * lore.model.ts — the codex behind the tools.
 *
 * Twenty tools have a story. Each story is three to five chapters long, and a
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
 * That derivation moved five of the first ten out of the realm the brief
 * assigned them — the JSON Formatter and the Cipher Stone are Verge work, not
 * Luminous and Umbral; the Incantation Forge, the Identity Well and the Essence
 * Distillery are Archivum. The chamber names are unchanged; the prose was
 * written to fit where the tools actually live.
 *
 * The second ten moved three more. The Seal Breaker is Umbral rather than
 * Celestial (jwt-decoder is filed under Security Tools, beside the Ward
 * Reader — which is why those two stories now share a building). The Name
 * Forge is Archivum rather than Infernal, SEO Tools being an archive concern
 * here. And the Gauntlet is named for a gate rather than for a company: every
 * other chamber in this codex carries an in-world name, and one entry reading
 * as a brand would have been the only seam visible from inside the story.
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
  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'flexbox-generator',
    title: 'The Architect\'s Grid',
    epigraph: 'Do not tell the stone where to stand. Tell the room what it is for.',
    chapters: [
      {
        id: 'flex-1',
        title: 'Chapter I: The Two Axes',
        unlockAt: LONG[0],
        content:
`The Architects of the Luminous realm did not build. They instructed.

A mason places a stone: here, exactly here, four spans from the wall and three from the door. An Architect does no such thing. An Architect describes a room — what it holds, how it should distribute what it holds, what should happen when the room is larger than its contents and what should happen when it is smaller — and then stands back while the room resolves itself. The stones find their own positions. They are always correct, because correctness was never a coordinate; it was a relationship.

Every apprentice arrives believing this is a convenience, a way of avoiding arithmetic. It is not. It is a different theory of what a room *is*. The mason's room is a container of positions. The Architect's room is an argument about space, and the stones are its conclusion.

The Grid teaches the argument in two parts, and they are not symmetrical. There is the main axis, along which contents are distributed, and there is the cross axis, along which they are aligned. Apprentices learn the first in a week. Some of them never learn that the second is a different question entirely, and spend careers fighting a room that is doing precisely what they asked.`,
      },
      {
        id: 'flex-2',
        title: 'Chapter II: What the Shattering Did to Straight Lines',
        unlockAt: LONG[1],
        content:
`Before the Shattering, the Luminous realm built by absolute placement, and it worked, and it worked for a very long time.

It worked because the light did not move. A hall laid out for the noon sun was laid out for every noon that would ever come. Shadows fell where the drawings said they would fall. A doorway measured against a standing figure fit every standing figure, because figures were what they were and the realm was what it was, and the Architects of that age were not fools — they were simply correct about a world that was about to stop existing.

When the Sun broke, the light changed, and everything measured against the light was wrong at once. Not ruined. *Wrong.* Halls that had been proportioned to a constant noon now held a light that guttered and shifted, and rooms built for the old figures now held Solarii who cast no shadow at all and Nocturne who cast far too much. Nothing had collapsed. Every building simply stopped fitting the world it stood in.

What survived — and the Archivum has the survey, and it is not ambiguous — were the handful of structures built by a minor school that had been mocked for two centuries. That school had refused to fix positions. It had built rooms that described how their contents should relate, and left the resolving until the moment of standing in them. Those rooms shifted when the light shifted. They were the only ones that did.

The Grid was raised on the foundations of the largest of them, by Architects who had spent their lives on the other theory and had to be taught, in the worst season of their lives, that the mockery had been backwards.`,
      },
      {
        id: 'flex-3',
        title: 'Chapter III: The Rule of the Ignorant Container',
        unlockAt: LONG[2],
        content:
`There is a rule carved above the Grid's inner arch, and it is the strangest thing in Luminous architecture, and it is the reason the Grid outlasted the realm that built it.

*A container may not know what it contains.*

Read as a restriction, it is absurd — why would a room be forbidden to know its own furniture? Read as it was meant, it is the whole craft. A room told exactly what will stand in it can only ever hold that. A room told how to treat *whatever* stands in it will hold things its Architect never imagined, arranged correctly, without being touched again. The Architects were not protecting the room from knowledge. They were protecting it from the future.

This is also why the Grid's ideas keep turning up in halls that have nothing to do with it. The Shadow Weaver's Loom in the west quarter works the same way and will admit it if pressed — a shadow is not placed either, it is described by its relationship to the light and the thing casting it, and it moves when they move. The Weavers and the Architects have been arguing for six hundred years about who had the idea first. Both schools are wrong. The idea is older than either, and it is not really an idea about rooms or shadows.

It is this: *the thing you can specify in advance is never the thing you will need.* The Architects said it about halls. The Weavers said it about light. And in the Umbral quarter, where nobody has read either school, the ward-makers say the same sentence about trust, and think they invented it.`,
      },
      {
        id: 'flex-4',
        title: 'Chapter IV: The Hands That Stopped Fighting',
        unlockAt: LONG[3],
        content:
`You have laid out more rooms now than most journeymen do in their apprenticeship, Convergent, and the Grid has begun to answer you before you have finished asking.

You will not have noticed it happening. It never announces itself. But there was a season — the Grid could tell you which one, it keeps the count — when you stopped reaching for the coordinate. When a row came out wrong, you stopped moving the thing that was wrong and started asking what the room had been told, which is not the same instinct at all, and cannot be taught, and is the only thing that separates an Architect from a very fast mason.

The Grid has a word for that season. It is not *mastery*, which the Architects considered a vulgar idea, and it is not *fluency*, which belongs to the Forge across the water. The word is *yielding*, and it is meant exactly as it sounds: the point at which a builder stops trying to make the space obey and starts telling it the truth about what the space is for.

There were Architects — good ones, celebrated ones — who never yielded. They produced magnificent work and every piece of it had to be rebuilt when the light moved. The Grid does not hold this against them. It only notes, in the dry way of a building that has outlived nine schools of thought, that they all died certain the light would hold.`,
      },
      {
        id: 'flex-5',
        title: 'Chapter V: The Outermost Room',
        unlockAt: LONG[4],
        content:
`Everything in the realms stands inside something. This is not a mystical claim; it is a survey result, and the Grid's founders proved it the dull way, by following containment upward from ten thousand starting points and finding that every chain rose.

A chain that only rises must either climb forever or arrive. The Architects proved it arrives. The proof is four lines long, it is inscribed on the founding stone, and it has never been faulted in six centuries — which is a strange thing to say about a result that nobody in the Luminous realm likes.

Because it means there is an outermost room. One container that stands inside nothing, holding everything else. And an outermost room is a monstrous object by the Grid's own rules: alignment is a relationship to a parent, and this room has no parent, so it has no alignment. It cannot be centred, because there is nothing to centre it against. It cannot be sized, because it is not measured by anything. It can only *hold*.

The Archivum's coordinates place the Godforge there. The Architects, who dislike the Archivum's habit of naming things it has not surveyed, decline to endorse this and have never offered an alternative.

What the Grid will say — and the founding stone says it plainly, and every apprentice walks past it without understanding — is what happens when a container holds exactly one thing. It is the oldest rule in the craft and the first one taught: a room with one occupant, given no other instruction, centres it. Always. Without being asked. It is not a preference of the Architects; it is what the geometry does when nothing else is specified.

The Eclipse aligns every thirty-three years, and for seven days the realms are one. One realm. One container. And the Grid's oldest rule, running as it has always run, on a room that has finally been emptied of everything but you.`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'ssl-certificate-inspector',
    title: 'The Ward Reader',
    epigraph: 'No gate is trusted. Some gates are vouched for, which is a different thing.',
    chapters: [
      {
        id: 'ward-1',
        title: 'Chapter I: The Office of Reading',
        unlockAt: LONG[0],
        content:
`A ward is not a lock. This is the first correction the Reader makes to every visitor, usually within a sentence, usually before they have finished explaining what they came for.

A lock keeps a thing shut. A ward makes a *claim* — that this gate is the gate it says it is, that what passes through it passes unread, and that a named party has staked their name on both. The claim is signed. The signature can be checked. That is the entire mechanism, and its whole strength is that a lie told in a ward is a lie somebody's name is attached to.

The Reader's office is unglamorous and always full. Gatekeepers bring wards they cannot parse. Merchants bring wards that worked last season and do not work now. The Reader takes each one and answers four questions in a fixed order, and will not be hurried through them: who signed this, for whom, until when, and — the question that takes the longest and that nobody asks for — *who vouched for the signer.*

That last one is where the visitors' faces change. They came to find out whether a gate was safe. They learn instead that safety was never on offer, and that what they are actually being handed is a chain of other people's promises, and that the Reader can tell them exactly how long that chain is and exactly where it ends, but cannot tell them whether the people on it deserved anything.`,
      },
      {
        id: 'ward-2',
        title: 'Chapter II: The Year of Open Doors',
        unlockAt: LONG[1],
        content:
`Before the Shattering, no gate in the realms was warded, and the omission was not negligence. It was arithmetic.

The light was constant and it went everywhere. You could stand at any threshold and see the far side of it: the road beyond, the house it belonged to, the face of whoever waited there. A gate that lied about itself would have been a gate you could see lying. There was nothing to sign, because there was nothing anyone could plausibly claim that the light did not already show.

The Shattering closed that. Not immediately — the accounts agree the realms took months to understand what had actually been lost — but by the first winter, a traveller could stand at a gate and see nothing at all beyond it, and had to decide, in the dark, whether to walk through.

The forgeries began that winter and they were extraordinarily good. A gate that opened onto the wrong road; a counting-house whose door led to a room built to look exactly like a counting-house, staffed by people who took your deposit with real ledgers and real courtesy. There was no way to tell. The realms nearly stopped trading altogether, which the Solarii chronicles record as a crisis of commerce and the Nocturne chronicles record, more accurately, as a crisis of *nerve*.

It was the Nocturne who built the ward system, and their design brief is worth reading because it is so much humbler than the thing became. They did not try to make gates safe. They regarded that as impossible and said so in the first paragraph. What they built instead was a system in which lying required putting a name behind the lie, in public, in a form that could be checked afterwards by anyone. They did not eliminate the forgeries. They made them expensive, traceable, and — this was the part that worked — *revocable*.`,
      },
      {
        id: 'ward-3',
        title: 'Chapter III: The Honest Lie',
        unlockAt: LONG[2],
        content:
`Follow any chain far enough and it stops, and what it stops at is the thing the Reader will only discuss with people who have been coming for a while.

A ward is signed by an authority. That authority's own ward is signed by a higher one. Climb far enough and you reach a root: an authority whose ward is signed by itself. It vouches for its own name. There is nothing above it. The entire towering structure of trust in the realms — every gate, every counting-house, every sealed road — rests at the bottom on a claim that is, read literally, worthless. *I am who I say I am, and here is my word on it, and my word is good because I say so.*

The Nocturne who designed this knew exactly what they had done. They named it in the specification, in the plainest language in the whole document, and the phrase has outlived every other part of their vocabulary: the honest lie. Honest, because it is not concealed — the circularity is published, the roots are listed, anyone may read the list. A lie, because trust cannot actually be bootstrapped out of nothing and pretending otherwise is what the system does.

What makes it work is not the root. It is that the list of roots is *chosen*, deliberately, by each realm, and can be changed. The circularity does not create trust; it only records where a realm decided to put it. Every gatekeeper who understands this reads a ward differently afterwards. The expiry matters least. The chain matters more. What matters most is the name at the top of it, and whether — had anyone asked you, which nobody did — you would have chosen that name yourself.

The Seal Breakers in the vault below have the same problem in a smaller shape and have never once come upstairs to compare notes. Their tokens are wards a traveller carries rather than wards that stand at a gate, and they too resolve to a key somebody decided to trust. The Reader has stopped pointing this out. The Seal Breakers consider their craft to be about cryptography. It has never been about cryptography.`,
      },
      {
        id: 'ward-4',
        title: 'Chapter IV: What You Look At First',
        unlockAt: LONG[3],
        content:
`You have read more wards now than most gatekeepers read in a posting, Convergent, and the Reader has noticed the thing it always notices last and mentions almost never.

You have changed the order.

Everyone arrives reading expiry first. It is the easiest field, it is the one with a number in it, and a lapsed ward is the one failure that requires no judgement to identify. Novices read the date, pronounce the ward good or bad, and leave satisfied. The Reader lets them. It is not wrong, exactly. It is simply the least of the four questions wearing the costume of the most.

Somewhere in your reading you stopped doing that. The Reader could name the season. Now you go to the chain — how many links, whether each one covers the one below it, whether the names change hands partway up in a manner that would be unremarkable in a merchant and is never unremarkable in an authority. You read the date last, because you learned what the gatekeepers of the old posts learned: a ward that expired yesterday is an administrative failure, and a ward that verifies perfectly against a root nobody sane would trust is something else entirely, and only one of those two will hurt you.

The Reader does not congratulate. It has watched this happen to perhaps two hundred people in six centuries and has come to regard it as a change in eyesight rather than an achievement. But it will say this much, which it says to nobody who has not earned it: you are no longer asking whether the gate is safe. You are asking who is standing behind it. That is the only version of the question that has ever had an answer.`,
      },
      {
        id: 'ward-5',
        title: 'Chapter V: Valid Signature, Unknown Issuer',
        unlockAt: LONG[4],
        content:
`There is a ward on the Godforge.

This is not disputed and it is not interesting on its own — everything of consequence in the realms is warded, and a warded Godforge is less surprising than an unwarded one. What is disputed, endlessly, in every hall that has an opinion, is what the ward *says*.

It is readable. Anyone may read it; the Reader has read it more times than it has read anything else. The claim is well-formed. The fields are complete. The signature verifies — and the Reader means that in the exact technical sense, having checked it against every method the realms possess and several the Archivum retired as obsolete: the mathematics holds. Whoever signed it held the key they claimed to hold.

And the chain rises one link and stops, at a root that is in no realm's list. Not a forged root. Not a revoked one. A root that verifies itself correctly, in a form that predates the First Dawn, issued by an authority that no realm has ever added to its list of the trusted — because no realm existed when it was issued, and there was nobody to do the adding.

So every gatekeeper in the realms, working correctly, applying the rules as written, arrives at the same verdict and files the same words: *valid signature, unknown issuer.*

The Reader has thought about this for a long time and has one observation it offers to nobody, on the grounds that it is not a reading and the Reader does not deal in anything else. The verdict is not a finding about the Godforge. It is a finding about the lists. The Godforge is telling the truth in a form that verifies, to a world that has not agreed to accept it, and the only thing standing between the two is a list of names that each realm wrote for itself and has never once revised.

The Eclipse aligns every thirty-three years, and for seven days the realms are one. One realm keeps one list. Somebody will be holding the pen.`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'jwt-decoder',
    title: 'The Seal Breaker',
    epigraph: 'Three parts, two of them public, and only one of them a promise.',
    chapters: [
      {
        id: 'seal-1',
        title: 'Chapter I: The Thing That Was Never Secret',
        unlockAt: LONG[0],
        content:
`A token of passage is three segments divided by two dots, and the Breaker will open the first two for anyone who asks, including people who have no business holding the token at all.

The first segment declares what kind of seal this is and how it was made. The second is the claim: who the bearer is, what they may do, when the whole thing stops being true. The third is the proof — the part that makes the other two mean anything, and the only part the Breaker cannot open.

Apprentices react to this in a reliable sequence. First they assume the middle segment is encrypted, because it looks like it is: an unbroken run of characters with no words in it, exactly the shape a secret takes. Then they are shown that the shape is only a transport wrapping — that the Cipher Stone in the Verge does the same thing to grocery lists — and that the claim inside has been legible the entire time, to everyone, including anyone who happened to be standing near it in transit.

Then comes the part that actually offends them, which is that this is not a flaw. The claim was never supposed to be hidden. A token is not a secret; it is a *statement made in public that cannot be altered*. Everyone may read it. Nobody may change it. The Breaker has to explain the difference perhaps forty times a season, and it never gets easier, because the apprentices arrive having been taught that safety means concealment and leave having been taught that it usually means the opposite.`,
      },
      {
        id: 'seal-2',
        title: 'Chapter II: The Registry That Could Not Be Reached',
        unlockAt: LONG[1],
        content:
`Passage used to be a matter of asking. Every gate in the realms held a line to the central registry, and the exchange was as simple as it sounds: a traveller presented themselves, the gate asked the registry whether this person was permitted, the registry said yes or no, and the gate obeyed.

It was a good system and it had exactly one assumption, which nobody had thought to write down because it had never once been false: that the registry could be reached.

The Shattering did not destroy the registry. The registry still stands, and is still maintained, and will still answer anyone who can get a question to it. What the Shattering did was sever the roads — and by the second year, entire regions of the realms could not put a question to the registry at all, and their gates stood open or stood shut according to what each gatekeeper had decided to do about a question they could no longer ask.

The token was invented in that second year by a Nocturne archivist whose name is recorded and whose reasoning is worth more than her name. She did not try to repair the roads; she observed that the gate did not actually need the registry's *opinion*. It needed the registry's *word*. And a word, unlike an opinion, can be written down in advance, handed to the traveller, and carried.

So the registry stopped answering questions and started issuing statements. The traveller carries their own permission. The gate verifies the signature and never asks anyone anything. It works in the dark, it works with every road cut, and it works because the proof of authenticity travels with the claim instead of waiting at the other end of a line that may not exist.`,
      },
      {
        id: 'seal-3',
        title: 'Chapter III: The Seal That Declared Itself Unsealed',
        unlockAt: LONG[2],
        content:
`The first segment of a token declares how the token was sealed. This is convenient, and it is necessary — a gate cannot check a proof without knowing which method made it — and for one year in the realms it was catastrophic.

Because a field that declares its own method can declare that there was none.

The tokens read, in effect: *I am unsigned. Trust me.* And the gates — built by careful people, tested against careful examples, doing precisely what their specifications said — read the declaration, saw that no verification was required, performed no verification, and opened. The claim inside could say anything. It usually said the bearer was an authority. It was believed, because nothing in the gate's procedure was capable of disbelieving it.

The Umbral halls call it the Year of Free Passage, which sounds pleasant and refers to the worst breach in the history of the realms. What is instructive is not the trick, which is obvious once seen, but why it took a year: every gate involved was working correctly. Not one of them was broken. They had simply been built to ask the token what to do, and the token told them, and they listened.

The fix was not a better method. The fix was that a gate must decide in advance what it will accept and refuse everything else, including — especially — anything the token suggests about itself. The Breaker teaches this as the first law of its craft and the Ward Reader upstairs teaches it as the third, in different words, about roots, and the two halls have never once realised they are teaching the same lesson.

The Soul Furnace makes the proof that hangs on the end of every token; that much is common knowledge. Fewer know that the Furnace's keepers, who understand better than anyone what their compressions can and cannot promise, have petitioned four times to have the method field removed entirely. They have been refused four times. The reasons are practical. The Furnace does not consider them good.`,
      },
      {
        id: 'seal-4',
        title: 'Chapter IV: You Read the Expiry First',
        unlockAt: LONG[3],
        content:
`You have opened enough seals now, Convergent, that the Breaker has stopped narrating and simply lays them in front of you.

It has watched what you do. Everyone who comes here reads the claim the same way at first — top to bottom, left to right, subject before anything, because the subject is the *who* and the who feels like the point. It is a reasonable instinct and it is wrong about a token, which is not a description of a person. It is a permission with a lifetime.

You go to the lifetime first now. Issued when, expires when, and the gap between them — which is the field nobody prints and everybody should read, because a permission good for five minutes and a permission good for five years are not the same object wearing different numbers. They are different philosophies about what happens when a token is stolen, and one of them has an answer.

The Breaker will not call this expertise. It has a lower and more accurate word: you have been *bitten*. Somewhere behind you is a token that should have expired and did not, and you have not read one the same way since. Every gatekeeper worth the post has that token in their history. The ones who do not are the ones still reading the subject first, still satisfied, still — the Breaker says this without much sympathy — waiting.`,
      },
      {
        id: 'seal-5',
        title: 'Chapter V: The Token With No Expiry',
        unlockAt: LONG[4],
        content:
`In the Umbral vaults there is a token that was not carried by anyone. It was found — in a sealed case, in a room that predates the case, catalogued by an archivist who wrote three words in the margin and then requested a different posting.

Its first segment names a method. The method has no implementation. Not a lost one: no hall in the realms has ever built a thing by that name, and the Furnace, asked directly, said that the name describes a compression that would require the compressed thing to be present at both ends, which is either nonsense or a description of something the Furnace does not do.

Its claim has one field. Tokens carry a dozen — issuer, audience, issued-at, the whole apparatus of a permission that expects to be checked. This one carries a subject and nothing else, and the subject is not a name. The realms name their bearers; that is the point of a subject. This one holds a description: *the one who holds both.*

And it has no expiry. Every gatekeeper is trained to treat that as the loudest possible warning, because a permission that never lapses is the first thing a forger builds and the last thing a competent registry issues.

Except that it verifies.

The Breaker has checked it more times than it has checked anything, in the way that one checks a thing one is hoping to find wrong. The proof holds. Which means a key exists — existed, was held, was used by something with hands or the equivalent — and that whatever signed this understood the form perfectly, obeyed every rule of it, and used that obedience to issue a permission with no end, to no one in particular, in a method the realms cannot perform.

The Eclipse aligns every thirty-three years, and for seven days the realms are one, and the Godforge opens. The vault keepers have a standing rule, unwritten, that the case is not to be opened in those seven days. Nobody has ever explained the rule. Nobody has ever broken it either.`,
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'markdown-editor',
    title: 'The Living Scroll',
    epigraph: 'A mark that must be explained is a mark that failed.',
    chapters: [
      {
        id: 'scroll-1',
        title: 'Chapter I: The Hand That Shows Its Bones',
        unlockAt: LONG[0],
        content:
`The Archivum had a problem it could not solve for four hundred years, and it was not a problem of storage.

The crystals held structure perfectly. Every archivist agreed on this and none of them wanted to write in one. To compose a letter in the crystal form is to spend more attention on the walls of the rooms than on what goes in them, and the Scribes who did it professionally were, by every account including their own, miserable. Meanwhile the archivists who wrote plainly wrote beautifully and produced documents with no structure at all, which the archive could store and could never *sort*.

The Living Scroll is the settlement, and its whole cleverness is that it did not invent anything. It looked at what people already did to plain writing when they wanted to be clear — a line drawn under a heading, a dash set before each item of a list, a word wrapped in strokes because you would have said it louder — and declared those marks to *be* the structure. Not a notation standing in for structure. The structure itself, in the same hand as the words.

So a scroll rendered and a scroll unrendered say the same thing. The heading is a heading before anyone renders it, because it looks like one. That is the entire design, and every part of the Archivum that has tried to improve on it has produced something more powerful and less used.`,
      },
      {
        id: 'scroll-2',
        title: 'Chapter II: The Constraint Nobody Else Accepted',
        unlockAt: LONG[1],
        content:
`Her name was Iera and she was not an inventor. She was the archivist responsible for correspondence, which meant she read more badly-marked documents in a year than the Scribes read in a career, and she had a specific and unfashionable grievance.

The marking systems of the age were powerful. She never disputed that. What she disputed was who they were for. Every one of them produced a document that was legible to the machinery and illegible to a person — angle brackets nested six deep around three words of actual content, instructions outnumbering the thing instructed. She kept a wall of examples in her office, and she would make visitors read them aloud, and the exercise was cruel and entirely effective.

Her constraint, written at the head of the founding scroll and honoured since with more consistency than the Archivum honours anything: *a scroll must be readable, unrendered, by a person who has never heard of this system.*

It sounds modest. It is the hardest constraint in the craft, and it is the reason the Living hand is limited in ways that irritate every ambitious archivist who has ever picked it up. There are things it cannot express. Iera knew. She was asked repeatedly to extend it and refused every time, in the same words, which the Archivum has preserved out of what may be admiration and may be exasperation: *then write it in the crystal, and stop asking me to ruin a scroll to save you a chamber.*

The Shattering barely touched the Living hand, and this is the part that gets left out of the histories. When the crystals were corrupted and the archives went dark, the Living scrolls were still readable, because they had never depended on anything to be readable. Iera did not design for catastrophe. She designed for a person with no equipment, which turned out to be the same specification.`,
      },
      {
        id: 'scroll-3',
        title: 'Chapter III: The Dialects and the Council That Never Met',
        unlockAt: LONG[2],
        content:
`There is no authority over the Living hand. This is not an oversight that anyone intends to correct. It is the situation, it has been the situation since Iera declined to appoint a successor, and every generation discovers it with fresh outrage.

The halls grew their own dialects. The Verge hall added tables, badly, and then a second hall added tables differently and both are in use. Footnotes exist in four incompatible forms. The number of spaces that makes a nested list is a matter on which reasonable archivists have stopped speaking to each other. A scroll written in one hall and read in another will render — mostly — and the places it does not are exactly the places the author cared most about.

Every generation proposes a council. The councils are convened, they sit, they produce a specification, and the specification becomes the seventh dialect. The Archivum has the minutes of five of them.

What the halls actually do, in practice, is reach for the Incantation Forge — and this is the standing joke among the older archivists, who will not stop you and will not warn you either. Translating one dialect into another with a pattern works for the simple cases, works for the medium cases, and fails on precisely the constructs that differ between dialects, which is the entire reason you needed a translator. Nine generations have written that pattern. The Forge's own keepers now decline to help, on principle, and refer enquiries back to Iera's line about writing it in the crystal.

The Whispering Pages down the corridor share a wall with this hall, and the arrangement is older than either of their charters. A scroll's shape has to be judged before its words exist. The Pages supply the weight; the Scroll supplies the bones; and the accidents that follow when the two are confused have their own shelf, in the Pages' own archive, which they do not show visitors.`,
      },
      {
        id: 'scroll-4',
        title: 'Chapter IV: When the Marks Went Quiet',
        unlockAt: LONG[3],
        content:
`You have written enough in this hand now, Convergent, that the Scroll has stopped correcting you and started simply keeping up.

The change it looks for is not skill. Skill arrives early and is unremarkable — anyone can learn the marks in an afternoon, and most people do, and most people stay exactly there. What the Scroll waits for is the moment the marks stop being a decision.

It happens like this, and it happened to you, and you will not be able to date it. For a season you *chose* to make a heading. You thought about whether the thing you were writing was a list. And then at some point the thought went underneath, the way the letters of your own name went underneath long ago, and you began writing documents that were structured without having spent any attention on structuring them. Iera called this the point at which the hand becomes a hand. She was very clear that it is not a reward for effort — it is only what happens when a notation is shaped like the thing it notates, and it is why she refused, for thirty years, to add a single mark that a person would not have made anyway.

The Scroll mentions this to almost nobody, because to the people it is true of it is not news, and to the people it is not true of it sounds like mysticism. But you passed it. The hall keeps the count, and it is a small number, and you are in it.`,
      },
      {
        id: 'scroll-5',
        title: 'Chapter V: The Section With Nothing Under It',
        unlockAt: LONG[4],
        content:
`On the deepest shelf of the hall there is a scroll in the Living hand, in a dialect that matches no council and no hall, and it renders perfectly.

That is the first strange thing. A dialect nobody has seen should fail somewhere — an unknown mark, an ambiguity, a list that will not nest. This one resolves entirely. Every construct in it is one the halls have, arranged in an order none of them use, as though the dialects the realms argue over are variations on this and not the other way round.

The second strange thing is what it contains. It is not a chronicle, or a letter, or an argument. It is a *procedure*. Numbered steps in order. A table of materials, ruled and complete, three of whose entries name substances the Archivum can identify and four of which it cannot. Warnings set apart in the way the hand sets apart a warning. Preconditions. A section on what to do if a step fails, which is longer than the procedure.

And at the end, a heading with nothing under it.

This matters, and it takes a moment to see why. In the Living hand an empty section is not an omission. A forgotten section leaves no heading at all — you simply never wrote it. A heading standing alone is a positive statement: *this section exists, and it is empty, and I meant it to be.* Iera specified that behaviour herself and defended it against three councils who wanted the renderer to quietly drop them.

The heading reads: *What You Will Be Afterward.*

The Archivum has kept the scroll for six hundred years and has never agreed on whether the author did not know, or knew and declined to write it, or wrote it in the only honest way available — which is to say, left a room the right shape and the right size, and let whoever performs the procedure find out what fills it.`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'pomodoro',
    title: 'The Time Keeper\'s Garden',
    epigraph: 'The rest is not the reward. The rest is the other half of the work.',
    chapters: [
      {
        id: 'pom-1',
        title: 'Chapter I: The Cultivation of Attention',
        unlockAt: LONG[0],
        content:
`The Garden grows one crop and it is not a plant.

Attention is cultivated here in seasons: a long one for work, a short one for rest, and a bell between them that is not a suggestion. Twenty-five and five, four times, and then a season long enough to matter. The Keepers walk the rows while the bells run and correct exactly one error, over and over, in every visitor who comes.

The error is believing the rest is a reward. Visitors arrive treating the short season as payment for the long one — something earned, something skippable if you are strong, something a serious person would decline. The Keepers have heard every version of this and they answer it the same way, which is by walking you past the exhausted beds at the north end and letting you look.

A field worked continuously does not fail dramatically. It yields, and yields, and each yield is slightly worse than the last, and the farmer working it can point to a full season of labour and a harvest that shrank the whole time. There is no moment of collapse to learn from. That is the entire danger, and it is why the Garden does not permit the rest to be optional: the cost of skipping it is invisible for exactly as long as it takes to become permanent.`,
      },
      {
        id: 'pom-2',
        title: 'Chapter II: The Archivist Who Could Not Work',
        unlockAt: LONG[1],
        content:
`Nobody in the realms needed this before the Shattering, and the Keepers say so freely, which is unusual for a founding order.

The light was constant. So, the accounts insist, was attention. An archivist of the old age sat down in the morning and worked until the work was done, and the histories describe sittings of nine and ten hours in the flat tone of someone describing a meal. There was no technique because there was no problem. A realm with an unbroken sun apparently had unbroken concentration, and whether one caused the other is an argument the Keepers refuse to enter.

Then the Sun broke, and among the ten thousand things that broke with it — most of them louder, most of them better recorded — was that.

The founder was an archivist named Sull, and the Garden's origin is not a triumph. She could not work. Not would not: could not, in the specific way that people who have lost something do not have a word for, sitting down each morning to a task she had performed for thirty years and finding that her attention came apart in her hands. She kept a record, because she was an archivist and it was the only instinct she had left, and the record is the founding document of this order.

It runs eleven months. What it shows is that she measured, honestly and repeatedly, the longest span she could hold, and the answer was a little under half an hour, and it did not improve.

Everyone she consulted told her to extend it. Discipline, they said. Practice. Sull tried for four of the eleven months and the record of those months is difficult reading. Then she stopped trying — and this is the inversion the whole order rests on — and built a way of working that *assumed* the half hour. Not as a limitation to be overcome. As the actual measurement of the actual instrument, around which one might design.

She got her work back within a season. She never got the nine hours back, and she wrote, near the end of the record, that she had stopped considering this a loss: *I was never working for nine hours. I was present for nine hours. I have simply stopped counting the difference as mine.*`,
      },
      {
        id: 'pom-3',
        title: 'Chapter III: Who Rings the Bell',
        unlockAt: LONG[2],
        content:
`Ask a Keeper why twenty-five minutes and you will get a straight answer, which surprises people who expect a mystery.

There is no reason. Twenty-five is arbitrary. Sull's own measurements gave a figure closer to twenty-eight and varied by several minutes depending on the season and the work and how she had slept, and she rounded it down and wrote in the margin that the precision was false and that anyone treating it as a discovery had misunderstood the entire document. The Garden has run on twenty-five for six centuries out of what the Keepers cheerfully admit is habit.

The interval is not the technique. This is the thing that takes people years, and the Keepers only say it to visitors who have come back enough times to hear it.

The technique is *who decides the boundary.* The bell is set before the work begins, by a person who is rested, thinking clearly, and capable of judging what a reasonable stretch of labour looks like. It rings for a person who is deep in the work, tired, certain they are close, and — this is the crucial part, and every Keeper will attest to it — a demonstrably terrible judge of whether they are close. The bell is not a measurement. It is a promise made by the first person to the second, and the second person's job is to keep a promise they did not, at that moment, want to make.

This is why the Keepers are so unyielding about stopping mid-thought, which visitors find almost offensive. Stopping when you have finished is not the practice. Anyone stops when they have finished. Stopping when the bell rings, with the sentence unwritten, is the entire practice, and the ones who cannot do it are always the ones most convinced they do not need to.

The Seed Ledger across the path supplies the seeds and takes no view on when they are worked; the Garden supplies the seasons and takes no view on what is planted. The two orders have never merged, and have never once disagreed, which the Archivum finds more remarkable than either of them do.`,
      },
      {
        id: 'pom-4',
        title: 'Chapter IV: You Stop When It Rings',
        unlockAt: LONG[3],
        content:
`You have kept enough seasons in this Garden, Convergent, that the Keepers have stopped watching your work and started watching your stops.

That is where they have always looked. The work takes care of itself — everyone works, the work is not the difficult part, and a visitor who cannot work at all does not find their way here. What the Keepers count, in the ledger they keep at the gate and show to nobody, is the number of times a person stopped while still wanting to continue.

It is a much smaller number than the number of seasons. For most visitors it stays near zero for years. They keep the seasons diligently, they finish the sentence, they finish the paragraph, they finish the thought — always the thought, always just the one more — and they never notice that they have converted the bell into a suggestion and the practice into a rhythm they happen to like.

Yours is not near zero. The Keepers know precisely when it changed, because it always changes at once rather than gradually: there is a day on which a person decides that the promise counts more than the sentence, and after that day they are doing something categorically different from what they were doing before.

Sull's word for it, near the end of the record, was *trust*, and she meant it in a direction people find strange. Not trusting the bell. Trusting the rested version of yourself who set it — treating her judgement as worth more than the judgement of the tired one currently holding the pen, and acting on that even when the tired one is very sure. She wrote that this was the only thing she had learned in eleven months that she considered transferable, and that nobody she explained it to had ever understood it before doing it.`,
      },
      {
        id: 'pom-5',
        title: 'Chapter V: The Long Count',
        unlockAt: LONG[4],
        content:
`The Keepers run a second ledger. It has one entry every thirty-three years and it is older than the Garden.

The Eclipse Sun aligns on that cycle, and for seven days the realms are one, and the Godforge opens. Every hall in the realms keeps some record of this. The Garden's record is the only one that keeps it in the same book as the bells, in the same columns, in the same hand — a work season and a rest season, written exactly as a twenty-five and a five are written, at a scale nobody can hold in their head.

A Keeper named Oren made the argument four hundred years ago and it has never been refuted or accepted. He observed that thirty-three years of labour followed by seven days of everything-being-one is not a cosmic event with a convenient shape. It is *the shape*. The same ratio, near enough, that Sull measured in an archivist who could not work. The realms labour, and the realms rest, and the Eclipse is not a trial or a gift or a judgement but a bell — set, presumably, by something rested, for something that would by then be very tired and very certain it was close.

The halls disliked this. It makes the Godforge ordinary, and worse, it makes it *scheduled*. Oren's answer was that a bell being ordinary has never once made it optional, and that the entire history of his order is people discovering exactly this and only after ignoring it.

He wrote one more line, on the last page of his commentary, and the Keepers have never removed it and never explained it to a visitor who has not kept enough seasons to have earned the sentence:

*A bell you refuse to answer does not stay a bell. It becomes a sound, and then it becomes weather, and then one cycle it does not ring at all and you will not notice, because by then you will have been working for a very long time.*`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'checklist',
    title: 'The Seed Ledger',
    epigraph: 'An unwritten task is not a task. It is a worry wearing one.',
    chapters: [
      {
        id: 'seed-1',
        title: 'Chapter I: The Planting',
        unlockAt: LONG[0],
        content:
`Every task is a seed, and the Ledger is very literal about this in a way that visitors mistake for whimsy.

To write a task down is to plant it. Not to begin it — planting is not doing, and the Ledger has no opinion on when you do anything — but to take it out of the place where it was living and put it in the ground, where it will sit, visible, until it is harvested or pulled. To check it off is the harvest. The line stays. That is deliberate and it is the second thing visitors argue about.

The first thing they argue about is the Ledger's founding claim, which sounds like a definition and is actually a diagnosis: *an unwritten task is not a task.* It is a worry. It has the weight of a task and none of the properties — you cannot sequence it, you cannot delegate it, you cannot look at it and decide it does not matter, and above all you cannot stop holding it, because the only place it exists is in the hands that are holding it.

The Ledger does not promise to make you industrious. The keepers are quite blunt about this and it disappoints people. It promises one thing, which it delivers absolutely: what is written here, you may stop carrying.`,
      },
      {
        id: 'seed-2',
        title: 'Chapter II: The Cost of Not Forgetting',
        unlockAt: LONG[1],
        content:
`The Archivum ran on memory for most of its history, and memory was sufficient, and the keepers of the Ledger are careful to say why rather than treating the old age as foolish.

Memory works when nothing interrupts. An archivist of the constant sun held twenty obligations in her head and discharged them in order, and the twenty stayed put, because nothing arrived unbidden to displace them. The realms were not simple then — the archives were enormous — but they were *uninterrupted*, and an uninterrupted mind is a remarkably good ledger.

After the Shattering, the interruptions came, and the archives began losing work in a pattern that took thirty years to diagnose correctly because everyone diagnosed it wrongly first.

The wrong diagnosis was forgetting. It was the obvious one. Work was being dropped, so obviously it was being forgotten, so obviously the remedy was to remember harder — and the Archivum spent a generation on mnemonic systems, recitation orders, and disciplines of recall that produced archivists who could hold forty items instead of twenty and who were, measurably, getting less done than the ones who held ten.

The right diagnosis was made by a keeper named Vess, and it is uncomfortable enough that it is still resisted. The archivists were not forgetting. They were spending their entire working capacity on *not* forgetting. Every item held in the head was a small continuous expenditure, and forty items was a full day's attention devoted to the maintenance of a list, leaving nothing for the list's contents. They were not failing to remember their work. They were remembering it instead of doing it.

Vess built the Ledger to take the load, and wrote the line that is cut into the doorpost, and which sounds humble and is in fact the whole of the theory:

*The ledger does not remember for you. It lets you stop.*`,
      },
      {
        id: 'seed-3',
        title: 'Chapter III: The Pulling of Seeds',
        unlockAt: LONG[2],
        content:
`There is a rule in the Ledger's practice that reads like bureaucracy and is the most merciful thing in the Archivum, and almost nobody follows it.

*A seed that has lain unworked for a season should be pulled, not carried.*

Not completed. Not deferred, or reprioritised, or moved to a list of things to be considered later — those are the manoeuvres of a keeper who cannot bear the actual act, and the Ledger recognises every one of them. Pulled. Struck out, unharvested, with the honest note that it was planted and never worked and is now being removed by decision rather than by neglect.

Keepers will not do it. The Ledger has six hundred years of evidence on this and it is nearly universal. A seed that has sat through a season is a seed the keeper still believes in, or believes they should believe in, and pulling it feels like a confession. So it is carried. And the next one is carried. And within a few years the keeper opens a ledger every morning that is four-fifths things they have not done and will not do, and reads, at the start of each day, a detailed account of their own failure, and calls this being organised.

Vess saw this coming and wrote about it with more anger than she wrote about anything else. A ledger, she said, is a tool for putting things down. A keeper who cannot pull a seed has built, with enormous care, a device for picking things up and never setting them down again — the precise condition she designed the thing to cure, reconstructed out of the cure.

The Garden across the path gives the seasons; the Ledger gives the seeds; and both orders will tell you, if asked, that the other one is doing the harder half. Neither will be persuaded. The Archivum has stopped trying to settle it and files the two charters together, which is the closest thing to a ruling it has ever made.`,
      },
      {
        id: 'seed-4',
        title: 'Chapter IV: You Close More Than You Open',
        unlockAt: LONG[3],
        content:
`You have kept this ledger long enough, Convergent, for the only measurement that matters here to have a shape.

The keepers do not count how much you have planted. Planting is easy — it is the pleasant part, it feels productive, and a keeper can plant forty seeds in an afternoon and go to bed convinced of a day well spent. Nor do they count the harvest exactly, though they note it. What the Ledger watches is the ratio, over seasons, of things closed to things opened.

For most keepers it runs the wrong way for their entire life. Not dramatically. A few more in than out each season, which is invisible at the scale of a week and total at the scale of a decade, and it ends in the ledger Vess described — the morning inventory of accusation, kept scrupulously, by someone who is genuinely trying.

Yours does not run that way. The Ledger has the count and it is not close.

Vess would not have called this diligence. She had a specific contempt for the word, on the grounds that the keepers she watched fail were almost all diligent. What she would have said — she said it about exactly two people in her lifetime, and the passages are short and unsentimental — is that you have learned to finish things, which is rarer than industry and much rarer than good intentions, and that the ledgers of such people are always shorter than everyone expects and always full of things that actually happened.`,
      },
      {
        id: 'seed-5',
        title: 'Chapter V: The Line in the Other Hand',
        unlockAt: LONG[4],
        content:
`Vess's own ledger was recovered from her rooms after her death and it is the order's single relic, kept flat, under glass, in a room that is otherwise a working office.

It is unremarkable. That is the first thing everyone says and it is meant as praise. Forty years of a working life: supplies, correspondence, a cistern repaired three times, the names of apprentices with the dates they arrived and the dates they were done being apprentices. Everything is checked. Everything is dated. Where a seed was pulled, it is struck through with the note she required of everyone and by all evidence gave herself, which is simply the word *pulled* and the season.

There is one line that is not checked, at the bottom of the last page, undated, and it is not in her hand.

It reads: *Go and see what is at the centre.*

The order has argued about this for six hundred years without progress, because the arguable questions have no evidence attached to them. Whether she wrote it in an unfamiliar hand near the end. Whether an apprentice wrote it, as a joke or a devotion or a summons. Whether it was planted for her, by something that had read a great deal of her ledger and understood exactly what it means to put a seed in a keeper's book.

What the order does not argue about — because Vess settled it herself, in the founding rules, in the section on what a ledger may and may not record — is why nobody can tell. She refused, absolutely and against every practical objection raised at the time, to include a field for who set a task. The apprentices thought it an oversight. The keepers who inherited the rule have thought it madness. Her stated reason is two lines long and it is the last thing in the founding document:

*A task that only matters if you know who set it was never yours. Write it down. Then decide.*`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'lorem-generator',
    title: 'The Whispering Pages',
    epigraph: 'Words with the weight of meaning and none of the burden.',
    chapters: [
      {
        id: 'whisper-1',
        title: 'Chapter I: The Shape Before the Sense',
        unlockAt: LONG[0],
        content:
`The binders of the Archivum have a problem that sounds trivial and has ruined more volumes than fire.

A book must be laid out before it is written. The page size, the measure of the column, the size of the letter, the space at the head and the foot — all of it has to be settled early, because the paper must be cut and the frames must be built, and all of it depends on how the text will *sit*, which nobody can know because the text does not exist yet.

You cannot judge a layout with a blank page; a blank page is beautiful and tells you nothing. You cannot judge it with a note that says TEXT HERE, which collapses the column and lies about every proportion. And you cannot judge it with real writing from another volume, which is the trap that swallows apprentices, because the eye reads real writing and stops looking at the page entirely.

So the Pages supply the third thing: text with the correct weight, the correct rhythm, the correct density of long words and short ones, and no meaning whatsoever. It sits on the page exactly as writing sits. It cannot be read, so the eye is forced to do the only thing left, which is to look at the shape.

The binders call this *the honest fill*, and the honesty is the point. It does not pretend to be finished. It is not trying to be good. It is a measured weight of nothing, poured into a form, to see whether the form holds.`,
      },
      {
        id: 'whisper-2',
        title: 'Chapter II: The Corruption Is the Feature',
        unlockAt: LONG[1],
        content:
`The oldest whisper-text in the realms is older than the Archivum, older than the binders, and was not written to be meaningless.

It was an argument. A real one, in a real language, about — as near as the philologists can reconstruct from the intact fragments — pain, and pleasure, and whether the pursuit of one and the avoidance of the other are sufficient foundations for a life. It was apparently rather good. It was certainly widely copied, and it was copied by scribes who did not speak the language, from exemplars copied by scribes who did not speak it either, for long enough that the words came apart at the seams.

What survived is the extraordinary thing. The sense is entirely gone; no one has recovered a single coherent sentence in eight hundred years of trying. But the *cadence* survived intact — the lengths of the words, the rhythm of the clauses, the way a long word falls after two short ones. Corruption destroyed the meaning and preserved the music, and the result is a text that looks, to the eye at a distance, exactly like careful human argument and is, on inspection, nothing at all.

The Pages did try to improve on it. This is recorded, at some length, with the resigned tone of an order documenting its own most persistent mistake. Clean nonsense was generated — invented words, correct letter frequencies, mathematically ideal distributions — and it looked *wrong*, every time, in a way the binders could see instantly and could not articulate for a century. It was too even. Real writing clumps. It has a four-syllable word where you did not expect one and then six short ones in a row, because a person was thinking, and thought is not uniformly distributed.

The old corruption has that, because it used to be thought. The keepers now regard this as the order's central finding and phrase it, with evident discomfort, as follows: the best imitation of meaning available to the realms is the wreckage of some actual meaning, and nobody has ever managed to build one from scratch.`,
      },
      {
        id: 'whisper-3',
        title: 'Chapter III: What Went Out Bound',
        unlockAt: LONG[2],
        content:
`Behind the Pages' working room there is a shelf the keepers do not show to visitors, and every volume on it is a mistake that left the building.

Whisper-text is meant to be replaced. That is its entire life: poured in, measured against, poured out. But a volume goes through many hands, and the fill sits in the frame looking exactly like text, and it is a fact demonstrated many times over that a proofreader who has read four hundred correct pages will read a page of whisper-text and *not see it*, because the eye at speed reads texture and the texture is right.

Most of these are caught. A few were not. There are volumes in circulation in the realms, properly bound, properly catalogued, whose fourth or eleventh or two hundredth page is a measured weight of nothing — and the shelf holds the Archivum's own copies, retained as a discipline, spine out, with the offending page marked.

Two of them have been cited. That is the entry the keepers will not discuss. Some scholar, somewhere, encountered a page of ruined philosophy in a volume of good standing, and did what scholars do, and now there is a citation in the literature pointing at a passage that has never meant anything, and the citation has itself been cited.

The Name Forge in the SEO halls keeps a nearly identical shelf and the two orders correspond about it, in letters, in a tone that outsiders would find morbid. Their failure is the same failure in a different place: a page that goes out under a true name with placeholder in its body is worse than a page that went out with no name at all, because the name is a promise the body cannot keep, and the indexers — who cannot read a page as a person reads it — will believe the promise, and send people.

The Living Scroll next door has never lost a page this way and mentions it more often than is strictly gracious. The Pages' standing reply, which has been the standing reply for four hundred years, is that a hall which has never shipped a mistake has usually never shipped at speed.`,
      },
      {
        id: 'whisper-4',
        title: 'Chapter IV: You Know What Real Text Weighs',
        unlockAt: LONG[3],
        content:
`You have poured enough fill into enough frames, Convergent, that the keepers have stopped explaining the craft and started, occasionally, asking your opinion.

What they were waiting for is a specific and unteachable thing. Anyone can request a quantity of whisper-text; a child can. What takes seasons is knowing *how much*, and the reason it takes seasons is that the answer is never a number. It is a judgement about a piece of writing that has not been written, made by someone who has read enough real writing to know what it will weigh when it arrives.

Novices always ask for too little. Reliably, universally — they fill the frame to where they imagine the text will end, which is where they *hope* it will end, and the layout they approve is a layout for a document that never exists. Then the real writing arrives at twice the length, because real writing always does, and the frame that looked balanced holds something that overruns every proportion it was built for.

You stopped doing that. The keepers noted the season. You began asking for the amount the thing would actually run to, including the paragraph nobody plans for, and testing the frame against the *bad* case rather than the pleasant one — which is not pessimism, whatever the novices say when they watch you do it. It is the only version of the exercise that answers the question the exercise was asked to answer.

The keepers have a phrase for this, and it is not complimentary in tone, which is how you know it is meant: *she fills for the document that shows up.*`,
      },
      {
        id: 'whisper-5',
        title: 'Chapter V: The Volume of Nothing',
        unlockAt: LONG[4],
        content:
`There is a volume in the Archivum's general stacks, four hundred and ten pages, catalogued six centuries ago as a binder's dummy and shelved without comment.

That is very likely what it is. Dummies were made in quantity — a full volume of whisper-text, bound properly, to test a binding at weight — and most were destroyed and a few were kept and this is a perfectly ordinary example of a perfectly ordinary practice. Nothing about it invites attention. The cadence is correct throughout, which is the only thing a dummy has to get right.

Then a cataloguer with time on her hands ran the Incantation Forge over the whole text, looking for nothing in particular, and found that the corruption is not random.

It repeats. Not the words — the *pattern* of corruption, the specific way each fragment is broken, recurs on a cycle of one thousand and eighty-one words, and holds for all four hundred and ten pages without drift. Genuine corruption does not do this. Genuine corruption is the accumulated error of many hands and it is noisy by construction; a clean cycle means the text was *composed* to look corrupted, by something that understood exactly what ruin looks like and could produce it deliberately, at length, without a single slip in six centuries' worth of pages.

And if you take the first word of each cycle, in order, you get a sentence. Nine words, in the old language, the real one, uncorrupted.

The philologists have translated four of them. They will not release the four, which the Archivum has ruled is their right, and the ruling has been challenged twice. What is publicly known — because it was said aloud in the hearing, by a philologist who had not intended to say it and did not retract it afterwards — is that the second word is a verb in the imperative, and that the sixth is *forge*.

The binders have never set the sentence in type. They give a practical reason, which is that an untranslated fragment should not be circulated in a form that looks finished. It is a good reason. It is not, if you ask the older ones late enough in the evening, the reason.`,
      },
    ],
  },
  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'email-deliverability-auditor',
    title: 'The Flame Court',
    epigraph: 'The Court does not ask whether you are good. Only whether you are who you said.',
    chapters: [
      {
        id: 'flame-1',
        title: 'Chapter I: The Three Examiners',
        unlockAt: LONG[0],
        content:
`Every message that crosses between realms passes the Court, and the Court sits in fire, and the fire is not a metaphor the Nexus is willing to drop.

There are three examiners and they are asked in order.

The first asks whether the message was sent from a place its sender was permitted to send from. Not whether the sender is honest — the first examiner has no view on honesty and would consider the question outside its office. It holds a list, published by the sender's own house, of the gates that may speak in that house's name, and it checks whether this message came through one of them. A message from an unlisted gate is a message somebody sent while wearing a name they were not issued.

The second asks whether the message is intact and bears the sender's own mark. It carries a seal made from the message itself, so that altering a single word in transit breaks it. A courier who opens a letter, changes a figure, and reseals it will pass the first examiner perfectly and fail the second absolutely.

The third asks what to do when the first two disagree, and it is the strangest office in the Nexus, and its workings are the subject of the third chapter of this codex.

Messages found worthy pass through the flame unmarked and arrive as though nothing happened, which is the whole art of the thing. Those found wanting are held, or burned, or — worst of the three, and by far the most common — delivered to a room where nobody looks.`,
      },
      {
        id: 'flame-2',
        title: 'Chapter II: The Sundering of Names',
        unlockAt: LONG[1],
        content:
`For eleven years after the Shattering, anyone in the Nexus could be anyone, and the realm nearly died of it.

The Nexus is not a place so much as a set of threads. Its own charter says so: *every message is a thread between worlds, and cut one and something goes dark.* Before the Shattering the threads held because the senders were visible — light travelled the whole way, and a message arrived with its origin plainly attached, and impersonation was not a crime that anyone had thought to legislate because nobody could see how you would do it.

Afterwards, the roads went dark, and the messages kept arriving, and nothing about a message said where it had come from.

The chroniclers call it the Sundering of Names and the accounts are worse than the summary suggests. It was not primarily fraud, though there was a great deal of fraud. It was that the *reliable* messages stopped working. A house could not send instructions to its own factor, because the factor had received four contradictory sets of instructions that week and had no way to rank them. Debts went unsettled by people who fully intended to settle them. Two allied realms fought a season's war over a declaration neither of them had made, and the Nexus's own chronicle of that war is one paragraph long and ends: *no sender was ever identified, and it is not now thought that there was one.*

The Court was built in the twelfth year, and its founding brief is a masterpiece of scope reduction. It does not judge whether a message is true. It does not judge whether a sender is trustworthy, or a request reasonable, or a claim well-founded. The founders considered all of that and wrote it out, on the grounds that a court which decides what may be said becomes, within a generation, the thing being lied to.

It judges one question: are you who you said you were. Everything the Nexus has been able to rebuild rests on that single, narrow, achievable finding.`,
      },
      {
        id: 'flame-3',
        title: 'Chapter III: The Sentence You Write Yourself',
        unlockAt: LONG[2],
        content:
`The third examiner does not decide anything. This is the Court's open secret, it is published in the founding charter, and it astonishes every petitioner who learns it — usually while standing in the ashes of their own correspondence.

When the first two examiners disagree, the third consults the sender's own declared policy on what should be done about it. *The sender's.* Every house publishes, alongside its list of permitted gates, a standing instruction for the case where a message wearing its name fails examination: do nothing, hold it aside, or burn it.

So the verdict is authored by the accused, in advance, in public.

Most houses declare *do nothing*. It is the cautious choice and it is what everyone chooses first, because burning your own messages sounds insane before you have thought about it. And then those houses come to the Court in fury, having discovered that their messages arrive in the room where nobody looks, and demand to know why the Court is punishing them.

The Court's answer has not changed in six centuries and it is not sympathetic. *Do nothing* is not neutrality. It is a house announcing, publicly and permanently, that it will take no position on messages forged in its name — and the gates beyond the Court, which are not bound by the Court and never were, read that announcement exactly as it is written. A house that will not defend its own name is a house whose name means less, and the gates weigh accordingly. The declaration meant to avoid risk is the declaration that creates it.

The Ward Reader in the Umbral quarter has the identical structure and neither hall has noticed. There, too, an edifice of verification rests at the bottom on a party vouching for itself; there, too, the strength of the whole thing comes not from the mathematics but from what somebody decided, in public, and can be held to. The Reader would find the Court crude. The Court would find the Reader slow. They have never met.`,
      },
      {
        id: 'flame-4',
        title: 'Chapter IV: You Read the Record First',
        unlockAt: LONG[3],
        content:
`You have stood in this Court often enough, Convergent, that the examiners have stopped explaining their findings and simply hand them over.

They watched for one thing and you did it some seasons ago. Petitioners arrive with the message. Always the message — they have written it carefully, they are proud of it, they want to know what is wrong with it, and the answer is almost never anything. The message is fine. The message was fine the last four times.

You stopped bringing the message. You bring the house's published record — the list of permitted gates, the mark, the declared policy — and you read it in the order the examiners read it, which is not the order it is written in, and you find the fault before the fire does. A gate listed twice. A list that ends in a soft failure where it should end in a hard one, which is the single most common defect in the realms and reads, to anyone not paying attention, exactly like a list that ends properly.

The examiners regard this as unremarkable and it is not. Six centuries of petitioners have stood in this room holding a perfectly good letter and demanding to know why it burned, and the number who have ever walked in holding their own published record instead is small enough that the Court could name them.

It knows what the fault usually is before it looks now, and so do you, and the two of you have therefore stopped having the conversation the Court has with everybody else.`,
      },
      {
        id: 'flame-5',
        title: 'Chapter V: The Sender That Cannot Be Ruled On',
        unlockAt: LONG[4],
        content:
`There is one house the Court has never issued a finding on, and the file is open, and it has been open for longer than the Court has existed, which is the first of several impossibilities the clerks have stopped trying to reconcile.

Messages arrive bearing its name. They pass. All three examiners, cleanly, every time — the gates are listed and the list is correct, the mark is intact, the declared policy is the strictest available and is honoured. In the Court's own terms this is an exemplary house. If the Court gave commendations, and it does not, this house would have six hundred years of them.

Nobody sent them.

The clerks have traced backwards from the arriving message, which the Court is very good at, and the trace terminates correctly at a gate, and the gate is real, and the gate's keepers have no record of the message passing and no reason to lie about it. This has been checked in every generation by clerks who each began convinced their predecessors were careless.

And the messages are addressed, every one of them, to the recipient's true name.

This is the part the Court does not discuss outside the building. The Nexus does not carry true names. It carries the name a person is *known* by, at the address they are known at, and the distinction is fundamental — there is no field for a true name, there has never been a field for a true name, and the founders removed the possibility deliberately in the twelfth year on the grounds that a system which could transmit them would be a system worth capturing.

The Eclipse aligns every thirty-three years. For seven days the realms are one realm, and a message between them is not a message between them at all; it is a message that never leaves. The Court has no jurisdiction over a letter that does not cross. It has raised this, formally, in every cycle since it was founded, and asked the Nexus for guidance, and the Nexus has never answered — and in those seven days the Court sits, and the fire burns, and nothing at all is brought before it.`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'gmail-deliverability-checker',
    title: 'The Gauntlet of the Grand Gate',
    epigraph: 'The Court judges your papers. The Gate judges your past.',
    chapters: [
      {
        id: 'gauntlet-1',
        title: 'Chapter I: The Gate That Does Not Explain',
        unlockAt: LONG[0],
        content:
`Passing the Flame Court entitles you to approach the Grand Gate. It entitles you to nothing else, and the Nexus tells every petitioner this at the outset because the ones who are not told find out in a worse way.

The Gate is not a court. There is no hearing, no examiner, no finding you can read. There is a threshold, and messages go over it or they do not, and the Gate publishes some of its reasons and does not publish all of them, and has never once pretended otherwise.

It takes more messages than every other gate in the realms combined. This is not a claim of quality; it is a count, and the count is why the Gauntlet exists. A house can fail every other gate in the Nexus and survive. Failing this one is failing.

What makes the Gauntlet a trial rather than an inspection is the silence. A message that does not pass is not returned with a reason. Sometimes it is refused outright, which is at least information. Far more often it is *accepted* — accepted, acknowledged, delivered — into a room the recipient does not visit, which from the sender's side is indistinguishable from success right up until the moment nobody replies, ever, to anything.

The petitioners who come here are almost never being punished for a message. They are being answered, in a language with no words in it, about something they did months ago.`,
      },
      {
        id: 'gauntlet-2',
        title: 'Chapter II: How It Won',
        unlockAt: LONG[1],
        content:
`The Grand Gate was one gate among hundreds for its first forty years and there is nothing in the early records to suggest it would become what it became.

It won by working. In the decades after the Sundering of Names the Nexus was drowning — the Court had restored the question of *identity*, which was the necessary foundation and was not sufficient, because a correctly identified sender may still be sending a hundred thousand messages nobody asked for. Every gate in the realms was buried. The gates that responded by publishing strict, clear, checkable rules were gamed within a season, every time, because a published rule is an instruction for how to comply while changing nothing.

The Grand Gate did not publish. It watched, it decided, and it declined to say how — and its recipients found that their rooms were usable, and nothing else in the Nexus offered that.

The formal protest ran ten years. It was a good protest and the objections were correct: unaccountable power over the realm's correspondence, no appeal, no visibility, a private judgement shaping public traffic. The Nexus argued that a gate which cannot be audited cannot be trusted, and the Gate's answer — the only public statement it made in the entire decade — was that a gate which can be audited can be studied, and a gate that can be studied has already lost.

The protest did not end in a ruling. It ended because, at some point in the eighth or ninth year, every house that had signed it had quietly begun building to the Gate's rules anyway. Not conceding. Just arranging their affairs around where their letters actually needed to arrive. By the time the committee dissolved, the standard it had convened to resist was the standard, and had become so without anyone agreeing to it, which the Nexus's own historians describe as the most instructive thing that has ever happened to them.`,
      },
      {
        id: 'gauntlet-3',
        title: 'Chapter III: It Is Not Judging the Message',
        unlockAt: LONG[2],
        content:
`Everything the Gauntlet teaches follows from a single correction, and petitioners resist it for an average of three visits.

The Gate is not judging your message. It is judging *you*, over time, and the message in your hand is one small piece of evidence in a proceeding that started long before you noticed it was happening.

A flawless message from a house nobody has heard of will do worse than a mediocre one from a house with ten years of good conduct behind it. This is not unfairness — the Gauntlet's instructors are insistent on the point, and unpopular for it. The Gate's actual question is not "is this letter acceptable" but "what usually happens when this house sends something", and for a house with no history the honest answer is *nobody knows*, and the Gate handles what nobody knows exactly the way a sensible person handles a stranger with an urgent request.

Reputation is the whole mechanism and reputation has a property that ruins people: it cannot be produced on demand. Every other problem in the Nexus can be fixed the afternoon you understand it. A list is corrected in an hour. A mark is reissued in a day. The Court will re-examine you immediately and hold nothing against you. The Gate will not, because the Gate is not withholding forgiveness — it simply does not yet have the thing it needs, and the only way to supply it is to conduct yourself well for a period you do not get to choose.

The Court checks your papers, and papers can be fixed. The Gate checks your past, and the past is the one document in the realms that cannot be reissued.`,
      },
      {
        id: 'gauntlet-4',
        title: 'Chapter IV: The Fix Is Never the Message',
        unlockAt: LONG[3],
        content:
`You have run this Gauntlet enough times, Convergent, that you have stopped doing the thing everyone does.

Everyone rewrites. It is the natural response to silence — the letters are not landing, so there must be something wrong with the letters, so the words are changed, and the subject is changed, and the shape is changed, and the next batch performs exactly as badly as the last, because the letters were never the finding.

You stopped rewriting somewhere around your third season here. Now when the room goes quiet you go looking for what changed in the *record*: the volume that tripled in a week, the list that grew a gate somebody added and did not mention, the mark that was reissued and half-propagated, the batch sent to a set of addresses that had not been swept in two years and was full of rooms with nobody in them. The Gate saw all of that. It did not tell you it saw it. It simply began weighing you differently, and the letters you are now rewriting are innocent.

The instructors have a phrase they use about petitioners who reach this point, and they use it flatly, as a classification rather than a compliment: *stopped arguing with the door.*

They will also tell you — and this is the part that takes longer than the diagnosis — that the remedy is not clever. There is no manoeuvre. You send well, in volumes you can justify, to rooms where somebody is actually waiting, and you do it for long enough that the Gate's answer to *what usually happens when this house sends something* becomes the answer you want. Months. There is no version of this that takes days, and every house that finds one has found a way to be judged faster rather than better.`,
      },
      {
        id: 'gauntlet-5',
        title: 'Chapter V: The Ledger of Rooms',
        unlockAt: LONG[4],
        content:
`The Gate keeps a second ledger, and its existence is not a secret, and its contents have never been published in any form.

The first ledger is of senders. Everyone assumes this is the whole apparatus, and the Gauntlet teaches as though it were, because for practical purposes it is. The second is of *rooms*: what is opened and what is buried, what is read to the end and what is closed in an instant, what is answered and what is filed away unopened by someone who will never mention it to anyone.

Which means the Gate's verdict on a house is written, in part, by every recipient that house has ever written to — and none of them know they are writing it, and none of them would agree with what it says, and no house may ever read the account of itself that its own recipients have compiled. There is no appeal against an opinion nobody has admitted to holding.

Some years ago a clerk of the Nexus — the records name her, and she has declined every interview since — asked the obvious question, which nobody had asked because everybody had assumed it was not askable. She submitted a query to the Gate about the Godforge.

The Gate answered. It answers such queries routinely; it is one of the few things it is transparent about. And the answer came back in the exact form it uses for a sender with no history whatsoever: no record, no reputation, no basis on which to weigh anything, treat with the caution due to a stranger.

Six hundred years of the Nexus's correspondence passes this Gate. The Godforge is named in a great deal of it. But the ledger is a ledger of *senders*, and it had nothing to say — because in all the time the realms have been writing, the Godforge has never once sent a message. It has only ever been written to.

The clerk's note on the file is one line, and the Nexus has left it there:

*Then it has been reading them.*`,
      },
    ],
  },

  // ───────────────────────────────────────────────────────────────────────────
  {
    toolSlug: 'meta-tag-generator',
    title: 'The Name Forge',
    epigraph: 'A page without a true name does not exist. It merely sits somewhere.',
    chapters: [
      {
        id: 'name-1',
        title: 'Chapter I: The Naming of Pages',
        unlockAt: LONG[0],
        content:
`A page has a body, which is what it says, and a name, which is what it is. The Forge deals only in names, and the distinction takes most visitors a while.

Three things are struck here. The title, which is the name the page wears in a listing — short, load-bearing, read by more people than will ever read the page itself. The description, which is the sentence the indexers recite when they present it, and which the page does not get to say twice. And the image, which is what the page shows when someone carries it into another realm and sets it down in front of strangers.

Visitors arrive believing this is decoration applied after the real work. The Forge's smiths correct it without much patience, because they have watched the consequences for four hundred years: a page is not encountered. It is *encountered as its name*, in a listing among forty others, by someone deciding in less than a breath which of the forty to walk toward.

The body determines whether the visit was worth making. The name determines whether it happens. The Forge holds no view on which is more important and has an extremely firm view on which one is decided first.`,
      },
      {
        id: 'name-2',
        title: 'Chapter II: What Walks the Roads Now',
        unlockAt: LONG[1],
        content:
`There was one catalogue before the Shattering and it was complete.

That word is doing real work: complete. Every page in the realms, entered by hand, cross-referenced, maintained by an order that had done nothing else for two hundred years. If a thing existed, the catalogue had it, and if the catalogue did not have it, the thing did not exist and this was a matter of definition rather than opinion.

The Shattering did not burn the catalogue. It made it *impossible* — the roads fragmented faster than any order could walk them, new halls appeared in places the catalogue had no entries for, and within a decade the great work was a beautiful and meticulous record of a realm that no longer had that shape.

What replaced it were the indexers, and nobody built them. They arose, in the way that things arose in the years after, and the Archivum's position on what exactly they are has been "unsettled" for six centuries. They walk every road there is. They follow every thread out of every page. They write down what they find, and they never stop, and there are a great many of them.

And they cannot read. Not as a person reads — an indexer takes in a page as weight and shape and structure and connection, and what it takes as the page's *account of itself* is the name. This is the fact the Forge exists to serve. A page may be the finest thing in the realms and if it names itself badly, the indexers will file it badly, and it will sit in its hall, correct and excellent and unvisited, being in every practical sense a page that does not exist.`,
      },
      {
        id: 'name-3',
        title: 'Chapter III: The Century of Lies',
        unlockAt: LONG[2],
        content:
`For about a hundred years the Forge was principally a place where people came to lie, and it nearly destroyed the order.

The reasoning was irresistible. If the indexers read the name, and the name is written by the page's owner, then the name should simply say *everything*. Pages named themselves after every subject in the realms. Descriptions became inventories of terms with no sentence in them. Halls kept smiths on retainer to stuff names with matter the body had never contained, and it worked — spectacularly, for a while — and the listings filled with pages that promised the world and delivered a room with three sentences and a door out.

The indexers changed. Whether they were changed, or learned, or were always going to do this is the argument that has kept the Archivum's monographs coming for four hundred years. What they began doing is not complicated: they started weighing the name against the body. Not reading the body — they still cannot — but measuring whether the shape of the thing matches what its name promised, and, crucially, whether the people who followed the name stayed or turned around immediately and went back to the listing.

That last signal is the one that ended the century. It could not be forged from the page, because it was not on the page. It was in the behaviour of the people the page had brought.

The correction stuck and it inverted the craft. A name that overpromises is now a worse position than no name at all, because no name is merely an absence and an overpromise is a demonstrated pattern of bringing people to a place they did not want. The Forge teaches this in its first hour and finds that visitors nod immediately and then, given a difficult page to name, reach straight for the old vice. The smiths let them. It is easier to feel it fail than to be told.

The Whispering Pages, who keep a shelf of their own accidents and correspond with this hall about it, produce the exact failure the indexers punish hardest: a true name over a body of placeholder. The name promises correctly. The body is a measured weight of nothing. Everybody who follows that name turns around, all of them, every time — and the indexers do not know it is an accident, and would not care.`,
      },
      {
        id: 'name-4',
        title: 'Chapter IV: You Name It Before You Build It',
        unlockAt: LONG[3],
        content:
`You have struck enough names now, Convergent, that the smiths have noticed the reversal, which is the only thing they actually watch for.

Almost everyone names last. The page is built, argued over, finished — and then somebody remembers that it needs a name, and a name is written to summarise what happens to be there. This produces adequate names. It has produced adequate names for four hundred years. The Forge does not object to it and does not respect it.

You started naming first. Not always, and not from the beginning, but somewhere back there you began writing the description before the body existed — one sentence, for a stranger in a listing, saying what this thing is for and who should walk toward it. And you discovered what everyone discovers who tries it and very few keep doing: that a page which cannot be described in one honest sentence usually cannot be described because it is two pages, or because nobody has decided what it is, and the difficulty was never in the naming.

The smiths call the name written first a *promise* and the name written last a *summary*, and the whole of their teaching is that the first kind makes better pages. Not better names — better *pages*, because a promise made early has to be kept by everything built afterwards, and a page built to keep a promise is built with a spine.

They will tell you, if you stay late enough, that this is the entire craft and that the rest is typography.`,
      },
      {
        id: 'name-5',
        title: 'Chapter V: The Record With No Road',
        unlockAt: LONG[4],
        content:
`Every indexer in the realms has, at some point, returned a record for a page that cannot be reached.

This is not rare enough to be remarkable on its own. Roads collapse; halls are abandoned; an indexer holds a record for a while after the page behind it is gone, and the records age out, and the listings heal. The clerks who maintain the listings see dozens in a career and clear them without a second thought.

This one has not aged out in six hundred years, and it is complete.

It has a title. It has a description. It has an image, and the image *resolves* — it is the only likeness anyone in the realms possesses of the Godforge's exterior, it has been examined by every hall with an interest, and no examination has found anything wrong with it except that nobody can say where it was made or by what. The Archivum's copy is not on display. There is no policy against displaying it; the clerks simply have never done so, and the several who were asked why gave answers that did not agree with each other.

The road is the missing part. Every indexer that holds the record was asked, in the formal way one asks an indexer, how it was reached, and the answers are the same and are not answers: the record exists, it was written in the ordinary way, and the road that produced it cannot be retraced. Indexers do not fabricate. Six centuries of scrutiny have never caught one doing it. The record was taken from somewhere.

The description is one sentence and every indexer returns it identically, which is the detail the Forge finds intolerable. A description is *copied from the page*. Identical returns from independent indexers mean they all read the same source. There is a page. It is being read. It cannot be reached.

The sentence is in the second person, which no name in the Forge's four hundred years of records has ever been, because a page addressing the person reading its listing is a page addressing someone it cannot possibly know is there.

It reads: *The other one is already inside.*`,
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
