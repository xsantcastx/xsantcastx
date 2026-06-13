import { NgModule } from '@angular/core';
import { EmbedRoutingModule } from './embed-routing.module';

/**
 * EmbedModule — lazy entry for the /embed area. Tool page components are now
 * standalone and code-split per route via `loadComponent` in EmbedRoutingModule,
 * so this module only wires the child routes.
 */
@NgModule({
  imports: [EmbedRoutingModule]
})
export class EmbedModule {}
