/**
 * lore-scroll.model.ts — the twenty-five scrolls the anvil turns up.
 *
 * Adapted from `Eclipse_Realms_Lore_Codex.md` in the EclipseRealms repository,
 * which is the canonical source for the First Sun, the Solarii, the Shattering,
 * the four Lost Gods, the Godforge and the Prophecy of the Final Eclipse. The
 * codex is written as a reference — bullet lists, a faction table, a timeline.
 * A scroll cannot be a bullet list, so each of these takes one claim from the
 * source and tells it as something a person wrote down: an account, a
 * transcript, a marginal note, a confession. Every proper noun, every number
 * (thirty-three years, seven days) and every quoted line is the source's.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A SCROLL HAS A RARITY
 * ─────────────────────────────────────────────────────────────────────────────
 * `rarity` is intrinsic to the scroll, not stamped on at drop time. It names
 * the rune tier that can turn the scroll up, which is what makes the chapters a
 * progression: The First Dawn is common knowledge and falls out of Common
 * runes, The Prophecy is not and needs Epic or better. A scroll whose rarity
 * were assigned from whatever rune happened to drop it would make "The
 * Prophecy" a Common scroll for anyone lucky on their eighth strike, and the
 * five chapters would stop meaning anything.
 *
 * The one exception is `unwritten-verse`, filed Singular. It is the only scroll
 * the Void rune can produce and the only one nothing else can. The source calls
 * it the final page of the Codex, blank and faintly warm; it seemed wrong to
 * make it reachable by grinding Commons.
 *
 * Pure data. No browser APIs — safe to import from an SSR path.
 */
import { RuneTier } from './rune.model';

/** The five chapters, in reading order. */
export type LoreChapterId =
  | 'first-dawn'
  | 'shattering'
  | 'convergents'
  | 'godforge'
  | 'prophecy';

export interface LoreScroll {
  id: string;
  /** "Fragment of the First Dawn, Part III" */
  title: string;
  /** The scroll's own name, shown under the title. "The Sun That Dreamed". */
  subtitle: string;
  chapter: LoreChapterId;
  /** The chapter's display name, denormalised so a card needs no lookup. */
  chapterName: string;
  /** 1-5 within the chapter. */
  partNumber: number;
  /** Two or three paragraphs, split on blank lines by the component. */
  content: string;
  /** The rune tier that can turn this scroll up. See the note above. */
  rarity: RuneTier;
  /** ISO date of discovery. Absent until found — filled in by the service. */
  unlockedAt?: string;
}

export interface LoreChapterDefinition {
  id: LoreChapterId;
  name: string;
  /** One line under the chapter heading, before any scroll is opened. */
  epigraph: string;
  /** Shown in place of the chapter when nothing in it has been found. */
  hint: string;
}

export const LORE_CHAPTERS: LoreChapterDefinition[] = [
  {
    id: 'first-dawn',
    name: 'The First Dawn',
    epigraph: '"In the beginning, there was the Sun — whole, silent, and dreaming."',
    hint: 'The oldest thing anyone wrote down. Common runes remember it.',
  },
  {
    id: 'shattering',
    name: 'The Shattering',
    epigraph: '"When gods wage war, even truth bleeds."',
    hint: 'What the war did, told by the ones it was done to.',
  },
  {
    id: 'convergents',
    name: 'The Convergents',
    epigraph: '"Between light and shadow, the soul remembers both."',
    hint: 'Born between realms. Hunted in one, revered in the other.',
  },
  {
    id: 'godforge',
    name: 'The Godforge',
    epigraph: 'Creation itself, in mechanical form.',
    hint: 'The engine under the borderlands. Epic runes have stood near it.',
  },
  {
    id: 'prophecy',
    name: 'The Prophecy',
    epigraph: '"The world shall end not in fire nor shadow, but when the Convergent forgets which one they were."',
    hint: 'The Final Eclipse. Nothing below an Epic rune has seen these.',
  },
];

const CHAPTER_NAME = new Map(LORE_CHAPTERS.map(c => [c.id, c.name]));

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

interface ScrollSeed {
  id: string;
  chapter: LoreChapterId;
  rarity: RuneTier;
  /** The scroll's own name, which follows "Fragment of <Chapter>, Part N —". */
  subtitle: string;
  content: string;
}

