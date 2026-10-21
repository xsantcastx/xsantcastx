/**
 * keeper-maker.component.ts — "Make your Keeper", at the Glass of Becoming.
 *
 * One live preview of the in-game pixel Keeper (the same painter the world
 * uses, wearing what the player wears now), a name, nine ‹ › choices, a
 * "Surprise me" and ONE primary button: "Become this Keeper". Nothing is saved
 * until that button (the save goes through KeeperLookService → the gateway).
 *
 * Hosted in the play view's place panel (it pauses the world) on a new save,
 * from the Places list, or from the one gentle nudge. Phone-first: one column,
 * every control 44px.
 */
import { AfterViewInit, Component, ElementRef, EventEmitter, NgZone, OnDestroy, OnInit, Output, PLATFORM_ID, ViewChild, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { TranslationService } from '../../translation.service';
import { InventoryService } from '../rpg/inventory.service';
import { KEEPER_LOOK_I18N } from './keeper-look.i18n';
import { KeeperLookService } from './keeper-look.service';
import { KeeperLook, LOOK_FIELDS, type Vocation, LookField, NAME_MAX, cleanName, fieldOptions, fieldSwatch, lookKey, randomLook, stepLook } from './keeper-look.model';
import { KeeperPainter, PaintState } from './keeper-paint';
import { KeeperGear, gearKey, keeperAction } from './keeper-gear';
import { wornGear } from './worn-gear';
import { vocationLook } from './vocation-look';

/** The preview's loop: stand, run, swing. Seconds. */
const LOOP = [{ action: 'idle', for: 1.8 }, { action: 'run', for: 1.6 }, { action: 'attack', for: .55 }, { action: 'idle', for: .6 }] as const;
const LOOP_TOTAL = LOOP.reduce((sum, step) => sum + step.for, 0);

@Component({
  selector: 'app-keeper-maker',
  standalone: true,
  templateUrl: './keeper-maker.component.html',
  styleUrls: ['./keeper-maker.component.css'],
})
export class KeeperMakerComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly i18n = inject(TranslationService);
  private readonly looks = inject(KeeperLookService);
  private readonly inventory = inject(InventoryService);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Fired after "Become this Keeper" saved: the host closes the place. */
  @Output() readonly done = new EventEmitter<KeeperLook>();
  @ViewChild('preview') preview?: ElementRef<HTMLCanvasElement>;

  readonly fields = LOOK_FIELDS;
  readonly nameMax = NAME_MAX;
  draft: KeeperLook = this.looks.look;
  gear: KeeperGear = {};
  saved = false;
  private painter: KeeperPainter | null = null;
  private painterFor = '';
  private raf = 0;
  private start = 0;
  private sub?: Subscription;
  private reduced = false;

  /** A made Keeper keeps the calling they were made with (their trees and bar are that class's); a new one chooses. */
  readonly locked = this.looks.look.made;
  setVocation(v: Vocation): void {
    if (this.locked && v !== this.looks.look.vocation) return;
    this.draft = { ...this.draft, vocation: v }; this.saved = false;
    this.repaintStill();
  }

  ngOnInit(): void {
    this.i18n.register(KEEPER_LOOK_I18N);
    this.inventory.init();
    this.sub = this.inventory.snapshot$.subscribe(snap => { this.gear = wornGear(snap.equipped); this.painter = null; });
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.reduced = matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.start = performance.now();
    this.zone.runOutsideAngular(() => {
      const tick = (now: number) => { this.paint((now - this.start) / 1000); this.raf = this.reduced ? 0 : requestAnimationFrame(tick); };
      this.raf = requestAnimationFrame(tick);
    });
  }

  ngOnDestroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.sub?.unsubscribe();
  }

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  /** The painting key on the preview (for tests: changes whenever the look or the gear does). */
  get previewKey(): string { return `${lookKey(this.draft)}#${gearKey(this.gear)}#${this.draft.vocation}`; }

  fieldLabel(field: LookField): string { return this.t(`look.field.${field}`); }
  valueLabel(field: LookField): string {
    const value = this.draft[field];
    if (typeof value === 'string') return this.t(`look.${field === 'body' ? 'body' : field === 'hair' ? 'hair' : field === 'eyes' ? 'eyes' : 'face'}.${value}`);
    return this.t('look.swatch', { n: value + 1, total: fieldOptions(field).length });
  }
  swatch(field: LookField): string | null { return fieldSwatch(field, this.draft[field]); }

  step(field: LookField, by: number): void {
    this.draft = stepLook(this.draft, field, by);
    this.saved = false;
    this.repaintStill();
  }
  surprise(): void {
    this.draft = randomLook(Math.random, this.draft);
    this.saved = false;
    this.repaintStill();
  }
  setName(value: string): void {
    this.draft = { ...this.draft, name: value.slice(0, NAME_MAX) };
    this.saved = false;
  }
  keep(): void {
    const look = { ...this.draft, name: cleanName(this.draft.name) };
    this.looks.choose(look);
    this.draft = this.looks.look;
    this.saved = true;
    this.done.emit(this.draft);
  }

  private repaintStill(): void {
    this.painter = null;
    if (this.reduced) this.paint(0);
  }

  private paint(seconds: number): void {
    const el = this.preview?.nativeElement;
    const c = el?.getContext('2d');
    if (!el || !c) return;
    const key = this.previewKey;
    // The class shows in the preview too (the undead Warlock's garb and hood).
    const v = vocationLook(this.draft.vocation, this.gear);
    if (!this.painter || this.painterFor !== key) { this.painter = new KeeperPainter(this.draft, v.gear, v.garb); this.painterFor = key; }
    let at = this.reduced ? 0 : seconds % LOOP_TOTAL;
    let step: typeof LOOP[number] = LOOP[0];
    for (const s of LOOP) { if (at < s.for) { step = s; break; } at -= s.for; }
    const state: PaintState = {
      action: keeperAction(step.action), time: seconds, attackT: step.action === 'attack' ? Math.min(1, at / step.for) : 0,
      reduced: this.reduced, weapon: true,
    };
    c.clearRect(0, 0, el.width, el.height);
    // The chibi Keeper is ~31 art px tall: frame 40 art px (6 px each on the 240 canvas) so it fills the glass.
    const scale = Math.max(1, Math.floor(el.width / 40));
    c.save();
    c.translate(el.width / 2, el.height - scale * 2);
    this.painter.draw(c, scale, state);
    c.restore();
    el.setAttribute('data-look-key', key);
  }
}
