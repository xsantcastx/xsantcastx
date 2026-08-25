/**
 * price-chart.component.ts — a price line, its mean, and the volume under it.
 *
 * Hand-drawn SVG rather than a charting library, for the reason in the repo's
 * anti-goals: the site already refuses a 600 kB 3D engine to fake a planet, and
 * a chart is a smaller ask than that. Recharts is ~180 kB and Chart.js ~70 kB
 * for one polyline, two paths and a row of rectangles.
 *
 * SSR-safe by construction: it computes a `viewBox` and some path strings, and
 * never measures the DOM. The same markup that renders on the server renders in
 * the browser, at whatever size CSS gives it, because every coordinate is in
 * viewBox units and `preserveAspectRatio="none"` does the scaling.
 *
 * Two modes on one component. `compact` is the row sparkline: line only, no
 * axes, no volume. Full is the detail panel: gridlines, volume bars, a moving
 * average, and a labelled y-axis.
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

import { movingAverage, type PricePoint } from './exchange.model';

/** The viewBox. Wide and short — a price chart is read across, not up. */
const W = 300;
const H = 100;
/** Room under the line for the volume bars, in viewBox units. */
const VOLUME_H = 22;

@Component({
  selector: 'app-price-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="ge-chart"
      [class.ge-chart--compact]="compact"
      [attr.viewBox]="'0 0 ' + W + ' ' + H"
      preserveAspectRatio="none"
      role="img"
      [attr.aria-label]="ariaLabel"
    >
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" [attr.stop-color]="color" stop-opacity="0.34" />
          <stop offset="100%" [attr.stop-color]="color" stop-opacity="0" />
        </linearGradient>
      </defs>

      <!-- Gridlines. Full mode only: on a 40px sparkline they are noise. -->
      @if (!compact) {
        @for (y of gridlines; track y) {
          <line class="ge-chart__grid" x1="0" [attr.y1]="y" [attr.x2]="W" [attr.y2]="y" />
        }
      }

      <!-- Volume, drawn first so the price line sits over it. -->
      @if (!compact) {
        @for (bar of bars; track bar.x) {
          <rect
            class="ge-chart__vol"
            [attr.x]="bar.x" [attr.y]="bar.y"
            [attr.width]="bar.w" [attr.height]="bar.h"
            [attr.fill]="color"
          />
        }
      }

      <path class="ge-chart__fill" [attr.d]="areaPath" [attr.fill]="'url(#' + gradientId + ')'" />

      @if (!compact && averagePath) {
        <path class="ge-chart__avg" [attr.d]="averagePath" [attr.stroke]="color" />
      }

      <path class="ge-chart__line" [attr.d]="linePath" [attr.stroke]="color" />

      <!-- The right edge is the price the buy button will charge. Marked. -->
      @if (!compact && last) {
        <circle class="ge-chart__now" [attr.cx]="last.x" [attr.cy]="last.y" r="3" [attr.fill]="color" />
      }
    </svg>
  `,
  styles: [`
    .ge-chart { display: block; width: 100%; height: 100%; overflow: visible; }
    .ge-chart__line {
      fill: none; stroke-width: 1.6; stroke-linejoin: round; stroke-linecap: round;
      vector-effect: non-scaling-stroke;
    }
    .ge-chart__avg {
      fill: none; stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.5;
      vector-effect: non-scaling-stroke;
    }
    .ge-chart__grid {
      stroke: rgba(255, 255, 255, 0.07); stroke-width: 1;
      vector-effect: non-scaling-stroke;
    }
    .ge-chart__vol { opacity: 0.2; }
    .ge-chart__fill { stroke: none; }
    .ge-chart--compact .ge-chart__line { stroke-width: 1.4; }
  `],
})
export class PriceChartComponent {
  readonly W = W;
  readonly H = H;

  /** Sparkline mode: line and fill only. */
  @Input() compact = false;
  /** Stroke colour. The caller passes the rarity or the trend colour. */
  @Input() color = '#c89868';
  @Input() ariaLabel = 'Price history';

  @Input()
  set points(value: readonly PricePoint[] | null | undefined) {
    this.build(value ?? []);
  }

  linePath = '';
  areaPath = '';
  averagePath = '';
  bars: { x: number; y: number; w: number; h: number }[] = [];
  gridlines: number[] = [];
  last: { x: number; y: number } | null = null;

  /**
   * A per-instance gradient id.
   *
   * Two charts on one page sharing a `<defs>` id means the second one silently
   * adopts the first one's colour, which is the classic inline-SVG bug and
   * exactly what a page of forty sparklines would hit.
   */
  readonly gradientId = `ge-grad-${(PriceChartComponent.seq = (PriceChartComponent.seq + 1) % 1e6)}`;
  private static seq = 0;

  private build(points: readonly PricePoint[]): void {
    if (points.length < 2) {
      this.linePath = '';
      this.areaPath = '';
      this.averagePath = '';
      this.bars = [];
      this.gridlines = [];
      this.last = null;
      return;
    }

    const prices = points.map(p => p.price);
    let lo = Math.min(...prices);
    let hi = Math.max(...prices);
    // A perfectly flat series would divide by zero and, worse, draw a line
    // pinned to the top of the box. Pad it into a band so it draws through the
    // middle, which is what "this did not move" should look like.
    if (hi - lo < 1e-9) { lo -= Math.max(1, lo * 0.05); hi += Math.max(1, hi * 0.05); }

    const plotH = this.compact ? H : H - VOLUME_H;
    const x = (i: number) => (i / (points.length - 1)) * W;
    const y = (price: number) => plotH - ((price - lo) / (hi - lo)) * (plotH - 4) - 2;

    const coords = points.map((p, i) => ({ x: x(i), y: y(p.price) }));
    this.linePath = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(2)} ${c.y.toFixed(2)}`)
      .join(' ');
    this.areaPath =
      `${this.linePath} L${W} ${plotH} L0 ${plotH} Z`;
    this.last = coords[coords.length - 1];

    if (this.compact) {
      this.averagePath = '';
      this.bars = [];
      this.gridlines = [];
      return;
    }

    const avg = movingAverage(points);
    this.averagePath = avg
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
      .join(' ');

    const maxVol = Math.max(1, ...points.map(p => p.volume));
    const barW = Math.max(1, (W / points.length) * 0.62);
    this.bars = points.map((p, i) => {
      const h = Math.max(1, (p.volume / maxVol) * (VOLUME_H - 3));
      return { x: x(i) - barW / 2, y: H - h, w: barW, h };
    });

    this.gridlines = [0.25, 0.5, 0.75].map(f => +(plotH * f).toFixed(2));
  }
}
