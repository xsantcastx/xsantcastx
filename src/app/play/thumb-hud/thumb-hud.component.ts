/**
 * thumb-hud.component.ts — the portrait phone's thumb-zone HUD (docs/design/ui-pass-3.md §A.2; Diablo Immortal's skill
 * arc, Genshin's context button, OSRS mobile's ticker and Paimon menu, made cozy).
 *
 * Right thumb: a round wooden disc (Attack, or the verb in reach: Enter, Talk, Loot, Take, Read) with the four skill
 * keys on a quarter arc round it and a ⇅ chip that swaps them between keys 1–4 and 5–8. Left thumb: the belt as a
 * column (Health, Mana, Spellstone) over the bag row (Bag, Map, More). Top band: the face chip, the ticker (Glim's
 * lines, loot, the area, what is in reach, chat). ☰ More opens a tile sheet of everything rare.
 *
 * Like the desktop bar (play/hud-bar) it owns no game state: it reads the play view (`hud`) and calls its methods, so
 * cooldowns, counts and titles stay the HUD's. The classes the specs know (.td-skills .td-skill .td-belt .td-pot
 * .td-stone) are kept. Every control here is marked data-world-rail (nameplates steer round it, dirfix.md).
 */
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import type { SideScrollerComponent } from '../side-scroller.component';
import { DropTargetDirective } from '../../shared/inventory-grid/drop-target.directive';
import { iconOf } from '../../shared/art/item-icons';
import type { IconKind } from '../../shared/art/item-icon-shapes';

/** Each More tile's 16-px pixel icon (the item icon set, drawn at 2× in a 32 px well): never a flat swatch. */
const TILE_ICON: Readonly<Record<string, readonly [IconKind, string]>> = {
  book: ['book', 'amethyst'], character: ['helm', 'steel'], journal: ['scroll', 'paper'], chat: ['quill', 'ivory'],
  friends: ['heart', 'rose'], bestiary: ['crest', 'crimson'], settings: ['gear', 'brass'], loot: ['chest', 'wood'],
  names: ['lens', 'glass'], lore: ['inkwell', 'midnight'], account: ['key', 'gold'], feedback: ['page', 'paper'],
  menu: ['compass', 'brass'], slate: ['mirror', 'glass'],
};
const tileArt = new Map<string, string>();
function tileIcon(id: string): string {
  let src = tileArt.get(id);
  if (src === undefined) {
    const k = TILE_ICON[id];
    try { src = k ? iconOf(k[0], k[1] as never).src : ''; } catch { src = ''; }
    tileArt.set(id, src);
  }
  return src;
}

/** The verb the disc shows. */
export type ThumbVerb = 'attack' | 'enter' | 'talk' | 'loot' | 'take' | 'read' | 'use' | 'strike';

/** One ticker line. */
export interface TickerLine { key: string; kind: 'glim' | 'area' | 'armed' | 'log' | 'chat'; text: string; who?: string }

/** A More tile. */
interface Tile { id: string; label: string; badge: boolean; pressed?: boolean; go: () => void; icon?: string }

/** A ticker log line lives this long (ms). */
export const TICKER_MS = 6000;

/**
 * The ticker's lines, top first, at most `max`: Glim (or the speaker riding his line), the area title, what is in
 * reach, then the newest log and chat lines of the last six seconds. Pure, for the spec.
 */
export function tickerLines(src: {
  glim?: { key: string; who: string; text: string } | null;
  area?: string | null;
  armed?: string | null;
  log: readonly { key: number; at: number; text: string }[];
  chat?: readonly { id: string; at: number; name: string; text: string }[];
  now: number; max: number;
}): TickerLine[] {
  // While Glim speaks he has the whole ticker (the reach line, the area and the log yield): his line is never cut.
  if (src.glim) return [{ key: `g${src.glim.key}`, kind: 'glim', who: src.glim.who, text: src.glim.text }];
  const out: TickerLine[] = [];
  if (src.area) out.push({ key: `a${src.area}`, kind: 'area', text: src.area });
  if (src.armed) out.push({ key: `p${src.armed}`, kind: 'armed', text: src.armed });
  const fresh = [
    ...src.log.filter(l => src.now - l.at < TICKER_MS).map(l => ({ at: l.at, line: { key: `l${l.key}`, kind: 'log' as const, text: l.text } })),
    ...(src.chat ?? []).filter(m => src.now - m.at < TICKER_MS).map(m => ({ at: m.at, line: { key: `c${m.id}`, kind: 'chat' as const, who: m.name, text: m.text } })),
  ].sort((a, b) => b.at - a.at).map(x => x.line);
  // The stage lines already said (an armed prompt is also logged as a message): never twice.
  for (const l of fresh) if (!out.some(o => o.text === l.text)) out.push(l);
  return out.slice(0, src.max);
}

