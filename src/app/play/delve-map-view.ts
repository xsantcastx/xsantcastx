/**
 * delve-map-view.ts — the Delve's minimap and full map in the /play HUD
 * (Terraria-style). The picture is engine/delve-map.ts; this holds what the
 * player did to the view: whether the minimap shows (phones can fold it), the
 * full map's zoom and pan, and the "way to camp" line under it. Map v2: a
 * short press (a tap) on the full map is handed to `onTap` as a world cell
 * (placing or picking a pin), using the last drawn view's transform.
 *
 * Drawn on the play view's HUD tick (5 times a second), never per frame.
 */
import { drawDelveMap, MapSource } from './engine/delve-map';

/** Phones remember a folded minimap (a view preference, like the Hearth pill). */
const MINI_KEY = 'eclipse-delve-minimap';
/** CSS px per cell on the minimap, and the full map's zoom steps. */
const MINI_CELL = 3;
const ZOOMS = [2, 3, 4, 6, 8, 12, 16] as const;

/** The world columns the full map spans: the plain grid, or (endless) the explored sectors and the core. */
function spanOf(source: MapSource): { col0: number; col1: number; mid: number } {
  const col0 = source.world?.col0 ?? 0, col1 = source.world?.col1 ?? source.t.cols;
  return { col0, col1, mid: (col0 + col1) / 2 };
}

export class DelveMapView {
  /** The minimap is on screen (phones: the toggle). */
  miniShown = true;
  /** The full-screen map is open. */
  open = false;
  /** Index into ZOOMS for the full map; -1 = fit the whole Delve. */
  zoom = -1;
  /** The full map's centre in cells; NaN = on the Keeper. */
  private panCol = NaN;
  private panRow = NaN;
  private drag: { id: number; x: number; y: number; col: number; row: number; moved: number } | null = null;
  /** Cells of explored way to the goal (the camp, or a tracked pin / Glim's mark): 0 = none explored yet, -1 = no goal. */
  campPath = -1;
  /** The full map's last drawn transform (device px): what a tap is read against. */
  private drawn: { ox: number; oy: number; s: number; dpr: number } | null = null;
  /** A tap on the full map, as a world cell (pins). */
  onTap: ((col: number, row: number) => void) | null = null;

  constructor(private readonly source: () => MapSource | null) {
    try { this.miniShown = localStorage.getItem(MINI_KEY) !== '0'; } catch { /* private mode: shown */ }
  }

  toggleMini(): void {
    this.miniShown = !this.miniShown;
    try { localStorage.setItem(MINI_KEY, this.miniShown ? '1' : '0'); } catch { /* this session only */ }
  }
  show(): void { this.open = true; this.zoom = -1; this.panCol = this.panRow = NaN; }
  hide(): void { this.open = false; this.drag = null; }
  zoomBy(step: number): void {
    const now = this.zoom < 0 ? this.fitIndex() : this.zoom;
    this.zoom = Math.max(0, Math.min(ZOOMS.length - 1, now + step));
  }
  centre(): void { this.panCol = this.panRow = NaN; }

  /** The minimap: the cells round the Keeper at MINI_CELL px each. */
  drawMini(canvas: HTMLCanvasElement | undefined): void {
    const source = this.source();
    if (!canvas || !source || !this.miniShown) return;
    const c = this.fit(canvas);
    if (!c) return;
    const dpr = canvas.width / Math.max(1, canvas.clientWidth);
    drawDelveMap(c, source, {
      width: canvas.width, height: canvas.height, scale: Math.round(MINI_CELL * dpr),
      centerCol: source.keeper.col + .5, centerRow: source.keeper.row + .5,
    });
  }

  /** The full map: fitted or zoomed, centred on the Keeper or where it was dragged, with the way to camp. */
  drawFull(canvas: HTMLCanvasElement | undefined): void {
    const source = this.source();
    if (!canvas || !source || !this.open) return;
    const c = this.fit(canvas);
    if (!c) return;
    const dpr = canvas.width / Math.max(1, canvas.clientWidth);
    // A phone held upright fits the Delve at a pixel or two a cell: start close in, on the Keeper.
    if (this.zoom < 0 && this.cellPx(canvas, source) < 4) this.zoom = ZOOMS.indexOf(6);
    const cell = this.cellPx(canvas, source);
    const fitted = this.zoom < 0;
    // The endless Delve: which sector columns are explored, for tests and assistive reading.
    if (source.world) canvas.dataset['explored'] = source.world.sectors.join(',');
    const view = {
      width: canvas.width, height: canvas.height, scale: Math.round(cell * dpr),
      // Fitted: the whole Delve, centred. Zoomed: on the Keeper until dragged.
      centerCol: fitted ? spanOf(source).mid : Number.isFinite(this.panCol) ? this.panCol : source.keeper.col + .5,
      centerRow: fitted ? source.t.rows / 2 - 1 : Number.isFinite(this.panRow) ? this.panRow : source.keeper.row + .5,
      path: true,
    };
    this.campPath = drawDelveMap(c, source, view);
    // The same transform drawDelveMap used (delve-map.ts), kept to read taps back into cells.
    const s = Math.max(1, Math.round(view.scale));
    this.drawn = { ox: Math.round(view.width / 2 - view.centerCol * s), oy: Math.round(view.height / 2 - view.centerRow * s), s, dpr };
    // The transform in device px (`ox,oy,px per cell,dpr`), for tests and assistive tools placing a pin.
    canvas.dataset['view'] = `${this.drawn.ox},${this.drawn.oy},${s},${dpr}`;
  }

