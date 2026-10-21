import { audioHidden, guardAudioContext } from './audio-visibility';

/** A stand-in context: records suspend/resume and holds a state like the real one. */
class FakeCtx {
  state: AudioContextState = 'running';
  suspends = 0; resumes = 0;
  suspend(): Promise<void> { this.suspends++; this.state = 'suspended'; return Promise.resolve(); }
  resume(): Promise<void> { this.resumes++; this.state = 'running'; return Promise.resolve(); }
}

describe('audio-visibility: every context goes quiet with the page', () => {
  let vis: DocumentVisibilityState;
  beforeEach(() => {
    vis = 'visible';
    spyOnProperty(document, 'visibilityState', 'get').and.callFake(() => vis);
  });

  it('suspends a guarded context when the page hides and wakes it when it shows', () => {
    const ctx = guardAudioContext(new FakeCtx() as unknown as AudioContext) as unknown as FakeCtx;
    vis = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.state).toBe('suspended');
    expect(audioHidden()).toBeTrue();
    vis = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ctx.state).toBe('running');
    expect(audioHidden()).toBeFalse();
  });

  it('pagehide suspends even without a visibilitychange (the phone app-switch backstop)', () => {
    const ctx = guardAudioContext(new FakeCtx() as unknown as AudioContext) as unknown as FakeCtx;
    window.dispatchEvent(new Event('pagehide'));
    expect(ctx.state).toBe('suspended');
  });

  it('a context born while the page is hidden starts suspended', () => {
    vis = 'hidden';
    const ctx = guardAudioContext(new FakeCtx() as unknown as AudioContext) as unknown as FakeCtx;
    expect(ctx.suspends).toBe(1);
    vis = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
  });
});
