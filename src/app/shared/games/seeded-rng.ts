/**
 * seeded-rng — the one random draw behind every game of chance.
 *
 * A play's outcome is a pure function of a seed string. The seed is
 * `secret:nonce`, where `secret` is a random string minted once per save and
 * `nonce` counts plays (see play-ledger). The seed is stored with the play, so
 * the same play can always be re-derived and is never re-rolled.
 *
 * cyrb128 hashes the string into four 32-bit words; sfc32 turns them into a
 * stream of floats in [0, 1). Both are small, fast and well distributed; this
 * is a game's RNG, not a cryptographic one.
 *
 * Pure, import-free: the node simulators load this file directly.
 */

/** Four 32-bit words from a string (cyrb128). */
export function hashSeed(seed: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4; h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

/** A deterministic stream of floats in [0, 1) for this seed (sfc32). */
export function seededRng(seed: string): () => number {
  let [a, b, c, d] = hashSeed(seed);
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/** The seed of the play numbered `nonce` under this save's secret. */
export function playSeed(secret: string, nonce: number): string {
  return `${secret}:${nonce}`;
}

/** A fresh 128-bit secret as hex. Crypto when the platform has it. */
export function newSecret(): string {
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** Pick an index from integer or float weights with one draw. */
export function pickWeighted(weights: readonly number[], total: number, rng: () => number): number {
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
