import { Injectable } from '@angular/core';
import { TranslationService } from '../translation.service';
import { ToolCard } from './tools.component';
import { TOOLS_REGISTRY, getRelatedTools as registryGetRelated } from './tools-registry';

/**
 * Injectable service that provides tool data from the single registry.
 * Use this when you need tool data inside a service or component that
 * doesn't extend ToolsComponent (e.g. individual tool pages needing
 * related tools, or the SEO service).
 */
@Injectable({ providedIn: 'root' })
export class ToolsDataService {

  constructor(private translationService: TranslationService) {}

  private t(key: string): string {
    return this.translationService.translate(key);
  }

  /** Get all tools as ToolCard view models, resolving i18n where available */
  getTools(): ToolCard[] {
    return TOOLS_REGISTRY.map(t => ({
      id: t.id,
      title: t.titleKey ? this.t(t.titleKey) : t.title,
      description: t.descriptionKey ? this.t(t.descriptionKey) : t.description,
      route: t.route,
      status: t.status,
      category: t.category,
      tags: t.tags,
      icon: t.svgIcon,
    }));
  }

  /** Get related tools by shared tags (delegates to registry) */
  getRelatedTools(currentId: string, count: number = 4): ToolCard[] {
    const related = registryGetRelated(currentId, count);
    return related.map(t => ({
      id: t.id,
      title: t.titleKey ? this.t(t.titleKey) : t.title,
      description: t.descriptionKey ? this.t(t.descriptionKey) : t.description,
      route: t.route,
      status: t.status,
      category: t.category,
      tags: t.tags,
      icon: t.svgIcon,
    }));
  }
}