const SCROLL_SEEDS: ScrollSeed[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // I. THE FIRST DAWN — common. What everyone is taught, more or less intact.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'dawn-1', chapter: 'first-dawn', rarity: 'common',
    subtitle: 'The Sun That Dreamed',
    content:
`Before life, before time, there was a flame in the void that had never been lit, because there had never been a moment in which it was not burning. The Archivum calls it the First Sun. The Solari call it the Father. The Nocturne, who are more careful with words than anyone gives them credit for, call it the thing that was whole.

It did not rule. It did not decide. It dreamed, and creation was the shape of the dreaming — which is why the oldest accounts all agree on a detail the later ones drop: nothing in the beginning was made on purpose.

The light of that dreaming became the Luminous Realm. Its shadow — and there is always a shadow, that is what light is for — became the Umbral. Both were born in the same instant, from the same flame, and every war since has been an argument about which of them was the accident.`,
  },
  {
    id: 'dawn-2', chapter: 'first-dawn', rarity: 'common',
    subtitle: 'The Sculptors',
    content:
`From the warmth rose the Solarii. Not born, exactly — the word the oldest tablets use is closer to "condensed". They were what happens when a dreaming flame is warm for long enough in the same place.

They were sculptors of order and balance, and they were extremely good at it. Read that sentence again, because every catastrophe in this codex follows from it. A being that has never failed at ordering anything has no way to learn that some things should be left disordered.

They set the realms in their courses. They gave the Luminous its plains and the Umbral its ashes. They taught, and the teaching was good. There is no account anywhere — Solari, Nocturne or Archivum — that says the Solarii were cruel. That is precisely the difficulty.`,
  },
  {
    id: 'dawn-3', chapter: 'first-dawn', rarity: 'common',
    subtitle: 'A Thought Unmade',
    content:
`Within the light hid a reflection that hungered.

Four words in the original, and scholars have spent whole lifetimes on the choice of "hid". It implies intent. It implies the reflection knew it could be seen and arranged not to be. The Solari read it that way and built a church on it. The Archivum notes, drily, that the word may simply have been the only one the writer had.

What is agreed: the First Shadow was not an invasion. It did not come from outside, because there was no outside. It was in the light, of the light, and had been there since the dreaming began — a thought the Sun had and did not finish.

The Nocturne have a saying about this that the Solari find obscene: *nothing that was always there can be a trespasser.*`,
  },
  {
    id: 'dawn-4', chapter: 'first-dawn', rarity: 'common',
    subtitle: 'The Two Energies',
    content:
`Aether is what light does when it is asked to do work. It fuels miracles in the Luminous Realm and it fuels their technology, and the Solari have never seen a reason to distinguish between the two. Their cities are glass and gold and they float above the radiant plains, and they float on Aether, and if you ask a Solari engineer how it works she will tell you it works because it is true.

Nox is what shadow does. It creates through decay and transformation — it does not build a thing so much as persuade an existing thing to become another. The obsidian towers of the Umbral were not raised. They were *encouraged*.

Both are the same flame, divided. Every Convergent learns this early and painfully, because they carry both and the two do not stop arguing.`,
  },
  {
    id: 'dawn-5', chapter: 'first-dawn', rarity: 'common',
    subtitle: 'What the Dreaming Cost',
    content:
`There is a passage near the end of the First Dawn accounts that most copies omit. The Archivum keeps it because the Archivum keeps everything, including the parts that make its own patrons uncomfortable.

It says: the Sun dreamed because it could not wake. It says the dreaming was not generosity but symptom. It says creation is what a thing does when it is trying, and failing, to become conscious — and that everything alive is a fragment of an attempt that did not succeed.

No faction teaches this. The Solari call it heresy, the Nocturne call it self-pity, and the Convergents, who might be expected to have an opinion, mostly decline to discuss it. But it is the oldest text in the codex, older than the Shattering, and nobody has ever produced an argument against it that does not begin by assuming it is false.`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // II. THE SHATTERING — uncommon. Told by the ones it was done to.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'shattering-1', chapter: 'shattering', rarity: 'uncommon',
    subtitle: 'The Purge That Was Voted',
    content:
`They took a vote. That is the detail nobody expects and everybody, on hearing it, immediately believes.

The Solarii convened to decide what to do about the reflection in the light, and they did not decide rashly, and they did not decide alone. The record of the session survives in fragments. There were objections. Someone — the name is lost, the Archivum has spent four ages failing to recover it — argued that a shadow cannot be removed from a light without removing the light.

The motion carried anyway. The minutes note the vote was not unanimous and does not say by how much, which is its own kind of answer.

They sought to purge the Shadow. Everything after this sentence is consequence.`,
  },
  {
    id: 'shattering-2', chapter: 'shattering', rarity: 'uncommon',
    subtitle: 'The Sound It Made',
    content:
`Accounts of the Shattering differ on everything except the sound, and on the sound they are identical across both realms, which is the strongest evidence we have that any of them are true.

They all say: there was no sound. Not silence — the absence of the *possibility* of sound, for a duration nobody can specify because duration was among the things that broke.

Then the First Sun came apart. Its fragments rained across the world, and each piece was a prison for a god, or a key to release the darkness they feared, and to this day nobody can tell which by looking. The Solari assume prison. The Nocturne assume key. Both have been digging for a very long time.

A Verge proverb: *the only difference between a lock and a door is which side you woke up on.*`,
  },
  {
    id: 'shattering-3', chapter: 'shattering', rarity: 'uncommon',
    subtitle: 'The Mirroring',
    content:
`Reality splintered, and every being, every soul, was mirrored.

Understand what this means, because the phrasing is gentler than the fact. You were not copied. A copy is a second thing. You were *divided* — and the division ran through the middle of whatever you were, so that each half is entirely you and entirely insufficient, and each half is walking around in a different world being certain it is the original.

Two realms were born. One bathed in light. One drowned in its echo. They exist together, unseen, occupying the same space and refusing to acknowledge it, the way two people who were once one household can share a street for forty years and never meet.

Until the Eclipse binds them once more. Which it does. Every thirty-three years, whether anyone is ready or not.`,
  },
  {
    id: 'shattering-4', chapter: 'shattering', rarity: 'uncommon',
    subtitle: 'What the Gods Became',
    content:
`When the Sun broke, the gods became what they swore to destroy.

Aureth, the Radiant — goddess of order — is bound to the Solari now, and the binding is not the honour they think it is. Order that cannot choose to stop is not order. It is a wheel.

Verrin, the Hollow, god of endings, took the Nocturne as patron and has kept every promise made to them, which is the frightening part. Verrin's promises are all of the same kind.

Kael, the Broken Flame, keeper of the balance, patron of the Convergents — which is to say patron of the ones nobody else would have. Kael's blade exists in both realms and vanishes from one when drawn in the other, and there is no clearer statement of what Kael is for.

And the Nameless. Believed to be the First Shadow. Trapped beneath the world. Waiting for the next Eclipse. The Archivum files this one under *pending*.`,
  },
  {
    id: 'shattering-5', chapter: 'shattering', rarity: 'uncommon',
    subtitle: 'The Age of Mirrors',
    content:
`Humanity adapted, because humanity always does, and the adaptation was the strangest part of the whole business.

The reflections awoke. People began to meet themselves — not often, not reliably, but often enough that a body of etiquette grew up around it. You do not speak first. You do not touch. You do not, under any circumstances, tell your reflection something it does not already know, because the two of you have been diverging since the Shattering and there is no telling what a new fact will do to a life you are not living.

The Solari Church declared the reflections a disease of faith and prescribed prayer. The Nocturne declared them the only honest thing left in creation and prescribed attention. Both prescriptions were widely ignored by the people actually meeting themselves in doorways, who found the whole thing less theological than the clergy hoped and much more awkward.`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // III. THE CONVERGENTS — rare. The ones who carry both.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'convergents-1', chapter: 'convergents', rarity: 'rare',
    subtitle: 'Neither Wholly',
    content:
`Few are born between realms. Their souls are neither wholly Light nor wholly Shadow, and the two halves do not blend — that is the misconception every account has to correct first. A Convergent is not a mixture. A Convergent is a room with two occupants who have never agreed on anything.

They alone can cross freely. This is described in the Solari texts as a gift and in the Nocturne texts as a symptom, and both are being polite.

Each passage burns away part of their essence. Not metaphorically. A Convergent who crosses often enough becomes measurably less — quieter, thinner, harder to remember afterwards. There are Convergents in the Verge right now who are almost entirely gone and still walking, and the etiquette around *them* is that you do not point it out.`,
  },
  {
    id: 'convergents-2', chapter: 'convergents', rarity: 'rare',
    subtitle: 'The Binding',
    content:
`Only by binding to Eclipse Fragments can they remain whole.

The fragments are pieces of the First Sun — the same rain that fell at the Shattering, the same shards that are prison or key. A Convergent finds one, and binds to it, and the burning slows. Not stops. Slows.

The binding is not a ritual. There are no words for it and the Solari attempts to invent some have all failed embarrassingly. You hold the fragment, and either it takes or it does not, and nobody has ever explained the difference between a Convergent a fragment accepts and one it leaves cold. Two siblings, same birth, same Verge, same shard: one bound, one did not, and the one who did not is a name in an Archivum ledger and nothing else.

This is why Convergents hoard. It looks like avarice. It is arithmetic.`,
  },
  {
    id: 'convergents-3', chapter: 'convergents', rarity: 'rare',
    subtitle: 'Hunted and Revered',
    content:
`The Verge is the border between both worlds, unstable and ever-shifting, where time fractures and echoes of both realms overlap. It is where Convergents wander, and it is not a refuge. It is simply the only place neither church has managed to hold.

They are hunted and revered, and by the same people, often in the same week. A Solari village will burn a Convergent's belongings on a Tuesday and send for one on a Friday, because their child has gone through into the echo and the only thing that can follow is the thing they were burning belongings over.

The Convergents come anyway. Every time. There is a line in the Archivum's commentary that has never been improved on: *they have the best reason of anyone to refuse, and the worst record of refusing.*`,
  },
  {
    id: 'convergents-4', chapter: 'convergents', rarity: 'rare',
    subtitle: 'The One Who Sealed',
    content:
`Legends say a Convergent once sealed the First Shadow.

They do not say how, and this is not an omission — the Archivum has checked. Every version of the story, in both realms, in six scripts, arrives at the moment of the sealing and goes quiet, and resumes afterwards. It is not that the method was forgotten. It is that no account ever contained it.

What the accounts do contain: it was at the First Eclipse. The Convergents appeared, and the Nameless was sealed, and those two facts are always given in that order and never causally linked, and after four ages of scholarship nobody can say whether that is significant or simply how the sentence was first written down.

They also say another will decide its fate. Not seal. *Decide.* The Archivum has an entire wing arguing about that verb.`,
  },
  {
    id: 'convergents-5', chapter: 'convergents', rarity: 'rare',
    subtitle: 'On Being Asked Which',
    content:
`A transcript, recovered from the Verge, speaker unnamed. The Archivum believes it to be a Convergent addressing a Solari tribunal, though the tribunal's questions are lost and only the answers survive.

"—no. You are asking which one I am, and I am telling you the question does not have the shape you think it has."

"Both. Not half of each. Both, entirely, at once, and if that is impossible then I am impossible, and yet here I am answering you."

"You want me to choose because a choice would let you file me. I understand. I have wanted it too. There are mornings I would give the rest of my essence to wake up as one thing."

"But the prophecy does not say the world ends when the Convergent chooses. It says it ends when the Convergent *forgets which one they were.* Those are opposite failures, and you have spent this entire hearing asking me to commit the second one."`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IV. THE GODFORGE — epic. The engine, and what it shows you.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'godforge-1', chapter: 'godforge', rarity: 'epic',
    subtitle: 'The Thing Beneath the Borderlands',
    content:
`A colossal structure, buried beneath the borderlands. Some call it a sun fragment. Others call it a machine built by the gods. The Archivum, which dislikes both answers, notes that the two are not exclusive and that nobody has explained why they would be.

Its core hums. Every account uses that word and no account improves on it. Not roars, not blazes — hums, at a pitch just below the one you could name, continuously, and survey teams report that after the third day underground you stop hearing it and start expecting it, and that the expecting is worse.

Creation itself, in mechanical form. Read that as the engineers do rather than as the priests do: not a thing that was created, and not a thing that creates. A thing that *is* creating, right now, at a rate and for a purpose nobody has established, and has been for longer than there have been people to notice.`,
  },
  {
    id: 'godforge-2', chapter: 'godforge', rarity: 'epic',
    subtitle: 'The Gates and the Seven Days',
    content:
`During the Eclipse the gates open. Not are opened — there is no mechanism, no key, no attendant, and four ages of trying have not produced one. They open, and they stay open seven days, and then they are shut and cannot be found.

Every recorded attempt to hold them open has failed identically. The Solari sent an order of engineers at the Third Eclipse with braces cut from Aether-glass; the braces are still there, unbent, holding nothing, in a wall with no opening in it.

Seven days is the whole of it. Whatever you intend to do at the Godforge, you will do it in seven days or you will wait thirty-three years and be a different person when you return — which is, several commentaries point out, indistinguishable from not returning.`,
  },
  {
    id: 'godforge-3', chapter: 'godforge', rarity: 'epic',
    subtitle: 'Your Own Reflections',
    content:
`Inside, echoes of every past Eclipse reappear. To enter is to face your own reflections — the lives you could have lived.

This is not a haunting. The distinction matters and the survivors are insistent about it. A haunting is something that wants from you. These want nothing. They are simply *there*, going about lives that diverged from yours at a decision you had forgotten you made, and they do not turn to look at you, and that is the part that breaks people.

The Archivum has interviewed every recorded entrant. The accounts vary wildly except on one point, which is unanimous and unexplained: nobody reports seeing a reflection whose life went *worse*.

Whether that is because the Godforge is cruel, or because it is honest and we are simply that bad at choosing, is the oldest open question in the wing.`,
  },
  {
    id: 'godforge-4', chapter: 'godforge', rarity: 'epic',
    subtitle: 'The Claim',
    content:
`Whoever claims the Godforge at the height of the Eclipse may reshape existence.

Six words of consequence in a sentence that has never once been tested, because in every Eclipse on record the claim has not been made. Not failed. *Not made.* Parties reached the core — several are documented, with equipment lists and survivor testimony — and then came back out, and every one of them has declined to explain why.

The Nocturne take this as evidence the reshaping is a lie. The Solari take it as evidence of divine restraint and have built two festivals on it. The Archivum, which has read all the testimony, records only that the survivors do not contradict each other, and that people who are lying usually do.

There is a phrase that recurs across four separate accounts in three languages. Rendered plainly, it is: *there was nothing there I wanted more than what I already had.*`,
  },
  {
    id: 'godforge-5', chapter: 'godforge', rarity: 'epic',
    subtitle: 'The Engineer\'s Marginalia',
    content:
`Found written in the margin of a Solari survey chart, in a hand that appears nowhere else in the archive. The chart itself is unremarkable — a cross-section, competently drawn, of the third descent.

"It is not a machine. I have said this at four hearings and I will say it here where nobody will read it. A machine has a purpose outside itself. You can ask what a machine is for and the answer will be about something else."

"Ask what this is for and the answer is: this."

"We keep measuring the output. There is no output. There is no input either. It is not converting anything into anything. It hums, and the hum is not a by-product, and I think — I have thought this since the second descent and I am too old now to be careful — I think the humming is the whole of it."

"We did not find an engine under the borderlands. We found something dreaming, and we have been taking readings of its sleep."`,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // V. THE PROPHECY — legendary, mythic, and the one Singular.
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'prophecy-1', chapter: 'prophecy', rarity: 'legendary',
    subtitle: 'The Seers\' Text',
    content:
`"The world shall end not in fire nor shadow, but when the Convergent forgets which one they were."

It is the shortest prophecy in the codex and the only one with no variant readings. Every copy in both realms agrees to the word, which for a text of this age is not merely unusual — the Archivum classes it as impossible, and has an entire monograph on the impossibility.

The conventional reading is that a Convergent will fail, and the failure will be forgetting. The Archivum's minority reading is grammatical and much worse: the line does not say *a* Convergent. It says *the* Convergent. Definite. Singular. As though at the relevant moment there will only be one left to forget anything.

Nobody has refuted the minority reading. It is simply not taught.`,
  },
  {
    id: 'prophecy-2', chapter: 'prophecy', rarity: 'legendary',
    subtitle: 'Consume, Not Separate',
    content:
`Ancient seers foretell a Final Eclipse — when the realms no longer separate but consume each other.

Every Eclipse until now has been a binding. Seven days, both worlds occupying the one space, and then the separation returns and everyone goes back to being half of something. Unpleasant, survivable, thirty-three years until the next.

The Final Eclipse is described differently, and the difference is one verb. They do not merge. They *consume*. Whatever comes out the other side is not both realms in one place; it is one thing that used to be two and does not remember being two.

Time will loop. Memories will bleed. The barrier will fail. The seers give these three in this order in every copy, and the Archivum has noted, without comment, that the third is stated as a consequence and not as a cause.`,
  },
  {
    id: 'prophecy-3', chapter: 'prophecy', rarity: 'legendary',
    subtitle: 'The Two Readings',
    content:
`Some believe this will end everything. Others whisper it is how the world heals itself.

The dispute is old enough that both sides have stopped expecting to win it, which has made them unusually honest with each other. A Solari cardinal and a Nocturne archivist corresponded on the question for thirty years; the letters survive and are the best thing in the wing.

Near the end she writes to him: "You believe the wound closes. I believe the patient dies. We have agreed for three decades that the bleeding stops. Perhaps that is as much as anyone gets."

He replies — and this is the last letter, he did not live to send another: "You have described healing. You have simply described it from the perspective of the wound."`,
  },
  {
    id: 'prophecy-4', chapter: 'prophecy', rarity: 'mythic',
    subtitle: 'The Nameless Stirs',
    content:
`During the Eclipse, the First Shadow stirs, whispering through dreams.

The whispering is documented and the documentation is the strangest body of evidence in the archive, because it is not frightening. That is what everyone gets wrong before they read it. The dreams the Nameless sends are not nightmares. They are *reasonable*.

Sleepers wake having been gently, patiently talked through an argument they cannot afterwards reconstruct but are certain was sound. They report the sensation of having been listened to. Several report it as the first time.

The Solari classify the dreams as assault and treat those who receive them. The Nocturne classify them as correspondence and answer. The Archivum, which has collected four thousand transcripts, notes only this: in every one of them, the Nameless is the party that asks the questions.

A thing trapped beneath the world for four ages, with one channel to the living, and it spends the channel asking what we think.`,
  },
  {
    id: 'unwritten-verse', chapter: 'prophecy', rarity: 'singular',
    subtitle: 'The Unwritten Verse',
    content:
`The final page of the Codex is blank — yet faintly warm to the touch.

Every copy has it. Every copy has always had it. Scribes reproducing the codex have, across four ages, dutifully copied a blank page, and there is no record of any of them asking why, which the Archivum finds more remarkable than the page.

When held under the light of a full eclipse, words appear:

"There was never Light.
There was never Shadow.
Only the dream of balance…
and the nightmare of remembering."

The Solari have suppressed this passage twice and both times it reappeared in the next generation of copies, in the same hand, on the blank page that every copy has always had. The Nocturne do not celebrate it either; it takes from them exactly what it takes from their enemies.

The Archivum keeps it under no classification at all. Asked why, the wing's last keeper is recorded as saying that a thing which unmakes both sides of a four-age war is not evidence for either of them, and that she did not know what shelf that goes on.`,
  },
];

