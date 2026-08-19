import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
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
import { AUTO_STEP_MS } from './rune-reel';

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
  // Hoisted so a test can drain the purse mid-run: auto-roll stopping on Gold
  // is only observable if the Gold can actually move.
  let gold$: BehaviorSubject<{ gold: number }>;
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
    gold$ = new BehaviorSubject({ gold: STRIKE_COST * 100 });
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

  it('lands one face-up card on the strike, with no hand to pick from', () => {
    roll();
    expect(root.querySelector('.rf-focus')).toBeTruthy();
    expect(fixture.componentInstance.landed).toBeTrue();
    // One card, not ten, and nothing to click before the rune is legible.
    expect(root.querySelectorAll('.rf-pick__card').length).toBe(1);
    expect(root.querySelector('.rf-pick__skip')).toBeNull();
    expect(root.querySelector('.rf-pick__done')).toBeTruthy();
    expect(audio.runeReveal).toHaveBeenCalledTimes(1);
  });

  it('dismisses on a backdrop click and on Escape', () => {
    roll();
    (root.querySelector('.rf-focus') as HTMLElement).click();
    fixture.detectChanges();
    expect(root.querySelector('.rf-focus')).toBeNull();

    roll();
    fixture.componentInstance.onEscape();
    fixture.detectChanges();
    expect(root.querySelector('.rf-focus')).toBeNull();
  });

  it('binds data-reveal from the tier table once landed and colours the tier label', () => {
    nextFind = find('rare');
    roll();
    const pick = root.querySelector('.rf-pick') as HTMLElement;
    expect(pick.getAttribute('data-reveal')).toBe(RUNE_TIERS.rare.reveal);
    expect(pick.style.getPropertyValue('--star-color')).toBe(RUNE_TIERS.rare.color);
    expect(root.querySelector('.rf-pick__card.is-chosen .rf-sparks--reveal')).toBeTruthy();
    expect(root.querySelector('.rf-pick__card.is-chosen .rf-pick__sweep')).toBeTruthy();
    expect(root.querySelector('.rf-pick__tier')?.textContent?.trim()).toBe('Rare');
  });

  it('runs the ladder: common is plain, mythic is flash', () => {
    roll();
    expect(root.querySelector('.rf-pick')?.getAttribute('data-reveal')).toBe('plain');
    fixture.componentInstance.dismissFocus();
    fixture.detectChanges();

    nextFind = find('mythic');
    roll();
    expect(root.querySelector('.rf-pick')?.getAttribute('data-reveal')).toBe('flash');
    expect(audio.runeReveal).toHaveBeenCalledWith(RUNE_TIERS.mythic.semitones, true);
    // Cleanup: the celebration writes to <html> and appends a layer to <body>;
    // ngOnDestroy has to take both back, or a route change mid-Mythic leaves
    // them on the page the player navigated to.
    fixture.destroy();
    expect(document.documentElement.dataset['gfSlowmo']).toBeUndefined();
    expect(document.documentElement.classList.contains('gf-distorting')).toBe(false);
    expect(document.querySelector('.gf-fx')).toBeNull();
  });

  it('prints the whole haul under the card and can read the scroll', () => {
    nextFind = find('uncommon', { item: item(), scroll: scroll(), essence: 2 });
    roll();

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
    expect(fixture.componentInstance.haul.length).toBe(1);
    fixture.componentInstance.dismissFocus();
    fixture.detectChanges();
    expect(fixture.componentInstance.haul.length).toBe(0);
    expect(root.querySelector('.rf-focus')).toBeNull();
  });

  describe('rapid fire', () => {
    it('rolls again from the result, without dismissing it first', () => {
      roll();
      expect(root.querySelector('.rf-focus')).toBeTruthy();
      const again = root.querySelector('.rf-acts__btn--again') as HTMLButtonElement;
      expect(again).toBeTruthy();

      nextFind = find('rare');
      again.click();
      fixture.detectChanges();

      // Same panel, new rune. The reveal never closed.
      expect(root.querySelector('.rf-focus')).toBeTruthy();
      expect(root.querySelectorAll('.rf-pick__card').length).toBe(1);
      expect(root.querySelector('.rf-pick__tier')?.textContent?.trim()).toBe('Rare');
      // Second pull of the sitting, so the ceremony is cut short.
      expect(root.querySelector('.rf-pick')?.classList.contains('rf-pick--rapid')).toBeTrue();
    });

    it('leaves the first pull dramatic and only shortens the repeats', () => {
      roll();
      expect(root.querySelector('.rf-pick')?.classList.contains('rf-pick--rapid')).toBeFalse();
      fixture.componentInstance.strike();
      fixture.detectChanges();
      expect(root.querySelector('.rf-pick')?.classList.contains('rf-pick--rapid')).toBeTrue();
      // Dismissing ends the sitting, so the next one is dramatic again.
      fixture.componentInstance.dismissFocus();
      roll();
      expect(root.querySelector('.rf-pick')?.classList.contains('rf-pick--rapid')).toBeFalse();
    });

    it('auto-roll stops on the first Rare rather than rolling past it', fakeAsync(() => {
      fixture.componentInstance.toggleAuto();
      fixture.detectChanges();
      expect(fixture.componentInstance.autoOn).toBeTrue();

      tick(AUTO_STEP_MS);
      expect(fixture.componentInstance.autoOn).toBeTrue();

      nextFind = find('rare');
      tick(AUTO_STEP_MS);
      fixture.detectChanges();
      expect(fixture.componentInstance.autoOn).toBeFalse();
      expect(fixture.componentInstance.autoStopped).toBe('find');
      expect(root.querySelector('.rf-acts__note')?.textContent).toContain('Rare');
      // The find it stopped for is the one on screen.
      expect(root.querySelector('.rf-pick__tier')?.textContent?.trim()).toBe('Rare');
    }));

    it('auto-roll stops when the purse runs dry', fakeAsync(() => {
      fixture.componentInstance.toggleAuto();
      tick(AUTO_STEP_MS);
      gold$.next({ gold: 0 });
      fixture.detectChanges();
      tick(AUTO_STEP_MS);
      fixture.detectChanges();

      expect(fixture.componentInstance.autoOn).toBeFalse();
      expect(fixture.componentInstance.autoStopped).toBe('gold');
      expect(root.querySelector('.rf-acts__note--broke')).toBeTruthy();
      // The last find stays up — running out of Gold is not a reason to clear
      // the screen the player is reading.
      expect(root.querySelector('.rf-focus')).toBeTruthy();
    }));

    it('a bulk run tallies by tier, rarest first', fakeAsync(() => {
      const queue = ['common', 'common', 'uncommon', 'common', 'rare'].map(t => find(t));
      let i = 0;
      (TestBed.inject(RuneForgeService) as any).strike = () => queue[i++] ?? null;
      fixture.componentInstance.strikeMany(5);
      tick(50);
      fixture.detectChanges();

      expect(fixture.componentInstance.rolling).toBeFalse();
      const rows = Array.from(root.querySelectorAll('.rf-pick__tally-row')).map(n => n.textContent?.replace(/\s+/g, ' ').trim());
      expect(rows).toEqual(['1 Rare', '1 Uncommon', '3 Common']);
    }));

    it('past the grid cap it draws the best find instead of every card', fakeAsync(() => {
      let i = 0;
      (TestBed.inject(RuneForgeService) as any).strike = () => (i++ === 7 ? find('epic') : find('common'));
      fixture.componentInstance.strikeMany(20);
      tick(50);
      fixture.detectChanges();

      expect(fixture.componentInstance.batchCount).toBe(20);
      // Past the cap the finds are counted, not kept.
      expect(fixture.componentInstance.batchCards.length).toBe(fixture.componentInstance.gridCap);
      expect(root.querySelectorAll('.rf-pick__card').length).toBe(1);
      expect(root.querySelector('.rf-pick__card')?.classList.contains('is-best')).toBeTrue();
    }));

    it('never rolls more than the purse allows', () => {
      // 100 strikes' worth of Gold in the stub.
      expect(fixture.componentInstance.affordableRolls(10)).toBe(10);
      expect(fixture.componentInstance.affordableRolls(1000)).toBe(100);
    });

    it('ALL spends the whole purse, however deep it is', () => {
      // The bug: ALL used to be clamped to BULK_CAP (1000), so a purse holding
      // forty thousand strikes' worth offered ALL and then spent 2.5% of it.
      gold$.next({ gold: STRIKE_COST * 40_000 });
      fixture.detectChanges();
      expect(fixture.componentInstance.allRolls).toBe(40_000);
      expect(fixture.componentInstance.affordableRolls(40_000)).toBe(40_000);
      // And the label stays short enough for the chip it is drawn in.
      expect(fixture.componentInstance.allRollsLabel.length).toBeLessThanOrEqual(5);
    });

    it('ALL rounds down to whole strikes and never goes negative', () => {
      gold$.next({ gold: STRIKE_COST * 3 + STRIKE_COST / 2 });
      fixture.detectChanges();
      expect(fixture.componentInstance.allRolls).toBe(3);
      gold$.next({ gold: 0 });
      fixture.detectChanges();
      expect(fixture.componentInstance.allRolls).toBe(0);
    });

    it('a bulk run that cannot afford a single strike says so and rolls nothing', () => {
      gold$.next({ gold: 0 });
      fixture.detectChanges();
      fixture.componentInstance.strikeMany(10);
      fixture.detectChanges();
      expect(fixture.componentInstance.batchCount).toBe(0);
      expect(fixture.componentInstance.broke).toBeTrue();
    });
  });
});