@Component({
  selector: 'app-thumb-hud',
  standalone: true,
  imports: [DropTargetDirective],
  changeDetection: ChangeDetectionStrategy.Default,
  templateUrl: './thumb-hud.component.html',
  styleUrls: ['./thumb-hud.component.css'],
})
export class ThumbHudComponent implements OnInit, OnDestroy {
  @Input({ required: true }) hud!: SideScrollerComponent;
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private tick?: ReturnType<typeof setInterval>;
  now = Date.now();
  /** The skill page: 0 shows keys 1–4 on the arc, 1 shows 5–8. */
  page = 0;
  moreOpen = false;
  /** The disc's long-press fan (Attack / the verb), for the rare moment both are near. */
  fan = false;
  private discTimer?: ReturnType<typeof setTimeout>;
  private discLong = false;
  private keyTimer?: ReturnType<typeof setTimeout>;
  private keyLong = false;

  ngOnInit(): void {
    // The ticker's lines fade after six seconds: a slow clock re-reads them (no clock at all on the server).
    if (typeof window !== 'undefined') this.zone.runOutsideAngular(() => { this.tick = setInterval(() => this.zone.run(() => { this.now = Date.now(); this.moreNews = this.tiles.some(t => t.badge); this.cdr.markForCheck(); }), 1000); });
  }
  ngOnDestroy(): void { clearInterval(this.tick); clearTimeout(this.discTimer); clearTimeout(this.keyTimer); }

  t(key: string, params?: Record<string, string | number>): string { return this.hud.t(key, params); }

  get compact(): boolean { return this.hud.thumbCompact; }
  get slots(): readonly number[] { return this.page ? [5, 6, 7, 8] : [1, 2, 3, 4]; }
  get hasPage2(): boolean { return this.hud.tdAbilities.some(a => Number(a.key) > 4); }
  ability(n: number) { return this.hud.tdAbilities.find(a => a.key === String(n)) ?? null; }
  flipPage(): void { this.page = this.page ? 0 : 1; this.hud.thumbSfx('tap'); }

  // ── The skill keys: a tap casts; a long-press opens the Skill Book (it never casts) ──
  keyDown(): void { this.keyLong = false; clearTimeout(this.keyTimer); this.keyTimer = setTimeout(() => { this.keyLong = true; this.hud.toggleSpellbook(); }, 500); }
  keyUp(): void { clearTimeout(this.keyTimer); }
  keyTap(n: number): void { if (this.keyLong) { this.keyLong = false; return; } const a = this.ability(n); if (a) this.hud.useAbility(a.key); }

  // ── The disc: Attack while a hostile is near, else the verb in reach ──
  get verb(): ThumbVerb { return this.hud.thumbVerb; }
  get verbLabel(): string { return this.t('thumb.verb.' + this.verb); }
  /** Both a hostile and something to do are near: a long-press fans the two. */
  get both(): boolean { return this.verb === 'attack' && this.hud.thumbArmedVerb !== null; }
  discDown(ev: PointerEvent): void {
    this.discLong = false;
    clearTimeout(this.discTimer);
    if (this.both) this.discTimer = setTimeout(() => { this.discLong = true; this.fan = true; this.hud.input(ev, 'attack', false); }, 450);
    if (this.verb === 'attack') this.hud.input(ev, 'attack', true);
    else { ev.preventDefault(); }
  }
  discUp(ev: PointerEvent): void {
    clearTimeout(this.discTimer);
    if (this.verb === 'attack') { this.hud.input(ev, 'attack', false); return; }
    if (!this.discLong && ev.type === 'pointerup') { if (this.verb === 'loot') this.hud.openNearby(); else this.hud.interact(); }
  }
  discCancel(ev: PointerEvent): void { clearTimeout(this.discTimer); if (this.verb === 'attack') this.hud.input(ev, 'attack', false); }
  fanAttack(ev: PointerEvent): void { this.fan = false; this.hud.input(ev, 'attack', true); setTimeout(() => this.hud.input(ev, 'attack', false), 180); }
  fanVerb(): void { this.fan = false; if (this.hud.thumbArmedVerb === 'loot') this.hud.openNearby(); else this.hud.interact(); }
  get armedLabel(): string { const v = this.hud.thumbArmedVerb; return v ? this.t('thumb.verb.' + v) : ''; }

