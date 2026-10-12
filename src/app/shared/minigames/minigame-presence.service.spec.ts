import { MinigamePresenceService } from './minigame-presence.service';

describe('MinigamePresenceService', () => {
  it('is active while any mini-game is mounted and never goes negative', () => {
    const svc = new MinigamePresenceService();
    expect(svc.active()).toBeFalse();
    svc.enter();
    svc.enter();
    expect(svc.active()).toBeTrue();
    svc.leave();
    expect(svc.active()).toBeTrue();
    svc.leave();
    expect(svc.active()).toBeFalse();
    svc.leave();
    svc.enter();
    expect(svc.active()).toBeTrue();
  });
});
