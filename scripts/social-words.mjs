/**
 * social-words.mjs — the Hearth's profanity filter (docs/design/online.md §3.9). Simple and server-side on purpose:
 * every line the room relays (public chat, party chat, whispers) passes through `clean()`, which masks a short list of
 * English and Spanish slurs and swears (first letter kept, the rest `*`), seen through the usual disguises (case,
 * accents, l33t digits, repeated letters, dots or spaces between letters). Names that hide one are replaced, not masked
 * (a name cannot carry `*`). It is a courtesy, not a wall: the report button and the owner are the wall.
 */

// Stems, matched at the start of a word (so "fucking", "shitty" are caught; "scunthorpe", "class", "assume" are not:
// none of these stems starts those words). Kept short and unambiguous: a false positive in a cozy game is worse than a
// miss the report button can catch.
const STEMS = [
  // English
  'fuck', 'fuk', 'shit', 'bitch', 'cunt', 'pussy', 'asshole', 'bastard', 'slut', 'whore', 'wank',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'twat', 'motherfuck', 'dickhead', 'bollock',
  // Spanish
  'puta', 'puto', 'mierda', 'cabron', 'pendejo', 'gilipollas', 'coño', 'joder', 'maricon', 'zorra', 'verga', 'chinga', 'culero',
];
// Whole words only (a stem would catch innocent words).
const WORDS = ['ass', 'arse', 'tit', 'tits', 'cum', 'dick', 'dicks', 'cock', 'cocks', 'polla', 'culo'];

const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'l' };

/** A word as the filter reads it: lower case, no accents (ñ kept), l33t undone, letters not doubled. */
export function fold(word, collapse = true) {
  let s = word.toLowerCase().replace(/ñ/g, '\u0000').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0000/g, 'ñ');
  s = [...s].map(ch => LEET[ch] ?? ch).join('');
  s = s.replace(/[^a-zñ]/g, '');
  return collapse ? s.replace(/(.)\1+/g, '$1') : s;
}
const FOLDED_STEMS = STEMS.map(w => fold(w));
// Whole words keep their doubled letters ("ass" folded would be "as").
const FOLDED_WORDS = new Set(WORDS.map(w => fold(w, false)));

function bad(word) {
  const f = fold(word);
  if (!f) return false;
  if (FOLDED_WORDS.has(fold(word, false))) return true;
  return FOLDED_STEMS.some(stem => f.startsWith(stem));
}

/** Mask the bad words in a line: the first letter stays, the rest become `*`. Spaced-out letters ("f u c k") too. */
export function clean(text) {
  if (typeof text !== 'string' || !text) return text;
  // Spaced or dotted single letters ("f.u.c.k", "s h i t") are read as one word first.
  let out = text.replace(/(?:\b\p{L}[\s.\-_*]){2,}\p{L}\b/gu, run => {
    const joined = run.replace(/[\s.\-_*]/g, '');
    return bad(joined) ? joined[0] + '*'.repeat(joined.length - 1) : run;
  });
  out = out.replace(/[\p{L}\p{N}@$!|]+/gu, word => (bad(word) ? word[0] + '*'.repeat(Math.max(1, word.length - 1)) : word));
  return out;
}

/** A name that hides one of the words (any of its parts, or all of it run together). */
export function nameIsRude(name) {
  if (typeof name !== 'string') return false;
  return name.split(/[\s_'-]+/).some(bad) || bad(name.replace(/[\s_'-]+/g, ''));
}
