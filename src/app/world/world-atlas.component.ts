/**
 * world-atlas.component.ts — interactive Fractured Realms atlas on /world.
 *
 * Presentation only. Hotspots are data-driven from the atlas spec and route
 * to existing dossiers. No new routes, choices, or persistence.
 */
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TranslationService } from '../translation.service';
import {
  ATLAS_HOTSPOTS,
  ATLAS_IMAGE_STEM,
  ATLAS_SOURCE,
  type AtlasHotspot,
  atlasHotspotsInMobileOrder,
  atlasHref,
  atlasRealmTone,
} from '../shared/narrative/world-atlas';

@Component({
  selector: 'app-world-atlas',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './world-atlas.component.html',
  styleUrls: ['./world-atlas.component.css'],
})
export class WorldAtlasComponent {
  private readonly i18n = inject(TranslationService);

  readonly spots = ATLAS_HOTSPOTS;
  readonly mobileSpots = atlasHotspotsInMobileOrder();
  readonly imageStem = `assets/images/${ATLAS_IMAGE_STEM}`;
  readonly width = ATLAS_SOURCE.sourceDimensions.width;
  readonly height = ATLAS_SOURCE.sourceDimensions.height;
  readonly radiusPercent = ATLAS_SOURCE.hitTarget.desktopRadiusPercent;
  readonly minTargetPx = ATLAS_SOURCE.hitTarget.minimumPointerTargetPx;

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n.translate(key, vars);
  }

  href(spot: AtlasHotspot): string {
    return atlasHref(spot.id);
  }

  tone(spot: AtlasHotspot): { color: string; glow: string } {
    return atlasRealmTone(spot.id);
  }

  labelAbove(spot: AtlasHotspot): boolean {
    return spot.anchor.y >= 75;
  }
}
