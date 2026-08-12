import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { RelatedToolsComponent } from '../shared/related-tools.component';
import { ToolUsageCounterComponent } from '../shared/tool-usage-counter/tool-usage-counter.component';
import { NewsletterCaptureComponent } from '../shared/newsletter/newsletter-capture.component';
import { EmbedCodeGeneratorComponent } from '../shared/embed-code-generator/embed-code-generator.component';
import { AffiliateCTAComponent } from '../shared/affiliate/affiliate-cta.component';
import { CarbonAdComponent } from '../shared/carbon-ad/carbon-ad.component';
import { SponsorSlotComponent } from '../shared/sponsor-slot/sponsor-slot.component';
import { ToolLoreComponent } from '../shared/lore/tool-lore.component';
import { HouseAdComponent } from '../shared/ads/house-ad.component';

/**
 * ToolsSharedModule — declares + exports the shared presentational components
 * that the lazy-loaded tool pages depend on. Previously these were declared in
 * AppModule (eager). Moving them here lets the lazy tools/embed modules use them
 * without eagerly shipping them in main.js.
 */
@NgModule({
  declarations: [
    RelatedToolsComponent,
    ToolLoreComponent,
    ToolUsageCounterComponent,
    NewsletterCaptureComponent,
    EmbedCodeGeneratorComponent,
    AffiliateCTAComponent,
    CarbonAdComponent,
    SponsorSlotComponent,
  ],
  // HouseAdComponent is standalone, so it is imported rather than declared.
  // CarbonAdComponent's template uses it for the no-network fallback.
  imports: [CommonModule, FormsModule, RouterModule, HouseAdComponent],
  exports: [
    CommonModule,
    FormsModule,
    RouterModule,
    RelatedToolsComponent,
    ToolLoreComponent,
    ToolUsageCounterComponent,
    NewsletterCaptureComponent,
    EmbedCodeGeneratorComponent,
    AffiliateCTAComponent,
    CarbonAdComponent,
    SponsorSlotComponent,
  ]
})
export class ToolsSharedModule {}
