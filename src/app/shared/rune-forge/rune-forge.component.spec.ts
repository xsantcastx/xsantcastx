import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { EconomyService } from '../economy/economy.service';
import { ForgeAudioService } from '../economy/forge-audio.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { ForgeCraftGateway } from '../rpg/forge-craft.gateway';
import { InventoryService } from '../rpg/inventory.service';
import { LoreScrollService } from './lore-scroll.service';
import { RuneForgeComponent } from './rune-forge.component';
import { RuneForgeService } from './rune-forge.service';
import { RUNES, RUNE_TIERS, STRIKE_COST } from './rune.model';

/**
 * The reveal, from the component's side of the service boundary.
 *
 * Every service is an untyped literal carrying exactly the members the
 * component calls — the forge's `strike()` hands back whatever find the spec
 * queued, so a Rare, an Epic and a Mythic can be forced without touching the
 * drop table. Nothing here rolls, spends or persists.
 */
describe('RuneForgeComponent reveal', () => {
  let fixture: ComponentFixture<RuneForgeComponent>;
  let root: HTMLElement;
  let nextFind: any;
  const audio = { strike: jasmine.createSpy('strike'), runeReveal: jasmine.createSpy('runeReveal'), voidRumble: jasmine.createSpy('voidRumble'), scrollUnfurl: jasmine.createSpy('scrollUnfurl') };
  const scrolls = { markRead: jasmine.createSpy('markRead') };
  const store = new Map<string, string>();

  const runeOf = (tier: string) => RUNES.find(r => r.tier === tier)!;
  const emptySnap = () => ({
    held: {}, crafted: [], strikes: 0, goldSpent: 0, unique: 0, rarest: null, collectionValue: 0, firstFound: {},
  });
  const find = (tier: string, over: Record<string, unknown> = {}) => ({
    rune: runeOf(tier), held: 1, copies: 1, isNew: true, essence: 0, scroll: null, item: null, explorer: null,
    ...over,
  });
  const item = (over: Record<string, unknown> = {}) => ({
    id: 'i1', name: 'Ash Sigil', type: 'artifact', rarity: 'rare', stats: { goldPerSec: 1.3 },
    sellValue: 0, equipped: false, foundAt: '2026-01-01T00:00:00.000Z', soulbound: false, ...over,
  });
  const scroll = () => ({
    id: 's1', title: 'Fragment of the First Dawn, Part III', subtitle: 'The Sun That Dreamed',
    chapter: 'first-dawn', chapterName: 'The First Dawn', partNumber: 3,
    content: 'First paragraph.\n\nSecond paragraph.', rarity: 'epic',
  });

  beforeEach(async () => {
    audio.strike.calls.reset();
    audio.runeReveal.calls.reset();
    audio.voidRumble.calls.reset();
    audio.scrollUnfurl.calls.reset();
    scrolls.markRead.calls.reset();
    store.clear();
    nextFind = find('common');
    const rune$ = new BehaviorSubject(emptySnap());
    const gold$ = new BehaviorSubject({ gold: STRIKE_COST * 100 });
    const inv$ = new BehaviorSubject({});

    await TestBed.configureTestingModule({
      imports: [RuneForgeComponent, RouterTestingModule],
      providers: [
        TranslationService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ForgeAudioService, useValue: audio },
        { provide: LoreScrollService, useValue: scrolls },
        {
          provide: GameStateGateway,
          useValue: {
            readRaw: (key: string) => store.get(key) ?? null,
            writeRaw: (key: string, raw: string) => { store.set(key, raw); },
          },
        },
        {
          provide: RuneForgeService,
          useValue: {
            init: () => undefined,
            snapshot$: rune$.asObservable(),
            hasEverFound: () => false,
            countOf: () => 0,
            hasCrafted: () => false,
            strike: () => nextFind,
            craft: () => false,
          },
        },
        { provide: EconomyService, useValue: { snapshot$: gold$.asObservable() } },
        { provide: ForgeCraftGateway, useValue: { init: () => undefined, craftBasaltEdge: () => ({ ok: false, code: 'missing' }) } },
        { provide: InventoryService, useValue: { snapshot$: inv$.asObservable(), stackOf: () => 0 } },
      ],
    }).compileComponents();

    TestBed.inject(TranslationService).setLanguage('en');
    fixture = TestBed.createComponent(RuneForgeComponent);
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  function roll(): void {
    fixture.componentInstance.strike();
    fixture.detectChanges();
  }

  it('deals a face-down hand and offers to reveal now', () => {
    roll();
    expect(root.querySelector('.rf-focus')).toBeTruthy();
    expect(root.querySelector('.rf-pick')?.getAttribute('data-reveal')).toBeNull();
    expect(root.querySelector('.rf-pick__skip')?.textContent?.trim()).toBe('Reveal now');
    expect(root.querySelector('.rf-pick__done')).toBeNull();
  });

  it('turns the hand on a backdrop click instead of ignoring it', () => {
    roll();
    (root.querySelector('.rf-focus') as HTMLElement).click();
    fixture.detectChanges();
    expect(fixture.componentInstance.landed).toBeTrue();
    expect(fixture.componentInstance.chosen).toBe(0);
    expect(root.querySelector('.rf-pick__done')).toBeTruthy();
    // The reveal is still up — the click ended the wait, not the reveal.
    expect(root.querySelector('.rf-focus')).toBeTruthy();
    expect(audio.runeReveal).toHaveBeenCalledTimes(1);
  });

  it('turns the hand on Escape and on Enter while face-down', () => {
    roll();
    fixture.componentInstance.onEscape();
    fixture.detectChanges();
    expect(fixture.componentInstance.landed).toBeTrue();
    // A second Escape now dismisses, as before.
    fixture.componentInstance.onEscape();
    fixture.detectChanges();
    expect(root.querySelector('.rf-focus')).toBeNull();

    roll();
    fixture.componentInstance.onEnter(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.landed).toBeTrue();
  });

  it('leaves Enter to the focused card so the keyboard user turns the one they chose', () => {
    roll();
    const card = root.querySelectorAll('.rf-pick__card')[4] as HTMLButtonElement;
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    Object.defineProperty(ev, 'target', { value: card });
    fixture.componentInstance.onEnter(ev);
    expect(fixture.componentInstance.landed).toBeFalse();
    card.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.chosen).toBe(4);
  });

  it('binds data-reveal from the tier table once landed and colours the tier label', () => {
    nextFind = find('rare');
    roll();
    fixture.componentInstance.skipPick();
    fixture.detectChanges();
    const pick = root.querySelector('.rf-pick') as HTMLElement;
    expect(pick.getAttribute('data-reveal')).toBe(RUNE_TIERS.rare.reveal);
    expect(pick.style.getPropertyValue('--star-color')).toBe(RUNE_TIERS.rare.color);
    expect(root.querySelector('.rf-pick__card.is-chosen .rf-sparks--reveal')).toBeTruthy();
    expect(root.querySelector('.rf-pick__card.is-chosen .rf-pick__sweep')).toBeTruthy();
    expect(root.querySelector('.rf-pick__tier')?.textContent?.trim()).toBe('Rare');
  });

  it('runs the ladder: common is plain, mythic is flash', () => {
    roll();
    fixture.componentInstance.skipPick();
    fixture.detectChanges();
    expect(root.querySelector('.rf-pick')?.getAttribute('data-reveal')).toBe('plain');
    fixture.componentInstance.dismissFocus();
    fixture.detectChanges();

    nextFind = find('mythic');
    roll();
    fixture.componentInstance.skipPick();
    fixture.detectChanges();
    expect(root.querySelector('.rf-pick')?.getAttribute('data-reveal')).toBe('flash');
    expect(audio.runeReveal).toHaveBeenCalledWith(RUNE_TIERS.mythic.semitones, true);
    // Cleanup: the flare wrote to <html>; dismiss and let ngOnDestroy clear it.
    fixture.destroy();
    expect(document.documentElement.dataset['runeFlare']).toBeUndefined();
  });

  it('prints the whole haul under the card and can read the scroll', () => {
    nextFind = find('uncommon', { item: item(), scroll: scroll(), essence: 2 });
    roll();
    fixture.componentInstance.skipPick();
    fixture.detectChanges();

    const lines = root.querySelectorAll('.rf-pick__haul-line');
    expect(lines.length).toBe(3);
    expect(lines[0].textContent).toContain('Equippable');
    expect(lines[0].textContent).toContain('Ash Sigil');
    expect(lines[0].textContent).toContain('Gold/sec +1.3');
    expect((lines[0] as HTMLElement).style.getPropertyValue('--star')).toBe(RUNE_TIERS.rare.color);
    expect(lines[1].textContent).toContain('Lore scroll');
    expect(lines[1].textContent).toContain('The Sun That Dreamed');
    expect(lines[2].textContent).toContain('Eclipse Essence');
    expect(lines[2].textContent).toContain('+2');
    expect(audio.scrollUnfurl).toHaveBeenCalledTimes(1);

    const read = root.querySelector('.rf-pick__lore-btn') as HTMLButtonElement;
    expect(read.textContent?.trim()).toBe('Read the scroll');
    read.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.rf-pick__lore p').length).toBe(2);
    expect(scrolls.markRead).toHaveBeenCalledWith('s1');
    expect(root.querySelector('.rf-pick__lore-btn')?.textContent?.trim()).toBe('Fold the scroll');
  });

  it('shows no haul panel for a bare rune', () => {
    roll();
    fixture.componentInstance.skipPick();
    fixture.detectChanges();
    expect(root.querySelector('.rf-pick__haul')).toBeNull();
    expect(root.querySelector('.rf-pick__lore-btn')).toBeNull();
  });

  it('summarises a batch and marks its best card', () => {
    const queue = [
      find('common', { item: item() }),
      find('epic', { item: item({ id: 'i2' }), scroll: scroll() }),
      find('common'),
    ];
    let i = 0;
    (TestBed.inject(RuneForgeService) as any).strike = () => queue[i++];
    fixture.componentInstance.strikeMany(3);
    fixture.detectChanges();

    expect(root.querySelector('.rf-pick__haul-sum')?.textContent?.trim()).toBe('2 equippables · 1 scrolls · 0 explorers');
    const cards = root.querySelectorAll('.rf-pick--batch .rf-pick__card');
    expect(cards.length).toBe(3);
    expect(cards[1].classList.contains('is-best')).toBeTrue();
    expect(cards[0].classList.contains('is-best')).toBeFalse();
    expect(audio.runeReveal).toHaveBeenCalledWith(RUNE_TIERS.epic.semitones, true);
  });

  /**
   * Every batch card is `.is-chosen`, so a `data-reveal` on the pick would
   * fire the per-tier card rules on all ten in whichever tier came out LAST.
   * A common card must not hold Legendary's 1.06 scale and double ring, and
   * the is-best marker must survive an Uncommon last card. Computed styles,
   * not classes: the leak is a cascade bug, and only the cascade can show it.
   */
  it('keeps the batch grid plain when the last find is legendary', () => {
    const queue = [find('common'), find('common'), find('legendary')];
    let i = 0;
    (TestBed.inject(RuneForgeService) as any).strike = () => queue[i++];
    fixture.componentInstance.strikeMany(3);
    fixture.detectChanges();

    const pick = root.querySelector('.rf-pick') as HTMLElement;
    expect(pick.getAttribute('data-reveal')).toBeNull();
    const cards = Array.from(root.querySelectorAll('.rf-pick--batch .rf-pick__card')) as HTMLElement[];
    expect(cards.length).toBe(3);
    for (const card of cards) {
      const style = getComputedStyle(card);
      expect(style.animationName).withContext('no rfLandHeld/rfHaloHeld on a batch card').toBe('none');
      expect(style.transform).withContext('no held scale(1.06) on a batch card').toBe('none');
      expect(style.boxShadow).withContext('no legendary double ring on a batch card').not.toContain('0px 0px 0px 2px');
    }
    expect(cards[2].classList.contains('is-best')).toBeTrue();
    expect(getComputedStyle(cards[2]).boxShadow).toContain('0px 0px 0px 1px');
    expect(getComputedStyle(cards[0]).boxShadow).not.toContain('0px 0px 0px 1px');
  });

  it('keeps the is-best ring when the last find is uncommon and the best is epic', () => {
    const queue = [find('epic'), find('common'), find('uncommon')];
    let i = 0;
    (TestBed.inject(RuneForgeService) as any).strike = () => queue[i++];
    fixture.componentInstance.strikeMany(3);
    fixture.detectChanges();

    expect(root.querySelector('.rf-pick')?.getAttribute('data-reveal')).toBeNull();
    const cards = Array.from(root.querySelectorAll('.rf-pick--batch .rf-pick__card')) as HTMLElement[];
    expect(cards[0].classList.contains('is-best')).toBeTrue();
    // The is-best rule paints the ring in the card's own (library) colour and a
    // 32px halo mixed from it; the leak replaced the halo with uncommon's 36px
    // glow inherited from the pick. The common card does not animate rfLand+rfHalo.
    const hex = cards[0].style.getPropertyValue('--star-color').trim();
    const rgb = `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
    const bestShadow = getComputedStyle(cards[0]).boxShadow;
    expect(bestShadow).toContain(`${rgb} 0px 0px 0px 1px`);
    expect(bestShadow).toContain('0px 0px 32px -6px');
    expect(bestShadow).not.toContain(RUNE_TIERS.uncommon.glow.replace(/,\s*/g, ', '));
    expect(getComputedStyle(cards[1]).animationName).toBe('none');
    expect(getComputedStyle(cards[1]).boxShadow).not.toContain('0px 0px 0px 1px');
  });

  it('clears the haul when the reveal is dismissed', () => {
    nextFind = find('uncommon', { item: item() });
    roll();
    fixture.componentInstance.skipPick();
    fixture.detectChanges();
    expect(fixture.componentInstance.haul.length).toBe(1);
    fixture.componentInstance.dismissFocus();
    fixture.detectChanges();
    expect(fixture.componentInstance.haul.length).toBe(0);
    expect(root.querySelector('.rf-focus')).toBeNull();
  });
});
