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
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-house-ad',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="house-ad"
      routerLink="/sponsors"
      aria-label="Sponsor The Godforge — advertise on this page"
    >
      <span class="house-ad__eyebrow">
        <span class="house-ad__pulse" aria-hidden="true"></span>
        Available slot
      </span>
      <span class="house-ad__title">{{ title }}</span>
      <span class="house-ad__body">{{ body }}</span>
      <span class="house-ad__cta">Sponsor The Godforge →</span>
    </a>
  `,
  styleUrls: ['./house-ad.component.css'],
})
export class HouseAdComponent {
  @Input() title = 'Your ad here';
  @Input() body =
    'Reach developers while they are mid-task, on the tool that solves it. One tasteful slot, no tracking.';
}
