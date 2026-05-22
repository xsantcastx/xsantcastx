import { NgModule } from '@angular/core';
import { ToolsPageComponentsModule } from './tools-page-components.module';
import { EmbedRoutingModule } from './embed-routing.module';

@NgModule({
  imports: [ToolsPageComponentsModule, EmbedRoutingModule]
})
export class EmbedModule {}
