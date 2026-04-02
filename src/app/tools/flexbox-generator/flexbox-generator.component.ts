import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface FlexChild {
  id: number;
  flexGrow: number;
  flexShrink: number;
  flexBasis: string;
  order: number;
  alignSelf: string;
  color: string;
}

interface FlexPreset {
  name: string;
  description: string;
  container: Partial<FlexboxGeneratorComponent>;
  children: Omit<FlexChild, 'id'>[];
}

const CHILD_COLORS = [
  '#00ffcc', '#ff6b6b', '#ffd93d', '#6bcbff',
  '#c084fc', '#fb923c', '#34d399', '#f472b6',
  '#a78bfa', '#38bdf8', '#facc15', '#4ade80'
];

@Component({
  selector: 'app-flexbox-generator',
  templateUrl: './flexbox-generator.component.html',
  styleUrls: ['./flexbox-generator.component.css'],
  standalone: false
})
export class FlexboxGeneratorComponent {
  // Container properties
  flexDirection: string = 'row';
  justifyContent: string = 'flex-start';
  alignItems: string = 'stretch';
  alignContent: string = 'stretch';
  flexWrap: string = 'nowrap';
  gap: number = 10;

  // Children
  children: FlexChild[] = [];
  private nextId = 1;
  selectedChildIndex: number | null = null;

  // Code output
  codeCopied = false;

  // Options for selects
  readonly flexDirectionOptions = ['row', 'row-reverse', 'column', 'column-reverse'];
  readonly justifyContentOptions = ['flex-start', 'flex-end', 'center', 'space-between', 'space-around', 'space-evenly'];
  readonly alignItemsOptions = ['stretch', 'flex-start', 'flex-end', 'center', 'baseline'];
  readonly alignContentOptions = ['stretch', 'flex-start', 'flex-end', 'center', 'space-between', 'space-around'];
  readonly flexWrapOptions = ['nowrap', 'wrap', 'wrap-reverse'];
  readonly alignSelfOptions = ['auto', 'flex-start', 'flex-end', 'center', 'stretch', 'baseline'];

