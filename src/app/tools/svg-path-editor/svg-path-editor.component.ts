import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface PathCommand {
  type: string;
  params: number[];
  original: string;
}

interface ControlPoint {
  x: number;
  y: number;
  commandIndex: number;
  paramIndex: number;
  kind: 'endpoint' | 'control';
}

interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
    selector: 'app-svg-path-editor',
    templateUrl: './svg-path-editor.component.html',
    styleUrls: ['./svg-path-editor.component.css'],
    imports: [ToolsSharedModule, NgFor, FormsModule, NgIf]
})
export class SvgPathEditorComponent implements AfterViewInit {
  @ViewChild('svgViewport') svgViewport!: ElementRef<SVGSVGElement>;
  @ViewChild('pathElement') pathElement!: ElementRef<SVGPathElement>;

  pathInput = '';
  parsedCommands: PathCommand[] = [];
  controlPoints: ControlPoint[] = [];
  pathError = '';

  // Viewport
  zoom = 1;
  panX = 0;
  panY = 0;
  showGrid = true;
  showControlPoints = true;
  viewBoxSize = 500;

  // Pan state
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;

  // Drag state
  draggingPoint: ControlPoint | null = null;

  // Path info
  pathLength = 0;
  boundingBox: BBox = { x: 0, y: 0, width: 0, height: 0 };
  commandCount = 0;

  // Minify
  decimalPrecision = 2;
  minifiedPath = '';
  pathCopied = false;
  minifiedCopied = false;

