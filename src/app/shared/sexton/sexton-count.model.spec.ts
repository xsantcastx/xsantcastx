/**
 * sexton-count.model.spec.ts — the Sexton's Count's step machine: the order the facts must come in, what an event out
 * of turn does (nothing, and says so), the choice that two devices agree on, the journal, the Seek and the pay.
 */
import { huntGold } from '../economy/economy-curve';
import {
  SEXTON_COWL, SEXTON_JOURNAL, SEXTON_REWARD, type SextonEvent, type SextonFacts, journalIndex, sextonChoice, sextonEvent,
  sextonGold, sextonJournal, sextonSeek, sextonStep, stonesRead,
} from './sexton-count.model';
import { BOSS_UNIQUES } from '../rpg/boss-uniques';
import { CURSES } from '../grave-goods/grave-goods.model';

/** Apply events in order, as the service would (each records what the rules allow, at a rising time). */
function walk(events: SextonEvent[], from: SextonFacts = {}): { facts: SextonFacts; lines: string[] } {
  let facts: Record<string, number> = { ...from } as Record<string, number>;
  const lines: string[] = [];
  let t = 1;
  for (const ev of events) {
    const out = sextonEvent(facts, ev);
    lines.push(out.line);
    for (const f of out.add) if (!(f in facts)) facts = { ...facts, [f]: t++ };
  }
  return { facts, lines };
}

const WHOLE: SextonEvent[] = [
  { kind: 'accept' }, { kind: 'stone', n: 1 }, { kind: 'stone', n: 2 }, { kind: 'stone', n: 3 }, { kind: 'page', dark: true },
  { kind: 'walker' }, { kind: 'door' }, { kind: 'uncounted' }, { kind: 'grave' },
];

describe('the Sexton\'s Count: the step machine', () => {
  it('walks offer → stones → page → key → door → uncounted → grave → return, one fact at a time', () => {
    const seen: string[] = [];
    let facts: SextonFacts = {};
    seen.push(sextonStep(facts));
    for (const ev of WHOLE) { facts = walk([ev], facts).facts; seen.push(sextonStep(facts)); }
    expect(seen).toEqual(['offer', 'stones', 'stones', 'stones', 'page', 'key', 'door', 'uncounted', 'grave', 'return']);
  });

  it('the three stones count in any order, each once; the last one says where to go next', () => {
    const { facts, lines } = walk([{ kind: 'accept' }, { kind: 'stone', n: 3 }, { kind: 'stone', n: 3 }, { kind: 'stone', n: 1 }, { kind: 'stone', n: 2 }]);
    expect(stonesRead(facts)).toBe(3);
    expect(sextonStep(facts)).toBe('page');
    expect(lines).toEqual(['sexton.say.taken', 'sexton.stone.3', 'sexton.stone.3.again', 'sexton.stone.1', 'sexton.stone.2.last']);
  });

  it('records nothing out of turn: stones before the chain, the page by day or too early, the door without the key', () => {
    expect(sextonEvent({}, { kind: 'stone', n: 1 })).toEqual({ add: [], line: 'sexton.stone.worn' });
    const taken = walk([{ kind: 'accept' }]).facts;
    expect(sextonEvent(taken, { kind: 'page', dark: true })).toEqual({ add: [], line: 'sexton.page.early' });
    const atPage = walk(WHOLE.slice(0, 4)).facts;
    expect(sextonStep(atPage)).toBe('page');
    // The page is only there in the dark.
    expect(sextonEvent(atPage, { kind: 'page', dark: false })).toEqual({ add: [], line: 'sexton.page.lit' });
    expect(sextonEvent(atPage, { kind: 'door' })).toEqual({ add: [], line: 'sexton.door.locked' });
    expect(sextonEvent(atPage, { kind: 'walker' }).add).toEqual([]);
    expect(sextonEvent(atPage, { kind: 'uncounted' }).add).toEqual([]);
    expect(sextonEvent(atPage, { kind: 'grave' }).add).toEqual([]);
  });

  it('the grave cannot be read while the Uncounted stands over it', () => {
    const atVault = walk(WHOLE.slice(0, 7)).facts;
    expect(sextonStep(atVault)).toBe('uncounted');
    expect(sextonEvent(atVault, { kind: 'grave' })).toEqual({ add: [], line: 'sexton.grave.guarded' });
    expect(sextonEvent(atVault, { kind: 'uncounted' })).toEqual({ add: ['uncounted'], line: 'sexton.say.uncounted' });
  });

  it('a fact already held is never added again (a replayed event changes nothing)', () => {
    const { facts } = walk(WHOLE);
    for (const ev of WHOLE) expect(sextonEvent(facts, ev).add).withContext(ev.kind).toEqual([]);
  });

  it('the choice: either fact ends it; when two devices chose differently, the earlier one is the answer', () => {
    const { facts } = walk(WHOLE);
    expect(sextonChoice(facts)).toBeNull();
    expect(sextonStep({ ...facts, kept: 50 })).toBe('done');
    expect(sextonChoice({ ...facts, kept: 50 })).toBe('kept');
    expect(sextonChoice({ ...facts, rested: 50 })).toBe('rested');
    expect(sextonChoice({ ...facts, kept: 60, rested: 50 })).toBe('rested');
    expect(sextonChoice({ ...facts, kept: 40, rested: 50 })).toBe('kept');
  });
});

describe('the Sexton\'s Count: the journal, the Seek, the pay', () => {
  it('six entries; done before the one under way, blank after it; nothing before the chain is taken', () => {
    expect(SEXTON_JOURNAL.length).toBe(6);
    expect(sextonJournal({})).toEqual([]);
    const atKey = walk(WHOLE.slice(0, 5)).facts;
    expect(sextonJournal(atKey).map(e => e.state)).toEqual(['done', 'done', 'now', 'later', 'later', 'later']);
    expect(journalIndex(atKey)).toBe(3);
    const atGrave = walk(WHOLE.slice(0, 8)).facts;
    expect(sextonJournal(atGrave).find(e => e.state === 'now')?.id).toBe('vault');
    const done = { ...walk(WHOLE).facts, rested: 99 };
    expect(sextonJournal(done).every(e => e.state === 'done')).toBeTrue();
  });

  it('the Seek points at the next step\'s place, and at nothing before or after the chain', () => {
    const at = (n: number) => sextonSeek(walk(WHOLE.slice(0, n)).facts);
    expect(sextonSeek({})).toBeNull();
    expect([at(1), at(4), at(5), at(6), at(7), at(8), at(9)]).toEqual(['stones', 'nook', 'walker', 'door', 'grave', 'grave', 'wren']);
    expect(sextonSeek({ ...walk(WHOLE).facts, kept: 99 })).toBeNull();
  });

  it('pays Gold priced as a hunt at level 8 (more for laying the cowl to rest), and the cowl is a real boss unique, cursed', () => {
    expect(SEXTON_REWARD.gold).toBe(huntGold(8, 12 * 60));
    expect(sextonGold('kept')).toBe(Math.floor(huntGold(8, 12 * 60)));
    expect(sextonGold('rested')).toBe(Math.floor(huntGold(8, 12 * 60) + huntGold(8, 5 * 60)));
    expect(sextonGold('rested')).toBeGreaterThan(sextonGold('kept'));
    const cowl = BOSS_UNIQUES.find(u => u.id === SEXTON_COWL.defId);
    expect(cowl?.boss).toBe('the-uncounted');
    expect(cowl?.sig.light).toBe(2);
    expect(CURSES[SEXTON_COWL.curse]).toBeDefined();
  });
});
