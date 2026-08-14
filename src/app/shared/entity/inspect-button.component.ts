import { Component, Input, inject } from '@angular/core';

import { TranslationService } from '../../translation.service';
import { InspectService } from './inspect.service';
import { type EntityType } from './entity.model';

@Component({
  selector: 'app-inspect-button',
  standalone: true,
  template: `
    <button
      type="button"
      class="inspect-btn"
      [attr.aria-label]="t('inspect.action')"
      (click)="open($event)">
      {{ t('inspect.action') }}
    </button>
  `,
  styles: [`
    :host { display: inline-flex; }
    .inspect-btn {
      min-height: 44px;
      min-width: 44px;
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.04);
      color: inherit;
      font: inherit;
      letter-spacing: 0.06em;
      cursor: pointer;
    }
    .inspect-btn:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 3px;
    }
  `],
})
export class InspectButtonComponent {
  private readonly inspect = inject(InspectService);
  private readonly i18n = inject(TranslationService);

  @Input({ required: true }) type!: EntityType;
  @Input({ required: true }) id!: string;

  t(key: string): string { return this.i18n.translate(key); }

  open(event: Event): void {
    event.stopPropagation();
    this.inspect.open({ type: this.type, id: this.id }, { trigger: event.currentTarget });
  }
}
