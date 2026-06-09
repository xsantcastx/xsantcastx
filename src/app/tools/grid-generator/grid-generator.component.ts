import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { NgStyle } from '@angular/common';

interface GridItem {
  id: number;
  label: string;
  colStart: number;
  colSpan: number;
  rowStart: number;
  rowSpan: number;
  color: string;
  areaName: string;
}

interface GridPreset {
  name: string;
  description: string;
  rows: number;
  columns: number;
  gap: number;
  rowTemplate: string[];
  colTemplate: string[];
  items: Omit<GridItem, 'id'>[];
  areas: string[][];
  useAreas: boolean;
}

const CELL_COLORS = [
  '#00ffcc', '#ff6b6b', '#ffd93d', '#6bcbff',
  '#c084fc', '#fb923c', '#34d399', '#f472b6',
  '#a78bfa', '#38bdf8', '#facc15', '#4ade80'
];

const TEMPLATE_UNITS = ['fr', 'px', 'auto', 'minmax'];

@Component({
    selector: 'app-grid-generator',
    templateUrl: './grid-generator.component.html',
    styleUrls: ['./grid-generator.component.css'],
    imports: [ToolsSharedModule, NgStyle]
})
export class GridGeneratorComponent {
  // Grid properties
  rows = 3;
  columns = 3;
  gap = 10;
  rowTemplate: string[] = ['1fr', '1fr', '1fr'];
  colTemplate: string[] = ['1fr', '1fr', '1fr'];

  // Template areas
  useAreas = false;
  areas: string[][] = [];

  // Items
  items: GridItem[] = [];
  private nextId = 1;
  selectedItemIndex: number | null = null;

  // Code output
  codeCopied = false;

  // Options
  readonly templateUnits = TEMPLATE_UNITS;
  readonly maxTrackCount = 12;

