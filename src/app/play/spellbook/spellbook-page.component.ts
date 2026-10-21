/**
 * spellbook-page.component.ts — the Spellbook (K) page inside its window: Diablo II's skill page in the cozy frame
 * (docs/design/skill-trees.md). The points banner, the tree tabs, the tree board (tier rows labelled with the level
 * they open at, large skill slots, pixel arrows from each prerequisite) and the picked skill's card (what it does now,
 * what the next rank changes, one big Learn button, keys 1–4, Synergies and the Spellstone folded away).
 *
 * Presentational only: it draws the side-scroller's `spellbook` view model as given and hands every choice back as an
 * output; the rules (what a rank costs, what blocks it) stay in td-tree. Any vocation, any number of tabs, tiers,
 * columns and skills — the board sizes itself from the nodes.
 */
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, inject } from '@angular/core';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { TranslationService } from '../../translation.service';
import { MAX_RANK, SKILLS as TD_SKILLS, type SkillId, type TreeId } from '../td/td-skills';
import { treeSkills } from '../td/td-tree';
import type { Vocation } from '../../shared/keeper-look/keeper-look.model';

/** The side-scroller's `spellbook` getter, as this page reads it (kept structurally identical; nothing is added). */
export interface SpellbookNode {
  id: SkillId; name: string; tier: number; col: number; rank: number; need: number; open: boolean; picked: boolean; buyable: boolean; slot: number; on: boolean;
}
export interface SpellbookPick {
  /** `nowRank`: the rank the fight casts at (the tree's plus `gear`, the ranks worn gear adds). `cd`: the wait now (cast speed in). */
  id: SkillId; name: string; kind: string; rank: number; max: number; now: string; nowRank: number; gear: number; next: string[]; mana: number; cd: number;
  block: string | null; need: string; slot: number; on: boolean; words: string;
  syn: { from: SkillId; name: string; ranks: number; text: string; live: boolean }[]; phase: { text: string; up: boolean } | null;
  /** What lifts the card's damage in the fight now (spell power, fire, the weapon, crits), or null. */
  power: string | null;
}
export interface SpellbookView {
  trees: { id: TreeId; ranks: number }[];
  left: number;
  tiers: { level: number; open: boolean }[];
  nodes: SpellbookNode[];
  lines: { x1: number; y1: number; x2: number; y2: number; lit: boolean }[];
  pick: SpellbookPick | null;
}
/** The Spellstone row for the picked spell (side-scroller `stoneView`). */
export interface SpellbookStone { soul: number; charges: number; rank: number; held: number; blanks: number; onBelt: boolean; why: string }

/** One prerequisite arrow on the board, in cell units: down from the parent, across in the gap above the child, down into it. */
interface Route { d: string; lit: boolean; col: number; tier: number }
type NodeState = 'locked' | 'learnable' | 'maxed' | 'learned' | 'unlearned';

/** Two clicks on the same skill this close together learn a rank (a double-tap on a phone, a double-click on a desk). */
const DOUBLE_MS = 420;

