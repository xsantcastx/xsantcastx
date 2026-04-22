import { Component, inject, ElementRef, ViewChild, AfterViewInit, NgZone, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

export type ShapeType = 'circle' | 'ellipse' | 'inset' | 'polygon';

export interface PolygonPoint {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
}

export interface ShapePreset {
  name: string;
  type: ShapeType;
  // For polygon presets
  points?: PolygonPoint[];
  // For circle
  circleRadius?: number;
  circleCx?: number;
  circleCy?: number;
  // For ellipse
  ellipseRx?: number;
  ellipseRy?: number;
  ellipseCx?: number;
  ellipseCy?: number;
  // For inset
  insetTop?: number;
  insetRight?: number;
  insetBottom?: number;
  insetLeft?: number;
  insetRound?: number;
}

@Component({
  selector: 'app-clip-path',
  templateUrl: './clip-path.component.html',
  styleUrls: ['./clip-path.component.css'],
  standalone: false
})
export class ClipPathComponent implements AfterViewInit {
  private readonly eggs = inject(EasterEggService);

  @ViewChild('previewCanvas') previewCanvas!: ElementRef<HTMLDivElement>;

  // Shape state
  shapeType: ShapeType = 'polygon';
  polygonPoints: PolygonPoint[] = [
    { x: 50, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 }
  ];

  // Circle params
  circleRadius = 50;
  circleCx = 50;
  circleCy = 50;

  // Ellipse params
  ellipseRx = 50;
  ellipseRy = 35;
  ellipseCx = 50;
  ellipseCy = 50;

  // Inset params
  insetTop = 10;
  insetRight = 10;
  insetBottom = 10;
  insetLeft = 10;
  insetRound = 0;

  // Preview
  previewBgColor = '#1a1a2e';
  shapeColor = '#00ffcc';
  previewSize = 400;

  // Drag state
  draggingIndex = -1;
  private canvasRect: DOMRect | null = null;

  // Code
  codeCopied = false;

  // Share
  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free CSS Clip-Path Generator — visually design clip-path shapes with drag handles and one-click code copy')}&url=${encodeURIComponent(SITE_URL + '/tools/clip-path')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/clip-path')}`;

  readonly presets: ShapePreset[] = [
    {
      name: 'Triangle',
      type: 'polygon',
      points: [{ x: 50, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]
    },
    {
      name: 'Pentagon',
      type: 'polygon',
      points: [
        { x: 50, y: 0 }, { x: 100, y: 38 }, { x: 81, y: 100 },
        { x: 19, y: 100 }, { x: 0, y: 38 }
      ]
    },
    {
      name: 'Hexagon',
      type: 'polygon',
      points: [
        { x: 25, y: 0 }, { x: 75, y: 0 }, { x: 100, y: 50 },
        { x: 75, y: 100 }, { x: 25, y: 100 }, { x: 0, y: 50 }
      ]
    },
    {
      name: 'Star',
      type: 'polygon',
      points: [
        { x: 50, y: 0 }, { x: 61, y: 35 }, { x: 98, y: 35 },
        { x: 68, y: 57 }, { x: 79, y: 91 }, { x: 50, y: 70 },
        { x: 21, y: 91 }, { x: 32, y: 57 }, { x: 2, y: 35 },
        { x: 39, y: 35 }
      ]
    },
    {
      name: 'Arrow Right',
      type: 'polygon',
      points: [
        { x: 0, y: 25 }, { x: 65, y: 25 }, { x: 65, y: 0 },
        { x: 100, y: 50 }, { x: 65, y: 100 }, { x: 65, y: 75 },
        { x: 0, y: 75 }
      ]
    },
    {
      name: 'Cross',
      type: 'polygon',
      points: [
        { x: 35, y: 0 }, { x: 65, y: 0 }, { x: 65, y: 35 },
        { x: 100, y: 35 }, { x: 100, y: 65 }, { x: 65, y: 65 },
        { x: 65, y: 100 }, { x: 35, y: 100 }, { x: 35, y: 65 },
        { x: 0, y: 65 }, { x: 0, y: 35 }, { x: 35, y: 35 }
      ]
    },
    {
      name: 'Diamond',
      type: 'polygon',
      points: [{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }]
    },
    {
      name: 'Chevron',
      type: 'polygon',
      points: [
        { x: 0, y: 0 }, { x: 75, y: 0 }, { x: 100, y: 50 },
        { x: 75, y: 100 }, { x: 0, y: 100 }, { x: 25, y: 50 }
      ]
    },
    {
      name: 'Circle',
      type: 'circle',
      circleRadius: 50, circleCx: 50, circleCy: 50
    },
    {
      name: 'Ellipse',
      type: 'ellipse',
      ellipseRx: 50, ellipseRy: 35, ellipseCx: 50, ellipseCy: 50
    },
    {
      name: 'Inset',
      type: 'inset',
      insetTop: 10, insetRight: 10, insetBottom: 10, insetLeft: 10, insetRound: 8
    },
    {
      name: 'Custom',
      type: 'polygon',
      points: [
        { x: 20, y: 0 }, { x: 80, y: 0 }, { x: 100, y: 20 },
        { x: 100, y: 80 }, { x: 80, y: 100 }, { x: 20, y: 100 },
        { x: 0, y: 80 }, { x: 0, y: 20 }
      ]
    }
  ];

  constructor(
    private router: Router,
    private translationService: TranslationService,
    private ngZone: NgZone
  ) {}

  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    // bind global mouse events for dragging
    this.ngZone.runOutsideAngular(() => {
      document.addEventListener('mousemove', this.onMouseMove);
      document.addEventListener('mouseup', this.onMouseUp);
      document.addEventListener('touchmove', this.onTouchMove, { passive: false });
      document.addEventListener('touchend', this.onTouchEnd);
    });
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Shape selection ──────────────────────────────────

  selectShape(type: ShapeType): void {
    this.shapeType = type;
    if (type === 'polygon' && this.polygonPoints.length === 0) {
      this.polygonPoints = [
        { x: 50, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }
      ];
    }
  }

  applyPreset(preset: ShapePreset): void {
    this.shapeType = preset.type;
    if (preset.type === 'polygon' && preset.points) {
      this.polygonPoints = preset.points.map(p => ({ ...p }));
      this.checkComplexEasterEgg();
    } else if (preset.type === 'circle') {
      this.circleRadius = preset.circleRadius ?? 50;
      this.circleCx = preset.circleCx ?? 50;
      this.circleCy = preset.circleCy ?? 50;
    } else if (preset.type === 'ellipse') {
      this.ellipseRx = preset.ellipseRx ?? 50;
      this.ellipseRy = preset.ellipseRy ?? 35;
      this.ellipseCx = preset.ellipseCx ?? 50;
      this.ellipseCy = preset.ellipseCy ?? 50;
    } else if (preset.type === 'inset') {
      this.insetTop = preset.insetTop ?? 10;
      this.insetRight = preset.insetRight ?? 10;
      this.insetBottom = preset.insetBottom ?? 10;
      this.insetLeft = preset.insetLeft ?? 10;
      this.insetRound = preset.insetRound ?? 0;
    }
  }

  // ── Clip-path generation ─────────────────────────────

  get clipPathValue(): string {
    switch (this.shapeType) {
      case 'circle':
        return `circle(${this.circleRadius}% at ${this.circleCx}% ${this.circleCy}%)`;
      case 'ellipse':
        return `ellipse(${this.ellipseRx}% ${this.ellipseRy}% at ${this.ellipseCx}% ${this.ellipseCy}%)`;
      case 'inset':
        const round = this.insetRound > 0 ? ` round ${this.insetRound}px` : '';
        return `inset(${this.insetTop}% ${this.insetRight}% ${this.insetBottom}% ${this.insetLeft}%${round})`;
      case 'polygon':
      default:
        const pts = this.polygonPoints.map(p => `${p.x}% ${p.y}%`).join(', ');
        return `polygon(${pts})`;
    }
  }

  get cssCode(): string {
    return `clip-path: ${this.clipPathValue};\n-webkit-clip-path: ${this.clipPathValue};`;
  }

  // ── Drag handles ─────────────────────────────────────

  onHandleMouseDown(event: MouseEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.draggingIndex = index;
    this.updateCanvasRect();
  }

  onHandleTouchStart(event: TouchEvent, index: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.draggingIndex = index;
    this.updateCanvasRect();
  }

  private onMouseMove = (event: MouseEvent): void => {
    if (this.draggingIndex < 0) return;
    this.updatePointFromClient(event.clientX, event.clientY);
  };

  private onTouchMove = (event: TouchEvent): void => {
    if (this.draggingIndex < 0) return;
    event.preventDefault();
    const touch = event.touches[0];
    this.updatePointFromClient(touch.clientX, touch.clientY);
  };

  private onMouseUp = (): void => {
    this.draggingIndex = -1;
  };

  private onTouchEnd = (): void => {
    this.draggingIndex = -1;
  };

  private updateCanvasRect(): void {
    if (this.previewCanvas) {
      this.canvasRect = this.previewCanvas.nativeElement.getBoundingClientRect();
    }
  }

  private updatePointFromClient(clientX: number, clientY: number): void {
    if (!this.canvasRect || this.draggingIndex < 0) return;
    const x = Math.round(Math.max(0, Math.min(100,
      ((clientX - this.canvasRect.left) / this.canvasRect.width) * 100
    )));
    const y = Math.round(Math.max(0, Math.min(100,
      ((clientY - this.canvasRect.top) / this.canvasRect.height) * 100
    )));
    this.ngZone.run(() => {
      this.polygonPoints[this.draggingIndex] = { x, y };
      this.checkComplexEasterEgg();
    });
  }

  // ── Add / Remove points ──────────────────────────────

  addPoint(): void {
    if (this.polygonPoints.length < 30) {
      // Insert midpoint between last and first
      const last = this.polygonPoints[this.polygonPoints.length - 1];
      const first = this.polygonPoints[0];
      this.polygonPoints.push({
        x: Math.round((last.x + first.x) / 2),
        y: Math.round((last.y + first.y) / 2)
      });
      this.checkComplexEasterEgg();
    }
  }

  removePoint(index: number): void {
    if (this.polygonPoints.length > 3) {
      this.polygonPoints.splice(index, 1);
    }
  }

  // ── Slider changes ───────────────────────────────────

  onCircleRadiusChange(event: Event): void {
    this.circleRadius = parseFloat((event.target as HTMLInputElement).value);
  }
  onCircleCxChange(event: Event): void {
    this.circleCx = parseFloat((event.target as HTMLInputElement).value);
  }
  onCircleCyChange(event: Event): void {
    this.circleCy = parseFloat((event.target as HTMLInputElement).value);
  }
  onEllipseRxChange(event: Event): void {
    this.ellipseRx = parseFloat((event.target as HTMLInputElement).value);
  }
  onEllipseRyChange(event: Event): void {
    this.ellipseRy = parseFloat((event.target as HTMLInputElement).value);
  }
  onEllipseCxChange(event: Event): void {
    this.ellipseCx = parseFloat((event.target as HTMLInputElement).value);
  }
  onEllipseCyChange(event: Event): void {
    this.ellipseCy = parseFloat((event.target as HTMLInputElement).value);
  }
  onInsetChange(side: 'top' | 'right' | 'bottom' | 'left', event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    switch (side) {
      case 'top': this.insetTop = value; break;
      case 'right': this.insetRight = value; break;
      case 'bottom': this.insetBottom = value; break;
      case 'left': this.insetLeft = value; break;
    }
  }
  onInsetRoundChange(event: Event): void {
    this.insetRound = parseFloat((event.target as HTMLInputElement).value);
  }

  onPointXChange(index: number, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.polygonPoints[index] = { ...this.polygonPoints[index], x: value };
    this.checkComplexEasterEgg();
  }

  onPointYChange(index: number, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.polygonPoints[index] = { ...this.polygonPoints[index], y: value };
    this.checkComplexEasterEgg();
  }

  // ── Preview helpers ──────────────────────────────────

  onBgColorChange(event: Event): void {
    this.previewBgColor = (event.target as HTMLInputElement).value;
  }

  onShapeColorChange(event: Event): void {
    this.shapeColor = (event.target as HTMLInputElement).value;
  }

  getHandleStyle(point: PolygonPoint): { [key: string]: string } {
    return {
      left: point.x + '%',
      top: point.y + '%'
    };
  }

  // ── SVG polygon for visual guides ────────────────────

  get svgPolygonPoints(): string {
    return this.polygonPoints.map(p => `${(p.x / 100) * this.previewSize},${(p.y / 100) * this.previewSize}`).join(' ');
  }

  // ── Copy code ────────────────────────────────────────

  copyCode(): void {
    navigator.clipboard.writeText(this.cssCode).then(() => {
      this.codeCopied = true;
      setTimeout(() => { this.codeCopied = false; }, 1500);
    });
  }

  // ── Reset ────────────────────────────────────────────

  resetAll(): void {
    this.shapeType = 'polygon';
    this.polygonPoints = [
      { x: 50, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }
    ];
    this.circleRadius = 50;
    this.circleCx = 50;
    this.circleCy = 50;
    this.ellipseRx = 50;
    this.ellipseRy = 35;
    this.ellipseCx = 50;
    this.ellipseCy = 50;
    this.insetTop = 10;
    this.insetRight = 10;
    this.insetBottom = 10;
    this.insetLeft = 10;
    this.insetRound = 0;
  }

  // ── Easter egg ───────────────────────────────────────

  private checkComplexEasterEgg(): void {
    if (this.shapeType === 'polygon' && this.polygonPoints.length >= 12) {
      this.eggs.trigger('clip-complex');
    }
  }

  // ── Track by ─────────────────────────────────────────

  trackByPresetName(_index: number, preset: ShapePreset): string {
    return preset.name;
  }

  trackByPointIndex(index: number): number {
    return index;
  }
}
