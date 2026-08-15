/**
 * inspect.component.ts — read-only Quick Inspect overlay.
 *
 * Desktop: side dialog. Mobile: bottom sheet. Overlay stack owns Escape.
 */
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { TranslationService } from '../../translation.service';
import { InspectService, type InspectView } from './inspect.service';
import { type EntityAction, type EntityFact } from './entity.model';
import { InventoryService } from '../rpg/inventory.service';
import { previewUpgrade, upgradeLevelOf } from '../rpg/item-upgrade';
import { formatCurrency } from '../economy/economy.model';
import type { GameItem } from '../rpg/item.model';

@Component({
  selector: 'app-inspect',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './inspect.component.html',
  styleUrls: ['./inspect.component.css'],
})
export class InspectComponent implements OnInit, OnDestroy {
  private readonly inspect = inject(InspectService);
  private readonly inventory = inject(InventoryService);
  private readonly i18n = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private sub?: Subscription;
  private media?: MediaQueryList;
  private mediaHandler?: () => void;

  @ViewChild('titleEl') titleEl?: ElementRef<HTMLElement>;

  view: InspectView = this.inspect.view;
  sheet = false;
  temperNote: string | null = null;

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  ngOnInit(): void {
    this.inspect.start();
    this.inventory.init();
    this.sub = this.inspect.view$.subscribe(view => {
      const opened = view.open && !this.view.open;
      this.view = view;
      if (opened) this.temperNote = null;
      this.cdr.markForCheck();
      if (opened) {
        const focusTitle = () => this.titleEl?.nativeElement.focus();
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => focusTitle());
        else setTimeout(focusTitle, 0);
      }
    });
    this.sub.add(this.inventory.snapshot$.subscribe(() => this.cdr.markForCheck()));
    if (this.isBrowser && typeof window.matchMedia === 'function') {
      this.media = window.matchMedia('(max-width: 768px)');
      this.sheet = this.media.matches;
      this.mediaHandler = () => {
        this.sheet = !!this.media?.matches;
        this.cdr.markForCheck();
      };
      this.media.addEventListener('change', this.mediaHandler);
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    if (this.media && this.mediaHandler) {
      this.media.removeEventListener('change', this.mediaHandler);
    }
  }

  close(): void {
    this.inspect.close();
  }

  retry(): void {
    this.inspect.retry();
  }

  runAction(action: EntityAction): void {
    if (action.id !== 'equip' || !action.enabled || !this.view.ref) return;
    this.inventory.init();
    this.inventory.equip(this.view.ref.id, 'weapon');
    this.inspect.retry();
  }

  get inspectedItem(): GameItem | null {
    const ref = this.view.ref;
    if (!ref || ref.type !== 'item') return null;
    return this.inventory.itemById(ref.id) ?? null;
  }

  get temperPreview() {
    const item = this.inspectedItem;
    return item ? previewUpgrade(item) : null;
  }

  get temperLevel(): number {
    return this.inspectedItem ? upgradeLevelOf(this.inspectedItem) : 0;
  }

  get canTemper(): boolean {
    return !!this.inspectedItem && this.inventory.canUpgrade(this.inspectedItem);
  }

  temperGold(): string {
    return this.temperPreview ? formatCurrency(this.temperPreview.gold) : '';
  }

  temperChance(): string {
    return this.temperPreview ? `${Math.round(this.temperPreview.successChance * 100)}` : '';
  }

  temperMats(): string {
    return this.temperPreview
      ? this.temperPreview.materials.map(row => `×${row.quantity} ${row.id}`).join(' · ')
      : '';
  }

  temper(): void {
    const item = this.inspectedItem;
    if (!item) return;
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `temper-${Date.now()}`;
    const result = this.inventory.temper(item.id, id);
    if (!result.ok) {
      this.temperNote = this.t('inspect.temper.blocked');
      this.cdr.markForCheck();
      return;
    }
    this.temperNote = result.leveled
      ? this.t('inspect.temper.ok', { n: upgradeLevelOf(result.item) })
      : this.t('inspect.temper.fail');
    this.inspect.retry();
    this.cdr.markForCheck();
  }

  factValue(fact: EntityFact): string {
    return fact.exactValue ?? fact.value;
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.view.open || event.key !== 'Tab') return;
    const root = (event.currentTarget as HTMLElement | null)?.querySelector?.('.qi') as HTMLElement | null;
    if (!root) return;
    const focusable = this.trapTargets(root);
    if (focusable.length === 0) {
      event.preventDefault();
      this.titleEl?.nativeElement.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || active === this.titleEl?.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Title is tabindex=-1 so it is not in the default tab list, but it is the
   *  initial focus. It must be first in the trap or Shift+Tab leaks out. */
  trapTargets(root: HTMLElement): HTMLElement[] {
    const listed = Array.from(root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    const title = this.titleEl?.nativeElement;
    const merged = title && !listed.includes(title) ? [title, ...listed] : listed;
    return merged.filter(el => el.offsetParent !== null || el === document.activeElement);
  }
}
