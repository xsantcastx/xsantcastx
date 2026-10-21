/**
 * character-onboarding.spec.ts — a second Keeper starts truly fresh (owner, 2026-10-21: "fix new character creation
 * and onboarding … with new characters and new users").
 *
 * Character #1 holds a lived-in save (a story under way, Glim met, a hearth lit, a worn title, an away stamp); a new
 * character on the same device reads none of it through the real services, files its own prologue progress in its
 * own namespace, and leaves #1 untouched. The account-wide sound setting is the one thing they share.
 */
import { TestBed } from '@angular/core/testing';
import { ACTIVE_CHARACTER_KEY, LOCAL_CHARACTER_KEYS, activeCharacterKey, characterStorageKey } from './character-scope';
import { GameStateGateway } from './game-state.gateway';
import { StoryService } from '../story/story.service';
import { STORY_KEY, coerceStory, mergeStory } from '../story/story-save.model';
import { GlimService } from '../glim/glim.service';
import { GLIM_KEY } from '../glim/glim-save.model';
import { WORN_TITLE_KEY, WornTitleService } from '../skills/worn-title.service';
import { AWAY_KEY } from '../offline/offline.model';
import { EconomyService } from '../economy/economy.service';
import { InventoryService } from '../rpg/inventory.service';

const SECOND = 'k2fresh0';

/** Character #1's lived-in save, written where it has always lived (unprefixed). */
function livedIn(): void {
  localStorage.setItem(STORY_KEY, JSON.stringify({ version: 1, chapter: 'prologue', beats: ['p.arrival', 'p.maw'], cards: [], scenes: [], tut: ['walk', 'book'] }));
  localStorage.setItem(GLIM_KEY, JSON.stringify({ version: 1, met: true, metAt: '2026-10-01T00:00:00.000Z', ladder: {}, said: { meet: 1 }, lastAt: {}, moments: [], answers: {}, peak: 2, seenAt: 0 }));
  localStorage.setItem('godforge-hearth', JSON.stringify({ version: 1, lit: ['hearth:ember-isle:basalt-seamworks'], wake: 'hearth:ember-isle:basalt-seamworks' }));
  localStorage.setItem(WORN_TITLE_KEY, 'mining');
  localStorage.setItem(AWAY_KEY, String(Date.now() - 3_600_000));
  localStorage.setItem('godforge-sound', JSON.stringify({ music: 0.25 }));
}

function boot(character: string | null): void {
  TestBed.resetTestingModule();
  if (character) localStorage.setItem(ACTIVE_CHARACTER_KEY, character); else localStorage.removeItem(ACTIVE_CHARACTER_KEY);
  TestBed.configureTestingModule({
    providers: [
      { provide: EconomyService, useValue: { grantCosmetic: () => undefined } },
      { provide: InventoryService, useValue: { grantStack: () => undefined } },
    ],
  });
}

describe('a second character starts fresh', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { TestBed.resetTestingModule(); localStorage.clear(); });

  it('reads an empty story, a Glim not yet met and no worn title, while character #1 keeps all of it', () => {
    livedIn();
    boot(SECOND);
    const story = TestBed.inject(StoryService);
    expect(story.state.beats).toEqual([]);
    expect(story.state.chapter).toBe('prologue');
    expect(story.state.tut).toBeUndefined();
    expect(story.state.skip).toBeUndefined();
    expect(TestBed.inject(GlimService).state.met).toBeFalse();
    expect(TestBed.inject(WornTitleService).worn).toBeNull();
    // The account-wide setting is shared.
    expect(TestBed.inject(GameStateGateway).read('godforge-sound')).toEqual({ music: 0.25 });

    boot(null);
    expect(TestBed.inject(StoryService).state.beats).toEqual(['p.arrival', 'p.maw']);
    expect(TestBed.inject(GlimService).state.met).toBeTrue();
    expect(TestBed.inject(WornTitleService).worn).toBe('mining');
  });

  it('files the new Keeper\'s prologue and skip in its own namespace, never in #1\'s', () => {
    livedIn();
    const before = localStorage.getItem(STORY_KEY);
    boot(SECOND);
    const story = TestBed.inject(StoryService);
    story.fileTut('walk');
    story.fileTut('walk');
    story.fileTut('bag');
    story.skipTut();
    const mine = JSON.parse(localStorage.getItem(characterStorageKey(STORY_KEY, SECOND))!);
    expect(mine.tut).toEqual(['walk', 'bag']);
    expect(mine.skip).toBeTrue();
    expect(localStorage.getItem(STORY_KEY)).toBe(before);
  });

  it('wears a title and stamps "away" per character', () => {
    livedIn();
    boot(SECOND);
    TestBed.inject(WornTitleService).wear('fishing');
    expect(localStorage.getItem(`${WORN_TITLE_KEY}@${SECOND}`)).toBe('fishing');
    expect(localStorage.getItem(WORN_TITLE_KEY)).toBe('mining');
    expect(activeCharacterKey(AWAY_KEY, localStorage)).toBe(`${AWAY_KEY}@${SECOND}`);
    localStorage.removeItem(ACTIVE_CHARACTER_KEY);
    expect(activeCharacterKey(AWAY_KEY, localStorage)).toBe(AWAY_KEY);
  });

  it('deleting a character takes its device-side keys too', async () => {
    for (const key of [AWAY_KEY, WORN_TITLE_KEY, 'eclipse-delve-track']) {
      expect(LOCAL_CHARACTER_KEYS.has(key)).withContext(key).toBeTrue();
      localStorage.setItem(`${key}@${SECOND}`, '1');
    }
    livedIn();
    boot(null);
    await TestBed.inject(GameStateGateway).deleteCharacterSave(SECOND);
    for (const key of [AWAY_KEY, WORN_TITLE_KEY, 'eclipse-delve-track']) expect(localStorage.getItem(`${key}@${SECOND}`)).withContext(key).toBeNull();
    expect(localStorage.getItem(WORN_TITLE_KEY)).toBe('mining');
  });
});

describe('the story record\'s prologue marks', () => {
  it('reads back a record from before them unchanged, and drops junk', () => {
    expect(coerceStory({ version: 1, chapter: 'prologue', beats: [], cards: [], scenes: [] })).toEqual({ version: 1, chapter: 'prologue', beats: [], cards: [], scenes: [] });
    const c = coerceStory({ beats: [], tut: ['bag', 'walk', 'nope', 'walk', 7], skip: 'yes' });
    expect(c.tut).toEqual(['walk', 'bag']);
    expect(c.skip).toBeUndefined();
  });

  it('merges two devices by the union of steps; a skip on either holds', () => {
    const m = coerceStory(mergeStory({ beats: [], tut: ['walk'] }, { beats: [], tut: ['bag'], skip: true }));
    expect(m.tut).toEqual(['walk', 'bag']);
    expect(m.skip).toBeTrue();
  });
});
