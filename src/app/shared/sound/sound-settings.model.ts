/**
 * sound-settings.model.ts — how loud the world is, per player.
 *
 * Three channels and a master mute (docs/handoff/world-feel.md):
 *
 *   music     the sparse, per-realm score (sound-palette.ts)
 *   ambience  the beds: wind, birds, cave drips, water, lava, the ink tide
 *   effects   footsteps, digs, pickups, the craft chime, fishing, UI taps
 *
 * Saved through the gateway as `godforge-sound` (synced: progress/sound), so a
 * player who turns the music down on a phone finds it down on the PC too. One
 * choice made on one screen: the later edit wins whole, never a mix of both.
 *
 * First visit is QUIET (the "reduce sound" default): nobody opens a game to a
 * wall of noise. The player turns it up if they like it.
 *
 * The key bindings ride in this blob too (`keys`, sparse overrides; shared/keys/keymap.model.ts), so they follow the
 * Keeper to every device. Only the pure keymap model is imported: cloud-save.model.ts is eager and imports this merge.
 */
import { cleanOverrides, type KeyOverrides } from '../keys/keymap.model';

export const SOUND_KEY = 'godforge-sound';

export type SoundChannel = 'music' | 'ambience' | 'effects';
export const SOUND_CHANNELS: readonly SoundChannel[] = ['music', 'ambience', 'effects'];

/**
 * The Hush's cap (play/td/td-dark.ts; design-bible §5.4): its omens are sound and sight, so the choice lives here.
 * 'full' the whole dread dial, 'quiet' no deeper than the far bell (59), 'off' no Hush at all.
 */
export type HushSetting = 'full' | 'quiet' | 'off';
export const HUSH_SETTINGS: readonly HushSetting[] = ['full', 'quiet', 'off'];

/**
 * Night darkness (play/td/td-night.ts; an accessibility choice saved beside the Hush): 'full' the deep night the world
 * is drawn for, 'softer' a lighter pass for eyes or screens that lose the shapes in it.
 */
export type NightSetting = 'full' | 'softer';
export const NIGHT_SETTINGS: readonly NightSetting[] = ['full', 'softer'];

/**
 * The Hearth chat (owner 2026-10-21: "the chat should always be connected to online, unless they decide to ignore
 * the chat"): 'on' joins the room on entering the world and stays in it; 'ignore' never joins and shows no unread
 * count. Saved here with the other per-player choices, so it follows the Keeper to every device.
 */
export type ChatSetting = 'on' | 'ignore';
export const CHAT_SETTINGS: readonly ChatSetting[] = ['on', 'ignore'];

/**
 * Privacy at the Hearth (protocol 4; docs/design/online.md §3.10): 'offline' appears offline to friends (still in the
 * room, still seen in the world); party invites from everyone, or from friends only.
 */
export type PresenceSetting = 'online' | 'offline';
export const PRESENCE_SETTINGS: readonly PresenceSetting[] = ['online', 'offline'];
export type InviteSetting = 'everyone' | 'friends';
export const INVITE_SETTINGS: readonly InviteSetting[] = ['everyone', 'friends'];

export interface SoundSettings {
  version: 1;
  music: number;
  ambience: number;
  effects: number;
  muted: boolean;
  /** How deep the Hush may run (an older save without it: the full dial). */
  hush: HushSetting;
  /** How dark the night is drawn (an older save without it: full). */
  night: NightSetting;
  /** The Hearth chat: on (always connected) or ignored (an older save without it: on). */
  chat: ChatSetting;
  /** Appear online or offline to friends (an older save without it: online). */
  presence: PresenceSetting;
  /** Who may invite to a party (an older save without it: everyone). */
  invites: InviteSetting;
  /** The player's key bindings: only the actions they changed (an older save without it: the defaults). */
  keys: KeyOverrides;
  /** When this choice was made (ms); the later one wins a merge. 0 = never touched. */
  updatedAt: number;
}

/** The first-visit levels: soft, so the world is felt before it is heard. */
export const QUIET_LEVELS: Readonly<Record<SoundChannel, number>> = { music: .35, ambience: .4, effects: .5 };

export function defaultSound(): SoundSettings {
  return { version: 1, ...QUIET_LEVELS, muted: false, hush: 'full', night: 'full', chat: 'on', presence: 'online', invites: 'everyone', keys: {}, updatedAt: 0 };
}

/** A level is 0..1 on a 5% grid (a slider step), so two devices never disagree by a hair. */
export function clampLevel(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.round(Math.max(0, Math.min(1, n)) * 20) / 20;
}

export function coerceSound(raw: unknown): SoundSettings {
  const base = defaultSound();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const r = raw as Partial<Record<keyof SoundSettings, unknown>>;
  const at = typeof r.updatedAt === 'number' && Number.isFinite(r.updatedAt) && r.updatedAt > 0 ? Math.floor(r.updatedAt) : 0;
  return {
    version: 1,
    music: clampLevel(r.music, base.music),
    ambience: clampLevel(r.ambience, base.ambience),
    effects: clampLevel(r.effects, base.effects),
    muted: r.muted === true,
    hush: HUSH_SETTINGS.includes(r.hush as HushSetting) ? r.hush as HushSetting : 'full',
    night: NIGHT_SETTINGS.includes(r.night as NightSetting) ? r.night as NightSetting : 'full',
    chat: CHAT_SETTINGS.includes(r.chat as ChatSetting) ? r.chat as ChatSetting : 'on',
    presence: PRESENCE_SETTINGS.includes(r.presence as PresenceSetting) ? r.presence as PresenceSetting : 'online',
    invites: INVITE_SETTINGS.includes(r.invites as InviteSetting) ? r.invites as InviteSetting : 'everyone',
    keys: cleanOverrides(r.keys),
    updatedAt: at,
  };
}

/** Two devices: the later choice wins whole (commutative; a tie keeps local). */
export function mergeSound(remote: unknown, local: unknown): unknown {
  if (remote == null) return local;
  if (local == null) return remote;
  const r = coerceSound(remote), l = coerceSound(local);
  return r.updatedAt > l.updatedAt ? r : l;
}

/**
 * The gain a channel actually plays at: 0 when muted, else the level squared
 * (a slider feels even to the ear that way; 50% is a quarter of the power).
 */
export function channelGain(s: SoundSettings, channel: SoundChannel): number {
  if (s.muted) return 0;
  const v = s[channel];
  return v * v;
}
