/**
 * td-zoom.ts — the top-down camera's zoom (owner 2026-10-26: "I feel like I'm too zoomed in on the character now …
 * it's too squared"; the paused look branch, ~/er/wt-look).
 *
 * The default frames about a third more of the world than the art style upgrade did (CSS px per art px ÷ 1.15:
 * desktop 2.6 at 720–1039 px tall, 3.5 from 1040; tablets 1.75; phones 4/3). The player scales that by a factor
 * (wheel, the Zoom keys, a pinch), clamped to ZOOM_MIN…ZOOM_MAX and kept per device in plain localStorage behind
 * try/catch (the Environment detail's rule, never the save gateway: a phone's zoom is not a desktop's).
 *
 * `backing()` turns a zoom into a canvas: always a whole number of backing pixels per art pixel (every art pixel the
 * same size), the backing then sized so the browser fits it to the element — exactly the device's pixels when that
 * works out, else a small even resample (a sharp-bilinear fit: whole-pixel art first, one smooth step after), never
 * a nearest-neighbour stretch by a fraction (uneven pixels).
 */
export const ZOOM_KEY = 'eclipse-td-zoom';
export const ZOOM_MIN = .75;
export const ZOOM_MAX = 1.5;
/** One wheel notch or key press. */
export const ZOOM_STEP = 1.1;
/** The art style upgrade's camera (CSS px per art px) is divided by this for the default: ≈ 32% more world on screen. */
export const ZOOM_OUT = 1.15;

/** The default CSS px per art px for a canvas of this CSS size. */
export function baseZoom(cssW: number, cssH: number): number {
  // The upgrade's camera: 3 css px per art px on a wide screen (4 from 1040 tall), 2 on a tablet, 1.5 on a phone.
  if (cssW >= 1100) return Math.max(3, Math.min(4, Math.floor(cssH / 260))) / ZOOM_OUT;
  if (cssW >= 700) return 2 / ZOOM_OUT;
  // A phone: 4/3, so a DPR-3 phone's canvas (backing 1.5 per CSS px) is exactly 2 device px per backing px.
  return 4 / 3;
}

export function clampZoom(f: number): number {
  if (!Number.isFinite(f)) return 1;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, f));
}

let current: number | null = null;

/** The player's zoom factor on this device (1 = the default). */
export function zoomFactor(): number {
  if (current !== null) return current;
  let v = 1;
  try {
    const s = typeof localStorage === 'undefined' ? null : localStorage.getItem(ZOOM_KEY);
    if (s !== null) v = clampZoom(parseFloat(s));
  } catch { /* storage blocked: the default */ }
  current = v;
  return v;
}

/** Set (and keep) the zoom factor; returns the clamped value. */
export function setZoomFactor(f: number): number {
  const v = Math.round(clampZoom(f) * 1000) / 1000;
  current = v;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(ZOOM_KEY, String(v)); } catch { /* not kept */ }
  return v;
}

/** One step in (+1) or out (−1), snapped to the step ladder so ten presses in and ten out come back to the default. */
export function stepZoom(dir: 1 | -1): number {
  const n = Math.round(Math.log(zoomFactor()) / Math.log(ZOOM_STEP)) + dir;
  return setZoomFactor(Math.pow(ZOOM_STEP, n));
}

/** Forget the in-memory value (specs). */
export function resetZoomCache(): void { current = null; }

export interface Backing {
  /** Whole backing px per art px (the engine's `scale`). */
  scale: number;
  /** Backing px per CSS px. */
  ratio: number;
  /** The backing is a whole multiple (or exactly) of the device's pixels: nearest-neighbour is lossless. */
  crisp: boolean;
}

/**
 * The canvas for a zoom: `z` CSS px per art px on a device of `dpr` pixels per CSS px, the backing capped at `cap`
 * backing px per CSS px (calm.md: the phone's raster budget). Never under 2 backing px per art px (the plates' text).
 */
export function backing(z: number, dpr: number, cap: number): Backing {
  const want = z * Math.min(dpr, cap);
  let scale = Math.max(2, Math.round(want));
  if (scale / z > cap + 1e-6) scale = Math.max(2, Math.floor(z * cap + 1e-6));
  const ratio = scale / z, q = dpr / ratio;
  return { scale, ratio, crisp: Math.abs(q - Math.round(q)) < 1e-3 };
}