  readonly presets: GridPreset[] = [
    {
      name: 'Holy Grail',
      description: 'Classic header, sidebar, main, sidebar, footer layout',
      rows: 3,
      columns: 3,
      gap: 8,
      rowTemplate: ['auto', '1fr', 'auto'],
      colTemplate: ['200px', '1fr', '200px'],
      useAreas: true,
      areas: [
        ['header', 'header', 'header'],
        ['sidebar-l', 'main', 'sidebar-r'],
        ['footer', 'footer', 'footer']
      ],
      items: [
        { label: 'Header', colStart: 1, colSpan: 3, rowStart: 1, rowSpan: 1, color: CELL_COLORS[0], areaName: 'header' },
        { label: 'Sidebar L', colStart: 1, colSpan: 1, rowStart: 2, rowSpan: 1, color: CELL_COLORS[1], areaName: 'sidebar-l' },
        { label: 'Main', colStart: 2, colSpan: 1, rowStart: 2, rowSpan: 1, color: CELL_COLORS[2], areaName: 'main' },
        { label: 'Sidebar R', colStart: 3, colSpan: 1, rowStart: 2, rowSpan: 1, color: CELL_COLORS[3], areaName: 'sidebar-r' },
        { label: 'Footer', colStart: 1, colSpan: 3, rowStart: 3, rowSpan: 1, color: CELL_COLORS[4], areaName: 'footer' }
      ]
    },
    {
      name: 'Dashboard',
      description: 'Admin dashboard with sidebar and card grid',
      rows: 4,
      columns: 4,
      gap: 12,
      rowTemplate: ['60px', '1fr', '1fr', '1fr'],
      colTemplate: ['220px', '1fr', '1fr', '1fr'],
      useAreas: false,
      areas: [],
      items: [
        { label: 'Nav', colStart: 1, colSpan: 4, rowStart: 1, rowSpan: 1, color: CELL_COLORS[0], areaName: '' },
        { label: 'Sidebar', colStart: 1, colSpan: 1, rowStart: 2, rowSpan: 3, color: CELL_COLORS[1], areaName: '' },
        { label: 'Card 1', colStart: 2, colSpan: 1, rowStart: 2, rowSpan: 1, color: CELL_COLORS[2], areaName: '' },
        { label: 'Card 2', colStart: 3, colSpan: 1, rowStart: 2, rowSpan: 1, color: CELL_COLORS[3], areaName: '' },
        { label: 'Card 3', colStart: 4, colSpan: 1, rowStart: 2, rowSpan: 1, color: CELL_COLORS[4], areaName: '' },
        { label: 'Chart', colStart: 2, colSpan: 2, rowStart: 3, rowSpan: 2, color: CELL_COLORS[5], areaName: '' },
        { label: 'Table', colStart: 4, colSpan: 1, rowStart: 3, rowSpan: 2, color: CELL_COLORS[6], areaName: '' }
      ]
    },
    {
      name: 'Gallery',
      description: 'Responsive image gallery grid with varied sizes',
      rows: 3,
      columns: 4,
      gap: 8,
      rowTemplate: ['1fr', '1fr', '1fr'],
      colTemplate: ['1fr', '1fr', '1fr', '1fr'],
      useAreas: false,
      areas: [],
      items: [
        { label: 'Hero', colStart: 1, colSpan: 2, rowStart: 1, rowSpan: 2, color: CELL_COLORS[0], areaName: '' },
        { label: 'Img 2', colStart: 3, colSpan: 1, rowStart: 1, rowSpan: 1, color: CELL_COLORS[1], areaName: '' },
        { label: 'Img 3', colStart: 4, colSpan: 1, rowStart: 1, rowSpan: 1, color: CELL_COLORS[2], areaName: '' },
        { label: 'Img 4', colStart: 3, colSpan: 2, rowStart: 2, rowSpan: 1, color: CELL_COLORS[3], areaName: '' },
        { label: 'Img 5', colStart: 1, colSpan: 1, rowStart: 3, rowSpan: 1, color: CELL_COLORS[4], areaName: '' },
        { label: 'Img 6', colStart: 2, colSpan: 1, rowStart: 3, rowSpan: 1, color: CELL_COLORS[5], areaName: '' },
        { label: 'Img 7', colStart: 3, colSpan: 2, rowStart: 3, rowSpan: 1, color: CELL_COLORS[6], areaName: '' }
      ]
    },
    {
      name: 'Sidebar',
      description: 'Simple two-column layout with fixed sidebar',
      rows: 1,
      columns: 2,
      gap: 0,
      rowTemplate: ['1fr'],
      colTemplate: ['260px', '1fr'],
      useAreas: false,
      areas: [],
      items: [
        { label: 'Sidebar', colStart: 1, colSpan: 1, rowStart: 1, rowSpan: 1, color: CELL_COLORS[0], areaName: '' },
        { label: 'Content', colStart: 2, colSpan: 1, rowStart: 1, rowSpan: 1, color: CELL_COLORS[1], areaName: '' }
      ]
    }
  ];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Grid Generator — visual playground with live preview and one-click code copy')}&url=${encodeURIComponent(SITE_URL + '/tools/grid-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/grid-generator')}`;

