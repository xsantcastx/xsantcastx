/**
 * har-analyzer.sample.ts — a small synthetic capture used by the "Load sample"
 * button, so the tool can be evaluated without hunting for a real .har first.
 *
 * It is hand-written rather than a real export: a genuine capture would carry
 * someone's cookies and session tokens, and this one is shaped to exercise the
 * analysis paths that matter — an uncompressed stylesheet, a slow API call, a
 * 404, a redirect, third-party scripts, a cached asset, an oversized JPEG and a
 * mix of HTTP/1.1 and HTTP/2. Timings are consistent with the declared
 * `startedDateTime`/`time` values so the waterfall is honest.
 */

interface SampleSpec {
  url: string;
  type: string;
  status: number;
  mime: string;
  start: number;
  /**
   * blocked, dns, connect, ssl, send, wait, receive — in HAR 1.2 semantics,
   * which means `connect` is the whole connection setup and `ssl` is the
   * handshake *inside* it. So connect must always be ≥ ssl here, and `time`
   * below must not add ssl again.
   */
  timings: [number, number, number, number, number, number, number];
  size: number;
  transfer: number;
  encoding?: string;
  cacheControl?: string;
  protocol?: string;
  fromCache?: boolean;
}

const NAV_START = '2026-08-11T09:14:22.000Z';

const SPECS: SampleSpec[] = [
  { url: 'https://shop.example.com/', type: 'document', status: 200, mime: 'text/html', start: 0,
    timings: [1, 22, 109, 68, 1, 214, 46], size: 34_820, transfer: 9_640, encoding: 'br', protocol: 'h2' },

  { url: 'https://shop.example.com/assets/app.9f2c1e.css', type: 'stylesheet', status: 200, mime: 'text/css', start: 398,
    timings: [3, 0, 0, 0, 1, 58, 22], size: 128_400, transfer: 128_400, protocol: 'h2',
    cacheControl: 'public, max-age=3600' },

  { url: 'https://fonts.gstatic.com/s/inter/v13/inter-var.woff2', type: 'font', status: 200, mime: 'font/woff2', start: 412,
    timings: [2, 31, 134, 79, 1, 44, 61], size: 96_112, transfer: 96_112, protocol: 'h2',
    cacheControl: 'public, max-age=31536000, immutable' },

  { url: 'https://shop.example.com/assets/vendor.4a81b0.js', type: 'script', status: 200, mime: 'application/javascript', start: 402,
    timings: [4, 0, 0, 0, 1, 66, 187], size: 612_300, transfer: 178_940, encoding: 'br', protocol: 'h2',
    cacheControl: 'public, max-age=31536000, immutable' },

  { url: 'https://shop.example.com/assets/main.7d20fa.js', type: 'script', status: 200, mime: 'application/javascript', start: 404,
    timings: [6, 0, 0, 0, 1, 71, 94], size: 214_560, transfer: 64_180, encoding: 'gzip', protocol: 'h2',
    cacheControl: 'public, max-age=31536000, immutable' },

  { url: 'https://cdn.thirdparty-analytics.io/tag.js', type: 'script', status: 200, mime: 'application/javascript', start: 620,
    timings: [11, 44, 153, 91, 2, 128, 37], size: 88_940, transfer: 31_220, encoding: 'gzip', protocol: 'http/1.1' },

  { url: 'https://shop.example.com/img/hero-banner.jpg', type: 'image', status: 200, mime: 'image/jpeg', start: 640,
    timings: [8, 0, 0, 0, 1, 62, 486], size: 842_000, transfer: 842_000, protocol: 'h2',
    cacheControl: 'public, max-age=604800' },

  { url: 'https://shop.example.com/img/logo.svg', type: 'image', status: 200, mime: 'image/svg+xml', start: 648,
    timings: [9, 0, 0, 0, 1, 40, 6], size: 4_120, transfer: 4_120, protocol: 'h2',
    cacheControl: 'public, max-age=31536000, immutable' },

  { url: 'https://shop.example.com/img/product-3.png', type: 'image', status: 200, mime: 'image/png', start: 690,
    timings: [214, 0, 0, 0, 1, 48, 121], size: 318_400, transfer: 318_400, protocol: 'h2',
    cacheControl: 'public, max-age=86400' },

  { url: 'https://shop.example.com/api/cart?session_token=abc123def456&currency=EUR', type: 'xhr', status: 200,
    mime: 'application/json', start: 812, timings: [2, 0, 0, 0, 1, 968, 14], size: 2_140, transfer: 1_180,
    encoding: 'gzip', protocol: 'h2' },

  { url: 'https://shop.example.com/api/recommendations', type: 'xhr', status: 500, mime: 'application/json', start: 830,
    timings: [3, 0, 0, 0, 1, 402, 8], size: 184, transfer: 402, protocol: 'h2' },

  { url: 'http://shop.example.com/legacy/tracking-pixel.gif', type: 'image', status: 302, mime: 'text/html', start: 902,
    timings: [4, 18, 34, 0, 1, 88, 2], size: 0, transfer: 322, protocol: 'http/1.1' },

  { url: 'https://shop.example.com/img/missing-icon.png', type: 'image', status: 404, mime: 'text/html', start: 940,
    timings: [3, 0, 0, 0, 1, 52, 4], size: 1_460, transfer: 640, protocol: 'h2' },

  { url: 'https://shop.example.com/assets/icons.4b19cc.woff2', type: 'font', status: 200, mime: 'font/woff2', start: 960,
    timings: [0, 0, 0, 0, 0, 0, 0], size: 18_240, transfer: 0, protocol: 'h2', fromCache: true,
    cacheControl: 'public, max-age=31536000, immutable' },
];

