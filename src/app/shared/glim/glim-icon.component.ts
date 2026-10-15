/**
 * glim-icon.component.ts — Glim as a crisp inline SVG: the same 12×10 art-pixel
 * moth the world draws (glim-art.ts), one rect per pixel run. SSR-safe (no
 * canvas), decorative (the control around it carries the name).
 */
import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import { GLIM_FACE_PALETTE, GLIM_H, GLIM_PALETTE, GLIM_PALETTE_DIM, GLIM_W, glimFace, glimRows, type GlimMood } from './glim-art';

interface Run { x: number; y: number; w: number; fill: string }

function runs(dim: boolean): Run[] {
  const palette = dim ? GLIM_PALETTE_DIM : GLIM_PALETTE;
  const out: Run[] = [];
  glimRows('mid').forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const fill = palette[row[x]!];
      let w = 1;
      while (fill && row[x + w] === row[x]) w++;
      if (fill) out.push({ x, y, w, fill });
      x += w;
    }
  });
  return out;
}
const BRIGHT = runs(false);
const DIM = runs(true);
/** Each mood's face painted over the bright moth, built once on first use. */
const FACES = new Map<GlimMood, Run[]>();
function withFace(mood: GlimMood): Run[] {
  let out = FACES.get(mood);
  if (!out) {
    out = [...BRIGHT, ...glimFace(mood).map(([x, y, key]) => ({ x, y, w: 1, fill: GLIM_FACE_PALETTE[key] ?? GLIM_PALETTE[key] ?? '#fff' }))];
    FACES.set(mood, out);
  }
  return out;
}

@Component({
  selector: 'app-glim-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" aria-hidden="true" focusable="false" shape-rendering="crispEdges">
      @for (r of pixels(); track $index) { <rect [attr.x]="r.x" [attr.y]="r.y" [attr.width]="r.w" height="1" [attr.fill]="r.fill" /> }
    </svg>
  `,
  styles: [`
    :host { display: inline-block; width: 24px; height: 20px; line-height: 0; }
    svg { width: 100%; height: 100%; }
  `],
})
export class GlimIconComponent {
  readonly dim = input(false);
  /** Its face (glim-art.ts GlimMood); calm by default. */
  readonly mood = input<GlimMood>('calm');
  readonly w = GLIM_W;
  readonly h = GLIM_H;
  readonly pixels = computed(() => (this.dim() ? DIM : this.mood() === 'calm' ? BRIGHT : withFace(this.mood())));
}
