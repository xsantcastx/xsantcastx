import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface CornerRadius {
  topLeft: number;
  topRight: number;
  bottomRight: number;
  bottomLeft: number;
}

interface AdvancedCornerRadius {
  topLeftH: number;
  topLeftV: number;
  topRightH: number;
  topRightV: number;
  bottomRightH: number;
  bottomRightV: number;
  bottomLeftH: number;
  bottomLeftV: number;
}

interface RadiusPreset {
  name: string;
  corners: CornerRadius;
  unit: 'px' | '%';
  advanced?: AdvancedCornerRadius;
  advancedUnit?: 'px' | '%';
}

@Component({
  selector: 'app-border-radius',
  templateUrl: './border-radius.component.html',
  styleUrls: ['./border-radius.component.css'],
  standalone: false
})
export class BorderRadiusComponent {
  private readonly eggs = inject(EasterEggService);

  corners: CornerRadius = {
    topLeft: 12,
    topRight: 12,
    bottomRight: 12,
    bottomLeft: 12
  };

  advancedCorners: AdvancedCornerRadius = {
    topLeftH: 12,
    topLeftV: 12,
    topRightH: 12,
    topRightV: 12,
    bottomRightH: 12,
    bottomRightV: 12,
    bottomLeftH: 12,
    bottomLeftV: 12
  };

  unit: 'px' | '%' = 'px';
  linked = true;
  advancedMode = false;

  previewBgColor = '#ffffff';
  previewBoxColor = '#00ffcc';
  previewBoxWidth = 200;
  previewBoxHeight = 200;

  codeCopied = false;
  codeFormat: 'css' | 'tailwind' = 'css';

