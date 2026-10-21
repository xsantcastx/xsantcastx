import { huntGold } from '../economy/economy-curve';
import { wornStats } from '../enchanting/socket-words';
import { itemToRecord, parseGameItem, recordToItem } from '../rpg/inventory-ops';
import { mintEquipment } from '../rpg/item-definition';
import { fightStats } from '../../play/td/td-skills';
import {
  CURSES, CURSE_ONE_IN, WHISPER_COST, WHISPER_KILL_CAP, WHISPER_ONE_IN, WHISPER_STAGES, cleansePrice, curseFor, dropLevel, graveStats,
  isGraveLevel, nextWhisperAt, parseCurse, parseWhisper, rollGrave, silencePrice, whisperKill, whisperStage, type ItemWhisper,
} from './grave-goods.model';

const seq = (...xs: number[]) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
const seeded = (s: number) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };

describe('grave-goods.model: cursed grave-goods', () => {
  it('only the crypts curse, only rare or better, never a unique', () => {
    expect(isGraveLevel('ashen-crypt-1')).toBeTrue();
    expect(isGraveLevel('drowned-crypts-3')).toBeTrue();
    expect(isGraveLevel('surface')).toBeFalse();
    expect(dropLevel('td:ashen-crypt-2:bone-walker@3,4:abc:7:g0')).toBe('ashen-crypt-2');
    const hit = seq(0.01, 0.5);
    expect(rollGrave({ rarity: 'rare', itemLevel: 20, levelId: 'ashen-crypt-1' }, hit).curse?.id).toBe('hollow-ward');
    expect(rollGrave({ rarity: 'uncommon', levelId: 'ashen-crypt-1' }, seq(0.01, 0.01, 0.01))).toEqual({});
    expect(rollGrave({ rarity: 'epic', unique: true, levelId: 'ashen-crypt-1' }, seq(0.01, 0.01))).toEqual({});
    // Outside a crypt the first roll is the whisper's, not a curse.
    expect(rollGrave({ rarity: 'rare', levelId: 'surface' }, seq(0.5, 0.5)).curse).toBeUndefined();
  });

  it('about 1 in 12 rare drops in a crypt is cursed', () => {
    const rand = seeded(7);
    let cursed = 0;
    const n = 12_000;
    for (let i = 0; i < n; i++) if (rollGrave({ rarity: 'rare', itemLevel: 15, levelId: 'drowned-crypts-1' }, rand).curse) cursed++;
    expect(cursed / n).toBeGreaterThan(1 / CURSE_ONE_IN * 0.8);
    expect(cursed / n).toBeLessThan(1 / CURSE_ONE_IN * 1.2);
  });

  it('a curse gives its bonus and takes its cost on the worn total; laid to rest, the cost goes and the bonus halves', () => {
    const c = curseFor('hollow-ward', 20);
    expect(c).toEqual({ id: 'hollow-ward', bonus: 55, cost: 15 });
    expect(graveStats({ curse: c })).toEqual({ life: 55, allResist: -15 });
    expect(graveStats({ curse: { ...c, cleansed: true } })).toEqual({ life: 27.5 });
    const g = curseFor('grave-cold', 50);
    expect(graveStats({ curse: g })).toEqual({ spellDamage: CURSES['grave-cold'].bonusAt(50), lifeRegen: -3 });
    expect(graveStats({ curse: curseFor('leaden-step', 10) })).toEqual({ critChance: 5, moveSpeed: -12 });
  });

  it('the fight reads the costs: a drain, resists that fall (never below 0), slower feet', () => {
    const drained = fightStats(20, undefined, { lifeRegen: -2 });
    expect(drained.lifeRegen).toBe(-2);
    const hollow = fightStats(20, undefined, { fireResist: 30, allResist: -15 });
    expect(hollow.resists.fire).toBe(15);
    expect(hollow.resists.cold).toBe(0);
    const leaden = fightStats(20, undefined, { moveSpeed: -12 });
    expect(leaden.moveHaste).toBeCloseTo(-0.12, 5);
    expect(fightStats(20, undefined, { moveSpeed: -500 }).moveHaste).toBeCloseTo(-0.3, 5);
  });

  it('a cursed piece pays its curse through wornStats, on top of its roll', () => {
    const item = mintEquipment('keepers-cowl', 'rare', seeded(3), undefined, 'cowl-1', 20)!;
    const plain = wornStats(item);
    const cursed = wornStats({ ...item, curse: curseFor('hollow-ward', 20) });
    expect(cursed.life ?? 0).toBe(Math.round(((plain.life ?? 0) + 55) * 10) / 10);
    expect(cursed.allResist ?? 0).toBe(Math.round(((plain.allResist ?? 0) - 15) * 10) / 10);
  });

  it('cleansing costs three minutes of a hunt at the Keeper\'s level, silencing two', () => {
    expect(cleansePrice(40)).toBe(huntGold(40, 180));
    expect(silencePrice(40)).toBe(huntGold(40, 120));
    expect(cleansePrice(1)).toBeGreaterThanOrEqual(60);
    expect(silencePrice(1)).toBeGreaterThanOrEqual(40);
  });
});

