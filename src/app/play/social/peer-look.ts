/**
 * peer-look.ts — a Keeper's look in a dozen characters, for the Hearth room's presence (scripts/social-server.mjs
 * protocol 2: `look` is `[a-z0-9.]{1,48}`).
 *
 * Only what the painter (shared/keeper-look/keeper-paint) needs to draw the sprite: the build, the figure, skin, hair
 * (style and colour), eyes (style and colour), the face mark and the two cloth colours, each as its index in the
 * model's own tables. Worn gear never travels; the other client dresses the Keeper in the class's own kit
 * (vocation-look). Unknown or out-of-range indices fall back to the default, so a peer can never paint a colour the
 * game does not own.
 */
import {
  BODY_TYPES, EYE_COLORS, EYE_STYLES, FACE_MARKS, FORMS, HAIR_COLORS, HAIR_STYLES, OUTFIT_COLORS, SKIN_TONES, VOCATIONS,
  coerceLook, type KeeperLook, type Vocation,
} from '../../shared/keeper-look/keeper-look.model';

const at = <T>(list: readonly T[], value: T): number => Math.max(0, list.indexOf(value));

/** The look as dot-separated indices (body.form.skin.hair.hairColor.eyes.eyeColor.face.outfit.trim). */
export function packLook(look: KeeperLook): string {
  return [
    at(BODY_TYPES, look.body), at(FORMS, look.form), look.skin, at(HAIR_STYLES, look.hair), look.hairColor,
    at(EYE_STYLES, look.eyes), look.eyeColor, at(FACE_MARKS, look.face), look.outfit, look.trim,
  ].map(n => (Number.isInteger(n) && n >= 0 && n < 100 ? n : 0)).join('.');
}

/** A packed look back to a whole KeeperLook (null when there is none: the peer is drawn in the default look). */
export function unpackLook(packed: unknown, vocation?: unknown, name = ''): KeeperLook | null {
  if (typeof packed !== 'string' || !/^[0-9.]{1,48}$/.test(packed)) return null;
  const n = packed.split('.').map(Number);
  const pick = <T>(list: readonly T[], i: number): T | undefined => (Number.isInteger(i) && i >= 0 && i < list.length ? list[i] : undefined);
  const index = (list: readonly unknown[], i: number): number | undefined => (Number.isInteger(i) && i >= 0 && i < list.length ? i : undefined);
  return coerceLook({
    made: true, prompted: true, name,
    body: pick(BODY_TYPES, n[0]), form: pick(FORMS, n[1]), skin: index(SKIN_TONES, n[2]), hair: pick(HAIR_STYLES, n[3]),
    hairColor: index(HAIR_COLORS, n[4]), eyes: pick(EYE_STYLES, n[5]), eyeColor: index(EYE_COLORS, n[6]), face: pick(FACE_MARKS, n[7]),
    outfit: index(OUTFIT_COLORS, n[8]), trim: index(OUTFIT_COLORS, n[9]),
    vocation: VOCATIONS.includes(vocation as Vocation) ? vocation : undefined,
  });
}