  readonly presets: RadiusPreset[] = [
    {
      name: 'None',
      corners: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      unit: 'px'
    },
    {
      name: 'Rounded Square',
      corners: { topLeft: 12, topRight: 12, bottomRight: 12, bottomLeft: 12 },
      unit: 'px'
    },
    {
      name: 'Circle',
      corners: { topLeft: 50, topRight: 50, bottomRight: 50, bottomLeft: 50 },
      unit: '%'
    },
    {
      name: 'Pill',
      corners: { topLeft: 200, topRight: 200, bottomRight: 200, bottomLeft: 200 },
      unit: 'px'
    },
    {
      name: 'Ticket',
      corners: { topLeft: 16, topRight: 16, bottomRight: 0, bottomLeft: 0 },
      unit: 'px'
    },
    {
      name: 'Drop',
      corners: { topLeft: 50, topRight: 50, bottomRight: 50, bottomLeft: 0 },
      unit: '%'
    },
    {
      name: 'Leaf',
      corners: { topLeft: 50, topRight: 0, bottomRight: 50, bottomLeft: 0 },
      unit: '%'
    },
    {
      name: 'Organic Blob',
      corners: { topLeft: 30, topRight: 70, bottomRight: 40, bottomLeft: 60 },
      unit: '%',
      advanced: {
        topLeftH: 30, topLeftV: 70,
        topRightH: 70, topRightV: 30,
        bottomRightH: 40, bottomRightV: 60,
        bottomLeftH: 60, bottomLeftV: 40
      },
      advancedUnit: '%'
    },
    {
      name: 'Blob Alt',
      corners: { topLeft: 60, topRight: 40, bottomRight: 70, bottomLeft: 30 },
      unit: '%',
      advanced: {
        topLeftH: 60, topLeftV: 40,
        topRightH: 40, topRightV: 70,
        bottomRightH: 70, bottomRightV: 30,
        bottomLeftH: 30, bottomLeftV: 60
      },
      advancedUnit: '%'
    },
    {
      name: 'Message',
      corners: { topLeft: 20, topRight: 20, bottomRight: 0, bottomLeft: 20 },
      unit: 'px'
    }
  ];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Border Radius Generator — design beautiful rounded corners with live preview and one-click code copy')}&url=${encodeURIComponent(SITE_URL + '/tools/border-radius')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/border-radius')}`;

  constructor(private router: Router, private translationService: TranslationService) {}

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  get sliderMax(): number {
    return this.unit === '%' ? 50 : 200;
  }

  get advancedSliderMax(): number {
    return this.unit === '%' ? 50 : 200;
  }

  onCornerChange(corner: keyof CornerRadius, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (this.linked) {
      this.corners.topLeft = value;
      this.corners.topRight = value;
      this.corners.bottomRight = value;
      this.corners.bottomLeft = value;
    } else {
      this.corners[corner] = value;
    }
    this.checkCircleEasterEgg();
  }

  onAdvancedCornerChange(corner: keyof AdvancedCornerRadius, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.advancedCorners[corner] = value;
  }

  toggleLinked(): void {
    this.linked = !this.linked;
    if (this.linked) {
      const value = this.corners.topLeft;
      this.corners.topRight = value;
      this.corners.bottomRight = value;
      this.corners.bottomLeft = value;
    }
  }

  toggleUnit(): void {
    this.unit = this.unit === 'px' ? '%' : 'px';
  }

  toggleAdvancedMode(): void {
    this.advancedMode = !this.advancedMode;
    if (this.advancedMode) {
      this.advancedCorners = {
        topLeftH: this.corners.topLeft,
        topLeftV: this.corners.topLeft,
        topRightH: this.corners.topRight,
        topRightV: this.corners.topRight,
        bottomRightH: this.corners.bottomRight,
        bottomRightV: this.corners.bottomRight,
        bottomLeftH: this.corners.bottomLeft,
        bottomLeftV: this.corners.bottomLeft
      };
    }
  }

  applyPreset(preset: RadiusPreset): void {
    this.unit = preset.unit;
    this.corners = { ...preset.corners };
    this.linked = preset.corners.topLeft === preset.corners.topRight
      && preset.corners.topRight === preset.corners.bottomRight
      && preset.corners.bottomRight === preset.corners.bottomLeft;

    if (preset.advanced && preset.advancedUnit) {
      this.advancedMode = true;
      this.unit = preset.advancedUnit;
      this.advancedCorners = { ...preset.advanced };
    } else {
      this.advancedMode = false;
      this.advancedCorners = {
        topLeftH: preset.corners.topLeft,
        topLeftV: preset.corners.topLeft,
        topRightH: preset.corners.topRight,
        topRightV: preset.corners.topRight,
        bottomRightH: preset.corners.bottomRight,
        bottomRightV: preset.corners.bottomRight,
        bottomLeftH: preset.corners.bottomLeft,
        bottomLeftV: preset.corners.bottomLeft
      };
    }
    this.checkCircleEasterEgg();
  }

  private checkCircleEasterEgg(): void {
    if (
      this.unit === '%' &&
      this.corners.topLeft === 50 &&
      this.corners.topRight === 50 &&
      this.corners.bottomRight === 50 &&
      this.corners.bottomLeft === 50
    ) {
      this.eggs.trigger('br-circle');
    }
  }

  get borderRadiusValue(): string {
    if (this.advancedMode) {
      const u = this.unit;
      const h = `${this.advancedCorners.topLeftH}${u} ${this.advancedCorners.topRightH}${u} ${this.advancedCorners.bottomRightH}${u} ${this.advancedCorners.bottomLeftH}${u}`;
      const v = `${this.advancedCorners.topLeftV}${u} ${this.advancedCorners.topRightV}${u} ${this.advancedCorners.bottomRightV}${u} ${this.advancedCorners.bottomLeftV}${u}`;
      return `${h} / ${v}`;
    }

    const u = this.unit;
    const { topLeft, topRight, bottomRight, bottomLeft } = this.corners;

    if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
      return `${topLeft}${u}`;
    }
    if (topLeft === bottomRight && topRight === bottomLeft) {
      return `${topLeft}${u} ${topRight}${u}`;
    }
    if (topRight === bottomLeft) {
      return `${topLeft}${u} ${topRight}${u} ${bottomRight}${u}`;
    }
    return `${topLeft}${u} ${topRight}${u} ${bottomRight}${u} ${bottomLeft}${u}`;
  }

  get borderRadiusInline(): string {
    return this.borderRadiusValue;
  }

  get cssCode(): string {
    return `border-radius: ${this.borderRadiusValue};`;
  }

  get tailwindCode(): string {
    if (this.advancedMode) {
      return `rounded-[${this.borderRadiusValue.replace(/ /g, '_')}]`;
    }
    const { topLeft, topRight, bottomRight, bottomLeft } = this.corners;
    const u = this.unit;
    if (topLeft === topRight && topRight === bottomRight && bottomRight === bottomLeft) {
      return `rounded-[${topLeft}${u}]`;
    }
    return `rounded-tl-[${topLeft}${u}] rounded-tr-[${topRight}${u}] rounded-br-[${bottomRight}${u}] rounded-bl-[${bottomLeft}${u}]`;
  }

  get displayedCode(): string {
    return this.codeFormat === 'css' ? this.cssCode : this.tailwindCode;
  }

  copyDisplayedCode(): void {
    const text = this.codeFormat === 'css' ? this.cssCode : this.tailwindCode;
    navigator.clipboard.writeText(text).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  getPresetPreviewStyle(preset: RadiusPreset): { [key: string]: string } {
    if (preset.advanced) {
      const u = preset.advancedUnit || preset.unit;
      const h = `${preset.advanced.topLeftH}${u} ${preset.advanced.topRightH}${u} ${preset.advanced.bottomRightH}${u} ${preset.advanced.bottomLeftH}${u}`;
      const v = `${preset.advanced.topLeftV}${u} ${preset.advanced.topRightV}${u} ${preset.advanced.bottomRightV}${u} ${preset.advanced.bottomLeftV}${u}`;
      return { 'borderRadius': `${h} / ${v}` };
    }
    const u = preset.unit;
    return {
      'borderRadius': `${preset.corners.topLeft}${u} ${preset.corners.topRight}${u} ${preset.corners.bottomRight}${u} ${preset.corners.bottomLeft}${u}`
    };
  }

  onPreviewBgChange(event: Event): void {
    this.previewBgColor = (event.target as HTMLInputElement).value;
  }

  onPreviewBoxColorChange(event: Event): void {
    this.previewBoxColor = (event.target as HTMLInputElement).value;
  }

  resetAll(): void {
    this.corners = { topLeft: 12, topRight: 12, bottomRight: 12, bottomLeft: 12 };
    this.advancedCorners = {
      topLeftH: 12, topLeftV: 12,
      topRightH: 12, topRightV: 12,
      bottomRightH: 12, bottomRightV: 12,
      bottomLeftH: 12, bottomLeftV: 12
    };
    this.unit = 'px';
    this.linked = true;
    this.advancedMode = false;
  }

  trackByPresetName(index: number, preset: RadiusPreset): string {
    return preset.name;
  }
}