describe('grave-goods.model: whispering items', () => {
  it('about 1 in 40 rare+ drops whispers, anywhere', () => {
    const rand = seeded(11);
    let w = 0;
    const n = 20_000;
    for (let i = 0; i < n; i++) if (rollGrave({ rarity: 'legendary', levelId: 'surface' }, rand).whisper) w++;
    expect(w / n).toBeGreaterThan(1 / WHISPER_ONE_IN * 0.8);
    expect(w / n).toBeLessThan(1 / WHISPER_ONE_IN * 1.2);
    expect(rollGrave({ rarity: 'rare', levelId: 'surface' }, seq(0.001, 0.99)).whisper).toEqual({ id: 'margin-hand', kills: 0 });
  });

  it('wakes a piece of its sentence at each threshold, and stops counting when whole', () => {
    let w: ItemWhisper = { id: 'first-tally', kills: 0 };
    expect(whisperStage(w)).toBe(0);
    expect(nextWhisperAt(w)).toBe(WHISPER_STAGES[0]);
    for (let i = 0; i < WHISPER_STAGES[0]; i++) w = whisperKill(w);
    expect(whisperStage(w)).toBe(1);
    for (let i = 0; i < 1000; i++) w = whisperKill(w);
    expect(w.kills).toBe(WHISPER_KILL_CAP);
    expect(whisperStage(w)).toBe(3);
    expect(nextWhisperAt(w)).toBeNull();
  });

  it('gains its stat as it wakes, costs resist while it whispers; silenced, it keeps the stat, the cost goes, it stops', () => {
    const w: ItemWhisper = { id: 'first-tally', kills: 80 };
    expect(graveStats({ whisper: w })).toEqual({ spellDamage: 4, allResist: -WHISPER_COST });
    const quiet = { ...w, silenced: true };
    expect(graveStats({ whisper: quiet })).toEqual({ spellDamage: 4 });
    expect(whisperKill(quiet)).toBe(quiet);
    expect(nextWhisperAt(quiet)).toBeNull();
    expect(graveStats({ whisper: { id: 'drowned-sister', kills: 0 } })).toEqual({ allResist: -WHISPER_COST });
  });
});

describe('grave-goods.model: saves', () => {
  it('an item saved before grave-goods existed loads with neither field, and round-trips unchanged', () => {
    const old = { id: 'old-1', name: 'Old Cowl', type: 'artifact', rarity: 'rare', stats: { life: 10 }, sellValue: 5, econ: 3, equipped: false, foundAt: '2026-01-01T00:00:00.000Z', soulbound: false, definitionId: 'keepers-cowl' };
    const item = parseGameItem(old)!;
    expect(item).not.toBeNull();
    expect('curse' in item).toBeFalse();
    expect('whisper' in item).toBeFalse();
    const back = recordToItem(itemToRecord(item));
    expect('curse' in back).toBeFalse();
    expect('whisper' in back).toBeFalse();
    expect(back.stats).toEqual({ life: 10 });
  });

  it('a cursed or whispering item round-trips through the ledger; junk marks are dropped, the item still loads', () => {
    const item = parseGameItem({ id: 'g-1', name: 'Cowl', type: 'artifact', rarity: 'epic', stats: {}, sellValue: 1, econ: 3, equipped: false, foundAt: 'x', soulbound: false,
      curse: { id: 'hollow-ward', bonus: 30, cost: 15, cleansed: true }, whisper: { id: 'margin-hand', kills: 9999, silenced: true } })!;
    expect(item.curse).toEqual({ id: 'hollow-ward', bonus: 30, cost: 15, cleansed: true });
    expect(item.whisper).toEqual({ id: 'margin-hand', kills: WHISPER_KILL_CAP, silenced: true });
    const back = recordToItem(itemToRecord(item));
    expect(back.curse).toEqual(item.curse);
    expect(back.whisper).toEqual(item.whisper);
    expect(parseCurse({ id: 'made-up', bonus: 1, cost: 1 })).toBeUndefined();
    expect(parseWhisper('nope')).toBeUndefined();
    const junk = parseGameItem({ id: 'g-2', name: 'Cowl', type: 'artifact', rarity: 'epic', stats: {}, sellValue: 1, econ: 3, equipped: false, foundAt: 'x', soulbound: false, curse: 42, whisper: { id: 7 } })!;
    expect(junk).not.toBeNull();
    expect('curse' in junk).toBeFalse();
  });
});