  // ── The ticker ──
  get lines(): TickerLine[] {
    const h = this.hud;
    const say = h.glimVoice.speech;
    const glim = say ? { key: String(say.seq), who: h.sayer?.name ?? h.glimNpc?.name ?? 'Glim', text: h.t(say.key, say.vars) } : null;
    const card = h.areaCard;
    const area = card ? [card.title, card.danger ? h.t('play.zone.danger') : h.t('thumb.safe'), h.skyClock].filter(Boolean).join(' · ') : null;
    const armed = h.state?.nearby || h.fishPrompt ? h.actionLabel : null;
    const chat = h.chatSetting === 'on' ? h.social.messages.filter(m => !h.muted.has(m.playerId)).slice(-3).map(m => ({ id: m.id, at: m.at, name: m.name, text: m.text })) : [];
    return tickerLines({ glim, area, armed, log: h.gameLog.slice(-6), chat, now: this.now, max: this.compact ? 2 : 3 });
  }
  tapLine(ev: Event, line: TickerLine): void {
    ev.stopPropagation();
    if (line.kind === 'glim') { this.hud.openGlimChat(); return; }
    this.openChat();
  }
  openChat(): void { this.moreOpen = false; this.hud.openThumbChat(); }

  // ── The face chip ──
  get level(): number { return this.hud.xpBar.level; }

  // ── ☰ More ──
  get tiles(): Tile[] {
    const h = this.hud;
    const close = (fn: () => void) => () => { this.moreOpen = false; fn(); };
    const out: Tile[] = [
      { id: 'book', label: this.t('thumb.tile.book'), badge: h.thumbBookNews, go: close(() => h.toggleSpellbook()) },
      { id: 'character', label: this.t('thumb.tile.character'), badge: h.thumbSheetNews, go: close(() => h.openCharacter()) },
      { id: 'journal', label: this.t('thumb.tile.journal'), badge: h.taskRows.some(r => r.ready), go: close(() => h.openJournal()) },
      { id: 'chat', label: this.t('thumb.tile.chat'), badge: h.chatUnread > 0 && h.chatSetting === 'on', go: close(() => h.openThumbChat()) },
      { id: 'friends', label: this.t('thumb.tile.friends'), badge: false, go: close(() => h.openFriends()) },
      { id: 'bestiary', label: this.t('thumb.tile.bestiary'), badge: false, go: close(() => h.toggleBestiary()) },
      { id: 'settings', label: this.t('thumb.tile.settings'), badge: false, go: close(() => h.openSound()) },
      { id: 'loot', label: this.t('thumb.tile.loot'), badge: false, go: close(() => h.openLoot()) },
      { id: 'names', label: this.t('thumb.tile.names'), badge: false, pressed: h.lootLabelsOn, go: () => h.toggleLootLabels() },
      { id: 'lore', label: this.t('thumb.tile.lore'), badge: false, go: close(() => h.openLore()) },
      { id: 'account', label: this.t('thumb.tile.account'), badge: false, go: close(() => h.openAccount()) },
      { id: 'feedback', label: this.t('thumb.tile.feedback'), badge: false, go: close(() => h.openFeedback()) },
    ];
    if (h.slateTier > 0) out.push({ id: 'slate', label: this.t('thumb.tile.slate'), badge: false, go: close(() => h.toggleSlate()) });
    // Everything else the ☰ Game Menu holds (the Glass, Controls, Character select): one tile to it.
    out.push({ id: 'menu', label: this.t('thumb.tile.menu'), badge: false, go: close(() => h.toggleGameMenu()) });
    for (const tile of out) tile.icon = tileIcon(tile.id);
    return out;
  }
  /** Any tile has news (read once a second: the sheet's points are not free to work out every frame). */
  moreNews = false;
  toggleMore(): void { this.moreOpen = !this.moreOpen; this.hud.thumbSfx(this.moreOpen ? 'open' : 'tap'); }
  tapTile(t: Tile): void { t.go(); }
}