/**
 * The scrolls. `title` and `chapterName` are derived rather than authored:
 * twenty-five hand-written "Fragment of the Shattering, Part IV" strings is
 * twenty-five chances to number one of them wrong, and a codex that skips from
 * Part III to Part V is the kind of bug nobody reports and everybody notices.
 */
export const LORE_SCROLLS: LoreScroll[] = (() => {
  const seen = new Map<LoreChapterId, number>();
  return SCROLL_SEEDS.map(seed => {
    const chapterName = CHAPTER_NAME.get(seed.chapter)!;
    const partNumber = (seen.get(seed.chapter) ?? 0) + 1;
    seen.set(seed.chapter, partNumber);
    return {
      id: seed.id,
      title: `Fragment of ${chapterName}, Part ${ROMAN[partNumber - 1] ?? partNumber}`,
      subtitle: seed.subtitle,
      chapter: seed.chapter,
      chapterName,
      partNumber,
      content: seed.content,
      rarity: seed.rarity,
    };
  });
})();

const SCROLL_BY_ID = new Map(LORE_SCROLLS.map(s => [s.id, s]));

export function scrollById(id: string): LoreScroll | undefined {
  return SCROLL_BY_ID.get(id);
}

export function scrollsOfChapter(chapter: LoreChapterId): LoreScroll[] {
  return LORE_SCROLLS.filter(s => s.chapter === chapter);
}

