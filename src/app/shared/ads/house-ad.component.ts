/**
 * HouseAdComponent — the "this slot is for sale" card.
 *
 * Rendered by every ad surface when `activeAdNetwork()` returns 'house', i.e.
 * when no real network has been configured yet. Owning it in one component
 * rather than duplicating the markup into each surface means the pitch, the
 * styling and the /sponsors link change in one place.
 *
 * Not labelled "Sponsored" anywhere: nothing here is paid placement, and
 * labelling own-promotion as an ad is the dark pattern the label exists to
 * prevent. The eyebrow says "Available slot", which is what it is.
 */
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-house-ad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="house-ad" aria-hidden="true">
      <span class="house-ad__eyebrow">
        <span class="house-ad__pulse" aria-hidden="true"></span>
        Available slot
      </span>
      <span class="house-ad__title">{{ title }}</span>
      <span class="house-ad__body">{{ body }}</span>
    </div>
  `,
  styleUrls: ['./house-ad.component.css'],
})
export class HouseAdComponent {
  @Input() title = 'Your ad here';
  @Input() body = 'This slot is reserved. It is not a product page.';
}
