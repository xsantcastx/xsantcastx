/**
 * feedback.spec.ts — "Send feedback": the draft's limits, the rate-limit arithmetic, the screenshot budget ladder and the
 * service's one-batch write (the stamp the rules' rate limit reads, and the note beside it).
 */
import { TestBed } from '@angular/core/testing';
import { CloudSaveService } from '../cloud-save/cloud-save.service';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { coerceFeedback } from '../../admin/gm-data.service';
import {
  FEEDBACK_COLLECTION, FEEDBACK_GAP_SECS, FEEDBACK_LIMIT_COLLECTION, SHOT_MAX_B64, SHOT_MAX_BYTES,
  buildFeedbackDoc, cleanDevice, draftProblem, fitShot, waitSecs, type FeedbackDraft,
} from './feedback.model';
import { FeedbackService } from './feedback.service';

const device = { ua: 'UA', viewport: '390x844@3', version: '2.90.0', area: 'Seamworks', vocation: 'warlock', level: 7 };
const draft = (over: Partial<FeedbackDraft> = {}): FeedbackDraft => ({ type: 'bug', message: 'The corpse window does not close.', shot: '', device, ...over });

describe('feedback draft', () => {
  it('needs a known type and 10 to 1000 characters (trimmed)', () => {
    expect(draftProblem(draft())).toBeNull();
    expect(draftProblem(draft({ message: '   too short ' }))).toBe('short');
    expect(draftProblem(draft({ message: 'x'.repeat(1000) }))).toBeNull();
    expect(draftProblem(draft({ message: 'x'.repeat(1001) }))).toBe('long');
    expect(draftProblem(draft({ type: 'rant' as never }))).toBe('type');
  });
  it('refuses a screenshot over the 200 KB the rules accept', () => {
    expect(draftProblem(draft({ shot: 'A'.repeat(SHOT_MAX_B64) }))).toBeNull();
    expect(draftProblem(draft({ shot: 'A'.repeat(SHOT_MAX_B64 + 1) }))).toBe('shot');
  });
  it('a 150 KB JPEG always fits the 200 KB of base64', () => {
    expect(Math.ceil(SHOT_MAX_BYTES / 3) * 4).toBeLessThanOrEqual(SHOT_MAX_B64);
  });
  it('bounds every device fact the way the rules do', () => {
    const d = cleanDevice({ ua: 'u'.repeat(900), viewport: 'v'.repeat(90), version: '1'.repeat(50), area: 'a'.repeat(200), vocation: 'w'.repeat(50), level: 12345.7 });
    expect(d.ua.length).toBe(300); expect(d.viewport.length).toBe(40); expect(d.version.length).toBe(20);
    expect(d.area.length).toBe(60); expect(d.vocation.length).toBe(20); expect(d.level).toBe(999);
    expect(cleanDevice({}).level).toBe(0);
  });
  it('builds exactly the keys the rules allow, with the shot only when there is one', () => {
    const plain = buildFeedbackDoc('u1', draft({ message: '  hello there, friend  ' }), 'T');
    expect(Object.keys(plain).sort()).toEqual(['at', 'device', 'message', 'status', 'type', 'uid']);
    expect(plain.message).toBe('hello there, friend');
    expect(plain.status).toBe('open');
    expect(Object.keys(buildFeedbackDoc('u1', draft({ shot: 'QUJD' }), 'T')).sort()).toEqual(['at', 'device', 'message', 'shot', 'status', 'type', 'uid']);
  });
});

describe('feedback rate limit', () => {
  it('asks for the rest of the minute, then nothing', () => {
    const t0 = 1_000_000;
    expect(waitSecs(0, t0)).toBe(0);
    expect(waitSecs(t0, t0)).toBe(FEEDBACK_GAP_SECS);
    expect(waitSecs(t0, t0 + 15_000)).toBe(45);
    expect(waitSecs(t0, t0 + 60_000)).toBe(0);
    expect(waitSecs(Number.NaN, t0)).toBe(0);
  });
});

