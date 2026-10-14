/**
 * play-memory-probe.ts — what an open/close of an in-world place costs.
 *
 * Shared by e2e/play-memory.spec.ts (the regression guard) and its PLAY_MEMORY_PROBE
 * mode (the measuring run behind docs/handoff/memory-heat-css.md). Everything is
 * read through the DevTools protocol, so detached nodes and canvases count too:
 *   - JS heap after a forced GC (`Performance.getMetrics` JSHeapUsedSize)
 *   - DOM nodes and listeners, attached + detached (`Memory.getDOMCounters`)
 *   - every HTMLCanvasElement / HTMLImageElement / ImageBitmap still alive in the
 *     heap (`Runtime.queryObjects`), with backing-store and decoded pixels
 *   - compositor layers (`LayerTree`)
 *   - requestAnimationFrame callbacks per second (an init-script counter)
 */
import type { CDPSession, Page } from '@playwright/test';

export interface MemorySample {
  heapMB: number;
  nodes: number;
  listeners: number;
  documents: number;
  canvases: number;
  canvasesAttached: number;
  canvasMP: number;
  images: number;
  imagesDecodedMP: number;
  largestImage: string;
  bitmaps: number;
  layers: number;
  layerMP: number;
  rafPerSec: number;
}

/** Count rAF callbacks; install before the app boots (addInitScript). */
export const RAF_COUNTER = `(() => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__rafCalls = 0;
  window.requestAnimationFrame = cb => raf(t => { window.__rafCalls++; cb(t); });
})();`;

export async function startProbe(page: Page): Promise<CDPSession & { layers: { width: number; height: number; drawsContent: boolean }[] }> {
  const cdp = await page.context().newCDPSession(page) as CDPSession & { layers: { width: number; height: number; drawsContent: boolean }[] };
  cdp.layers = [];
  await cdp.send('Performance.enable');
  await cdp.send('HeapProfiler.enable');
  await cdp.send('Runtime.enable');
  try {
    await cdp.send('LayerTree.enable');
    cdp.on('LayerTree.layerTreeDidChange', (e: { layers?: { width: number; height: number; drawsContent: boolean }[] }) => {
      if (e.layers) cdp.layers = e.layers;
    });
  } catch { /* no LayerTree domain (webkit) */ }
  return cdp;
}

async function instances(cdp: CDPSession, ctor: string, fn: string): Promise<Record<string, unknown>> {
  const proto = await cdp.send('Runtime.evaluate', { expression: `${ctor}.prototype` });
  const protoId = proto.result.objectId;
  if (!protoId) return {};
  const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: protoId });
  const out = await cdp.send('Runtime.callFunctionOn', { objectId: objects.objectId!, functionDeclaration: fn, returnByValue: true });
  await cdp.send('Runtime.releaseObject', { objectId: objects.objectId! });
  await cdp.send('Runtime.releaseObject', { objectId: protoId });
  return (out.result.value ?? {}) as Record<string, unknown>;
}

export async function sample(page: Page, cdp: CDPSession & { layers: { width: number; height: number; drawsContent: boolean }[] }): Promise<MemorySample> {
  await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.collectGarbage');
  const { metrics } = await cdp.send('Performance.getMetrics');
  const get = (name: string) => metrics.find(m => m.name === name)?.value ?? 0;
  const dom = await cdp.send('Memory.getDOMCounters');
  const canvas = await instances(cdp, 'HTMLCanvasElement', `function () {
    let px = 0, attached = 0;
    for (const c of this) { px += c.width * c.height; if (c.isConnected) attached++; }
    return { n: this.length, attached, mp: px / 1e6 };
  }`);
  const image = await instances(cdp, 'HTMLImageElement', `function () {
    let px = 0, big = 0, bigName = '';
    for (const i of this) {
      if (!i.complete || !i.naturalWidth) continue;
      const p = i.naturalWidth * i.naturalHeight; px += p;
      if (p > big) { big = p; bigName = (i.currentSrc || i.src).split('/').pop() + ' ' + i.naturalWidth + 'x' + i.naturalHeight; }
    }
    return { n: this.length, mp: px / 1e6, big: bigName };
  }`);
  const bitmap = await instances(cdp, 'ImageBitmap', `function () { return { n: this.length }; }`);
  const r0 = await page.evaluate(() => (window as unknown as { __rafCalls?: number }).__rafCalls ?? 0);
  await page.waitForTimeout(1000);
  const r1 = await page.evaluate(() => (window as unknown as { __rafCalls?: number }).__rafCalls ?? 0);
  const drawn = cdp.layers.filter(l => l.drawsContent);
  return {
    heapMB: +(get('JSHeapUsedSize') / 1048576).toFixed(2),
    nodes: dom.nodes,
    listeners: dom.jsEventListeners,
    documents: dom.documents,
    canvases: Number(canvas['n'] ?? 0),
    canvasesAttached: Number(canvas['attached'] ?? 0),
    canvasMP: +Number(canvas['mp'] ?? 0).toFixed(2),
    images: Number(image['n'] ?? 0),
    imagesDecodedMP: +Number(image['mp'] ?? 0).toFixed(2),
    largestImage: String(image['big'] ?? ''),
    bitmaps: Number(bitmap['n'] ?? 0),
    layers: drawn.length,
    layerMP: +(drawn.reduce((a, l) => a + l.width * l.height, 0) / 1e6).toFixed(2),
    rafPerSec: r1 - r0,
  };
}
