/**
 * tools-registry.ts — Single source of truth for all xsantcastx tools.
 *
 * Every component that needs tool data (landing page, /tools grid,
 * tools-data service, routing SEO) imports from here.
 * When adding a new tool, add ONE entry to TOOLS_REGISTRY and
 * everything else picks it up automatically.
 */

export interface ToolDefinition {
  /** Unique slug used as identifier (e.g. 'json-formatter') */
  id: string;

  /** Canonical English title shown on tool cards and pages */
  title: string;

  /** Canonical English description (one clear sentence) */
  description: string;

  /** Optional i18n translation key for title */
  titleKey?: string;

  /** Optional i18n translation key for description */
  descriptionKey?: string;

  /** Full route path (e.g. '/tools/json-formatter'). Empty string for coming-soon tools. */
  route: string;

  /** Whether the tool is live or coming soon */
  status: 'live' | 'coming-soon';

  /** Tool category for filtering */
  category: string;

  /** Tags for the /tools grid filtering and related-tools matching */
  tags: string[];

  /** SVG inner markup (path/circle/etc.) for the /tools page icon */
  svgIcon: string;

  /** Simple text/emoji icon for the landing page cards */
  textIcon: string;

  /** Feature bullet points for landing page tool cards */
  features: string[];

  /** Whether this tool is featured in the hero carousel */
  featured?: boolean;
}

/**
 * The canonical list of all tools on xsantcastx.com.
 * Order matters — it determines display order on the landing page and /tools grid.
 */
