/**
 * har-analyzer.worker.ts — owns the parsed HAR for the lifetime of a session.
 *
 * The main thread never holds the full HAR. It holds `HarAnalysis` (a few
 * hundred KB) and asks this worker for per-request detail or a redacted export
 * on demand. That split is the whole reason a 100 MB capture stays interactive:
 * `JSON.parse` on a file that size blocks for seconds, and a HAR that big is
 * roughly a quarter-gigabyte of live objects that would otherwise have to be
 * structured-cloned across the boundary.
 */

import { analyzeHar, extractDetail, redactHar } from './har-analysis';
import type { HarFile, WorkerRequestMessage, WorkerResponseMessage } from './har-analyzer.types';

/** Retained between messages so `detail` and `redact` do not re-parse. */
let parsed: HarFile | null = null;
let sourceBytes = 0;

/**
 * The worker global, typed locally.
 *
 * Pulling in `lib.webworker` with a triple-slash reference would apply to the
 * whole TypeScript program, not just this file, and its `self`/`addEventListener`
 * declarations then collide with the DOM lib the rest of the app compiles
 * against. Declaring the two members we use is enough and keeps the app's
 * single tsconfig intact.
 */
interface WorkerScope {
  postMessage(message: WorkerResponseMessage, transfer?: Transferable[]): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent<WorkerRequestMessage>) => void,
  ): void;
}

const ctx = self as unknown as WorkerScope;

function post(message: WorkerResponseMessage, transfer?: Transferable[]): void {
  if (transfer && transfer.length) {
    ctx.postMessage(message, transfer);
  } else {
    ctx.postMessage(message);
  }
}

function describeParseFailure(error: unknown, text: string): string {
  const raw = error instanceof Error ? error.message : String(error);

  // `JSON.parse` reports a character offset. Turning it into a line number and
  // a snippet is the difference between "unexpected token" and an actionable
  // error, and truncated HARs (the common real-world case) land here.
  const posMatch = /position (\d+)/i.exec(raw);
  if (posMatch) {
    const pos = parseInt(posMatch[1], 10);
    const line = text.slice(0, pos).split('\n').length;
    const snippet = text.slice(Math.max(0, pos - 40), pos + 40).replace(/\s+/g, ' ').trim();
    const atEnd = pos >= text.length - 2;
    return atEnd
      ? `The file ends mid-JSON at line ${line}. This usually means the capture was saved while DevTools was still recording, or the download was cut short — re-export the HAR and try again.`
      : `Invalid JSON at line ${line}: ${raw}. Near: …${snippet}…`;
  }
  return `Could not parse this file as JSON. ${raw}`;
}

ctx.addEventListener('message', async (event: MessageEvent<WorkerRequestMessage>) => {
  const msg = event.data;

  try {
    switch (msg.type) {
      case 'parse':
      case 'parseText': {
        post({ type: 'progress', phase: 'Reading file', pct: 5 });

        const text = msg.type === 'parse' ? await msg.file.text() : msg.text;
        sourceBytes = text.length;

        if (!text.trim()) {
          post({ type: 'error', message: 'That file is empty.' });
          return;
        }

        post({ type: 'progress', phase: 'Parsing JSON', pct: 25 });

        let har: HarFile;
        try {
          har = JSON.parse(text) as HarFile;
        } catch (error) {
          post({ type: 'error', message: describeParseFailure(error, text) });
          return;
        }

        if (!har || typeof har !== 'object' || !har.log || !Array.isArray(har.log.entries)) {
          post({
            type: 'error',
            message: 'This is valid JSON but not a HAR archive — a HAR has a top-level "log" object containing an "entries" array. Export one from DevTools → Network → the download arrow.',
          });
          return;
        }

        post({ type: 'progress', phase: 'Analysing requests', pct: 45 });

        parsed = har;
        // Map the entry walk (0-100) onto the back half of the overall bar.
        const analysis = analyzeHar(har, pct => {
          post({ type: 'progress', phase: 'Analysing requests', pct: 45 + Math.round(pct * 0.5) });
        });

        post({ type: 'progress', phase: 'Done', pct: 100 });
        post({ type: 'result', analysis });
        return;
      }

      case 'detail': {
        if (!parsed) {
          post({ type: 'error', message: 'No HAR is loaded.' });
          return;
        }
        post({ type: 'detail', detail: extractDetail(parsed, msg.index) });
        return;
      }

      case 'redact': {
        if (!parsed) {
          post({ type: 'error', message: 'No HAR is loaded.' });
          return;
        }
        post({ type: 'progress', phase: 'Redacting', pct: 30 });
        const { json, report } = redactHar(parsed, sourceBytes);
        // Transfer the buffer instead of cloning it — a redacted HAR is still
        // megabytes, and this hands ownership over with no copy.
        const buffer = new TextEncoder().encode(json).buffer as ArrayBuffer;
        post({ type: 'progress', phase: 'Done', pct: 100 });
        post({ type: 'redacted', buffer, report }, [buffer]);
        return;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // A HAR big enough to exhaust the heap throws RangeError here rather than
    // failing gracefully, so name that case explicitly.
    post({
      type: 'error',
      message: /allocation|out of memory|Invalid string length|RangeError/i.test(message)
        ? 'This HAR is too large for the browser to hold in memory. Try re-capturing with response bodies disabled (DevTools → Network → uncheck "Preserve log" and clear before recording), or split the capture.'
        : message,
    });
  }
});