function iso(offsetMs: number): string {
  return new Date(Date.parse(NAV_START) + offsetMs).toISOString();
}

const REQUEST_COOKIE =
  'sid=8f14e45fceea167a5a36dedd4bea2543; cart_id=b3f1c9a2; consent=analytics:1,marketing:0; ' +
  'ab_bucket=variant_b; _ga=GA1.2.998877665.1754870062; _gid=GA1.2.112233445.1754870062; ' +
  'locale=en-GB; currency=EUR; recently_viewed=112%2C884%2C231%2C905%2C447';

function buildEntry(spec: SampleSpec) {
  const [blocked, dns, connect, ssl, send, wait, receive] = spec.timings;
  // `ssl` is nested inside `connect`, so it is deliberately not summed again.
  const total = blocked + dns + connect + send + wait + receive;
  const host = spec.url.replace(/^https?:\/\//, '').split('/')[0];
  const isFirstParty = host === 'shop.example.com';
  const queryString = spec.url.includes('?')
    ? spec.url.split('?')[1].split('&').map(pair => {
        const [name, value = ''] = pair.split('=');
        return { name, value };
      })
    : [];

  return {
    pageref: 'page_1',
    startedDateTime: iso(spec.start),
    time: total,
    request: {
      method: 'GET',
      url: spec.url,
      httpVersion: spec.protocol === 'h2' ? 'h2' : 'http/1.1',
      headers: [
        { name: ':authority', value: host },
        { name: 'user-agent', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' },
        { name: 'accept', value: '*/*' },
        { name: 'accept-encoding', value: 'gzip, deflate, br, zstd' },
        ...(isFirstParty ? [{ name: 'cookie', value: REQUEST_COOKIE }] : []),
        ...(spec.type === 'xhr' ? [{ name: 'authorization', value: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sample.token' }] : []),
      ],
      queryString,
      cookies: isFirstParty
        ? [
            { name: 'sid', value: '8f14e45fceea167a5a36dedd4bea2543', path: '/', domain: '.example.com', httpOnly: true, secure: true },
            { name: 'cart_id', value: 'b3f1c9a2', path: '/', domain: '.example.com' },
          ]
        : [],
      headersSize: 512,
      bodySize: 0,
    },
    response: {
      status: spec.status,
      statusText: spec.status === 200 ? 'OK' : spec.status === 302 ? 'Found' : spec.status === 404 ? 'Not Found' : 'Internal Server Error',
      httpVersion: spec.protocol === 'h2' ? 'h2' : 'http/1.1',
      headers: [
        { name: 'content-type', value: spec.mime + (spec.mime.startsWith('text/') || spec.mime.includes('json') ? '; charset=utf-8' : '') },
        ...(spec.encoding ? [{ name: 'content-encoding', value: spec.encoding }] : []),
        ...(spec.cacheControl ? [{ name: 'cache-control', value: spec.cacheControl }] : []),
        ...(spec.status === 302 ? [{ name: 'location', value: 'https://shop.example.com/legacy/tracking-pixel.gif' }] : []),
        { name: 'server', value: isFirstParty ? 'nginx' : 'cloudflare' },
        ...(isFirstParty && spec.type === 'document'
          ? [{ name: 'set-cookie', value: 'sid=8f14e45fceea167a5a36dedd4bea2543; Path=/; HttpOnly; Secure; SameSite=Lax' }]
          : []),
      ],
      cookies: isFirstParty && spec.type === 'document'
        ? [{ name: 'sid', value: '8f14e45fceea167a5a36dedd4bea2543', path: '/', httpOnly: true, secure: true }]
        : [],
      content: {
        size: spec.size,
        mimeType: spec.mime,
        ...(spec.encoding ? { compression: spec.size - spec.transfer } : {}),
        ...(spec.mime.includes('json')
          ? { text: spec.status === 200 ? '{"items":[{"sku":"AX-9921","qty":2,"price":34.5}],"total":69}' : '{"error":"upstream timeout"}' }
          : {}),
        ...(spec.type === 'document' ? { text: '<!doctype html>\n<html lang="en">\n<head><title>Example Shop</title></head>\n<body><main id="app"></main></body>\n</html>' } : {}),
      },
      redirectURL: spec.status === 302 ? 'https://shop.example.com/legacy/tracking-pixel.gif' : '',
      headersSize: 384,
      bodySize: spec.transfer,
      _transferSize: spec.transfer,
    },
    cache: spec.fromCache ? { afterRequest: { expires: iso(31_536_000_000), lastAccess: iso(spec.start), eTag: 'W/"4b19cc"', hitCount: 4 } } : {},
    timings: { blocked, dns: dns || -1, connect: connect || -1, ssl: ssl || -1, send, wait, receive },
    serverIPAddress: isFirstParty ? '203.0.113.42' : '198.51.100.17',
    connection: isFirstParty ? '4821' : '4907',
    _resourceType: spec.type,
    _priority: spec.type === 'document' || spec.type === 'stylesheet' ? 'VeryHigh' : spec.type === 'script' ? 'High' : 'Low',
    _initiator: { type: spec.type === 'document' ? 'other' : 'parser', url: 'https://shop.example.com/' },
    ...(spec.fromCache ? { _fromCache: 'disk' } : {}),
  };
}

export const SAMPLE_HAR: string = JSON.stringify({
  log: {
    version: '1.2',
    creator: { name: 'xsantcastx HAR Analyzer (sample)', version: '1.0' },
    browser: { name: 'Chrome', version: '141.0.0.0' },
    pages: [
      {
        id: 'page_1',
        title: 'https://shop.example.com/',
        startedDateTime: NAV_START,
        pageTimings: { onContentLoad: 1_142, onLoad: 1_884 },
      },
    ],
    entries: SPECS.map(buildEntry),
  },
});