describe('screenshot budget', () => {
  const urlOf = (bytes: number) => `data:image/jpeg;base64,${'A'.repeat(Math.ceil(bytes / 3) * 4)}`;
  it('takes the first rung that fits', () => {
    const asked: string[] = [];
    const out = fitShot((w, q) => { asked.push(`${w}@${q}`); return urlOf(w > 600 ? SHOT_MAX_BYTES + 10_000 : 90_000); });
    expect(out).not.toBeNull();
    expect(asked.length).toBeGreaterThan(1);
    expect(Math.floor(out!.length * 3 / 4)).toBeLessThanOrEqual(SHOT_MAX_BYTES);
  });
  it('gives up (null) when nothing fits, rather than send a heavy one', () => {
    expect(fitShot(() => urlOf(SHOT_MAX_BYTES * 3))).toBeNull();
  });
});

describe('FeedbackService', () => {
  interface Call { kind: 'set'; path: string; data: Record<string, unknown> }
  let calls: Call[];
  let commits: number;
  let uid: string | null;
  let fail: string | null;
  const api = {
    writeBatch: () => ({
      set: (ref: { path: string }, data: Record<string, unknown>) => { calls.push({ kind: 'set', path: ref.path, data }); },
      commit: async () => { commits++; if (fail) throw { code: fail }; },
    }),
    doc: (...a: unknown[]) => (typeof a[1] === 'string' ? { path: (a.slice(1) as string[]).join('/') } : { path: `${(a[0] as { path: string }).path}/<auto id>` }),
    collection: (_db: unknown, name: string) => ({ path: name }),
    serverTimestamp: () => '<server time>',
  };
  beforeEach(() => {
    calls = []; commits = 0; uid = 'u1'; fail = null;
    try { localStorage.removeItem('eclipse-feedback-last'); } catch { /* */ }
    TestBed.configureTestingModule({
      providers: [
        { provide: CloudSaveService, useValue: { get signedIn() { return !!uid; }, get status() { return { uid }; } } },
        { provide: LazyFirestoreService, useValue: { get: async () => ({ db: {}, api }) } },
      ],
    });
  });

  it('writes the stamp and the note in one batch, then holds the next one back for a minute', async () => {
    const svc = TestBed.inject(FeedbackService);
    expect(await svc.submit(draft())).toBe('sent');
    expect(commits).toBe(1);
    expect(calls.map(c => c.path.split('/')[0])).toEqual([FEEDBACK_LIMIT_COLLECTION, FEEDBACK_COLLECTION]);
    expect(calls[0].path).toBe(`${FEEDBACK_LIMIT_COLLECTION}/u1`);
    expect(calls[0].data).toEqual({ last: '<server time>' });
    expect(calls[1].data['uid']).toBe('u1');
    expect(calls[1].data['at']).toBe('<server time>');
    expect(await svc.submit(draft())).toBe('wait');
    expect(svc.secsLeft()).toBeGreaterThan(0);
    expect(commits).toBe(1);
  });
  it('asks a guest to sign in and writes nothing', async () => {
    uid = null;
    expect(await TestBed.inject(FeedbackService).submit(draft())).toBe('signin');
    expect(commits).toBe(0);
  });
  it('sends nothing for a note that is too short', async () => {
    expect(await TestBed.inject(FeedbackService).submit(draft({ message: 'hi' }))).toBe('invalid');
    expect(commits).toBe(0);
  });
  it('tells a refusal from a broken connection, and does not start the minute for either', async () => {
    const svc = TestBed.inject(FeedbackService);
    fail = 'permission-denied';
    expect(await svc.submit(draft())).toBe('refused');
    fail = 'unavailable';
    expect(await svc.submit(draft())).toBe('failed');
    expect(svc.secsLeft()).toBe(0);
  });
});

describe('the GM console reads a note', () => {
  it('coerces what the rules let in, and drops what they would not', () => {
    const f = coerceFeedback('n1', { type: 'idea', message: 'm', uid: 'u', status: 'resolved', at: 5, shot: 'QUJD', device: { ua: 'x', viewport: 'v', version: '1', area: 'a', vocation: 'w', level: 4 } });
    expect(f).toEqual(jasmine.objectContaining({ id: 'n1', type: 'idea', status: 'resolved', at: 5, shot: 'QUJD' }));
    expect(f.device.level).toBe(4);
    const odd = coerceFeedback('n2', { type: 'weird', status: 'maybe', shot: 7 });
    expect(odd.type).toBe('other'); expect(odd.status).toBe('open'); expect(odd.shot).toBe('');
  });
});