export const TOOLS_REGISTRY: ToolDefinition[] = [
  {
    id: 'box-shadow-generator',
    title: 'CSS Box Shadow Generator',
    description: 'Visually design layered CSS box shadows with live preview and code export.',
    route: '/tools/box-shadow-generator',
    status: 'live',
    category: 'CSS Tools',
    tags: ['CSS', 'Design', 'Generator'],
    svgIcon: `<rect x="4" y="6" width="12" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="8" y="9" width="12" height="10" rx="2" stroke="currentColor" stroke-width="2" fill="none" opacity="0.4"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M19 14l2 2-2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="18" y1="16" x2="22" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    textIcon: '◻',
    features: ['Multiple shadow layers', 'Live visual preview', 'RGBA color picker', 'One-click CSS copy'],
    featured: true,
  },
  {
    id: 'color-palette',
    title: 'Color Palette Extractor',
    description: 'Extract dominant colors from any image. Export as CSS variables, Tailwind, or JSON.',
    titleKey: 'tools.color.title',
    descriptionKey: 'tools.color.desc',
    route: '/tools/color-palette',
    status: 'live',
    category: 'CSS Tools',
    tags: ['Colors', 'Design', 'CSS'],
    svgIcon: `<circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="16" cy="10" r="2" fill="currentColor" stroke="none"/><circle cx="12" cy="16" r="2" fill="currentColor" stroke="none"/><circle cx="6" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="18" cy="14" r="1.5" fill="currentColor" stroke="none"/>`,
    textIcon: '◉',
    features: ['Dominant color extraction', 'HEX, RGB & HSL formats', 'Export CSS variables', 'Export Tailwind config'],
  },
  {
    id: 'contrast-checker',
    title: 'WCAG Contrast Checker',
    description: 'Test foreground/background pairs against WCAG AA & AAA accessibility standards.',
    titleKey: 'tools.contrast.title',
    descriptionKey: 'tools.contrast.desc',
    route: '/tools/contrast-checker',
    status: 'live',
    category: 'CSS Tools',
    tags: ['Accessibility', 'WCAG', 'Colors'],
    svgIcon: `<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" stroke="none"/>`,
    textIcon: '◑',
    features: ['AA & AAA compliance', 'Normal & large text', 'UI component checks', 'Color picker'],
  },
  {
    id: 'email-deliverability-auditor',
    title: 'Email Deliverability Auditor',
    description: 'Audit SPF, DKIM, DMARC & MX records and get instant fix suggestions for email delivery.',
    route: '/tools/email-deliverability-auditor',
    status: 'live',
    category: 'Email Tools',
    tags: ['Email', 'DNS', 'Security', 'DevTools', 'SPF', 'DMARC'],
    svgIcon: `<path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke-width="1.5" fill="none"/><path d="M3 5l9 7 9-7" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    textIcon: '◈',
    features: ['SPF record validation', 'DKIM DNS lookup', 'DMARC policy check', 'Fix recommendations'],
    featured: true,
  },
  {
    id: 'gmail-deliverability-checker',
    title: 'Gmail Deliverability Checker',
    description: 'Diagnose email delivery issues and auto-generate SPF, DKIM, DMARC fixes.',
    route: '/tools/gmail-deliverability-checker',
    status: 'live',
    category: 'Email Tools',
    tags: ['Email', 'DevOps', 'DNS', 'Security'],
    svgIcon: `<path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M3 6l9 7 9-7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="17.5" cy="17.5" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><polyline points="15.5 17.5 17 19 20 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    textIcon: '◎',
    features: ['Gmail-specific diagnostics', 'SPF auto-generator', 'Ready-to-copy DNS fixes', 'MX record lookup'],
  },
  {
    id: 'ssl-certificate-inspector',
    title: 'SSL Certificate Inspector',
    description: 'Inspect SSL/TLS certificates, visualize chain of trust, and audit CA reputation instantly.',
    route: '/tools/ssl-certificate-inspector',
    status: 'live',
    category: 'Security Tools',
    tags: ['Security', 'SSL/TLS', 'Networking', 'DevTools', 'HTTPS'],
    svgIcon: `<path d="M12 2L4 5v6c0 4.418 3.358 8.547 8 9.95C16.642 19.547 20 15.418 20 11V5L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/><circle cx="12" cy="11" r="2.5" stroke="currentColor" stroke-width="1.5" fill="none"/>`,
    textIcon: '⬡',
    features: ['Certificate expiry check', 'Full chain visualization', 'Weak cipher detection', 'CA reputation audit'],
    featured: true,
  },
  {
    id: 'svg-to-code',
    title: 'SVG to Code Converter',
    description: 'Convert SVGs to optimized React, Vue, or Angular components with props and a11y.',
    route: '/tools/svg-to-code',
    status: 'live',
    category: 'Code Converters',
    tags: ['SVG', 'React', 'Vue', 'Angular', 'Components', 'Accessibility', 'Frontend', 'Code Generator'],
    svgIcon: `<path d="M3 6l4 6-4 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M10 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><rect x="14" y="4" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>`,
    textIcon: '⟨⟩',
    features: ['React JSX/TSX output', 'Vue & Angular support', 'Color & size props', 'ARIA accessibility'],
    featured: true,
  },
  {
    id: 'json-formatter',
    title: 'JSON Formatter & Validator',
    description: 'Format, validate, minify and repair JSON with live syntax checking and one-click copy.',
    route: '/tools/json-formatter',
    status: 'live',
    category: 'Code Converters',
    tags: ['JSON', 'Formatter', 'Validator', 'Code Tools'],
    svgIcon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="11" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
    textIcon: '{}',
    features: ['Live validation', 'Syntax highlighting', 'Sort keys & minify', 'Repair broken JSON'],
  },
  {
    id: 'base64-encoder',
    title: 'Base64 Encoder & Decoder',
    description: 'Encode text or files to Base64 and decode Base64 back to text with URL-safe mode and live conversion.',
    route: '/tools/base64-encoder',
    status: 'live',
    category: 'Code Converters',
    tags: ['Base64', 'Encoding', 'Code Tools', 'Utilities'],
    svgIcon: `<path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><rect x="14" y="13" width="6" height="6" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M16 16l1 1 2-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    textIcon: '64',
    features: ['Encode & decode text', 'URL-safe Base64', 'File drag & drop encode', 'Live conversion'],
  },
  {
    id: 'regex-tester',
    title: 'Regex Tester',
    description: 'Test and debug regular expressions live with match highlighting, capture groups, flags and plain-English explanations.',
    route: '/tools/regex-tester',
    status: 'live',
    category: 'Code Converters',
    tags: ['Regex', 'Code Tools', 'Debugger', 'Developer'],
    svgIcon: `<path d="M3 9h18M3 15h18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M7 5l-4 7 4 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M17 5l4 7-4 7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    textIcon: '.*',
    features: ['Live match highlighting', 'Capture groups', 'g i m s u flags', 'Plain-English explanation'],
  },
  {
    id: 'pdf-generator',
    title: 'PDF Catalog Generator',
    description: 'Build professional product catalogs from images and export as PDF instantly.',
    titleKey: 'tools.pdf.title',
    descriptionKey: 'tools.pdf.desc',
    route: '/tools/pdf-generator',
    status: 'live',
    category: 'Productivity',
    tags: ['PDF', 'Images', 'Export'],
    svgIcon: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>`,
    textIcon: '▤',
    features: ['Drag & drop upload', 'Multiple layout templates', 'Custom accent colors', 'Auto-save to browser'],
    featured: true,
  },
  {
    id: 'image-compressor',
    title: 'Image Compressor',
    description: 'Compress JPEG, PNG, and WebP images in-browser. No uploads, instant download.',
    titleKey: 'tools.compressor.title',
    descriptionKey: 'tools.compressor.desc',
    route: '/tools/image-compressor',
    status: 'live',
    category: 'Productivity',
    tags: ['Images', 'Performance', 'WebP'],
    svgIcon: `<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/><polyline points="14 3 14 8 19 8"/>`,
    textIcon: '▣',
    features: ['JPEG, PNG & WebP', 'Batch up to 20 images', 'Live quality preview', 'No server uploads'],
  },
  {
    id: 'ssl-certificate-auditor',
    title: 'SSL Certificate Auditor',
    description: 'Audit SSL certificates, verify CA chain, and surface security flags instantly.',
    route: '/tools/ssl-certificate-auditor',
    status: 'live',
    category: 'Security Tools',
    tags: ['Security', 'SSL/TLS', 'DevTools', 'HTTPS', 'Networking'],
    svgIcon: `<path d="M12 2L4 5v6c0 4.418 3.358 8.538 8 9.95C16.642 19.538 20 15.418 20 11V5L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
    textIcon: '🔒',
    features: ['Root CA verification', 'Certificate expiry check', 'Security flag audit', 'No backend required'],
  },

  {
    id: 'gradient-generator',
    title: 'CSS Gradient Generator',
    description: 'Create beautiful CSS gradients with a visual editor and export ready-to-use code.',
    titleKey: 'tools.gradient.title',
    descriptionKey: 'tools.gradient.desc',
    route: '/tools/gradient-generator',
    status: 'live',
    category: 'CSS Tools',
    tags: ['CSS', 'Design', 'Colors'],
    svgIcon: `<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="currentColor" stop-opacity="1"/><stop offset="100%" stop-color="currentColor" stop-opacity="0.15"/></linearGradient></defs><rect x="3" y="3" width="18" height="18" rx="3" fill="url(#g)" stroke="currentColor"/>`,
    textIcon: '◧',
    features: ['Linear, radial & conic', 'Visual stop editor', 'Angle control', 'One-click CSS copy'],
  },

  {
    id: 'jwt-decoder',
    title: 'JWT Decoder & Debugger',
    description: 'Decode and inspect JSON Web Tokens instantly — view header, payload, claims, and expiration status.',
    route: '/tools/jwt-decoder',
    status: 'live',
    category: 'Security Tools',
    tags: ['JWT', 'Auth', 'Security', 'DevTools'],
    svgIcon: `<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 8h8M8 12h6M8 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    textIcon: '🔐',
    features: ['Instant header/payload decode', 'Expiration countdown', 'Claim labels', 'Copy sections'],
    featured: true,
  },
  {
    id: 'uuid-generator',
    title: 'UUID/GUID Generator',
    description: 'Generate UUID v1, v4, and ULID identifiers with bulk mode, formatting, and validation.',
    route: '/tools/uuid-generator',
    status: 'live',
    category: 'Productivity',
    tags: ['UUID', 'Generator', 'DevTools'],
    svgIcon: `<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7 8h10M7 12h7M7 16h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6"/><circle cx="17" cy="14" r="3" stroke="currentColor" stroke-width="2" fill="none"/>`,
    textIcon: '#',
    features: ['UUID v1, v4 & ULID', 'Bulk generation (1-100)', 'Format options', 'UUID validator'],
  },
  {
    id: 'hash-generator',
    title: 'Hash Generator',
    description: 'Generate MD5, SHA-1, SHA-256, SHA-384, SHA-512 hashes from text or files with comparison mode.',
    route: '/tools/hash-generator',
    status: 'live',
    category: 'Security Tools',
    tags: ['Hash', 'Crypto', 'Security', 'DevTools'],
    svgIcon: `<path d="M12 2L2 7l10 5 10-5-10-5z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M2 17l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M2 12l10 5 10-5" stroke="currentColor" stroke-width="2" fill="none"/>`,
    textIcon: '#️',
    features: ['5 hash algorithms', 'File drag & drop', 'Hash comparison', 'Uppercase/lowercase toggle'],
  },
  {
    id: 'meta-tag-generator',
    title: 'Open Graph & Meta Tag Generator',
    description: 'Generate SEO, Open Graph, and Twitter Card meta tags with live social preview mockups.',
    route: '/tools/meta-tag-generator',
    status: 'live',
    category: 'SEO Tools',
    tags: ['SEO', 'Meta Tags', 'Social', 'Marketing'],
    svgIcon: `<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><path d="M8 8h8v4H8z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 15h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M8 18h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>`,
    textIcon: '🏷',
    features: ['OG & Twitter Cards', 'Social preview mockups', 'SEO meta tags', 'One-click copy'],
    featured: true,
  },
  {
    id: 'env-validator',
    title: '.env File Validator & Secret Scanner',
    description: 'Validate .env file syntax and scan for exposed API keys, tokens, and secrets.',
    route: '/tools/env-validator',
    status: 'live',
    category: 'Security Tools',
    tags: ['Security', 'DevTools', 'Secrets', 'Validation'],
    svgIcon: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    textIcon: '🛡',
    features: ['Syntax validation', 'Secret scanning', 'Severity levels', 'Export .env.example'],
  },
  {
    id: 'font-pairer',
    title: 'Font Pairer',
    description: 'Find beautiful Google Font combinations with live preview and CSS export.',
    route: '/tools/font-pairer',
    status: 'live',
    category: 'CSS Tools',
    tags: ['Typography', 'Fonts', 'Design'],
    svgIcon: `<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>`,
    textIcon: 'Aa',
    features: ['18 curated pairings', 'Live type preview', 'Category filters', 'CSS & link export'],
  },

  // ── Batch 3: 2026-03-31 ──────────────────────────────────────────────────
  {
    id: 'cron-builder',
    title: 'Cron Expression Builder',
    description: 'Build cron schedules visually with human-readable descriptions and next-run preview.',
    route: '/tools/cron-builder',
    status: 'live',
    category: 'Productivity',
    tags: ['Cron', 'Scheduling', 'DevTools'],
    svgIcon: `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    textIcon: '⏰',
    features: ['Visual builder', 'Common presets', 'Next 5 runs', 'Human-readable output'],
    featured: true,
  },
  {
    id: 'api-request-builder',
    title: 'API Request Builder',
    description: 'Build and test HTTP requests in the browser — a lightweight Postman alternative.',
    route: '/tools/api-request-builder',
    status: 'live',
    category: 'Productivity',
    tags: ['API', 'HTTP', 'REST', 'DevTools'],
    svgIcon: `<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><path d="M8 10l4-4 4 4M8 14l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    textIcon: '🔗',
    features: ['All HTTP methods', 'Headers & body editor', 'Response viewer', 'Copy as cURL'],
    featured: true,
  },
  {
    id: 'json-to-ts',
    title: 'JSON to TypeScript',
    description: 'Convert JSON to TypeScript interfaces with nested object and array support.',
    route: '/tools/json-to-ts',
    status: 'live',
    category: 'Code Converters',
    tags: ['JSON', 'TypeScript', 'Converter', 'DevTools'],
    svgIcon: `<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><path d="M9 8l-3 4 3 4M15 8l3 4-3 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    textIcon: '{}',
    features: ['Nested interfaces', 'Array type inference', 'Union types', 'One-click copy'],
  },
  {
    id: 'markdown-editor',
    title: 'Markdown Preview & Editor',
    description: 'Write and preview GitHub Flavored Markdown with live rendering and HTML export.',
    route: '/tools/markdown-editor',
    status: 'live',
    category: 'Productivity',
    tags: ['Markdown', 'Editor', 'Preview', 'GFM'],
    svgIcon: `<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><path d="M7 15V9l3 3 3-3v6M17 9v3.5c0 .8-.7 1.5-1.5 1.5S14 13.3 14 12.5V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`,
    textIcon: 'M↓',
    features: ['Live preview', 'GFM support', 'Formatting toolbar', 'Export HTML & .md'],
  },
  {
    id: 'diff-checker',
    title: 'Text Diff Checker',
    description: 'Compare two texts side-by-side with color-coded additions, deletions, and changes.',
    route: '/tools/diff-checker',
    status: 'live',
    category: 'Productivity',
    tags: ['Diff', 'Compare', 'Text', 'DevTools'],
    svgIcon: `<path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.3"/><rect x="3" y="3" width="7" height="8" rx="1" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="13" width="7" height="8" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>`,
    textIcon: '±',
    features: ['Side-by-side view', 'Unified diff', 'Ignore whitespace', 'Line numbers'],
  },
  {
    id: 'timestamp-converter',
    title: 'Unix Timestamp Converter',
    description: 'Convert between Unix timestamps and human-readable dates with timezone support.',
    route: '/tools/timestamp-converter',
    status: 'live',
    category: 'Productivity',
    tags: ['Timestamp', 'Date', 'Unix', 'Converter'],
    svgIcon: `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M2 12h2M20 12h2M12 2v2M12 20v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>`,
    textIcon: '🕐',
    features: ['Epoch ↔ date', 'Live clock', 'Timezone support', 'Relative time'],
  },
  {
    id: 'url-encoder',
    title: 'URL Encoder / Decoder',
    description: 'Encode and decode URLs and query parameters with a built-in URL parser.',
    route: '/tools/url-encoder',
    status: 'live',
    category: 'Code Converters',
    tags: ['URL', 'Encoder', 'Decoder', 'DevTools'],
    svgIcon: `<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`,
    textIcon: '%',
    features: ['Component & full URL modes', 'URL parser', 'Query string builder', 'Live conversion'],
  },
  {
    id: 'sql-formatter',
    title: 'SQL Formatter & Beautifier',
    description: 'Format and beautify SQL queries with syntax highlighting and dialect support.',
    route: '/tools/sql-formatter',
    status: 'live',
    category: 'Code Converters',
    tags: ['SQL', 'Formatter', 'Database', 'DevTools'],
    svgIcon: `<path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 7v5c0 1.7 3.6 3 8 3s8-1.3 8-3V7" stroke="currentColor" stroke-width="2" fill="none"/><path d="M4 12v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5" stroke="currentColor" stroke-width="2" fill="none"/>`,
    textIcon: 'SQL',
    features: ['Auto-indent', 'Syntax highlighting', 'Dialect options', 'Minify mode'],
  },
  {
    id: 'base-converter',
    title: 'Number Base Converter',
    description: 'Convert numbers between binary, octal, decimal, and hexadecimal instantly.',
    route: '/tools/base-converter',
    status: 'live',
    category: 'Productivity',
    tags: ['Binary', 'Hex', 'Converter', 'Math'],
    svgIcon: `<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><text x="7" y="14" font-size="8" font-weight="bold" fill="currentColor" font-family="monospace">01</text><text x="14" y="14" font-size="8" font-weight="bold" fill="currentColor" font-family="monospace" opacity="0.5">FF</text>`,
    textIcon: '01',
    features: ['Bin/Oct/Dec/Hex', 'Live conversion', 'Bit visualization', 'BigInt support'],
  },

  // ── Batch 4: 2026-04-01 ──────────────────────────────────────────────────
  {
    id: 'password-generator', title: 'Secure String Generator',
    description: 'Generate cryptographically secure random strings and passphrases with strength analysis.',
    route: '/tools/password-generator', status: 'live', category: 'Security Tools',
    tags: ['Security', 'Generator', 'Crypto', 'DevTools'],
    svgIcon: `<rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" stroke-width="2" fill="none"/>`,
    textIcon: '🔐', features: ['Crypto-secure', 'Strength meter', 'Passphrase mode', 'Bulk generate'],
  },
  {
    id: 'qr-generator', title: 'QR Code Generator',
    description: 'Generate QR codes from text, URLs, email, WiFi, or vCard with custom colors and download.',
    route: '/tools/qr-generator', status: 'live', category: 'Productivity',
    tags: ['QR Code', 'Generator', 'Image'],
    svgIcon: `<rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" fill="none"/><rect x="15" y="2" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" fill="none"/><rect x="2" y="15" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2" fill="none"/><rect x="15" y="15" width="4" height="4" stroke="currentColor" stroke-width="2" fill="none"/>`,
    textIcon: '📱', features: ['Text, URL, WiFi, vCard', 'Custom colors', 'Download PNG/SVG', 'Live preview'], featured: true,
  },
  {
    id: 'lorem-generator', title: 'Lorem Ipsum Generator',
    description: 'Generate placeholder text in classic, hipster, or tech variants by paragraphs, sentences, or words.',
    route: '/tools/lorem-generator', status: 'live', category: 'Productivity',
    tags: ['Lorem Ipsum', 'Text', 'Generator'],
    svgIcon: `<path d="M4 6h16M4 10h12M4 14h16M4 18h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    textIcon: '📝', features: ['3 text variants', 'Paragraphs/sentences/words', 'HTML wrap option', 'Copy to clipboard'],
  },
  {
    id: 'color-converter', title: 'Color Converter',
    description: 'Convert colors between HEX, RGB, HSL, HSB, and CMYK with harmonies and tints/shades.',
    route: '/tools/color-converter', status: 'live', category: 'CSS Tools',
    tags: ['Colors', 'Converter', 'CSS', 'Design'],
    svgIcon: `<circle cx="12" cy="8" r="5" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8" cy="15" r="5" stroke="currentColor" stroke-width="2" fill="none" opacity="0.6"/><circle cx="16" cy="15" r="5" stroke="currentColor" stroke-width="2" fill="none" opacity="0.6"/>`,
    textIcon: '🎨', features: ['HEX/RGB/HSL/CMYK', 'Color harmonies', 'Tints & shades', 'CSS variable output'],
  },
  {
    id: 'case-converter', title: 'Text Case Converter',
    description: 'Convert text between 12 case formats: camelCase, snake_case, kebab-case, PascalCase, and more.',
    route: '/tools/case-converter', status: 'live', category: 'Productivity',
    tags: ['Text', 'Converter', 'Formatter'],
    svgIcon: `<path d="M4 6h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.5"/><text x="4" y="13" font-size="6" fill="currentColor" font-weight="bold">Aa</text>`,
    textIcon: 'Aa', features: ['12 case formats', 'All at once', 'Word/char counts', 'Clean whitespace'],
  },
  {
    id: 'flexbox-generator', title: 'CSS Flexbox Generator',
    description: 'Visual flexbox playground with container and item controls, presets, and live CSS output.',
    route: '/tools/flexbox-generator', status: 'live', category: 'CSS Tools',
    tags: ['CSS', 'Flexbox', 'Layout', 'Generator'],
    svgIcon: `<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="5" y="6" width="4" height="5" rx="1" fill="currentColor" opacity="0.4"/><rect x="10" y="6" width="4" height="8" rx="1" fill="currentColor" opacity="0.6"/><rect x="15" y="6" width="4" height="4" rx="1" fill="currentColor" opacity="0.3"/>`,
    textIcon: '⬚', features: ['Visual playground', 'Per-item controls', 'Layout presets', 'Live CSS output'], featured: true,
  },
  {
    id: 'chmod-calculator', title: 'Chmod Calculator',
    description: 'Interactive Unix permission calculator with checkbox matrix, symbolic notation, and umask support.',
    route: '/tools/chmod-calculator', status: 'live', category: 'Productivity',
    tags: ['Unix', 'Permissions', 'Linux', 'DevTools'],
    svgIcon: `<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    textIcon: '🔧', features: ['Permission matrix', 'Numeric & symbolic', 'Umask calculator', 'Common presets'],
  },
  {
    id: 'html-entities', title: 'HTML Entity Encoder / Decoder',
    description: 'Encode and decode HTML entities with a searchable reference table of 70+ common entities.',
    route: '/tools/html-entities', status: 'live', category: 'Code Converters',
    tags: ['HTML', 'Encoder', 'Decoder', 'Entities'],
    svgIcon: `<path d="M9 6l-5 6 5 6M15 6l5 6-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="M10 18l4-12" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.4"/>`,
    textIcon: '&', features: ['Named & numeric entities', 'Live conversion', '70+ entity reference', 'Searchable table'],
  },
  {
    id: 'json-path', title: 'JSON Path Finder',
    description: 'Explore JSON as an interactive tree and click any node to get its full path in dot or bracket notation.',
    route: '/tools/json-path', status: 'live', category: 'Code Converters',
    tags: ['JSON', 'Path', 'Explorer', 'DevTools'],
    svgIcon: `<circle cx="12" cy="5" r="3" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="5" cy="18" r="3" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="19" cy="18" r="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8v4M8 15l-1.5 1M16 15l1.5 1" stroke="currentColor" stroke-width="2"/>`,
    textIcon: '🌳', features: ['Interactive tree', 'Dot & bracket paths', 'Search & filter', 'Type badges'],
  },
  {
    id: 'css-units', title: 'CSS Units Converter',
    description: 'Convert between px, rem, em, %, vw, vh, pt, cm, mm, and in with a common spacing scale.',
    route: '/tools/css-units', status: 'live', category: 'CSS Tools',
    tags: ['CSS', 'Units', 'Converter', 'Design'],
    svgIcon: `<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><path d="M4 12h16M12 4v16" stroke="currentColor" stroke-width="1.5" opacity="0.3"/><text x="6" y="10" font-size="5" fill="currentColor" font-weight="bold">px</text><text x="13" y="18" font-size="5" fill="currentColor" font-weight="bold" opacity="0.6">rem</text>`,
    textIcon: 'px', features: ['10 CSS units', 'All at once', 'Spacing scale', 'Custom base size'],
  },
  {
    id: 'aspect-ratio', title: 'Aspect Ratio Calculator',
    description: 'Calculate and visualize aspect ratios with social media presets and CSS output.',
    route: '/tools/aspect-ratio', status: 'live', category: 'Productivity',
    tags: ['Aspect Ratio', 'Calculator', 'Design', 'Social Media'],
    svgIcon: `<rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 5l18 14M21 5L3 19" stroke="currentColor" stroke-width="1" opacity="0.2"/>`,
    textIcon: '📐', features: ['Ratio simplification', 'Social media presets', 'Lock & calculate', 'CSS output'],
  },
  {
    id: 'css-minifier', title: 'CSS Minifier & Beautifier',
    description: 'Minify or beautify CSS with syntax highlighting, compression stats, and no external dependencies.',
    route: '/tools/css-minifier', status: 'live', category: 'CSS Tools',
    tags: ['CSS', 'Minifier', 'Beautifier', 'Formatter'],
    svgIcon: `<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><path d="M8 8h8M8 12h5M8 16h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>`,
    textIcon: '{}', features: ['Minify & beautify', 'Syntax highlighting', 'Compression stats', 'No dependencies'],
  },
  {
    id: 'http-status', title: 'HTTP Status Code Reference',
    description: 'Searchable reference of all HTTP status codes with categories, descriptions, and use cases.',
    route: '/tools/http-status', status: 'live', category: 'Productivity',
    tags: ['HTTP', 'Reference', 'API', 'DevTools'],
    svgIcon: `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
    textIcon: '📖', features: ['All 1xx-5xx codes', 'Search & filter', 'Color-coded categories', 'Detailed explanations'],
  },
  {
    id: 'border-radius', title: 'CSS Border Radius Generator',
    description: 'Visual border-radius editor with individual corner controls, blob shapes, and presets.',
    route: '/tools/border-radius', status: 'live', category: 'CSS Tools',
    tags: ['CSS', 'Border Radius', 'Generator', 'Design'],
    svgIcon: `<rect x="3" y="3" width="18" height="18" rx="8" stroke="currentColor" stroke-width="2" fill="none"/>`,
    textIcon: '◴', features: ['Individual corners', 'Advanced 8-value syntax', 'Blob presets', 'Live preview'],
  },
  {
    id: 'emoji-picker', title: 'Emoji Picker & Search',
    description: 'Search 500+ emojis by name, copy as emoji, HTML entity, or Unicode codepoint.',
    route: '/tools/emoji-picker', status: 'live', category: 'Productivity',
    tags: ['Emoji', 'Search', 'Unicode', 'Copy'],
    svgIcon: `<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 14s1.5 2 4 2 4-2 4-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/>`,
    textIcon: '😀', features: ['500+ emojis', 'Category tabs', 'Skin tones', 'Copy as emoji/HTML/Unicode'],
  },

  // ── Batch 5: 2026-04-02 ──────────────────────────────────────────────────
  { id: 'ip-lookup', title: 'IP Address Lookup', description: 'Detect your public IP, validate addresses, and calculate subnets.', route: '/tools/ip-lookup', status: 'live', category: 'Productivity', tags: ['IP', 'Network', 'Subnet', 'DevTools'], svgIcon: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M2 12h20" stroke="currentColor" stroke-width="2"/>', textIcon: '🌐', features: ['Auto-detect IP', 'Subnet calculator', 'IPv4/IPv6', 'Private ranges'] },
  { id: 'grid-generator', title: 'CSS Grid Generator', description: 'Visual CSS Grid playground with template areas and layout presets.', route: '/tools/grid-generator', status: 'live', category: 'CSS Tools', tags: ['CSS', 'Grid', 'Layout', 'Generator'], svgIcon: '<rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/><rect x="14" y="14" width="7" height="7" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '▦', features: ['Visual editor', 'Template areas', 'Item controls', 'Presets'], featured: true },
  { id: 'yaml-json', title: 'YAML to JSON Converter', description: 'Convert between YAML and JSON bidirectionally with no dependencies.', route: '/tools/yaml-json', status: 'live', category: 'Code Converters', tags: ['YAML', 'JSON', 'Converter'], svgIcon: '<path d="M4 6h16M4 10h12M4 14h16M4 18h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', textIcon: '⇄', features: ['YAML ↔ JSON', 'No dependencies', 'Syntax highlighting', 'Samples'] },
  { id: 'jwt-generator', title: 'JWT Generator & Builder', description: 'Build and sign JWT tokens with custom claims and HMAC via Web Crypto.', route: '/tools/jwt-generator', status: 'live', category: 'Security Tools', tags: ['JWT', 'Auth', 'Security'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M8 8h8M8 12h6M8 16h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', textIcon: '🔑', features: ['HMAC signing', 'Custom claims', 'Expiration picker', 'Live preview'] },
  { id: 'tailwind-lookup', title: 'Tailwind CSS Lookup', description: 'Searchable reference of 300+ Tailwind utility classes with CSS equivalents.', route: '/tools/tailwind-lookup', status: 'live', category: 'CSS Tools', tags: ['Tailwind', 'CSS', 'Reference'], svgIcon: '<path d="M12 6c-2.67 0-4.33 1.33-5 4 1-1.33 2.17-1.83 3.5-1.5" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '🎐', features: ['300+ classes', 'CSS equivalents', 'Category filters', 'Copy class'] },
  { id: 'md-table-generator', title: 'Markdown Table Generator', description: 'Visual table editor with CSV import and markdown/HTML export.', route: '/tools/md-table-generator', status: 'live', category: 'Productivity', tags: ['Markdown', 'Table', 'Generator'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="2"/><line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" stroke-width="2"/>', textIcon: '📋', features: ['Visual editor', 'CSV import', 'Alignment', 'MD + HTML'] },
  { id: 'json-escape', title: 'JSON String Escape / Unescape', description: 'Escape and unescape special characters in JSON strings.', route: '/tools/json-escape', status: 'live', category: 'Code Converters', tags: ['JSON', 'Escape', 'String'], svgIcon: '<path d="M9 6l-5 6 5 6M15 6l5 6-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>', textIcon: '\\n', features: ['Escape/unescape', 'Live conversion', 'Unicode', 'Size stats'] },
  { id: 'animation-generator', title: 'CSS Animation Generator', description: 'Visual keyframe animation builder with presets and live preview.', route: '/tools/animation-generator', status: 'live', category: 'CSS Tools', tags: ['CSS', 'Animation', 'Keyframes'], svgIcon: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', textIcon: '✨', features: ['Keyframe editor', '8 presets', 'Timing controls', 'Live preview'], featured: true },
  { id: 'text-counter', title: 'Text Counter & Analyzer', description: 'Count words, characters, sentences with reading time and keyword density.', route: '/tools/text-counter', status: 'live', category: 'Productivity', tags: ['Text', 'Counter', 'Word Count'], svgIcon: '<path d="M4 6h16M4 10h12M4 14h8M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', textIcon: '📊', features: ['Word/char count', 'Reading time', 'Top words', 'Keyword density'] },
  { id: 'screen-info', title: 'Screen Resolution Info', description: 'Auto-detect screen resolution, pixel density, viewport, and breakpoint.', route: '/tools/screen-info', status: 'live', category: 'Productivity', tags: ['Screen', 'Resolution', 'DPI'], svgIcon: '<rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="2"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="2"/>', textIcon: '🖥️', features: ['Auto-detect', 'DPR & PPI', 'Live tracking', 'Device ref'] },
  { id: 'slug-generator', title: 'Slug Generator', description: 'Convert text to URL-friendly slugs with transliteration and bulk mode.', route: '/tools/slug-generator', status: 'live', category: 'Productivity', tags: ['Slug', 'URL', 'SEO'], svgIcon: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '🐌', features: ['Transliteration', 'Multiple formats', 'Bulk mode', 'Max length'] },
  { id: 'csv-json', title: 'CSV to JSON Converter', description: 'Convert between CSV and JSON with delimiter options and file upload.', route: '/tools/csv-json', status: 'live', category: 'Code Converters', tags: ['CSV', 'JSON', 'Converter'], svgIcon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2" fill="none"/><polyline points="14 2 14 8 20 8" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '📄', features: ['CSV ↔ JSON', 'Delimiters', 'File upload', 'Table preview'] },
  { id: 'favicon-generator', title: 'Favicon Generator', description: 'Generate favicons from text, emoji, or image with multiple sizes.', route: '/tools/favicon-generator', status: 'live', category: 'Productivity', tags: ['Favicon', 'Generator', 'Image'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '🖼️', features: ['Text/emoji/image', 'Multiple sizes', 'Download PNG/ICO', 'HTML tags'] },
  { id: 'keyboard-shortcuts', title: 'Keyboard Shortcuts Reference', description: 'Searchable reference of 200+ shortcuts for VS Code, Chrome, Git, and more.', route: '/tools/keyboard-shortcuts', status: 'live', category: 'Productivity', tags: ['Keyboard', 'Shortcuts', 'Reference'], svgIcon: '<rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M6 10h1M9 10h1M12 10h1M15 10h1M7 14h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', textIcon: '⌨️', features: ['200+ shortcuts', 'Multi-tool', 'OS-aware', 'Search'] },
  { id: 'placeholder-image', title: 'Placeholder Image Generator', description: 'Generate placeholder images with custom size, colors, and text.', route: '/tools/placeholder-image', status: 'live', category: 'Productivity', tags: ['Placeholder', 'Image', 'Generator'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '🏞️', features: ['Custom dimensions', 'Colors & text', 'PNG/JPEG/WebP', 'Size presets'] },
  { id: 'color-blindness', title: 'Color Blindness Simulator', description: 'Simulate how colors appear under 7 types of color vision deficiency.', route: '/tools/color-blindness', status: 'live', category: 'CSS Tools', tags: ['Accessibility', 'Colors', 'A11y'], svgIcon: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '👁️', features: ['7 vision types', 'Color matrices', 'Side-by-side', 'Contrast check'] },
  { id: 'robots-generator', title: 'Robots Meta Tag Generator', description: 'Visual builder for robots meta tags and robots.txt directives.', route: '/tools/robots-generator', status: 'live', category: 'SEO Tools', tags: ['SEO', 'Robots', 'Meta Tags'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M9 9h6v6H9z" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '🤖', features: ['Meta tag builder', 'robots.txt', 'All directives', 'Explanations'] },
  { id: 'dns-lookup', title: 'DNS Record Lookup', description: 'Look up A, AAAA, CNAME, MX, NS, TXT, SOA records via Cloudflare DoH.', route: '/tools/dns-lookup', status: 'live', category: 'Security Tools', tags: ['DNS', 'Network', 'Lookup'], svgIcon: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 2v10l7 4" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '🔍', features: ['8 record types', 'Cloudflare DoH', 'TTL display', 'Reference'] },
  { id: 'box-model', title: 'CSS Box Model Visualizer', description: 'Interactive box model diagram with margin, border, padding controls.', route: '/tools/box-model', status: 'live', category: 'CSS Tools', tags: ['CSS', 'Box Model', 'Layout'], svgIcon: '<rect x="1" y="1" width="22" height="22" stroke="currentColor" stroke-width="1" fill="none" opacity="0.3"/><rect x="4" y="4" width="16" height="16" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5"/><rect x="7" y="7" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '📦', features: ['Interactive diagram', 'Box-sizing toggle', 'Shorthand CSS', 'Presets'] },
  { id: 'snippet-manager', title: 'Code Snippet Manager', description: 'Save, organize, and search code snippets locally with syntax highlighting.', route: '/tools/snippet-manager', status: 'live', category: 'Productivity', tags: ['Code', 'Snippets', 'Manager'], svgIcon: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>', textIcon: '💾', features: ['Local storage', 'Syntax highlighting', 'Search & filter', 'Import/Export'] },

  // ── Batch 6: 2026-04-03 ──────────────────────────────────────────────────
  { id: 'regex-generator', title: 'Regex Pattern Generator', description: 'Common regex patterns library with test area and flag selectors.', route: '/tools/regex-generator', status: 'live', category: 'Productivity', tags: ['Regex', 'Generator', 'Patterns'], svgIcon: '<path d="M4 6h16M4 12h10M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', textIcon: '/.*/', features: ['Pattern library', 'Test area', 'Flag selector', 'Copy patterns'] },
  { id: 'text-shadow', title: 'CSS Text Shadow Generator', description: 'Visual text shadow editor with multiple layers and 8 presets.', route: '/tools/text-shadow', status: 'live', category: 'CSS Tools', tags: ['CSS', 'Text Shadow', 'Generator'], svgIcon: '<text x="4" y="16" font-size="14" font-weight="bold" fill="currentColor" opacity="0.3">T</text><text x="5" y="15" font-size="14" font-weight="bold" fill="currentColor">T</text>', textIcon: 'Tˢ', features: ['Multiple layers', 'X/Y/blur controls', '8 presets', 'Live preview'] },
  { id: 'html-to-md', title: 'HTML to Markdown Converter', description: 'Convert HTML to Markdown and back with no external dependencies.', route: '/tools/html-to-md', status: 'live', category: 'Code Converters', tags: ['HTML', 'Markdown', 'Converter'], svgIcon: '<path d="M9 6l-5 6 5 6M15 6l5 6-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>', textIcon: 'H↔M', features: ['Bidirectional', 'Tables & lists', 'Code blocks', 'No dependencies'] },
  { id: 'data-size', title: 'Data Size Calculator', description: 'Convert between bytes, KB, MB, GB, TB with bandwidth and storage calculators.', route: '/tools/data-size', status: 'live', category: 'Productivity', tags: ['Data', 'Storage', 'Calculator', 'Converter'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7 8h10M7 12h7M7 16h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', textIcon: 'GB', features: ['Binary & decimal', 'Bandwidth calc', 'Storage planner', 'All conversions'] },
  { id: 'color-shades', title: 'Color Shades & Tints Generator', description: 'Generate tints, shades, tones, and color harmonies from a single color.', route: '/tools/color-shades', status: 'live', category: 'CSS Tools', tags: ['Colors', 'Shades', 'Tints', 'Design'], svgIcon: '<rect x="3" y="3" width="5" height="18" rx="1" fill="currentColor" opacity="0.2"/><rect x="10" y="3" width="5" height="18" rx="1" fill="currentColor" opacity="0.5"/><rect x="17" y="3" width="5" height="18" rx="1" fill="currentColor" opacity="0.8"/>', textIcon: '🎨', features: ['10 tints & shades', 'Color harmonies', 'Export CSS/SCSS', 'Tailwind config'] },
  { id: 'git-reference', title: 'Git Command Reference', description: 'Searchable reference of 100+ git commands with examples and flags.', route: '/tools/git-reference', status: 'live', category: 'Productivity', tags: ['Git', 'Reference', 'DevTools'], svgIcon: '<circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="17" cy="17" r="3" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7 10v4a3 3 0 0 0 3 3h4" stroke="currentColor" stroke-width="2"/>', textIcon: 'git', features: ['100+ commands', 'Categories', 'Examples & flags', 'Cheatsheet mode'] },
  { id: 'responsive-preview', title: 'Responsive Preview', description: 'Preview URLs at different screen sizes with device presets and comparison.', route: '/tools/responsive-preview', status: 'live', category: 'Productivity', tags: ['Responsive', 'Preview', 'Design'], svgIcon: '<rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><rect x="7" y="19" width="10" height="2" rx="1" stroke="currentColor" stroke-width="2" fill="none"/>', textIcon: '📱', features: ['Device presets', 'Custom sizes', 'Side-by-side', 'Rotate'] },
  { id: 'pomodoro', title: 'Pomodoro Timer', description: 'Focus timer with work/break cycles, audio notification, and session history.', route: '/tools/pomodoro', status: 'live', category: 'Productivity', tags: ['Timer', 'Pomodoro', 'Focus', 'Productivity'], svgIcon: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', textIcon: '🍅', features: ['Work/break cycles', 'Audio notification', 'Session history', 'Neon timer ring'] },
  { id: 'css-filter', title: 'CSS Filter Generator', description: 'Visual CSS filter editor with blur, brightness, contrast, and 8 presets.', route: '/tools/css-filter', status: 'live', category: 'CSS Tools', tags: ['CSS', 'Filter', 'Generator', 'Image'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v10M7 12h10" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>', textIcon: '🔮', features: ['10 filter sliders', 'Before/after', '8 presets', 'Live preview'], featured: true },
  { id: 'npm-search', title: 'NPM Package Search', description: 'Search npm registry, compare install commands, and view package info.', route: '/tools/npm-search', status: 'live', category: 'Productivity', tags: ['NPM', 'Packages', 'Search', 'DevTools'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M7 7h10v10H7z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 7v10" stroke="currentColor" stroke-width="2"/>', textIcon: 'npm', features: ['Registry search', 'Install commands', 'Bundle size', 'Recent searches'] },
  { id: 'json-minifier', title: 'JSON Minifier & Compressor', description: 'Minify or beautify JSON with sort keys, remove nulls, and compression stats.', route: '/tools/json-minifier', status: 'live', category: 'Code Converters', tags: ['JSON', 'Minifier', 'Compressor'], svgIcon: '<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><path d="M8 8h8M8 12h5M8 16h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>', textIcon: '{}', features: ['Minify/beautify', 'Sort keys', 'Remove nulls', 'Compression %'] },
  { id: 'morse-code', title: 'Morse Code Translator', description: 'Encode text to Morse code and decode back with audio playback.', route: '/tools/morse-code', status: 'live', category: 'Productivity', tags: ['Morse', 'Translator', 'Audio', 'Encoder'], svgIcon: '<circle cx="6" cy="12" r="2" fill="currentColor"/><rect x="11" y="10" width="8" height="4" rx="2" fill="currentColor"/><circle cx="6" cy="6" r="2" fill="currentColor"/><rect x="11" y="4" width="5" height="4" rx="2" fill="currentColor"/>', textIcon: '·−', features: ['Bidirectional', 'Audio playback', 'Speed control', 'Reference table'] },
  { id: 'binary-text', title: 'Binary to Text Converter', description: 'Convert text to 8-bit binary and binary back to text with live preview.', route: '/tools/binary-text', status: 'live', category: 'Code Converters', tags: ['Binary', 'Text', 'Converter'], svgIcon: '<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><text x="6" y="14" font-size="8" font-weight="bold" fill="currentColor" font-family="monospace">01</text>', textIcon: '01', features: ['Bidirectional', 'UTF-8 support', 'Separator options', 'Bit count'] },
  { id: 'string-repeater', title: 'Text Repeater & Manipulator', description: 'Repeat, reverse, shuffle, sort, deduplicate, and transform text lines.', route: '/tools/string-repeater', status: 'live', category: 'Productivity', tags: ['Text', 'Repeater', 'Manipulator'], svgIcon: '<path d="M4 6h16M4 10h16M4 14h16M4 18h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', textIcon: '×N', features: ['Repeat N times', 'Sort & dedupe', 'Reverse & shuffle', 'Wrap & number'] },
  { id: 'mock-data', title: 'Random Mock Data Generator', description: 'Generate random names, emails, addresses, and more as JSON, CSV, or SQL.', route: '/tools/mock-data', status: 'live', category: 'Productivity', tags: ['Mock Data', 'Generator', 'JSON', 'Testing'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 9h18M9 3v18M15 3v18" stroke="currentColor" stroke-width="1" opacity="0.3"/>', textIcon: '🎲', features: ['10+ data types', 'JSON/CSV/SQL', 'Column picker', 'Up to 100 rows'] },
  { id: 'apca-contrast', title: 'APCA Contrast Calculator', description: 'Calculate APCA and WCAG 2.x contrast ratios side-by-side with font-based compliance.', route: '/tools/apca-contrast', status: 'live', category: 'CSS Tools', tags: ['Accessibility', 'APCA', 'WCAG', 'Contrast'], svgIcon: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" opacity="0.5"/>', textIcon: 'Lc', features: ['APCA + WCAG 2', 'Font-size compliance', 'Suggest accessible color', 'Lc value display'] },
  { id: 'ts-playground', title: 'TypeScript Type Reference', description: 'Interactive reference of TypeScript utility types with examples and explanations.', route: '/tools/ts-playground', status: 'live', category: 'Productivity', tags: ['TypeScript', 'Types', 'Reference', 'DevTools'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><text x="7" y="16" font-size="12" font-weight="bold" fill="currentColor">TS</text>', textIcon: 'TS', features: ['Utility types', 'Generics explainer', 'Interactive examples', 'Copy snippets'] },
  { id: 'caesar-cipher', title: 'ROT13 & Caesar Cipher', description: 'Encode/decode ROT13 and Caesar cipher with brute force view of all 26 rotations.', route: '/tools/caesar-cipher', status: 'live', category: 'Productivity', tags: ['Cipher', 'ROT13', 'Encoder', 'Crypto'], svgIcon: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 2v4M18 6l-3 3M22 12h-4M18 18l-3-3M12 22v-4M6 18l3-3M2 12h4M6 6l3 3" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>', textIcon: '🔑', features: ['ROT13 instant', 'Adjustable shift', 'Brute force view', 'Preserve case'] },
  { id: 'design-tokens', title: 'Design Token Converter', description: 'Convert design tokens JSON to CSS variables, SCSS, or Tailwind config.', route: '/tools/design-tokens', status: 'live', category: 'CSS Tools', tags: ['Design Tokens', 'CSS', 'Figma', 'SCSS'], svgIcon: '<rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8" cy="8" r="2" fill="currentColor"/><circle cx="16" cy="8" r="2" fill="currentColor" opacity="0.5"/><circle cx="8" cy="16" r="2" fill="currentColor" opacity="0.3"/><circle cx="16" cy="16" r="2" fill="currentColor" opacity="0.7"/>', textIcon: '🎨', features: ['CSS/SCSS/Tailwind', 'Nested groups', '$value format', 'Live preview'] },
  { id: 'json-schema', title: 'JSON Schema Generator', description: 'Paste JSON and instantly generate a valid JSON Schema (draft-07) with format inference and validation.', route: '/tools/json-schema', status: 'live', category: 'Code Converters', tags: ['JSON', 'Schema', 'Generator', 'Validator'], svgIcon: '<path d="M4 4h16v16H4z" stroke="currentColor" stroke-width="2" fill="none" rx="2"/><path d="M8 8h3v3H8zM13 8h3v3h-3zM8 13h3v3H8z" fill="currentColor" opacity="0.5"/>', textIcon: '{}', features: ['Draft-07 schema', 'Format inference', 'Validate against schema', 'Nested support'] },
  { id: 'image-resizer', title: 'Image Resizer', description: 'Resize images by percentage, exact dimensions, or social media presets in your browser.', route: '/tools/image-resizer', status: 'live', category: 'Productivity', tags: ['Images', 'Resize', 'Scale', 'Social Media'], svgIcon: '<polyline points="15 3 21 3 21 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="9 21 3 21 3 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><line x1="21" y1="3" x2="14" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="21" x2="10" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>', textIcon: '↔', features: ['Resize by % or px', 'Social media presets', 'Batch up to 20 images', 'JPEG/PNG/WebP output'] },
];

// ── Helper functions ──────────────────────────────────────────────────────────

/** All tools currently marked as live */
export function getLiveTools(): ToolDefinition[] {
  return TOOLS_REGISTRY.filter(t => t.status === 'live');
}

/** Find a tool by its id */
export function getToolById(id: string): ToolDefinition | undefined {
  return TOOLS_REGISTRY.find(t => t.id === id);
}

/** Tools marked as featured (for hero carousel, spotlights, etc.) */
export function getFeaturedTools(): ToolDefinition[] {
  return TOOLS_REGISTRY.filter(t => t.featured && t.status === 'live');
}

/** All unique categories across registered tools */
export function getCategories(): string[] {
  const cats = new Set(TOOLS_REGISTRY.map(t => t.category));
  return ['All', ...Array.from(cats).sort()];
}

/** All unique tags across registered tools */
export function getAllTags(): string[] {
  const tagSet = new Set<string>();
  TOOLS_REGISTRY.forEach(t => t.tags.forEach(tag => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}

/**
 * Get tools related to a given tool, ranked by shared tag count.
 * Only returns live tools.
 */
export function getRelatedTools(currentId: string, count: number = 4): ToolDefinition[] {
  const current = getToolById(currentId);
  if (!current) return [];
  const currentTags = new Set(current.tags.map(t => t.toLowerCase()));
  return TOOLS_REGISTRY
    .filter(t => t.id !== currentId && t.status === 'live')
    .map(t => ({
      tool: t,
      score: t.tags.filter(tag => currentTags.has(tag.toLowerCase())).length
    }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(r => r.tool);
}