  constructor(
    private router: Router,
    private translationService: TranslationService,
    private eggs: EasterEggService
  ) {
    this.initDefaultItems();
    this.rebuildAreas();
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Track Helpers ────────────────────────────────────────

  onRowsChange(value: number): void {
    const prev = this.rows;
    this.rows = Math.max(1, Math.min(12, value));
    this.syncTemplateArray('row', prev, this.rows);
    this.rebuildAreas();
    this.checkMatrixEgg();
  }

  onColumnsChange(value: number): void {
    const prev = this.columns;
    this.columns = Math.max(1, Math.min(12, value));
    this.syncTemplateArray('col', prev, this.columns);
    this.rebuildAreas();
    this.checkMatrixEgg();
  }

  onGapChange(event: Event): void {
    this.gap = parseInt((event.target as HTMLInputElement).value, 10);
  }

  private syncTemplateArray(axis: 'row' | 'col', oldCount: number, newCount: number): void {
    const arr = axis === 'row' ? this.rowTemplate : this.colTemplate;
    if (newCount > oldCount) {
      for (let i = oldCount; i < newCount; i++) {
        arr.push('1fr');
      }
    } else if (newCount < oldCount) {
      arr.splice(newCount);
    }
    if (axis === 'row') {
      this.rowTemplate = [...arr];
    } else {
      this.colTemplate = [...arr];
    }
  }

  updateRowTemplate(index: number, value: string): void {
    this.rowTemplate[index] = value;
    this.rowTemplate = [...this.rowTemplate];
  }

  updateColTemplate(index: number, value: string): void {
    this.colTemplate[index] = value;
    this.colTemplate = [...this.colTemplate];
  }

  getTemplateDisplay(value: string): string {
    return value;
  }

  // ── Template Areas ──────────────────────────────────────

  toggleAreas(): void {
    this.useAreas = !this.useAreas;
    if (this.useAreas) {
      this.rebuildAreas();
    }
  }

  rebuildAreas(): void {
    const newAreas: string[][] = [];
    for (let r = 0; r < this.rows; r++) {
      const row: string[] = [];
      for (let c = 0; c < this.columns; c++) {
        // Preserve existing area names
        if (this.areas[r] && this.areas[r][c]) {
          row.push(this.areas[r][c]);
        } else {
          row.push('.');
        }
      }
      newAreas.push(row);
    }
    this.areas = newAreas;
  }

  updateAreaCell(row: number, col: number, value: string): void {
    if (this.areas[row]) {
      this.areas[row][col] = value.trim() || '.';
    }
  }

  // ── Item Management ─────────────────────────────────────

  addItem(): void {
    if (this.items.length >= 24) return;
    const colorIndex = this.items.length % CELL_COLORS.length;
    const item: GridItem = {
      id: this.nextId++,
      label: `Item ${this.items.length + 1}`,
      colStart: 1,
      colSpan: 1,
      rowStart: 1,
      rowSpan: 1,
      color: CELL_COLORS[colorIndex],
      areaName: ''
    };
    this.items.push(item);
    this.selectedItemIndex = this.items.length - 1;
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.splice(index, 1);
    if (this.selectedItemIndex !== null) {
      if (this.selectedItemIndex >= this.items.length) {
        this.selectedItemIndex = this.items.length - 1;
      } else if (this.selectedItemIndex === index) {
        this.selectedItemIndex = Math.min(index, this.items.length - 1);
      }
    }
  }

  selectItem(index: number): void {
    this.selectedItemIndex = index;
  }

  get selectedItem(): GridItem | null {
    if (this.selectedItemIndex === null) return null;
    return this.items[this.selectedItemIndex] || null;
  }

  trackByItemId(index: number, item: GridItem): number {
    return item.id;
  }

  trackByPresetName(index: number, preset: GridPreset): string {
    return preset.name;
  }

  trackByIndex(index: number): number {
    return index;
  }

  private initDefaultItems(): void {
    for (let r = 1; r <= this.rows; r++) {
      for (let c = 1; c <= this.columns; c++) {
        if (this.items.length >= 9) break;
        const colorIndex = this.items.length % CELL_COLORS.length;
        this.items.push({
          id: this.nextId++,
          label: `${this.items.length + 1}`,
          colStart: c,
          colSpan: 1,
          rowStart: r,
          rowSpan: 1,
          color: CELL_COLORS[colorIndex],
          areaName: ''
        });
      }
    }
    this.selectedItemIndex = 0;
  }

  // ── Item Property Updates ───────────────────────────────

  updateItemField(field: keyof GridItem, value: any): void {
    const item = this.selectedItem;
    if (!item) return;
    (item as any)[field] = value;
  }

  updateItemNumericField(field: keyof GridItem, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(val)) {
      this.updateItemField(field, val);
    }
  }