/**
 * The chance a strike of a given rune tier also turns up a scroll.
 *
 * The brief's ladder, with the two tiers it did not name filled in between the
 * Epic figure and the Void's certainty rather than left at Epic's — a Mythic
 * rune that was no likelier to carry a scroll than an Epic would be the only
 * place in this feature where the ladder stops climbing.
 */
export const SCROLL_CHANCE: Record<RuneTier, number> = {
  common: 0.001,
  uncommon: 0.002,
  rare: 0.004,
  epic: 0.006,
  legendary: 0.0075,
  mythic: 0.009,
  singular: 1.00,
};

/**
 * Which scrolls a rune tier can turn up.
 *
 * A tier reaches its own shelf and every shelf below it. Restricting each tier
 * to exactly its own rarity would strand The First Dawn behind Common runes for
 * a player deep enough that Commons are the only thing they no longer need —
 * and would make the last two Prophecy scrolls hostage to a 0.35% roll landing
 * on the right side of a second coin flip.
 *
 * Singular is the exception in both directions: the Void reaches everything,
 * and nothing else reaches the Void's shelf. `unwritten-verse` is the only
 * scroll on it.
 */
const TIER_REACH: Record<RuneTier, RuneTier[]> = {
  common: ['common'],
  uncommon: ['uncommon', 'common'],
  rare: ['rare', 'uncommon', 'common'],
  // Epic reaches the legendary shelf, which is where The Prophecy starts. That
  // is one rung further than the strict ladder would give it, and it is
  // deliberate: The Prophecy is specified as an Epic-and-above chapter, and
  // gating it at Legendary would put it behind a 1% rune instead of a 3.5% one.
  epic: ['legendary', 'epic', 'rare', 'uncommon', 'common'],
  legendary: ['legendary', 'epic', 'rare', 'uncommon', 'common'],
  mythic: ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'],
  singular: ['singular', 'mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'],
};

