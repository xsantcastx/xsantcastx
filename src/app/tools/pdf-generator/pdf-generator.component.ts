import { Component, HostListener, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '@angular/fire/auth';
import { Subscription } from 'rxjs';
import { CatalogPdfService } from './catalog-pdf.service';
import { CatalogCloudService, CloudCatalog } from './catalog-cloud.service';
import { AuthServiceService } from '../../auth-service.service';
import { SITE_URL } from '../../seo.service';
import {
  BadgeType, CatalogPdfConfig, ColumnCount, DEFAULT_FIELD_CONFIGS,
  FieldConfig, FieldKey, Product, ProductImage, ProductSection, ProductStringFields
} from './pdf-generator.types';
import { buildCollagePages, CollagePage } from './collage-layout.util';

export interface PreviewPage {
  type: 'cover' | 'divider' | 'minimal' | 'detailed' | 'editorial';
  sectionName?: string;
  products?: Product[];
  collageLayout?: CollagePage;
  cols?: ColumnCount;
}

@Component({
  selector: 'app-pdf-generator',
  templateUrl: './pdf-generator.component.html',
  styleUrls: ['./pdf-generator.component.css'],
  standalone: false
})
export class PdfGeneratorComponent implements OnDestroy {

  // ─── State ────────────────────────────────────────────────────────────────

  private _sections: ProductSection[] = [];
  get sections(): ProductSection[] { return this._sections; }
  set sections(v: ProductSection[]) { this._sections = v; this.scheduleSave(); }

  fieldConfigs: FieldConfig[] = DEFAULT_FIELD_CONFIGS.map(f => ({ ...f }));
  config: CatalogPdfConfig = {
    title: '',
    subtitle: '',
    brand: '',
    pageSize: 'a4',
    template: 'minimal',
    columns: 3,
    currency: '€',
    showPageNumbers: true,
    showCoverPage: true,
    showSectionDividers: true,
    showNameOverlay: true,
    showPriceOverlay: true,
    accentColor: '#c9a84c',
  };

  activeTab: 'products' | 'fields' = 'products';
  expandedProductId: string | null = null;
  showPreview = false;
  previewPages: PreviewPage[] = [];
  generating = false;
  dragOver = false;
  error = '';
  draftRestored = false;
  imagesStripped = false;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly STORAGE_KEY = 'pdf_catalog_draft';

  // ─── Cloud / Auth ─────────────────────────────────────────────────────────

  currentUser: User | null = null;
  cloudSaving = false;
  cloudLoading = false;
  cloudSaved = false;
  cloudError = '';
  showCatalogsPanel = false;
  cloudCatalogs: CloudCatalog[] = [];
  private cloudCatalogId: string | null = null;
  private authSub: Subscription;

  // Drag & drop state
  draggingSectionId: string | null = null;
  draggingProductId: string | null = null;
  draggingProductFromSectionId: string | null = null;
  dropOverSectionId: string | null = null;
  dropBeforeProductId: string | null = null;

  // ─── Undo / Redo ─────────────────────────────────────────────────────────

  private historyStack: ProductSection[][] = [];
  private historyPointer = -1;

  snapshot(): void {
    this.historyStack = this.historyStack.slice(0, this.historyPointer + 1);
    this.historyStack.push(this.sections);
    this.historyPointer = this.historyStack.length - 1;
    if (this.historyStack.length > 50) { this.historyStack.shift(); this.historyPointer--; }
  }

  undo(): void {
    if (this.historyPointer <= 0) return;
    this.historyPointer--;
    this.sections = this.historyStack[this.historyPointer];
    this.expandedProductId = null;
  }

  redo(): void {
    if (this.historyPointer >= this.historyStack.length - 1) return;
    this.historyPointer++;
    this.sections = this.historyStack[this.historyPointer];
  }

  get canUndo(): boolean { return this.historyPointer > 0; }
  get canRedo(): boolean { return this.historyPointer < this.historyStack.length - 1; }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    const ctrl = event.ctrlKey || event.metaKey;
    if (!ctrl) return;
    const tag = (event.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (event.key === 'z' && !event.shiftKey) { event.preventDefault(); this.undo(); }
    if ((event.key === 'y') || (event.key === 'z' && event.shiftKey)) { event.preventDefault(); this.redo(); }
  }

  // ─── Readonly constants ───────────────────────────────────────────────────

  readonly twitterShareUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free PDF Catalog Generator — upload images, add product details and download a professional PDF. No sign-up, runs in the browser 🔥')}&url=${encodeURIComponent(SITE_URL + '/tools/pdf-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/pdf-generator')}`;

  readonly pageSizes = [
    { value: 'a4' as const,     label: 'A4  (210 × 297 mm)' },
    { value: 'letter' as const, label: 'Letter  (8.5 × 11 in)' },
  ];
  readonly currencyOptions = ['€', '$', '£', '¥'];
  readonly badgeTypes: BadgeType[] = ['new', 'featured', 'sale', 'bestseller', 'limited'];
  readonly badgeLabels: Record<BadgeType, string> = {
    new:        'New',
    featured:   'Featured',
    sale:       'Sale',
    bestseller: 'Bestseller',
    limited:    'Limited',
  };

  constructor(
    private router: Router,
    private pdfService: CatalogPdfService,
    private authService: AuthServiceService,
    private catalogCloud: CatalogCloudService,
  ) {
    this.loadDraft();
    this.snapshot();
    this.authSub = this.authService.user$.subscribe(user => {
      this.currentUser = user;
      if (!user) {
        this.showCatalogsPanel = false;
        this.cloudCatalogs = [];
      }
    });
  }

  ngOnDestroy(): void {
    this.authSub.unsubscribe();
  }

  // ─── Auto-save ────────────────────────────────────────────────────────────

  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveDraft(), 600);
  }

  private saveDraft(): void {
    const sectionsOut = this.sections.map(s => ({
      ...s,
      products: s.products.map(p => ({
        ...p,
        images: p.images.map(({ file: _f, ...rest }) => rest),
      })),
    }));
    const payload = JSON.stringify({ version: 1, config: this.config, fieldConfigs: this.fieldConfigs, sections: sectionsOut });

    try {
      localStorage.setItem(PdfGeneratorComponent.STORAGE_KEY, payload);
    } catch {
      // Quota exceeded — retry without image data
      try {
        const slim = JSON.stringify({
          version: 1, config: this.config, fieldConfigs: this.fieldConfigs,
          sections: this.sections.map(s => ({ ...s, products: s.products.map(p => ({ ...p, images: [] })) })),
          _imagesStripped: true,
        });
        localStorage.setItem(PdfGeneratorComponent.STORAGE_KEY, slim);
      } catch { /* silent */ }
    }
  }

  private loadDraft(): void {
    try {
      const raw = localStorage.getItem(PdfGeneratorComponent.STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        version: number;
        config: CatalogPdfConfig;
        fieldConfigs: FieldConfig[];
        sections: ProductSection[];
        _imagesStripped?: boolean;
      };
      if (data.version !== 1) return;

      this.config = { ...this.config, ...data.config };
      this.fieldConfigs = data.fieldConfigs;
      this._sections = data.sections.map(s => ({
        ...s,
        products: s.products.map(p => ({
          ...p,
          images: (p.images as unknown as Array<Omit<ProductImage, 'file'>>).map(img => ({ ...img, file: null })),
        })),
      }));

      if (this._sections.some(s => s.products.length > 0)) {
        this.draftRestored = true;
        this.imagesStripped = !!data._imagesStripped;
      }
    } catch { /* corrupt storage — ignore */ }
  }

  // ─── Getters ──────────────────────────────────────────────────────────────

  get hasProducts(): boolean {
    return this.sections.some(s => s.products.length > 0);
  }

  get totalProducts(): number {
    return this.sections.reduce((n, s) => n + s.products.length, 0);
  }

  get enabledFields(): FieldConfig[] {
    return this.fieldConfigs.filter(f => f.enabled);
  }

  get expandedProduct(): Product | null {
    if (!this.expandedProductId) return null;
    for (const s of this.sections) {
      const p = s.products.find(p => p.id === this.expandedProductId);
      if (p) return p;
    }
    return null;
  }

  get expandedSection(): ProductSection | null {
    if (!this.expandedProductId) return null;
    return this.sections.find(s => s.products.some(p => p.id === this.expandedProductId)) ?? null;
  }

  get columnOptions(): readonly number[] {
    return this.config.template === 'minimal' ? [2, 3, 4] : [2, 3];
  }

  get estimatedPageCount(): number {
    return this.buildPreviewPages().length;
  }

  // ─── Tab + config methods ─────────────────────────────────────────────────

  setTab(tab: 'products' | 'fields'): void {
    this.activeTab = tab;
  }

  setTemplate(t: 'minimal' | 'detailed' | 'editorial'): void {
    let cols = this.config.columns;
    if (t !== 'minimal' && cols === 4) cols = 3;
    this.config = { ...this.config, template: t, columns: cols };
    this.scheduleSave();
  }

  setCurrency(c: string): void {
    this.config = { ...this.config, currency: c };
    this.scheduleSave();
  }

  setColumns(col: number): void {
    this.config = { ...this.config, columns: col as ColumnCount };
    this.scheduleSave();
  }

  onConfigChange(): void {
    this.scheduleSave();
  }

  // ─── Field methods ────────────────────────────────────────────────────────

  toggleField(key: FieldKey): void {
    this.fieldConfigs = this.fieldConfigs.map(fc =>
      fc.key === key ? { ...fc, enabled: !fc.enabled } : fc
    );
    this.scheduleSave();
  }

  moveField(key: FieldKey, dir: -1 | 1): void {
    const list = [...this.fieldConfigs];
    const idx = list.findIndex(f => f.key === key);
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    this.fieldConfigs = list;
    this.scheduleSave();
  }

  // ─── Section methods ──────────────────────────────────────────────────────

  addSection(): void {
    this.snapshot();
    const newSection: ProductSection = {
      id: `section-${Date.now()}-${Math.random()}`,
      name: 'New Section',
      subtitle: '',
      products: [],
      collapsed: false,
      featuredProductId: null,
    };
    this.sections = [...this.sections, newSection];
  }

  toggleSection(id: string): void {
    const section = this.sections.find(s => s.id === id);
    if (section && !section.collapsed) {
      // Collapsing — clear expandedProductId if it belongs to this section
      if (section.products.some(p => p.id === this.expandedProductId)) {
        this.expandedProductId = null;
      }
    }
    this.sections = this.sections.map(s =>
      s.id === id ? { ...s, collapsed: !s.collapsed } : s
    );
  }

  updateSectionName(id: string, name: string): void {
    this.sections = this.sections.map(s => s.id === id ? { ...s, name } : s);
  }

  updateSectionSubtitle(id: string, subtitle: string): void {
    this.sections = this.sections.map(s => s.id === id ? { ...s, subtitle } : s);
  }

  moveSection(id: string, dir: -1 | 1): void {
    this.snapshot();
    const list = [...this.sections];
    const idx = list.findIndex(s => s.id === id);
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    [list[idx], list[target]] = [list[target], list[idx]];
    this.sections = list;
  }

  removeSection(id: string): void {
    this.snapshot();
    const section = this.sections.find(s => s.id === id);
    if (section && section.products.some(p => p.id === this.expandedProductId)) {
      this.expandedProductId = null;
    }
    this.sections = this.sections.filter(s => s.id !== id);
  }

  collapseAll(): void {
    this.snapshot();
    this.expandedProductId = null;
    this.sections = this.sections.map(s => ({ ...s, collapsed: true }));
  }

  expandAll(): void {
    this.snapshot();
    this.sections = this.sections.map(s => ({ ...s, collapsed: false }));
  }

  sortSection(sectionId: string, by: 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc'): void {
    this.snapshot();
    this.sections = this.sections.map(s => {
      if (s.id !== sectionId) return s;
      const products = [...s.products].sort((a, b) => {
        switch (by) {
          case 'name-asc':   return a.name.localeCompare(b.name);
          case 'name-desc':  return b.name.localeCompare(a.name);
          case 'price-asc':  return parseFloat(a.price || '0') - parseFloat(b.price || '0');
          case 'price-desc': return parseFloat(b.price || '0') - parseFloat(a.price || '0');
        }
      });
      return { ...s, products };
    });
  }

  // ─── Product methods ──────────────────────────────────────────────────────

  addProductToSection(sectionId: string): void {
    this.snapshot();
    const product = this.newProduct();
    this.sections = this.sections.map(s =>
      s.id === sectionId ? { ...s, products: [...s.products, product] } : s
    );
    this.expandedProductId = product.id;
  }

  toggleProductExpand(productId: string): void {
    this.expandedProductId = this.expandedProductId === productId ? null : productId;
  }

  removeProduct(sectionId: string, productId: string): void {
    this.snapshot();
    if (this.expandedProductId === productId) {
      this.expandedProductId = null;
    }
    this.sections = this.sections.map(s =>
      s.id === sectionId
        ? { ...s, products: s.products.filter(p => p.id !== productId) }
        : s
    ).filter(s => s.products.length > 0 || s.id !== sectionId);
  }

  duplicateProduct(sectionId: string, productId: string): void {
    this.snapshot();
    this.sections = this.sections.map(s => {
      if (s.id !== sectionId) return s;
      const idx = s.products.findIndex(p => p.id === productId);
      if (idx < 0) return s;
      const original = s.products[idx];
      const clone: Product = {
        ...original,
        id: `product-${Date.now()}-${Math.random()}`,
        images: original.images.map(img => ({
          ...img,
          id: `img-${Date.now()}-${Math.random()}`,
        })),
        badges: [...original.badges],
      };
      const products = [...s.products];
      products.splice(idx + 1, 0, clone);
      return { ...s, products };
    });
    // Find and set the new clone's id as expanded
    for (const s of this.sections) {
      if (s.id !== sectionId) continue;
      const idx = s.products.findIndex(p => p.id === productId);
      if (idx >= 0 && idx + 1 < s.products.length) {
        this.expandedProductId = s.products[idx + 1].id;
      }
      break;
    }
  }

  moveProductToSection(productId: string, toSectionId: string): void {
    const fromSection = this.sections.find(s => s.products.some(p => p.id === productId));
    if (!fromSection || fromSection.id === toSectionId) return;
    this.snapshot();
    this.moveProductTo(fromSection.id, productId, toSectionId, null);
    this.expandedProductId = productId;
  }

  moveProduct(sectionId: string, productId: string, dir: -1 | 1): void {
    this.sections = this.sections.map(s => {
      if (s.id !== sectionId) return s;
      const products = [...s.products];
      const idx = products.findIndex(p => p.id === productId);
      const t = idx + dir;
      if (t < 0 || t >= products.length) return s;
      [products[idx], products[t]] = [products[t], products[idx]];
      return { ...s, products };
    });
  }

  updateProductField(sectionId: string, productId: string, field: FieldKey, value: string): void {
    this.sections = this.sections.map(s => ({
      ...s,
      products: s.products.map(p => {
        if (p.id !== productId) return p;
        const update: Partial<ProductStringFields> = {};
        update[field] = value;
        return { ...p, ...update };
      })
    }));
  }

  toggleProductBadge(sectionId: string, productId: string, badge: BadgeType): void {
    this.snapshot();
    this.sections = this.sections.map(s =>
      s.id === sectionId
        ? {
            ...s,
            products: s.products.map(p => {
              if (p.id !== productId) return p;
              const badges = p.badges.includes(badge)
                ? p.badges.filter(b => b !== badge)
                : [...p.badges, badge];
              return { ...p, badges };
            })
          }
        : s
    );
  }

  promoteProductImage(sectionId: string, productId: string, imageId: string): void {
    this.snapshot();
    this.sections = this.sections.map(s =>
      s.id === sectionId
        ? {
            ...s,
            products: s.products.map(p => {
              if (p.id !== productId) return p;
              const images = p.images.map(img => ({ ...img, isPrimary: img.id === imageId }));
              // Move promoted image to front
              const primaryIdx = images.findIndex(img => img.isPrimary);
              if (primaryIdx > 0) {
                const [primary] = images.splice(primaryIdx, 1);
                images.unshift(primary);
              }
              return { ...p, images };
            })
          }
        : s
    );
  }

  removeProductImage(sectionId: string, productId: string, imageId: string): void {
    this.snapshot();
    this.sections = this.sections.map(s =>
      s.id === sectionId
        ? {
            ...s,
            products: s.products.map(p => {
              if (p.id !== productId) return p;
              let images = p.images.filter(img => img.id !== imageId);
              // Ensure there's a primary if images remain
              if (images.length > 0 && !images.some(img => img.isPrimary)) {
                images = images.map((img, i) => ({ ...img, isPrimary: i === 0 }));
              }
              return { ...p, images };
            })
          }
        : s
    );
  }

  // ─── Upload handlers ──────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  onDragLeave(): void {
    this.dragOver = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    void this.addProductsFromFiles(files, 'General');
  }

  onFolderInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    void this.addFolderFiles(files);
    input.value = '';
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    void this.addProductsFromFiles(files, 'General');
    input.value = '';
  }

  onProductImageInput(event: Event, sectionId: string, productId: string): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    void this.addImagesToProduct(sectionId, productId, files);
    input.value = '';
  }

  // ─── JSON Export / Import ─────────────────────────────────────────────────

  exportCatalog(): void {
    const sectionsExport = this.sections.map(section => ({
      ...section,
      products: section.products.map(product => ({
        ...product,
        images: product.images.map(({ file: _file, ...rest }) => rest),
      })),
    }));

    const payload = {
      version: 1,
      config: this.config,
      fieldConfigs: this.fieldConfigs,
      sections: sectionsExport,
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const titleSlug = (this.config.title || 'untitled').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    a.href = url;
    a.download = `catalog-${titleSlug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importCatalog(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as {
          version: number;
          config: CatalogPdfConfig;
          fieldConfigs: FieldConfig[];
          sections: Array<Omit<ProductSection, 'products'> & {
            products: Array<Omit<Product, 'images'> & {
              images: Array<Omit<ProductImage, 'file'>>;
            }>;
          }>;
        };

        this.snapshot();

        this.config = parsed.config;
        this.fieldConfigs = parsed.fieldConfigs;
        this.sections = parsed.sections.map(section => ({
          ...section,
          products: section.products.map(product => ({
            ...product,
            images: product.images.map(img => ({
              ...img,
              file: null,
            })),
          })),
        }));
        this.expandedProductId = null;
      } catch {
        this.error = 'Failed to import catalog: invalid or corrupted JSON file.';
      }
    };
    reader.readAsText(file);
  }

  // ─── Product image management ─────────────────────────────────────────────

  async addImagesToProduct(sectionId: string, productId: string, files: File[]): Promise<void> {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (!images.length) return;

    const newImages = await Promise.all(
      images.map(async (file, i) => {
        const { dataUrl, naturalWidth, naturalHeight } = await CatalogPdfService.readFile(file);
        return {
          id: `img-${file.name}-${Date.now()}-${Math.random()}`,
          file,
          dataUrl,
          mimeType: file.type,
          naturalWidth,
          naturalHeight,
          isPrimary: false,
        } satisfies ProductImage;
      })
    );

    this.sections = this.sections.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        products: s.products.map(p => {
          if (p.id !== productId) return p;
          const existingImages = p.images;
          const combined = [...existingImages, ...newImages];
          // Ensure at least one primary
          if (!combined.some(img => img.isPrimary) && combined.length > 0) {
            combined[0] = { ...combined[0], isPrimary: true };
          }
          return { ...p, images: combined };
        })
      };
    });
  }

  // ─── Preview + Generate ───────────────────────────────────────────────────

  openPreview(): void {
    this.previewPages = this.buildPreviewPages();
    this.showPreview = true;
  }

  closePreview(): void {
    this.showPreview = false;
  }

  async generate(): Promise<void> {
    if (!this.hasProducts) return;
    this.generating = true;
    this.error = '';
    try {
      await this.pdfService.generate(this.config, this.sections, this.enabledFields);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to generate PDF.';
    } finally {
      this.generating = false;
    }
  }

  // ─── Drag & drop ─────────────────────────────────────────────────────────

  onSectionDragStart(event: DragEvent, sectionId: string): void {
    this.draggingSectionId = sectionId;
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onSectionDragOver(event: DragEvent, sectionId: string): void {
    if (this.draggingSectionId && this.draggingSectionId !== sectionId) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      this.dropOverSectionId = sectionId;
    } else if (this.draggingProductId && this.draggingProductFromSectionId !== sectionId) {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      this.dropOverSectionId = sectionId;
    }
  }

  onSectionDragLeave(event: DragEvent, sectionId: string): void {
    const related = event.relatedTarget as Node | null;
    const el = event.currentTarget as HTMLElement;
    if (related && el.contains(related)) return;
    if (this.dropOverSectionId === sectionId) {
      this.dropOverSectionId = null;
      this.dropBeforeProductId = null;
    }
  }

  onSectionDrop(event: DragEvent, targetSectionId: string): void {
    event.preventDefault();
    if (this.draggingSectionId && this.draggingSectionId !== targetSectionId) {
      const list = [...this.sections];
      const from = list.findIndex(s => s.id === this.draggingSectionId);
      const to = list.findIndex(s => s.id === targetSectionId);
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      this.sections = list;
    } else if (this.draggingProductId && this.draggingProductFromSectionId) {
      this.moveProductTo(this.draggingProductFromSectionId, this.draggingProductId, targetSectionId, null);
    }
    this.clearDragState();
  }

  onProductDragStart(event: DragEvent, productId: string, sectionId: string): void {
    event.stopPropagation();
    this.draggingProductId = productId;
    this.draggingProductFromSectionId = sectionId;
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  onProductDragOver(event: DragEvent, productId: string, sectionId: string): void {
    if (!this.draggingProductId || this.draggingProductId === productId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropOverSectionId = sectionId;
    this.dropBeforeProductId = productId;
  }

  onProductDrop(event: DragEvent, targetProductId: string, targetSectionId: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.draggingProductId || !this.draggingProductFromSectionId) return;
    if (this.draggingProductId !== targetProductId) {
      this.moveProductTo(this.draggingProductFromSectionId, this.draggingProductId, targetSectionId, targetProductId);
    }
    this.clearDragState();
  }

  onProductGridDragOver(event: DragEvent, sectionId: string): void {
    if (!this.draggingProductId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dropOverSectionId = sectionId;
    this.dropBeforeProductId = null;
  }

  onProductGridDrop(event: DragEvent, sectionId: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.draggingProductId || !this.draggingProductFromSectionId) return;
    this.moveProductTo(this.draggingProductFromSectionId, this.draggingProductId, sectionId, null);
    this.clearDragState();
  }

  onDragEnd(): void {
    this.clearDragState();
  }

  private moveProductTo(fromSectionId: string, productId: string, toSectionId: string, beforeProductId: string | null): void {
    let moved: Product | null = null;

    let sections = this.sections.map(s => {
      if (s.id !== fromSectionId) return s;
      const products = s.products.filter(p => {
        if (p.id === productId) { moved = p; return false; }
        return true;
      });
      const featuredProductId = s.featuredProductId === productId ? null : s.featuredProductId;
      return { ...s, products, featuredProductId };
    });

    if (!moved) return;

    sections = sections.map(s => {
      if (s.id !== toSectionId) return s;
      const products = [...s.products];
      if (beforeProductId) {
        const idx = products.findIndex(p => p.id === beforeProductId);
        products.splice(idx >= 0 ? idx : products.length, 0, moved!);
      } else {
        products.push(moved!);
      }
      return { ...s, products };
    });

    this.sections = sections;
  }

  private clearDragState(): void {
    this.draggingSectionId = null;
    this.draggingProductId = null;
    this.draggingProductFromSectionId = null;
    this.dropOverSectionId = null;
    this.dropBeforeProductId = null;
  }

  clearAll(): void {
    this.snapshot();
    this.sections = [];
    this.expandedProductId = null;
    this.error = '';
    this.draftRestored = false;
    localStorage.removeItem(PdfGeneratorComponent.STORAGE_KEY);
  }

  dismissDraftBanner(): void {
    this.draftRestored = false;
  }

  // ─── Cloud methods ────────────────────────────────────────────────────────

  async signInWithGoogle(): Promise<void> {
    this.cloudError = '';
    try {
      await this.authService.signInWithGoogle();
    } catch {
      this.cloudError = 'Sign-in failed. Please try again.';
    }
  }

  signOut(): void {
    this.authService.signOut();
  }

  async saveToCloud(): Promise<void> {
    if (!this.currentUser) return;
    this.cloudSaving = true;
    this.cloudError = '';
    try {
      if (!this.cloudCatalogId) {
        this.cloudCatalogId = `catalog-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      }
      const name = this.config.title.trim() || 'Untitled Catalog';
      await this.catalogCloud.save(
        this.currentUser.uid,
        this.cloudCatalogId,
        name,
        this.config,
        this.sections,
        this.fieldConfigs
      );
      this.cloudSaved = true;
      setTimeout(() => { this.cloudSaved = false; }, 2500);
    } catch {
      this.cloudError = 'Save failed. Please try again.';
    } finally {
      this.cloudSaving = false;
    }
  }

  async openCatalogsPanel(): Promise<void> {
    if (!this.currentUser) return;
    this.showCatalogsPanel = true;
    this.cloudLoading = true;
    this.cloudError = '';
    try {
      this.cloudCatalogs = await this.catalogCloud.list(this.currentUser.uid);
    } catch {
      this.cloudError = 'Could not load catalogs. Please try again.';
    } finally {
      this.cloudLoading = false;
    }
  }

  closeCatalogsPanel(): void {
    this.showCatalogsPanel = false;
  }

  loadCloudCatalog(catalog: CloudCatalog): void {
    this.snapshot();
    this.config = { ...catalog.config };
    this.fieldConfigs = catalog.fieldConfigs.map(f => ({ ...f }));
    this.sections = catalog.sections;
    this.cloudCatalogId = catalog.id;
    this.showCatalogsPanel = false;
    this.expandedProductId = null;
    this.draftRestored = false;
  }

  async deleteCloudCatalog(catalogId: string): Promise<void> {
    if (!this.currentUser) return;
    try {
      await this.catalogCloud.remove(this.currentUser.uid, catalogId);
      this.cloudCatalogs = this.cloudCatalogs.filter(c => c.id !== catalogId);
      if (this.cloudCatalogId === catalogId) this.cloudCatalogId = null;
    } catch {
      this.cloudError = 'Delete failed. Please try again.';
    }
  }

  formatCloudDate(ts: { toDate(): Date }): string {
    return ts.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  getSectionCoverImg(section: ProductSection): ProductImage | null {
    const product = section.featuredProductId
      ? (section.products.find(p => p.id === section.featuredProductId) ?? section.products[0])
      : section.products[0];
    return product?.images[0] ?? null;
  }

  setFeaturedProduct(sectionId: string, productId: string): void {
    this.sections = this.sections.map(s =>
      s.id === sectionId
        ? { ...s, featuredProductId: s.featuredProductId === productId ? null : productId }
        : s
    );
  }

  getProductFieldValue(product: Product, key: FieldKey): string {
    return (product as ProductStringFields)[key];
  }

  // ─── TrackBy helpers ──────────────────────────────────────────────────────

  trackBySection(_: number, section: ProductSection): string {
    return section.id;
  }

  trackByProduct(_: number, product: Product): string {
    return product.id;
  }

  trackByImage(_: number, image: ProductImage): string {
    return image.id;
  }

  trackByField(_: number, fc: FieldConfig): string {
    return fc.key;
  }

  trackByIndex(index: number): number {
    return index;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildPreviewPages(): PreviewPage[] {
    const pages: PreviewPage[] = [];
    const populated = this.sections.filter(s => s.products.length > 0);

    if (this.config.showCoverPage) {
      pages.push({ type: 'cover' });
    }

    for (const section of populated) {
      if (this.config.showSectionDividers) {
        pages.push({ type: 'divider', sectionName: section.name });
      }

      if (this.config.template === 'editorial') {
        for (const { items, layout } of buildCollagePages(section.products)) {
          pages.push({
            type: 'editorial',
            sectionName: section.name,
            products: items,
            collageLayout: layout,
          });
        }
      } else {
        const cols = this.config.columns;
        const perPage = cols * 3;
        for (let i = 0; i < section.products.length; i += perPage) {
          pages.push({
            type: this.config.template,
            sectionName: section.name,
            products: section.products.slice(i, i + perPage),
            cols,
          });
        }
      }
    }

    return pages;
  }

  private async addFolderFiles(files: File[]): Promise<void> {
    const images = files.filter(f => f.type.startsWith('image/'));
    if (!images.length) { this.error = 'No image files found in selected folder(s).'; return; }
    this.error = '';

    const groups = new Map<string, File[]>();
    for (const file of images) {
      const rel = (file as { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
      const parts = rel.split('/');
      const folder = parts.length > 1 ? parts[0] : 'General';
      if (!groups.has(folder)) groups.set(folder, []);
      groups.get(folder)!.push(file);
    }

    for (const [folder, folderFiles] of groups) {
      await this.addProductsFromFiles(folderFiles, folder);
    }
  }

  private async addProductsFromFiles(files: File[], sectionName: string): Promise<void> {
    const images = files.filter(f => f.type.startsWith('image/'));
    const rejected = files.length - images.length;
    if (rejected > 0) this.error = `${rejected} non-image file(s) skipped.`;
    if (!images.length) return;

    const newProducts = await Promise.all(
      images.map(async (file) => {
        const { dataUrl, naturalWidth, naturalHeight } = await CatalogPdfService.readFile(file);
        const productImage: ProductImage = {
          id: `img-${file.name}-${Date.now()}-${Math.random()}`,
          file,
          dataUrl,
          mimeType: file.type,
          naturalWidth,
          naturalHeight,
          isPrimary: true,
        };
        const product = this.newProduct();
        product.name = file.name.replace(/\.[^/.]+$/, '');
        product.images = [productImage];
        return product;
      })
    );

    const existing = this.sections.find(
      s => s.name.toLowerCase() === sectionName.toLowerCase()
    );

    if (existing) {
      this.sections = this.sections.map(s =>
        s.id === existing.id ? { ...s, products: [...s.products, ...newProducts] } : s
      );
    } else {
      const newSection: ProductSection = {
        id: `section-${Date.now()}-${Math.random()}`,
        name: sectionName,
        subtitle: '',
        products: newProducts,
        collapsed: false,
        featuredProductId: null,
      };
      this.sections = [...this.sections, newSection];
    }
  }

  private newProduct(): Product {
    return {
      id: `product-${Date.now()}-${Math.random()}`,
      images: [],
      name: '',
      description: '',
      longDescription: '',
      price: '',
      salePrice: '',
      sku: '',
      category: '',
      dimensions: '',
      materials: '',
      colors: '',
      notes: '',
      badges: [],
    };
  }
}