  // ── Pan (drag) and zoom (wheel) on the full map ──
  press(event: PointerEvent): void {
    const source = this.source();
    const canvas = event.currentTarget as HTMLCanvasElement;
    if (!source) return;
    canvas.setPointerCapture?.(event.pointerId);
    const fitted = this.zoom < 0;
    this.drag = {
      id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0,
      col: fitted ? spanOf(source).mid : Number.isFinite(this.panCol) ? this.panCol : source.keeper.col + .5,
      row: fitted ? source.t.rows / 2 - 1 : Number.isFinite(this.panRow) ? this.panRow : source.keeper.row + .5,
    };
  }
  move(event: PointerEvent): void {
    const source = this.source();
    if (!this.drag || event.pointerId !== this.drag.id || !source) return;
    this.drag.moved = Math.max(this.drag.moved, Math.hypot(event.clientX - this.drag.x, event.clientY - this.drag.y));
    // A tap is not a drag: the map only moves once the press has travelled.
    if (this.drag.moved <= 8) return;
    // Dragging the fitted map starts from where it is centred, at the nearest zoom step.
    if (this.zoom < 0) this.zoom = this.fitIndex();
    const cell = ZOOMS[this.zoom] ?? 4;
    const span = spanOf(source);
    this.panCol = Math.max(span.col0, Math.min(span.col1, this.drag.col - (event.clientX - this.drag.x) / cell));
    this.panRow = Math.max(-2, Math.min(source.t.rows, this.drag.row - (event.clientY - this.drag.y) / cell));
    this.drawFull(event.currentTarget as HTMLCanvasElement);
  }
  /** The press ended: a press that barely moved is a tap on a cell (pins). */
  release(event?: PointerEvent): void {
    const drag = this.drag;
    this.drag = null;
    if (!event || !drag || drag.id !== event.pointerId || drag.moved > 8 || !this.onTap) return;
    const cell = this.cellAt(event.currentTarget as HTMLCanvasElement, event.clientX, event.clientY);
    if (cell) this.onTap(cell.col, cell.row);
  }
  /** The world cell under a client point on the full map, by its last drawn transform. */
  cellAt(canvas: HTMLCanvasElement, clientX: number, clientY: number): { col: number; row: number } | null {
    const d = this.drawn;
    if (!d || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * d.dpr, y = (clientY - rect.top) * d.dpr;
    return { col: Math.floor((x - d.ox) / d.s), row: Math.floor((y - d.oy) / d.s) };
  }
  /** A world cell's centre in client px on the full map (tests and the pin editor). */
  pointOf(canvas: HTMLCanvasElement, col: number, row: number): { x: number; y: number } | null {
    const d = this.drawn;
    if (!d || !canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + (d.ox + (col + .5) * d.s) / d.dpr, y: rect.top + (d.oy + (row + .5) * d.s) / d.dpr };
  }
  wheel(event: WheelEvent): void {
    event.preventDefault();
    this.zoomBy(event.deltaY < 0 ? 1 : -1);
    this.drawFull(event.currentTarget as HTMLCanvasElement);
  }

  /** CSS px per cell on the full map: the zoom step, or the largest that fits the whole Delve. */
  private cellPx(canvas: HTMLCanvasElement, source: MapSource): number {
    if (this.zoom >= 0) return ZOOMS[this.zoom];
    const span = spanOf(source);
    return Math.max(1, Math.floor(Math.min(canvas.clientWidth / (span.col1 - span.col0), canvas.clientHeight / (source.t.rows + 2))));
  }
  private fitIndex(): number {
    const source = this.source();
    const canvas = typeof document !== 'undefined' ? document.querySelector<HTMLCanvasElement>('.map-full canvas') : null;
    const fit = canvas && source ? this.cellPx(canvas, source) : 4;
    let best = 0;
    ZOOMS.forEach((z, i) => { if (z <= fit) best = i; });
    return best;
  }
  /** Size the canvas's backing store to its box (device px) and hand back its context. */
  private fit(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (!w || !h) return null;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    return canvas.getContext('2d');
  }
}
