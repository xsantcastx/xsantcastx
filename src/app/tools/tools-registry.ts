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
