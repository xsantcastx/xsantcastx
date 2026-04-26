import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * appFocusTrap — a small SSR-safe focus-trap directive for modal dialogs.
 *
 * WHY THIS EXISTS
 * ---------------
 * The footer donation modals (crypto / PayPal / Stripe) had `role="dialog"` and
 * `aria-modal="true"` set correctly but no focus management whatsoever, which
 * fails WCAG 2.1 SC 2.1.2 (No Keyboard Trap) and SC 2.4.3 (Focus Order). The
 * Notion accessibility task (page 348e6899-f10e-81e2-95ac-f785add962ad) called
 * out four concrete defects:
 *
 *   1. Focus is NOT moved into the modal on open
 *   2. Tab/Shift+Tab can escape the "modal" back to background content
 *   3. Focus is NOT returned to the trigger when the modal closes
 *   4. Escape does NOT close the modal
 *
 * Rather than pulling in @angular/cdk just for this (the project does not
 * currently depend on it — would inflate bundle by ~30KB gzipped) we ship a
 * minimal directive that handles the four behaviours above. If we ever need
 * richer focus semantics (initial-focus targets, conditional traps, region
 * locking, …) this can be lifted-and-shifted into CDK's FocusTrap with a
 * trivial template change because the API surface is intentionally small.
 *
 * USAGE
 * -----
 * Bind the directive's value to whatever signal your modal uses to control
 * visibility, and listen to (escape) to close it on Esc:
 *
 *   <div class="modal" role="dialog" aria-modal="true"
 *        [appFocusTrap]="showModal" (escape)="closeModal()">
 *     ...
 *   </div>
 *
 * SSR
 * ---
 * The directive is a no-op on the server (PLATFORM_ID guard). All DOM access
 * is gated on `isBrowser` so prerender cannot trip on missing globals.
 */
@Directive({
  selector: '[appFocusTrap]',
  standalone: false,
})
export class FocusTrapDirective implements OnChanges, OnDestroy {
  /**
   * When this flips from falsy → truthy, focus is captured into the host
   * element. When it flips from truthy → falsy, focus is restored to whatever
   * element was focused before the trap engaged.
   */
  @Input('appFocusTrap') active: boolean | null | undefined = false;

  /** Emitted when the user presses Escape while the trap is active. */
  @Output() escape = new EventEmitter<KeyboardEvent>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Element that had focus before the trap engaged — restored on close. */
  private previouslyFocused: HTMLElement | null = null;
  /** Bound keydown handler — kept as a field so we can detach it cleanly. */
  private keydownHandler?: (ev: KeyboardEvent) => void;

  /**
   * CSS selector matching every element that should participate in tab order.
   * Matches the WAI-ARIA Authoring Practices "tabbable element" definition
   * (excluding hidden inputs and disabled controls). Kept narrow on purpose —
   * radio groups and contenteditable land in a follow-up if we ever ship them
   * in a modal here.
   */
  private static readonly FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    'audio[controls]',
    'video[controls]',
    '[contenteditable]:not([contenteditable="false"])',
  ].join(',');

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.isBrowser) return;
    if (!changes['active']) return;

    const next = !!changes['active'].currentValue;
    const prev = !!changes['active'].previousValue;
    if (next === prev) return;

    if (next) {
      this.engage();
    } else {
      this.release();
    }
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    // Best-effort cleanup — release() is idempotent.
    this.release();
  }

  private engage(): void {
    if (!this.isBrowser) return;
    const doc = typeof document !== 'undefined' ? document : null;
    if (!doc) return;

    // Remember the element that should receive focus when we close. Falls
    // back to <body> so we never leave the page focusless if there's nothing
    // sensible to restore to (browsers handle <body>-as-active gracefully).
    this.previouslyFocused = (doc.activeElement as HTMLElement | null) ?? null;

    // Defer the focus call by a microtask: the modal becomes visible via a
    // CSS class toggle in the same change-detection pass and many transitions
    // (display:none → block) make element.focus() a no-op until the next
    // paint. requestAnimationFrame is the safe choice in the browser; on the
    // server we already returned above so this never runs.
    const moveFocus = () => {
      const focusables = this.getFocusable();
      // Prefer the first non-close-button focusable so users land on
      // meaningful content (close button is still in tab order, just not the
      // initial target). Falls back to the close button, then to the host
      // itself with tabindex=-1 so something always has focus.
      const target =
        focusables.find((el) => !el.classList.contains('close-btn')) ??
        focusables[0] ??
        this.makeHostFocusable();

      target?.focus();
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(moveFocus);
    } else {
      moveFocus();
    }

    // Attach the keydown handler on the host (capture=false) so it bubbles
    // up from inner controls naturally. We don't use a global listener
    // because that would leak across multiple simultaneous traps if the
    // pattern ever spreads.
    this.keydownHandler = (ev: KeyboardEvent) => this.onKeydown(ev);
    this.host.nativeElement.addEventListener('keydown', this.keydownHandler);
  }

  private release(): void {
    if (this.keydownHandler) {
      this.host.nativeElement.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    if (this.previouslyFocused && typeof this.previouslyFocused.focus === 'function') {
      // Some triggers may have been removed from the DOM between open and
      // close (e.g. dynamic lists). Wrap to swallow that defensively.
      try {
        this.previouslyFocused.focus();
      } catch {
        /* swallow — best-effort restoration */
      }
    }
    this.previouslyFocused = null;
  }

  private onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      // Don't preventDefault on Escape — some screen readers reserve Escape
      // for their own dialogs. Just stop propagation so we don't double-fire
      // if a parent listens too, and emit so the host can close.
      ev.stopPropagation();
      this.escape.emit(ev);
      return;
    }

    if (ev.key !== 'Tab') return;

    const focusables = this.getFocusable();
    if (focusables.length === 0) {
      // Nothing tabbable — pin focus to the host so Tab can't escape.
      ev.preventDefault();
      this.makeHostFocusable()?.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = (typeof document !== 'undefined' ? document.activeElement : null) as
      | HTMLElement
      | null;

    if (ev.shiftKey && active === first) {
      // Wrap backwards from first → last
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && active === last) {
      // Wrap forwards from last → first
      ev.preventDefault();
      first.focus();
    }
  }

  private getFocusable(): HTMLElement[] {
    const root = this.host.nativeElement;
    const nodes = root.querySelectorAll<HTMLElement>(FocusTrapDirective.FOCUSABLE_SELECTOR);
    // Filter out anything that isn't actually visible. offsetParent === null
    // captures display:none (the common case for hidden modals) without the
    // cost of a getComputedStyle pass. Fixed/sticky elements need a different
    // check but we don't have any in these modals.
    return Array.from(nodes).filter((el) => {
      if (el.hasAttribute('disabled')) return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      if (el.tabIndex < 0) return false;
      // offsetParent is null for display:none and detached elements. It's a
      // surprisingly cheap visibility check compared to getBoundingClientRect.
      return el.offsetParent !== null || el === document.activeElement;
    });
  }

  private makeHostFocusable(): HTMLElement | null {
    const el = this.host.nativeElement;
    // Add a programmatic tabindex if the host is not already focusable so we
    // have a guaranteed place to park focus when the modal has zero tabbable
    // children (loading states, error placeholders, etc.).
    if (!el.hasAttribute('tabindex')) {
      el.setAttribute('tabindex', '-1');
    }
    return el;
  }
}