  // ── Preset Application ──────────────────────────────────

  applyPreset(preset: GridPreset): void {
    this.rows = preset.rows;
    this.columns = preset.columns;
    this.gap = preset.gap;
    this.rowTemplate = [...preset.rowTemplate];
    this.colTemplate = [...preset.colTemplate];
    this.useAreas = preset.useAreas;
    this.areas = preset.areas.map(row => [...row]);

    this.items = preset.items.map(item => ({
      ...item,
      id: this.nextId++
    }));
    this.selectedItemIndex = 0;

    if (!this.useAreas) {
      this.rebuildAreas();
    }
  }

  // ── Container Style ─────────────────────────────────────

  get containerStyle(): { [key: string]: string } {
    const style: { [key: string]: string } = {
      'display': 'grid',
      'grid-template-rows': this.rowTemplate.join(' '),
      'grid-template-columns': this.colTemplate.join(' '),
      'gap': this.gap + 'px'
    };
    if (this.useAreas && this.areas.length > 0) {
      style['grid-template-areas'] = this.areas
        .map(row => `"${row.join(' ')}"`)
        .join(' ');
    }
    return style;
  }

  getItemStyle(item: GridItem): { [key: string]: string } {
    const style: { [key: string]: string } = {
      'background': item.color
    };
    if (this.useAreas && item.areaName) {
      style['grid-area'] = item.areaName;
    } else {
      style['grid-column'] = `${item.colStart} / span ${item.colSpan}`;
      style['grid-row'] = `${item.rowStart} / span ${item.rowSpan}`;
    }
    return style;
  }

  // ── Code Generation ─────────────────────────────────────

  get cssCode(): string {
    let code = `.gg-container {\n`;
    code += `  display: grid;\n`;
    code += `  grid-template-columns: ${this.colTemplate.join(' ')};\n`;
    code += `  grid-template-rows: ${this.rowTemplate.join(' ')};\n`;
    if (this.gap > 0) code += `  gap: ${this.gap}px;\n`;

    if (this.useAreas && this.areas.length > 0) {
      code += `  grid-template-areas:\n`;
      this.areas.forEach((row, i) => {
        const isLast = i === this.areas.length - 1;
        code += `    "${row.join(' ')}"${isLast ? ';' : ''}\n`;
      });
    }

    code += `}\n`;

    // Generate per-item CSS
    this.items.forEach((item, i) => {
      const parts: string[] = [];
      if (this.useAreas && item.areaName) {
        parts.push(`  grid-area: ${item.areaName};`);
      } else {
        if (item.colSpan > 1 || item.colStart > 1) {
          parts.push(`  grid-column: ${item.colStart} / span ${item.colSpan};`);
        }
        if (item.rowSpan > 1 || item.rowStart > 1) {
          parts.push(`  grid-row: ${item.rowStart} / span ${item.rowSpan};`);
        }
      }
      if (parts.length > 0) {
        code += `\n.gg-item-${i + 1} {\n${parts.join('\n')}\n}\n`;
      }
    });

    return code;
  }

  copyCSS(): void {
    navigator.clipboard.writeText(this.cssCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  // ── Reset ───────────────────────────────────────────────

  resetAll(): void {
    this.rows = 3;
    this.columns = 3;
    this.gap = 10;
    this.rowTemplate = ['1fr', '1fr', '1fr'];
    this.colTemplate = ['1fr', '1fr', '1fr'];
    this.useAreas = false;
    this.areas = [];
    this.items = [];
    this.nextId = 1;
    this.selectedItemIndex = null;
    this.initDefaultItems();
    this.rebuildAreas();
  }

  // ── Easter Egg ──────────────────────────────────────────

  private checkMatrixEgg(): void {
    if (this.rows === 12 && this.columns === 12) {
      this.eggs.trigger('grid-matrix');
    }
  }
}
