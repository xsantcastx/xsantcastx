import { NgModule } from '@angular/core';
import { ToolsPageComponentsModule } from './tools-page-components.module';
import { ToolsRoutingModule } from './tools-routing.module';

@NgModule({
  imports: [ToolsPageComponentsModule, ToolsRoutingModule]
})
export class ToolsModule {}
