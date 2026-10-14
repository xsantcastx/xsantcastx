/**
 * keeper-lines.spec.ts: the town keepers' act-aware lines (world & cast S3).
 * Pure: no TestBed.
 */
import { STORY_BEAT_IDS } from '../../shared/story/story-save.model';
import { DIALOGUE } from '../../shared/npc/npc.model';
import { TOWN_KEEPERS } from './life';
import { LIFE_I18N } from './life.i18n';
import {
  DeedFacts, KEEPER_DEEDS, KEEPER_LINES, RENOWN_GOLD, allKeeperLines, keeperDeeds, keeperLines, lineKey,
} from './keeper-lines';

const KEEPERS = Object.values(TOWN_KEEPERS).flat();
const ctx = (beats: readonly string[] = [], deeds: readonly string[] = []) => ({ beats: new Set(beats), deeds: new Set(deeds) });
const gate = (keeper: string, key: string) => KEEPER_LINES[keeper].find(line => lineKey(keeper, line.n) === key)!;
const noFacts: DeedFacts = {
  forged: false, sold: 0, inVault: 0, strikes: 0, socketed: false, bought: false, hunted: false, dug: false,
  topSkill: 1, fished: false, mission: false, goldEarned: 0,
};

describe('keeper lines (S3)', () => {
  it('gives every keeper four to eight lines, and every keeper in a town has a pool', () => {
    for (const k of KEEPERS) {
      expect(KEEPER_LINES[k.id]).withContext(k.id).toBeDefined();
      expect(allKeeperLines(k.id).length).withContext(k.id).toBeGreaterThanOrEqual(4);
      expect(allKeeperLines(k.id).length).withContext(k.id).toBeLessThanOrEqual(8);
      expect(new Set(KEEPER_LINES[k.id].map(l => l.n)).size).withContext(`${k.id} numbers are unique`).toBe(KEEPER_LINES[k.id].length);
    }
    expect(Object.keys(KEEPER_LINES).sort()).toEqual(KEEPERS.map(k => k.id).sort());
  });

  it('never says a line for a story beat the Keeper has not reached, at any point in the story', () => {
    for (let n = 0; n <= STORY_BEAT_IDS.length; n++) {
      const reached = STORY_BEAT_IDS.slice(0, n);
      for (const k of KEEPERS) {
        for (const key of keeperLines(k.id, ctx(reached, KEEPER_DEEDS))) {
          const beat = gate(k.id, key).beat;
          if (beat) expect(reached).withContext(`${key} at ${n} beats`).toContain(beat);
        }
      }
    }
  });

  it('opens a deed line only once the deed is done', () => {
    for (const k of KEEPERS) {
      const fresh = keeperLines(k.id, ctx(STORY_BEAT_IDS));
      for (const key of fresh) expect(gate(k.id, key).deed).withContext(key).toBeUndefined();
    }
    expect(keeperLines('bench-smith', ctx([], ['crafted']))).toContain('play.life.line.bench-smith.4');
    expect(keeperLines('bench-smith')).not.toContain('play.life.line.bench-smith.4');
  });

  it('says the newest thing first: a later beat, then an earlier beat, then a deed, then the always-there lines', () => {
    expect(keeperLines('kael')[0]).toBe('play.life.line.kael.1');
    expect(keeperLines('kael', ctx([], ['struck']))[0]).toBe('play.life.line.kael.4');
    const act1 = keeperLines('kael', ctx(['p.words', 'a1.hammer'], ['struck']));
    expect(act1.slice(0, 3)).toEqual(['play.life.line.kael.6', 'play.life.line.kael.5', 'play.life.line.kael.4']);
    expect(keeperLines('kael', ctx(STORY_BEAT_IDS))[0]).toBe('play.life.line.kael.7');
  });

  it('turns the save into station deeds', () => {
    expect(keeperDeeds(noFacts)).toEqual([]);
    expect(keeperDeeds({ ...noFacts, forged: true, sold: 1, topSkill: 10, goldEarned: RENOWN_GOLD })).toEqual(['crafted', 'sold', 'skilled', 'renown']);
    expect(keeperDeeds({ ...noFacts, topSkill: 9, goldEarned: RENOWN_GOLD - 1 })).toEqual([]);
  });

  it('has every name, subtitle and line in English and Spanish, and translates the lines', () => {
    for (const k of KEEPERS) {
      for (const key of [k.nameKey, ...(k.titleKey ? [k.titleKey] : []), ...allKeeperLines(k.id)]) {
        expect(LIFE_I18N[key]?.en).withContext(key).toBeTruthy();
        expect(LIFE_I18N[key]?.es).withContext(key).toBeTruthy();
      }
      for (const key of allKeeperLines(k.id)) expect(LIFE_I18N[key].es).withContext(key).not.toBe(LIFE_I18N[key].en);
    }
  });

  it('keeps the canon cast in their own words: every canon keeper line is a DIALOGUE line', () => {
    for (const k of KEEPERS.filter(k => k.npc)) {
      const canon = DIALOGUE.filter(t => t.npcId === k.npc).flatMap(t => t.lines);
      for (const key of allKeeperLines(k.id)) expect(canon).withContext(key).toContain(LIFE_I18N[key].en);
    }
  });

  it('wears the approved role title as the subtitle of each named person', () => {
    const titles: Record<string, string> = {
      'bench-smith': 'Bench Smith', 'buyback-clerk': 'Buyback Clerk', 'chart-clerk': 'Chart Clerk', broker: 'Exchange Broker',
      'lodge-warden': 'Lodge Warden', steward: 'Expedition Steward',
      // The six role keepers named on 2026-10-14 keep their role title under the name.
      'vault-clerk': 'Vault Clerk', enchanter: 'Enchanter', croupier: 'Croupier', herald: 'Board Herald',
      gatekeeper: 'Arena Gatekeeper', 'trials-warden': 'Trials Warden',
    };
    for (const [id, title] of Object.entries(titles)) {
      const k = KEEPERS.find(row => row.id === id)!;
      expect(LIFE_I18N[k.titleKey!].en).toBe(title);
      expect(LIFE_I18N[k.nameKey].en).not.toBe(title);
    }
  });
});