/** Every scroll a rune of this tier could produce, rarest shelf first. */
export function scrollsReachableBy(tier: RuneTier): LoreScroll[] {
  const reach = TIER_REACH[tier] ?? TIER_REACH.common;
  const rank = new Map(reach.map((t, i) => [t, i]));
  return LORE_SCROLLS
    .filter(s => rank.has(s.rarity))
    .sort((a, b) => rank.get(a.rarity)! - rank.get(b.rarity)!);
}

/**
 * Pick the scroll a strike turns up, or null when the roll fails or there is
 * nothing left to find.
 *
 * Two rules, both of them about not wasting the player's attention:
 *
 * Only undiscovered scrolls are drawn. A duplicate rune is a resource — it goes
 * into a Runeword. A duplicate scroll is a page you have already read, dressed
 * up as an event, and the second time it happened anyone would stop reading the
 * cards.
 *
 * The draw prefers the rarest shelf the rune can reach that still has something
 * on it. A Mythic rune that handed over a First Dawn scroll while three
 * Prophecy fragments sat unfound would be technically generous and feel like a
 * miss.
 *
 * A consequence worth stating: an Epic rune turns up The Prophecy before The
 * Godforge, because Prophecy sits on the rarer shelf. Scrolls are found out of
 * order by design and the Codex lists them in chapter order regardless, so
 * finding order and reading order are not the same thing and only the second
 * one needs to be tidy.
 */
export function rollScroll(
  tier: RuneTier,
  found: ReadonlySet<string>,
  random: () => number = Math.random,
): LoreScroll | null {
  if (random() >= (SCROLL_CHANCE[tier] ?? 0)) return null;

  const candidates = scrollsReachableBy(tier).filter(s => !found.has(s.id));
  if (candidates.length === 0) return null;

  // `scrollsReachableBy` returns rarest shelf first, so the first candidate's
  // rarity is the best shelf still holding anything.
  const shelf = candidates[0].rarity;
  const onShelf = candidates.filter(s => s.rarity === shelf);
  return onShelf[Math.floor(random() * onShelf.length)] ?? onShelf[0];
}
