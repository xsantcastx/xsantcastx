import { NgModule } from '@angular/core';
import { ToolsRoutingModule } from './tools-routing.module';

/**
 * ToolsModule — lazy entry for the /tools area. Tool page components are now
 * standalone and code-split per route via `loadComponent` in ToolsRoutingModule,
 * so this module only wires the child routes.
 */
@NgModule({
  imports: [ToolsRoutingModule]
})
export class ToolsModule {}
