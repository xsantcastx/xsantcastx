import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, Subject } from 'rxjs';

import { ComboService } from './combo.service';
import { EconomyService } from './economy.service';
import { ForgeAudioService } from './forge-audio.service';
import { FORGE_BULK, ForgeFlameComponent } from './forge-flame.component';
import { FORGE_MODE_KEY } from './forge-mode.service';
import { IdleService } from '../idle/idle.service';
import { RuneForgeService } from '../rune-forge/rune-forge.service';
import { RUNES, RUNE_TIERS, STRIKE_COST } from '../rune-forge/rune.model';

/**
 * The second face, from the component's side of every service boundary.
 *
 * The rune forge is a literal that hands back whatever find the spec queued, so
 * a Common, a Rare and an empty purse can all be forced without touching the
 * drop table or spending anything. What is being tested is the fork: which
 * ledger a click reaches, what it puts on screen, and — the part most worth
 * pinning down — which ledgers it must NOT reach.
 */
describe('ForgeFlameComponent — the anvil face', () => {
  let fixture: ComponentFixture<ForgeFlameComponent>;
  let root: HTMLElement;
  let cmp: ForgeFlameComponent;

  /** Runes the fake anvil will hand back, in order. Empty means "no Gold". */
  let queued: any[];
  let gold$: BehaviorSubject<any>;

  const audio = {
    strike: jasmine.createSpy('strike'),
    coin: jasmine.createSpy('coin'),
    century: jasmine.createSpy('century'),
    runeReveal: jasmine.createSpy('runeReveal'),
    voidRumble: jasmine.createSpy('voidRumble'),
    comboTier: jasmine.createSpy('comboTier'),
    comboImpact: jasmine.createSpy('comboImpact'),
    comboAscension: jasmine.createSpy('comboAscension'),
    comboNameless: jasmine.createSpy('comboNameless'),
  };
  const idle = { strike: jasmine.createSpy('idleStrike') };
  const economyStrike = jasmine.createSpy('economyStrike');
  const comboStrike = jasmine.createSpy('comboStrike');
  const runeStrike = jasmine.createSpy('runeStrike');

  const runeOf = (tier: string) => RUNES.find(r => r.tier === tier)!;
  const find = (tier: string, over: Record<string, unknown> = {}) => ({
    rune: runeOf(tier), held: 1, copies: 1, isNew: false,
    essence: 0, scroll: null, item: null, explorer: null, ...over,
  });

  const snapshot = (gold: number) => ({
    gold, essence: 0, perSecond: 0, perClick: 1, autoPerSecond: 0,
    flameTier: 0, hammerVisual: 'none', runewords: [],
  });

  beforeEach(async () => {
    Object.values(audio).concat([idle.strike, economyStrike, comboStrike, runeStrike])
      .forEach(spy => (spy as jasmine.Spy).calls.reset());
    queued = [];
    localStorage.removeItem(FORGE_MODE_KEY);

    gold$ = new BehaviorSubject(snapshot(STRIKE_COST * 100));
    runeStrike.and.callFake(() => queued.shift() ?? null);
    economyStrike.and.returnValue({ gold: 1, count: 1, century: false, millennium: false });
    comboStrike.and.returnValue({ count: 1, tier: null, best: 0 });

    await TestBed.configureTestingModule({
      imports: [ForgeFlameComponent, RouterTestingModule],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ForgeAudioService, useValue: audio },
        { provide: IdleService, useValue: idle },
        {
          provide: EconomyService,
          useValue: {
            init: () => undefined,
            snapshot$: gold$.asObservable(),
            get snapshot() { return gold$.value; },
            autoStrike$: new Subject<void>().asObservable(),
            strike: economyStrike,
          },
        },
        {
          provide: ComboService,
          useValue: {
            snapshot$: new BehaviorSubject({ count: 0, tier: null, best: 0 }).asObservable(),
            get snapshot() { return { count: 0, tier: null, best: 0 }; },
            event$: new Subject().asObservable(),
            strike: comboStrike,
          },
        },
        {
          provide: RuneForgeService,
          useValue: { init: () => undefined, strike: runeStrike },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgeFlameComponent);
    cmp = fixture.componentInstance;
    fixture.detectChanges();
    root = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => localStorage.removeItem(FORGE_MODE_KEY));

  function toggle(): void {
    (root.querySelector('.ff__mode') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function press(): void {
    (root.querySelector('.ff__btn') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  // ── The switch ─────────────────────────────────────────────────────────────

  it('starts on Gold and flips to the anvil, persisting the choice', () => {
    expect(root.querySelector('.ff')!.getAttribute('data-mode')).toBe('gold');
    expect(root.querySelector('.ff__mode')!.getAttribute('aria-checked')).toBe('false');
    expect(root.querySelector('.ff__bulk')).toBeNull();

    toggle();

    expect(root.querySelector('.ff')!.getAttribute('data-mode')).toBe('anvil');
    expect(root.querySelector('.ff__mode')!.getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem(FORGE_MODE_KEY)).toBe('anvil');
    // x10 belongs to the anvil and appears with it.
    expect(root.querySelector('.ff__bulk')).toBeTruthy();
  });

  it('carries both faces in the DOM at once, so the flip has something to turn', () => {
    expect(root.querySelector('.ff__face')).toBeTruthy();
    expect(root.querySelectorAll('.ff__side').length).toBe(2);
    expect(root.querySelector('.ff__side--gold .ff__glyph')).toBeTruthy();
    expect(root.querySelector('.ff__side--anvil .ff__anvil')).toBeTruthy();
  });

  // ── Which ledger a click reaches ───────────────────────────────────────────

  it('pays Gold on the Gold face and never touches the rune ledger', () => {
    press();
    expect(economyStrike).toHaveBeenCalledTimes(1);
    expect(idle.strike).toHaveBeenCalledTimes(1);
    expect(runeStrike).not.toHaveBeenCalled();
  });

  it('strikes the anvil on the anvil face and never touches the Gold strike, the idle XP or the combo record', () => {
    queued = [find('common')];
    toggle();
    press();

    expect(runeStrike).toHaveBeenCalledTimes(1);
    expect(economyStrike).not.toHaveBeenCalled();
    // The rune ledger awards its own craft XP; paying idle XP as well would
    // make the anvil the cheapest XP on the site.
    expect(idle.strike).not.toHaveBeenCalled();
    // The combo ladder counts Gold strikes at the economy's two-a-second
    // ceiling. The anvil has no cooldown and a x10 button, so it must never
    // write to the persisted high-water mark.
    expect(comboStrike).not.toHaveBeenCalled();
  });

  // ── The haul ───────────────────────────────────────────────────────────────

  it('names the rune in its own rarity colour', () => {
    queued = [find('rare')];
    toggle();
    press();

    const drop = root.querySelector('.ff__loot') as HTMLElement;
    expect(drop).toBeTruthy();
    expect(drop.textContent!.trim()).toContain(runeOf('rare').name);
    expect(drop.style.getPropertyValue('--loot-color')).toBe(RUNE_TIERS.rare.color);
  });

  it('flags a first find and a sheared second copy', () => {
    queued = [find('common', { isNew: true, copies: 2 })];
    toggle();
    press();

    const drop = root.querySelector('.ff__loot') as HTMLElement;
    expect(drop.querySelector('.ff__loot-new')).toBeTruthy();
    expect(drop.textContent).toContain('2');
  });

  it('makes Rare and above an event: bigger, haloed, and a flash of the screen', () => {
    queued = [find('rare')];
    toggle();
    press();

    expect(root.querySelector('.ff__loot')!.classList).toContain('ff__loot--grand');
    expect(root.querySelector('.fx')!.getAttribute('data-burst')).toBe('flash');
    expect(audio.runeReveal).toHaveBeenCalled();
  });

  it('leaves a Common quiet — no halo, no flash', () => {
    queued = [find('common')];
    toggle();
    press();

    expect(root.querySelector('.ff__loot')!.classList).not.toContain('ff__loot--grand');
    expect(root.querySelector('.fx')).toBeNull();
  });

  it('stacks a bulk run upward so the whole haul stays on screen', () => {
    queued = Array.from({ length: FORGE_BULK }, () => find('common'));
    toggle();
    (root.querySelector('.ff__bulk') as HTMLButtonElement).click();
    fixture.detectChanges();

    const drops = Array.from(root.querySelectorAll('.ff__loot')) as HTMLElement[];
    expect(drops.length).toBe(FORGE_BULK);
    expect(runeStrike).toHaveBeenCalledTimes(FORGE_BULK);
    // Every offset above the first is negative: the column builds away from
    // the ember, which sits a couple of dozen pixels off the bottom edge.
    const offsets = drops.map(d => parseFloat(d.style.getPropertyValue('--dy')));
    expect(offsets[0]).toBe(0);
    expect(offsets[offsets.length - 1]).toBeLessThan(0);
    expect(offsets.every((v, i) => i === 0 || v < offsets[i - 1])).toBeTrue();
    // One sound for the run, not ten inside a frame.
    expect(audio.runeReveal).toHaveBeenCalledTimes(1);
  });

  it('banks what the purse could pay for when a bulk run dries up mid-way', () => {
    queued = [find('common'), find('common'), find('common')];
    toggle();
    (root.querySelector('.ff__bulk') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(root.querySelectorAll('.ff__loot').length).toBe(3);
    expect(root.querySelector('.ff')!.classList).not.toContain('ff--broke');
  });

  // ── Refused ────────────────────────────────────────────────────────────────

  it('shakes and says so when the purse cannot cover a strike', () => {
    queued = [];
    toggle();
    press();

    expect(root.querySelectorAll('.ff__loot').length).toBe(0);
    expect(cmp.announcement).toContain('Not enough Gold');
  });

  it('disables x10 and reddens the cost line below one strike', () => {
    gold$.next(snapshot(STRIKE_COST - 1));
    toggle();

    expect((root.querySelector('.ff__bulk') as HTMLButtonElement).disabled).toBeTrue();
    expect(root.querySelector('.ff__hud-cost')!.classList).toContain('ff__hud-cost--broke');

    gold$.next(snapshot(STRIKE_COST));
    fixture.detectChanges();
    expect((root.querySelector('.ff__bulk') as HTMLButtonElement).disabled).toBeFalse();
    expect(root.querySelector('.ff__hud-cost')!.classList).not.toContain('ff__hud-cost--broke');
  });

  // ── The counter ────────────────────────────────────────────────────────────

  it('counts a run of anvil strikes and labels it FORGE', () => {
    queued = [find('common'), find('common'), find('common')];
    toggle();
    press(); press(); press();

    const badge = root.querySelector('.ff__combo') as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.querySelector('.ff__combo-word')!.textContent).toBe('FORGE');
    expect(badge.textContent!.replace(/\s+/g, '')).toContain('x3');
  });

  it('ends the run when the face changes', () => {
    queued = [find('common'), find('common')];
    toggle();
    press(); press();
    expect(root.querySelector('.ff__combo')).toBeTruthy();

    toggle();
    expect(root.querySelector('.ff__combo')).toBeNull();
  });

  it('ends the run when the anvil refuses', () => {
    queued = [find('common'), find('common')];
    toggle();
    press(); press();
    expect(root.querySelector('.ff__combo')).toBeTruthy();

    press(); // nothing queued — the purse is empty
    fixture.detectChanges();
    expect(root.querySelector('.ff__combo')).toBeNull();
  });
});