  // Presets
  readonly presets: { name: string; path: string }[] = [
    { name: 'Star', path: 'M 250 50 L 310 185 L 455 185 L 340 275 L 380 415 L 250 330 L 120 415 L 160 275 L 45 185 L 190 185 Z' },
    { name: 'Heart', path: 'M 250 400 C 250 400 450 280 450 180 C 450 80 350 50 300 100 C 270 130 250 170 250 170 C 250 170 230 130 200 100 C 150 50 50 80 50 180 C 50 280 250 400 250 400 Z' },
    { name: 'Arrow', path: 'M 100 250 L 350 250 L 350 180 L 450 270 L 350 360 L 350 290 L 100 290 Z' },
    { name: 'Wave', path: 'M 0 250 C 80 150 170 350 250 250 C 330 150 420 350 500 250' },
    { name: 'Bezier Curve', path: 'M 50 400 C 50 100 450 100 450 400' },
    { name: 'Spiral', path: 'M 250 250 C 250 200 300 200 300 250 C 300 310 190 310 190 250 C 190 170 350 170 350 250 C 350 360 140 360 140 250 C 140 120 400 120 400 250' },
  ];

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free SVG Path Visualizer & Editor -- paste, visualize, edit and optimize SVG paths in your browser')}&url=${encodeURIComponent(SITE_URL + '/tools/svg-path-editor')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/svg-path-editor')}`;

  constructor(
    private router: Router,
    private translationService: TranslationService,
    private eggs: EasterEggService
  ) {}

  ngAfterViewInit(): void {
    if (this.presets.length > 0) {
      this.pathInput = this.presets[0].path;
      this.parsePath();
    }
  }

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  // ── Path Parsing ──────────────────────────────────────

  parsePath(): void {
    this.pathError = '';
    this.parsedCommands = [];
    this.controlPoints = [];
    this.pathLength = 0;
    this.boundingBox = { x: 0, y: 0, width: 0, height: 0 };
    this.commandCount = 0;
    this.minifiedPath = '';

    const d = this.pathInput.trim();
    if (!d) return;

    try {
      this.parsedCommands = this.tokenizePath(d);
      this.commandCount = this.parsedCommands.length;
      this.extractControlPoints();
      this.computePathInfo();
      this.generateMinifiedPath();

      // Easter egg: 50+ commands
      if (this.commandCount >= 50) {
        this.eggs.trigger('svg-complex-path');
      }
    } catch (e: any) {
      this.pathError = e.message || 'Invalid SVG path';
    }
  }

  private tokenizePath(d: string): PathCommand[] {
    const commands: PathCommand[] = [];
    // Match command letter followed by its numeric parameters
    const regex = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(d)) !== null) {
      const type = match[1];
      const paramStr = match[2].trim();
      let params: number[] = [];

      if (paramStr) {
        params = paramStr
          .replace(/,/g, ' ')
          .replace(/-/g, ' -')
          .split(/\s+/)
          .filter(s => s !== '')
          .map(Number);
      }

      commands.push({ type, params, original: match[0].trim() });
    }

    return commands;
  }

  private extractControlPoints(): void {
    const points: ControlPoint[] = [];
    let cx = 0, cy = 0;

    this.parsedCommands.forEach((cmd, cmdIdx) => {
      const p = cmd.params;
      const isRelative = cmd.type === cmd.type.toLowerCase();
      const t = cmd.type.toUpperCase();

      switch (t) {
        case 'M':
        case 'L':
        case 'T': {
          const x = isRelative ? cx + p[0] : p[0];
          const y = isRelative ? cy + p[1] : p[1];
          points.push({ x, y, commandIndex: cmdIdx, paramIndex: 0, kind: 'endpoint' });
          cx = x; cy = y;
          break;
        }
        case 'H': {
          const x = isRelative ? cx + p[0] : p[0];
          points.push({ x, y: cy, commandIndex: cmdIdx, paramIndex: 0, kind: 'endpoint' });
          cx = x;
          break;
        }
        case 'V': {
          const y = isRelative ? cy + p[0] : p[0];
          points.push({ x: cx, y, commandIndex: cmdIdx, paramIndex: 0, kind: 'endpoint' });
          cy = y;
          break;
        }
        case 'C': {
          const x1 = isRelative ? cx + p[0] : p[0];
          const y1 = isRelative ? cy + p[1] : p[1];
          const x2 = isRelative ? cx + p[2] : p[2];
          const y2 = isRelative ? cy + p[3] : p[3];
          const x = isRelative ? cx + p[4] : p[4];
          const y = isRelative ? cy + p[5] : p[5];
          points.push({ x: x1, y: y1, commandIndex: cmdIdx, paramIndex: 0, kind: 'control' });
          points.push({ x: x2, y: y2, commandIndex: cmdIdx, paramIndex: 2, kind: 'control' });
          points.push({ x, y, commandIndex: cmdIdx, paramIndex: 4, kind: 'endpoint' });
          cx = x; cy = y;
          break;
        }
        case 'S': {
          const x2 = isRelative ? cx + p[0] : p[0];
          const y2 = isRelative ? cy + p[1] : p[1];
          const x = isRelative ? cx + p[2] : p[2];
          const y = isRelative ? cy + p[3] : p[3];
          points.push({ x: x2, y: y2, commandIndex: cmdIdx, paramIndex: 0, kind: 'control' });
          points.push({ x, y, commandIndex: cmdIdx, paramIndex: 2, kind: 'endpoint' });
          cx = x; cy = y;
          break;
        }
        case 'Q': {
          const x1 = isRelative ? cx + p[0] : p[0];
          const y1 = isRelative ? cy + p[1] : p[1];
          const x = isRelative ? cx + p[2] : p[2];
          const y = isRelative ? cy + p[3] : p[3];
          points.push({ x: x1, y: y1, commandIndex: cmdIdx, paramIndex: 0, kind: 'control' });
          points.push({ x, y, commandIndex: cmdIdx, paramIndex: 2, kind: 'endpoint' });
          cx = x; cy = y;
          break;
        }
        case 'A': {
          const x = isRelative ? cx + p[5] : p[5];
          const y = isRelative ? cy + p[6] : p[6];
          points.push({ x, y, commandIndex: cmdIdx, paramIndex: 5, kind: 'endpoint' });
          cx = x; cy = y;
          break;
        }
        case 'Z':
          break;
      }
    });

    this.controlPoints = points;
  }

  private computePathInfo(): void {
    setTimeout(() => {
      if (this.pathElement?.nativeElement) {
        try {
          const el = this.pathElement.nativeElement;
          this.pathLength = Math.round(el.getTotalLength() * 100) / 100;
          const bbox = el.getBBox();
          this.boundingBox = {
            x: Math.round(bbox.x * 100) / 100,
            y: Math.round(bbox.y * 100) / 100,
            width: Math.round(bbox.width * 100) / 100,
            height: Math.round(bbox.height * 100) / 100,
          };
        } catch {
          // getBBox can fail on invisible/zero-area paths
        }
      }
    }, 50);
  }

  // ── Minification ──────────────────────────────────────

  generateMinifiedPath(): void {
    if (this.parsedCommands.length === 0) {
      this.minifiedPath = '';
      return;
    }
    const precision = this.decimalPrecision;
    this.minifiedPath = this.parsedCommands.map(cmd => {
      if (cmd.type.toUpperCase() === 'Z') return cmd.type;
      const params = cmd.params.map(n => {
        const rounded = parseFloat(n.toFixed(precision));
        return rounded.toString();
      });
      return cmd.type + params.join(' ');
    }).join('');
  }

  onPrecisionChange(event: Event): void {
    this.decimalPrecision = parseInt((event.target as HTMLInputElement).value, 10);
    this.generateMinifiedPath();
  }

  // ── Clipboard ─────────────────────────────────────────

  copyPath(): void {
    navigator.clipboard.writeText(this.pathInput).then(() => {
      this.pathCopied = true;
      setTimeout(() => { this.pathCopied = false; }, 1500);
    });
  }

  copyMinified(): void {
    navigator.clipboard.writeText(this.minifiedPath).then(() => {
      this.minifiedCopied = true;
      setTimeout(() => { this.minifiedCopied = false; }, 1500);
    });
  }

  // ── Viewport Controls ─────────────────────────────────

  zoomIn(): void {
    this.zoom = Math.min(this.zoom * 1.25, 10);
  }

  zoomOut(): void {
    this.zoom = Math.max(this.zoom / 1.25, 0.1);
  }

  resetView(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
  }

  toggleGrid(): void {
    this.showGrid = !this.showGrid;
  }

  toggleControlPoints(): void {
    this.showControlPoints = !this.showControlPoints;
  }

  get viewBox(): string {
    const size = this.viewBoxSize / this.zoom;
    const x = (this.viewBoxSize / 2 - size / 2) + this.panX;
    const y = (this.viewBoxSize / 2 - size / 2) + this.panY;
    return `${x} ${y} ${size} ${size}`;
  }

  get gridLines(): number[] {
    const lines: number[] = [];
    for (let i = 0; i <= this.viewBoxSize; i += 50) {
      lines.push(i);
    }
    return lines;
  }

  get fineGridLines(): number[] {
    const lines: number[] = [];
    for (let i = 0; i <= this.viewBoxSize; i += 10) {
      lines.push(i);
    }
    return lines;
  }

  get controlPointSize(): number {
    return 6 / this.zoom;
  }

  get controlLineWidth(): number {
    return 1 / this.zoom;
  }

  get pathStrokeWidth(): number {
    return 2 / this.zoom;
  }

  // ── Pan via mouse ─────────────────────────────────────

  onMouseDown(event: MouseEvent): void {
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      this.isPanning = true;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
      event.preventDefault();
    }
  }

  onMouseMove(event: MouseEvent): void {
    if (this.isPanning) {
      const dx = (event.clientX - this.panStartX) / this.zoom;
      const dy = (event.clientY - this.panStartY) / this.zoom;
      this.panX -= dx;
      this.panY -= dy;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
      event.preventDefault();
    } else if (this.draggingPoint) {
      this.onDragMove(event);
    }
  }

  onMouseUp(event: MouseEvent): void {
    this.isPanning = false;
    if (this.draggingPoint) {
      this.draggingPoint = null;
    }
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  // ── Control Point Dragging ────────────────────────────

  onPointMouseDown(event: MouseEvent, point: ControlPoint): void {
    event.stopPropagation();
    event.preventDefault();
    this.draggingPoint = point;
  }

  private onDragMove(event: MouseEvent): void {
    if (!this.draggingPoint || !this.svgViewport?.nativeElement) return;

    const svg = this.svgViewport.nativeElement;
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const svgPt = pt.matrixTransform(ctm.inverse());

    const cmd = this.parsedCommands[this.draggingPoint.commandIndex];
    if (!cmd) return;

    const isRelative = cmd.type === cmd.type.toLowerCase();
    const t = cmd.type.toUpperCase();

    if (t === 'H') {
      cmd.params[this.draggingPoint.paramIndex] = isRelative
        ? svgPt.x - this.getPreviousX(this.draggingPoint.commandIndex)
        : svgPt.x;
    } else if (t === 'V') {
      cmd.params[this.draggingPoint.paramIndex] = isRelative
        ? svgPt.y - this.getPreviousY(this.draggingPoint.commandIndex)
        : svgPt.y;
    } else {
      const pi = this.draggingPoint.paramIndex;
      if (isRelative) {
        const prevX = this.getPreviousX(this.draggingPoint.commandIndex);
        const prevY = this.getPreviousY(this.draggingPoint.commandIndex);
        cmd.params[pi] = svgPt.x - prevX;
        cmd.params[pi + 1] = svgPt.y - prevY;
      } else {
        cmd.params[pi] = svgPt.x;
        cmd.params[pi + 1] = svgPt.y;
      }
    }

    this.rebuildPathFromCommands();
    this.extractControlPoints();
    this.computePathInfo();
    this.generateMinifiedPath();
  }

  private getPreviousX(cmdIndex: number): number {
    let x = 0;
    for (let i = 0; i < cmdIndex; i++) {
      const cmd = this.parsedCommands[i];
      const t = cmd.type.toUpperCase();
      const isRel = cmd.type === cmd.type.toLowerCase();
      const p = cmd.params;
      if (t === 'Z') continue;
      if (t === 'H') { x = isRel ? x + p[0] : p[0]; }
      else if (t === 'V') { /* x unchanged */ }
      else if (p.length >= 2) {
        const lastX = p[p.length - 2];
        x = isRel ? x + lastX : lastX;
      }
    }
    return x;
  }

  private getPreviousY(cmdIndex: number): number {
    let y = 0;
    for (let i = 0; i < cmdIndex; i++) {
      const cmd = this.parsedCommands[i];
      const t = cmd.type.toUpperCase();
      const isRel = cmd.type === cmd.type.toLowerCase();
      const p = cmd.params;
      if (t === 'Z') continue;
      if (t === 'V') { y = isRel ? y + p[0] : p[0]; }
      else if (t === 'H') { /* y unchanged */ }
      else if (p.length >= 2) {
        const lastY = p[p.length - 1];
        y = isRel ? y + lastY : lastY;
      }
    }
    return y;
  }

  private rebuildPathFromCommands(): void {
    this.pathInput = this.parsedCommands.map(cmd => {
      if (cmd.type.toUpperCase() === 'Z') return cmd.type;
      const params = cmd.params.map(n => Math.round(n * 100) / 100).join(' ');
      return `${cmd.type} ${params}`;
    }).join(' ');
  }

  // ── Presets ───────────────────────────────────────────

  applyPreset(preset: { name: string; path: string }): void {
    this.pathInput = preset.path;
    this.resetView();
    this.parsePath();
  }

  // ── Command editing ───────────────────────────────────

  updateCommandParam(cmdIndex: number, paramIndex: number, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (isNaN(value)) return;
    this.parsedCommands[cmdIndex].params[paramIndex] = value;
    this.rebuildPathFromCommands();
    this.extractControlPoints();
    this.computePathInfo();
    this.generateMinifiedPath();
  }

  removeCommand(cmdIndex: number): void {
    if (this.parsedCommands.length <= 1) return;
    this.parsedCommands.splice(cmdIndex, 1);
    this.commandCount = this.parsedCommands.length;
    this.rebuildPathFromCommands();
    this.extractControlPoints();
    this.computePathInfo();
    this.generateMinifiedPath();
  }

  getCommandLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'M': 'MoveTo', 'm': 'moveTo (rel)',
      'L': 'LineTo', 'l': 'lineTo (rel)',
      'H': 'HorizTo', 'h': 'horizTo (rel)',
      'V': 'VertTo', 'v': 'vertTo (rel)',
      'C': 'CurveTo', 'c': 'curveTo (rel)',
      'S': 'SmoothCurve', 's': 'smoothCurve (rel)',
      'Q': 'QuadTo', 'q': 'quadTo (rel)',
      'T': 'SmoothQuad', 't': 'smoothQuad (rel)',
      'A': 'ArcTo', 'a': 'arcTo (rel)',
      'Z': 'ClosePath', 'z': 'closePath',
    };
    return labels[type] || type;
  }

  getZoomPercent(): number {
    return Math.round(this.zoom * 100);
  }

  trackByIndex(index: number): number {
    return index;
  }

  getControlLineEndpoints(): { x1: number; y1: number; x2: number; y2: number }[] {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    let cx = 0, cy = 0;

    this.parsedCommands.forEach((cmd) => {
      const p = cmd.params;
      const isRelative = cmd.type === cmd.type.toLowerCase();
      const t = cmd.type.toUpperCase();

      switch (t) {
        case 'C': {
          const x1 = isRelative ? cx + p[0] : p[0];
          const y1 = isRelative ? cy + p[1] : p[1];
          const x2 = isRelative ? cx + p[2] : p[2];
          const y2 = isRelative ? cy + p[3] : p[3];
          const x = isRelative ? cx + p[4] : p[4];
          const y = isRelative ? cy + p[5] : p[5];
          lines.push({ x1: cx, y1: cy, x2: x1, y2: y1 });
          lines.push({ x1: x, y1: y, x2: x2, y2: y2 });
          cx = x; cy = y;
          break;
        }
        case 'Q': {
          const x1 = isRelative ? cx + p[0] : p[0];
          const y1 = isRelative ? cy + p[1] : p[1];
          const x = isRelative ? cx + p[2] : p[2];
          const y = isRelative ? cy + p[3] : p[3];
          lines.push({ x1: cx, y1: cy, x2: x1, y2: y1 });
          lines.push({ x1: x, y1: y, x2: x1, y2: y1 });
          cx = x; cy = y;
          break;
        }
        case 'S': {
          const x2 = isRelative ? cx + p[0] : p[0];
          const y2 = isRelative ? cy + p[1] : p[1];
          const x = isRelative ? cx + p[2] : p[2];
          const y = isRelative ? cy + p[3] : p[3];
          lines.push({ x1: x, y1: y, x2: x2, y2: y2 });
          cx = x; cy = y;
          break;
        }
        case 'M':
        case 'L':
        case 'T': {
          cx = isRelative ? cx + p[0] : p[0];
          cy = isRelative ? cy + p[1] : p[1];
          break;
        }
        case 'H': {
          cx = isRelative ? cx + p[0] : p[0];
          break;
        }
        case 'V': {
          cy = isRelative ? cy + p[0] : p[0];
          break;
        }
        case 'A': {
          cx = isRelative ? cx + p[5] : p[5];
          cy = isRelative ? cy + p[6] : p[6];
          break;
        }
      }
    });

    return lines;
  }
}
