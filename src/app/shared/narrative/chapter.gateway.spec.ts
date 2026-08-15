import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { CHAPTER_KEY } from './chapter.model';
import { ChapterGateway } from './chapter.gateway';

class MemoryGateway {
  private readonly bag = new Map<string, string>();
  write(key: string, value: unknown): void {
    this.bag.set(key, JSON.stringify(value));
  }
  writeRaw(key: string, raw: string): void { this.bag.set(key, raw); }
  readRaw(key: string): string | null { return this.bag.get(key) ?? null; }
  remove(key: string): void { this.bag.delete(key); }
}

describe('ChapterGateway', () => {
  let memory: MemoryGateway;
  let gateway: ChapterGateway;

  beforeEach(() => {
    memory = new MemoryGateway();
    TestBed.configureTestingModule({
      providers: [
        ChapterGateway,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: GameStateGateway, useValue: memory },
        { provide: LocalSaveRegistry, useValue: { register() { /* noop */ } } },
      ],
    });
    gateway = TestBed.inject(ChapterGateway);
    gateway.init();
  });

  it('records one Infernal position and replays later choices', () => {
    const first = gateway.resolveInfernal('central', 1_000);
    const second = gateway.resolveInfernal('distributed', 2_000);
    expect(first.ok && first.replayed).toBe(false);
    expect(second.ok && second.replayed).toBe(true);
    if (first.ok && second.ok) {
      expect(second.record.choiceId).toBe('central');
      expect(second.record).toEqual(first.record);
    }
    expect(JSON.parse(memory.readRaw(CHAPTER_KEY)!).infernal.choiceId).toBe('central');
  });

  it('rolls back when persist fails', () => {
    const store = TestBed.inject(GameStateGateway) as unknown as MemoryGateway;
    spyOn(store, 'write').and.callFake(() => { /* swallow */ });
    const result = gateway.resolveInfernal('distributed', 3_000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('persist');
    expect(gateway.infernal()).toBeNull();
  });
});