@Component({
  selector: 'app-spellbook-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  templateUrl: './spellbook-page.component.html',
  styleUrl: './spellbook-page.component.css',
})
export class SpellbookPageComponent {
  private readonly i18n = inject(TranslationService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly icons = new Map<string, SafeHtml>();
  private lastClick = { id: '', at: 0 };

  @Input({ required: true }) book!: SpellbookView;
  /** The open tab (side-scroller `bookTab`). */
  @Input({ required: true }) tab!: TreeId;
  @Input() vocation = 'warlock';
  @Input() respecAsk = false;
  @Input() skyPhase = 'day';
  @Input() stone: SpellbookStone | null = null;
  @Input() stoneArt = '';
  @Input() soul = 0;

  @Output() readonly pick = new EventEmitter<string>();
  @Output() readonly learn = new EventEmitter<string>();
  @Output() readonly openTree = new EventEmitter<TreeId>();
  @Output() readonly respec = new EventEmitter<void>();
  @Output() readonly respecCancel = new EventEmitter<void>();
  @Output() readonly assign = new EventEmitter<{ id: string; slot: number }>();
  @Output() readonly aura = new EventEmitter<string>();
  @Output() readonly inscribe = new EventEmitter<string>();
  @Output() readonly belt = new EventEmitter<string>();

  readonly keys = [1, 2, 3, 4];
  readonly maxRank = MAX_RANK;

  t(key: string, vars?: Record<string, string | number>): string { return this.i18n.translate(key, vars); }

  /** Columns on the board: the widest tier of this tree (three for every tree today; more if a book ever needs them). */
  get cols(): number { return Math.max(3, ...this.book.nodes.map(n => n.col + 1)); }

  /** A tier row's label shows its level once: a row that opens at the same level as the row above stays blank. */
  rowLabel(i: number): string {
    const tiers = this.book.tiers;
    return i > 0 && tiers[i].level === tiers[i - 1].level ? '' : this.t('play.td.level', { n: tiers[i].level });
  }

  /** The prerequisite arrows, routed so they never cut through a slot: down, across in the gap, down into the child. */
  get routes(): Route[] {
    const byId = new Map(this.book.nodes.map(n => [n.id, n]));
    const out: Route[] = [];
    for (const n of this.book.nodes) {
      const req = TD_SKILLS[n.id]?.req, p = req ? byId.get(req) : undefined;
      if (!p) continue;
      const px = p.col + .5, cx = n.col + .5, py = p.tier + .5, gap = n.tier;
      const d = px === cx ? `M${px} ${py}V${n.tier + .5}` : `M${px} ${py}V${gap}H${cx}V${n.tier + .5}`;
      out.push({ d, lit: p.rank > 0, col: n.col, tier: n.tier });
    }
    return out;
  }

  state(n: SpellbookNode): NodeState {
    if (n.rank >= MAX_RANK) return 'maxed';
    if (!n.open) return 'locked';
    if (n.buyable) return 'learnable';
    return n.rank > 0 ? 'learned' : 'unlearned';
  }

  nodeLabel(n: SpellbookNode): string {
    const st = this.state(n);
    const what = st === 'locked' ? this.t('play.td.tree.state.locked', { n: n.need }) : this.t('play.td.tree.state.' + st);
    return `${n.name} · ${this.t('play.td.tree.rank', { n: n.rank, max: MAX_RANK })} · ${what}`;
  }

  /** A skill's pixel icon (its constant rects, td-skills); it fills the box it is put in (the CSS sizes the box). */
  icon(id: string): SafeHtml {
    let h = this.icons.get(id);
    if (!h) {
      h = this.sanitizer.bypassSecurityTrustHtml(`<svg viewBox="0 0 16 16" width="100%" height="100%" shape-rendering="crispEdges" aria-hidden="true">${TD_SKILLS[id as SkillId]?.icon ?? ''}</svg>`);
      this.icons.set(id, h);
    }
    return h;
  }

  /** A tab's picture: the first skill of its tree (the top row, leftmost). */
  treeIcon(tree: TreeId): SafeHtml {
    const first = treeSkills(this.vocation as Vocation, tree)[0];
    return first ? this.icon(first) : '';
  }

  // ── Choosing and learning ──
  /** A click picks; a second click on the same skill soon after (or a click on its "+") learns a rank. */
  nodeClick(n: SpellbookNode, ev: MouseEvent): void {
    const now = performance.now(), plus = (ev.target as HTMLElement | null)?.closest?.('.sbt__plus');
    const twice = this.lastClick.id === n.id && now - this.lastClick.at < DOUBLE_MS;
    this.lastClick = twice ? { id: '', at: 0 } : { id: n.id, at: now };
    if (!n.picked) this.pick.emit(n.id);
    if ((plus || twice) && n.buyable) this.learn.emit(n.id);
  }

  /** The board's keyboard: arrows walk to the nearest skill that way (and pick it), Enter or Space learns the picked one. */
  nodeKey(n: SpellbookNode, ev: KeyboardEvent): void {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      if (!n.picked) this.pick.emit(n.id);
      else if (n.buyable) this.learn.emit(n.id);
      return;
    }
    const dir = ({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] } as Record<string, [number, number]>)[ev.key];
    if (!dir) return;
    ev.preventDefault();
    const next = this.neighbour(n, dir);
    if (!next) return;
    this.pick.emit(next.id);
    this.focusNode(next.id);
  }

  private neighbour(from: SpellbookNode, [dx, dy]: [number, number]): SpellbookNode | null {
    let best: SpellbookNode | null = null, score = Infinity;
    for (const n of this.book.nodes) {
      const ox = n.col - from.col, oy = n.tier - from.tier;
      const along = dx ? ox * dx : oy * dy, across = Math.abs(dx ? oy : ox);
      if (along <= 0) continue;
      const s = along + across * 2.5;
      if (s < score) { score = s; best = n; }
    }
    return best;
  }

  private focusNode(id: string): void {
    // The picked skill takes the roving tab stop on the next render; focus follows it there.
    queueMicrotask(() => setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`.sbt__node[data-skill="${id}"]`)?.focus(), 0));
  }

  /** The tab strip's keyboard: left and right open the neighbouring tree. */
  tabKey(i: number, ev: KeyboardEvent): void {
    const step = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    ev.preventDefault();
    const trees = this.book.trees, to = trees[(i + step + trees.length) % trees.length];
    this.openTree.emit(to.id);
    queueMicrotask(() => setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`.sbt__tab[data-tree="${to.id}"]`)?.focus(), 0));
  }

  /** The primary button's words: what one point buys, or why it cannot be pressed when that is "at the top". */
  learnLabel(pk: SpellbookPick): string {
    if (pk.block === 'max') return this.t('play.td.tree.maxed');
    return this.t(pk.rank > 0 ? 'play.td.tree.rankUpCost' : 'play.td.tree.learnCost');
  }

  rankPct(rank: number): number { return Math.round(Math.min(1, rank / MAX_RANK) * 100); }
  liveSyn(pk: SpellbookPick): number { return pk.syn.filter(s => s.live).length; }
}