  readonly presets: FlexPreset[] = [
    {
      name: 'Navbar',
      description: 'Horizontal navigation bar with spaced items',
      container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'nowrap',
        gap: 12
      },
      children: [
        { flexGrow: 0, flexShrink: 0, flexBasis: '80px', order: 0, alignSelf: 'auto', color: CHILD_COLORS[0] },
        { flexGrow: 1, flexShrink: 1, flexBasis: 'auto', order: 0, alignSelf: 'auto', color: CHILD_COLORS[1] },
        { flexGrow: 0, flexShrink: 0, flexBasis: '60px', order: 0, alignSelf: 'auto', color: CHILD_COLORS[2] },
        { flexGrow: 0, flexShrink: 0, flexBasis: '60px', order: 0, alignSelf: 'auto', color: CHILD_COLORS[3] }
      ]
    },
    {
      name: 'Card Row',
      description: 'Evenly spaced cards that wrap',
      container: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'stretch',
        flexWrap: 'wrap',
        gap: 16
      },
      children: [
        { flexGrow: 0, flexShrink: 1, flexBasis: '150px', order: 0, alignSelf: 'auto', color: CHILD_COLORS[0] },
        { flexGrow: 0, flexShrink: 1, flexBasis: '150px', order: 0, alignSelf: 'auto', color: CHILD_COLORS[1] },
        { flexGrow: 0, flexShrink: 1, flexBasis: '150px', order: 0, alignSelf: 'auto', color: CHILD_COLORS[2] }
      ]
    },
    {
      name: 'Holy Grail',
      description: 'Classic header / sidebar / main / sidebar / footer',
      container: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        flexWrap: 'wrap',
        gap: 8
      },
      children: [
        { flexGrow: 0, flexShrink: 0, flexBasis: '100%', order: -1, alignSelf: 'auto', color: CHILD_COLORS[0] },
        { flexGrow: 0, flexShrink: 0, flexBasis: '100px', order: 0, alignSelf: 'auto', color: CHILD_COLORS[1] },
        { flexGrow: 1, flexShrink: 1, flexBasis: '0%', order: 0, alignSelf: 'auto', color: CHILD_COLORS[2] },
        { flexGrow: 0, flexShrink: 0, flexBasis: '100px', order: 0, alignSelf: 'auto', color: CHILD_COLORS[3] },
        { flexGrow: 0, flexShrink: 0, flexBasis: '100%', order: 1, alignSelf: 'auto', color: CHILD_COLORS[4] }
      ]
    },
    {
      name: 'Sidebar',
      description: 'Fixed sidebar with flexible main content',
      container: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        flexWrap: 'nowrap',
        gap: 0
      },
      children: [
        { flexGrow: 0, flexShrink: 0, flexBasis: '200px', order: 0, alignSelf: 'auto', color: CHILD_COLORS[0] },
        { flexGrow: 1, flexShrink: 1, flexBasis: '0%', order: 0, alignSelf: 'auto', color: CHILD_COLORS[1] }
      ]
    }
  ];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Flexbox Generator — visual playground with live preview and one-click code copy')}&url=${encodeURIComponent(SITE_URL + '/tools/flexbox-generator')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/flexbox-generator')}`;

  constructor(
    private router: Router,
    private translationService: TranslationService,
    private eggs: EasterEggService
  ) {
    // Start with 3 children
    this.addChild();
    this.addChild();
    this.addChild();
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Child Management ──────────────────────────────────────

  addChild(): void {
    if (this.children.length >= 12) return;
    const colorIndex = this.children.length % CHILD_COLORS.length;
    const child: FlexChild = {
      id: this.nextId++,
      flexGrow: 0,
      flexShrink: 1,
      flexBasis: 'auto',
      order: 0,
      alignSelf: 'auto',
      color: CHILD_COLORS[colorIndex]
    };
    this.children.push(child);
    this.selectedChildIndex = this.children.length - 1;

    // Easter egg: exactly 12 children
    if (this.children.length === 12) {
      this.eggs.trigger('flex-dozen');
    }
  }

  removeChild(index: number): void {
    if (this.children.length <= 1) return;
    this.children.splice(index, 1);
    if (this.selectedChildIndex !== null) {
      if (this.selectedChildIndex >= this.children.length) {
        this.selectedChildIndex = this.children.length - 1;
      } else if (this.selectedChildIndex === index) {
        this.selectedChildIndex = Math.min(index, this.children.length - 1);
      }
    }
  }

  selectChild(index: number): void {
    this.selectedChildIndex = index;
  }

  get selectedChild(): FlexChild | null {
    if (this.selectedChildIndex === null) return null;
    return this.children[this.selectedChildIndex] || null;
  }

  trackByChildId(index: number, child: FlexChild): number {
    return child.id;
  }

  trackByPresetName(index: number, preset: FlexPreset): string {
    return preset.name;
  }

  // ── Preset Application ────────────────────────────────────

  applyPreset(preset: FlexPreset): void {
    // Apply container settings
    if (preset.container.flexDirection !== undefined) this.flexDirection = preset.container.flexDirection;
    if (preset.container.justifyContent !== undefined) this.justifyContent = preset.container.justifyContent;
    if (preset.container.alignItems !== undefined) this.alignItems = preset.container.alignItems;
    if (preset.container.flexWrap !== undefined) this.flexWrap = preset.container.flexWrap;
    if (preset.container.gap !== undefined) this.gap = preset.container.gap;
    if (preset.container.alignContent !== undefined) this.alignContent = preset.container.alignContent;

    // Rebuild children
    this.children = preset.children.map(c => ({
      ...c,
      id: this.nextId++
    }));
    this.selectedChildIndex = 0;
  }

  // ── Container Style ───────────────────────────────────────

  get containerStyle(): { [key: string]: string } {
    return {
      'display': 'flex',
      'flex-direction': this.flexDirection,
      'justify-content': this.justifyContent,
      'align-items': this.alignItems,
      'align-content': this.alignContent,
      'flex-wrap': this.flexWrap,
      'gap': this.gap + 'px'
    };
  }

  getChildStyle(child: FlexChild): { [key: string]: string } {
    return {
      'flex-grow': String(child.flexGrow),
      'flex-shrink': String(child.flexShrink),
      'flex-basis': child.flexBasis,
      'order': String(child.order),
      'align-self': child.alignSelf,
      'background': child.color
    };
  }

  // ── Code Generation ───────────────────────────────────────

  get cssCode(): string {
    let code = `.fx-container {\n`;
    code += `  display: flex;\n`;
    if (this.flexDirection !== 'row') code += `  flex-direction: ${this.flexDirection};\n`;
    if (this.justifyContent !== 'flex-start') code += `  justify-content: ${this.justifyContent};\n`;
    if (this.alignItems !== 'stretch') code += `  align-items: ${this.alignItems};\n`;
    if (this.alignContent !== 'stretch') code += `  align-content: ${this.alignContent};\n`;
    if (this.flexWrap !== 'nowrap') code += `  flex-wrap: ${this.flexWrap};\n`;
    if (this.gap > 0) code += `  gap: ${this.gap}px;\n`;
    code += `}\n`;

    // Check if any children have non-default values
    const hasCustomChildren = this.children.some(c =>
      c.flexGrow !== 0 || c.flexShrink !== 1 || c.flexBasis !== 'auto' || c.order !== 0 || c.alignSelf !== 'auto'
    );

    if (hasCustomChildren) {
      this.children.forEach((child, i) => {
        const parts: string[] = [];
        if (child.flexGrow !== 0) parts.push(`  flex-grow: ${child.flexGrow};`);
        if (child.flexShrink !== 1) parts.push(`  flex-shrink: ${child.flexShrink};`);
        if (child.flexBasis !== 'auto') parts.push(`  flex-basis: ${child.flexBasis};`);
        if (child.order !== 0) parts.push(`  order: ${child.order};`);
        if (child.alignSelf !== 'auto') parts.push(`  align-self: ${child.alignSelf};`);
        if (parts.length > 0) {
          code += `\n.fx-item-${i + 1} {\n${parts.join('\n')}\n}\n`;
        }
      });
    }

    return code;
  }

  copyCSS(): void {
    navigator.clipboard.writeText(this.cssCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  // ── Slider Helpers ────────────────────────────────────────

  onGapChange(event: Event): void {
    this.gap = parseInt((event.target as HTMLInputElement).value, 10);
  }

  updateChildField(field: keyof FlexChild, value: any): void {
    const child = this.selectedChild;
    if (!child) return;
    (child as any)[field] = value;
  }

  updateChildSlider(field: keyof FlexChild, event: Event): void {
    const target = event.target as HTMLInputElement;
    this.updateChildField(field, parseFloat(target.value));
  }

  resetAll(): void {
    this.flexDirection = 'row';
    this.justifyContent = 'flex-start';
    this.alignItems = 'stretch';
    this.alignContent = 'stretch';
    this.flexWrap = 'nowrap';
    this.gap = 10;
    this.children = [];
    this.nextId = 1;
    this.selectedChildIndex = null;
    this.addChild();
    this.addChild();
    this.addChild();
  }
}
