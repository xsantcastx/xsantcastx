import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Firestore, doc, getDoc, setDoc, increment } from '@angular/fire/firestore';
import { BehaviorSubject } from 'rxjs';

export interface EasterEgg {
  id: string;
  name: string;
  description: string;
  tool?: string;        // tool slug or 'global' for site-wide
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;         // emoji
}

export interface EggDiscovery {
  egg: EasterEgg;
  isNew: boolean;
  totalFound: number;
  totalEggs: number;
}

/** Master registry of all easter eggs */
export const EASTER_EGGS: EasterEgg[] = [
  // ── Global ──────────────────────────────────────────────────────
  { id: 'konami',          name: 'Old School',           description: 'Entered the Konami Code',                          tool: 'global',  rarity: 'rare',      icon: '🕹️' },
  { id: 'night-owl',       name: 'Night Owl',            description: 'Used the site between 2am and 5am',                tool: 'global',  rarity: 'common',    icon: '🦉' },
  { id: 'speed-demon',     name: 'Speed Demon',          description: 'Visited 5 different tools in under 60 seconds',    tool: 'global',  rarity: 'rare',      icon: '⚡' },
  { id: 'explorer',        name: 'Explorer',             description: 'Visited every section of the homepage',            tool: 'global',  rarity: 'common',    icon: '🧭' },

  // ── Tool-specific ──────────────────────────────────────────────
  { id: 'json-inception',  name: 'Inception',            description: 'Formatted JSON nested 10+ levels deep',           tool: 'json-formatter',            rarity: 'rare',      icon: '🌀' },
  { id: 'b64-mirror',      name: 'Mirror Mirror',        description: 'Encoded "xsantcastx" in Base64',                  tool: 'base64-encoder',            rarity: 'common',    icon: '🪞' },
  { id: 'regex-master',    name: 'Regex Master',         description: 'Wrote a regex with lookahead AND lookbehind',      tool: 'regex-tester',              rarity: 'epic',      icon: '🧙' },
  { id: 'shadow-lord',     name: 'Shadow Lord',          description: 'Created a box shadow with 5+ layers',             tool: 'box-shadow-generator',      rarity: 'rare',      icon: '👤' },
  { id: 'monochrome',      name: 'Monochrome',           description: 'Checked contrast of two identical colors',        tool: 'contrast-checker',          rarity: 'common',    icon: '⬛' },
  { id: 'palette-void',    name: 'The Void',             description: 'Extracted a palette from a mostly black image',    tool: 'color-palette',             rarity: 'rare',      icon: '🕳️' },
  { id: 'ssl-localhost',    name: 'Hacker Mode',          description: 'Tried to inspect SSL on localhost',               tool: 'ssl-certificate-inspector', rarity: 'common',    icon: '💻' },
  { id: 'ssl-self',        name: 'Self Discovery',       description: 'Audited xsantcastx.com\'s own certificate',       tool: 'ssl-certificate-auditor',   rarity: 'rare',      icon: '🔍' },
  { id: 'email-santa',     name: 'Dear Santa',           description: 'Checked email deliverability for a holiday domain', tool: 'email-deliverability-auditor', rarity: 'epic', icon: '🎅' },
  { id: 'hash-meaning',    name: 'The Answer',           description: 'Hashed the number "42"',                          tool: 'hash-generator',            rarity: 'rare',      icon: '🌌' },
  { id: 'jwt-expired',     name: 'Time Traveler',        description: 'Decoded a JWT that expired years ago',            tool: 'jwt-decoder',               rarity: 'common',    icon: '⏳' },
  { id: 'uuid-lucky',      name: 'Lucky Roll',           description: 'Generated a UUID starting with "000"',            tool: 'uuid-generator',            rarity: 'epic',      icon: '🎰' },
  { id: 'meta-ego',        name: 'Ego Trip',             description: 'Set OG title to your own name',                   tool: 'meta-tag-generator',        rarity: 'common',    icon: '🪩' },
  { id: 'env-secret',      name: 'Secret Agent',         description: 'Added SECRET_EASTER_EGG to your .env',            tool: 'env-validator',             rarity: 'rare',      icon: '🕵️' },
  { id: 'font-disco',      name: 'Disco Mode',           description: 'Shuffled font pairings 10 times in a row',        tool: 'font-pairer',               rarity: 'rare',      icon: '🪩' },
  { id: 'gradient-mono',   name: 'Gradient of Nothing',  description: 'Created a gradient where all stops are the same color', tool: 'gradient-generator', rarity: 'common',    icon: '🫥' },
  { id: 'img-tiny',        name: 'Pixel Perfect',        description: 'Compressed an image below 10KB',                  tool: 'image-compressor',          rarity: 'rare',      icon: '🔬' },
  { id: 'svg-code',        name: 'SVG Whisperer',        description: 'Converted an SVG with 50+ elements',              tool: 'svg-to-code',               rarity: 'epic',      icon: '🎨' },
  { id: 'pdf-catalog',     name: 'Catalog King',         description: 'Generated a PDF with 20+ products',               tool: 'pdf-generator',             rarity: 'rare',      icon: '📚' },
  { id: 'gmail-self',      name: 'Self Check',           description: 'Checked your own Gmail deliverability',           tool: 'gmail-deliverability-checker', rarity: 'common', icon: '📬' },

  // ── Batch 2 tools ──────────────────────────────────────────
  { id: 'cron-chaos',      name: 'Chaos Mode',           description: 'Set a cron to run every single minute',            tool: 'cron-builder',              rarity: 'rare',      icon: '💥' },
  { id: 'api-teapot',      name: "I'm a Teapot",         description: 'Got a 418 status code or requested a teapot URL',  tool: 'api-request-builder',       rarity: 'epic',      icon: '🫖' },
  { id: 'json-ts-hidden',  name: 'Type Hunter',          description: 'Converted JSON containing an easter_egg key',      tool: 'json-to-ts',                rarity: 'rare',      icon: '🔎' },
  { id: 'md-hello-world',  name: 'Hello World',          description: 'Started your markdown with # Hello World',         tool: 'markdown-editor',           rarity: 'common',    icon: '👋' },
  { id: 'diff-identical',  name: 'Spot the Difference',  description: 'Compared two identical texts',                      tool: 'diff-checker',              rarity: 'common',    icon: '🪞' },
  { id: 'timestamp-epoch', name: 'In the Beginning',     description: 'Converted Unix epoch zero (Jan 1, 1970)',           tool: 'timestamp-converter',       rarity: 'rare',      icon: '🌅' },
  { id: 'url-rickroll',    name: 'Never Gonna Give You Up', description: 'Encoded a URL containing a rickroll',            tool: 'url-encoder',               rarity: 'epic',      icon: '🕺' },
  { id: 'sql-drop',        name: 'Bobby Tables',         description: 'Formatted SQL containing DROP TABLE',              tool: 'sql-formatter',             rarity: 'rare',      icon: '🗑️' },
  { id: 'base-meaning',    name: '42 in Every Base',     description: 'Entered 42 in the number base converter',          tool: 'base-converter',            rarity: 'common',    icon: '🔢' },

  // ── Batch 3 tools ──────────────────────────────────────────
  { id: 'pw-one-char',     name: 'Security Theater',     description: 'Generated a 1-character password',                  tool: 'password-generator',        rarity: 'rare',      icon: '🔓' },
  { id: 'qr-self',         name: 'Self-Referential',     description: 'Generated a QR code for "xsantcastx"',              tool: 'qr-generator',              rarity: 'rare',      icon: '🔄' },
  { id: 'lorem-42',        name: 'The Ultimate Filler',  description: 'Generated exactly 42 paragraphs of lorem ipsum',    tool: 'lorem-generator',           rarity: 'rare',      icon: '📜' },
  { id: 'color-void',      name: 'Into the Void',        description: 'Converted pure black #000000',                      tool: 'color-converter',           rarity: 'common',    icon: '🕳️' },
  { id: 'case-monotone',   name: 'Monotone',             description: 'Entered text that is all the same character',       tool: 'case-converter',            rarity: 'epic',      icon: '🔇' },
  { id: 'flex-dozen',      name: 'The Dirty Dozen',      description: 'Added 12 flex children to the playground',          tool: 'flexbox-generator',         rarity: 'rare',      icon: '📦' },
  { id: 'chmod-god',       name: 'God Mode',             description: 'Set file permissions to 777',                       tool: 'chmod-calculator',          rarity: 'rare',      icon: '👑' },
  { id: 'html-xss',        name: 'Nice Try',             description: 'Tried encoding a <script> tag',                     tool: 'html-entities',             rarity: 'common',    icon: '🛡️' },
  { id: 'json-abyss',      name: 'The Abyss',            description: 'Explored JSON nested deeper than 15 levels',        tool: 'json-path',                 rarity: 'epic',      icon: '🌊' },
  { id: 'css-zero',        name: 'Zero Dimensions',      description: 'Converted 0 in the CSS units converter',            tool: 'css-units',                 rarity: 'common',    icon: '0️⃣' },
  { id: 'ar-square',       name: 'Perfect Square',       description: 'Created a perfect 1:1 aspect ratio',                tool: 'aspect-ratio',              rarity: 'common',    icon: '⬜' },
  { id: 'css-important',   name: '!important Overload',  description: 'Minified CSS with 5+ !important declarations',      tool: 'css-minifier',              rarity: 'rare',      icon: '⚠️' },
  { id: 'http-teapot-ref', name: 'Teapot Enthusiast',    description: 'Looked up HTTP status code 418',                    tool: 'http-status',               rarity: 'rare',      icon: '🫖' },
  { id: 'br-circle',       name: 'Full Circle',          description: 'Set all border corners to 50% making a circle',     tool: 'border-radius',             rarity: 'common',    icon: '⭕' },
  { id: 'emoji-skull',     name: 'Memento Mori',         description: 'Copied the skull emoji',                            tool: 'emoji-picker',              rarity: 'rare',      icon: '💀' },

  // ── Batch 4 tools ──────────────────────────────────────────
  { id: 'ip-localhost',    name: 'There\'s No Place Like Home', description: 'Looked up 127.0.0.1',                         tool: 'ip-lookup',                 rarity: 'common',    icon: '🏠' },
  { id: 'grid-matrix',     name: 'The Matrix',           description: 'Created a 12x12 CSS Grid',                           tool: 'grid-generator',            rarity: 'epic',      icon: '🟩' },
  { id: 'yaml-hidden',     name: 'YAML Egg',             description: 'Converted YAML containing an easter_egg key',        tool: 'yaml-json',                 rarity: 'rare',      icon: '🥚' },
  { id: 'jwt-insecure',    name: 'Living Dangerously',   description: 'Generated a JWT with algorithm set to none',          tool: 'jwt-generator',             rarity: 'rare',      icon: '⚠️' },
  { id: 'tw-hidden',       name: 'Visibility: Hidden',   description: 'Searched for "hidden" in Tailwind lookup',            tool: 'tailwind-lookup',           rarity: 'common',    icon: '👻' },
  { id: 'md-lonely-cell',  name: 'Lonely Cell',          description: 'Created a markdown table with just 1 cell',           tool: 'md-table-generator',        rarity: 'rare',      icon: '📎' },
  { id: 'json-newlines',   name: 'Newline Enthusiast',   description: 'Escaped triple newlines in JSON',                     tool: 'json-escape',               rarity: 'common',    icon: '↵' },
  { id: 'anim-seizure',    name: 'Ludicrous Speed',      description: 'Set infinite animation under 0.1s duration',          tool: 'animation-generator',       rarity: 'epic',      icon: '🚀' },
  { id: 'text-hello',      name: 'Iconic Greeting',      description: 'Analyzed the text "hello world"',                     tool: 'text-counter',              rarity: 'common',    icon: '👋' },
  { id: 'screen-classic',  name: 'Retro Display',        description: 'Using a 1x DPR non-retina screen',                    tool: 'screen-info',               rarity: 'rare',      icon: '🖥️' },
  { id: 'slug-classic',    name: 'The OG Slug',          description: 'Slugified "hello world" to hello-world',              tool: 'slug-generator',            rarity: 'common',    icon: '🐌' },
  { id: 'csv-lonely',      name: 'Lonely Data Point',    description: 'Converted a CSV with just 1 cell',                    tool: 'csv-json',                  rarity: 'rare',      icon: '📊' },
  { id: 'favicon-x',       name: 'X Marks the Spot',     description: 'Generated a favicon with the letter X',               tool: 'favicon-generator',         rarity: 'rare',      icon: '❌' },
  { id: 'ks-konami',       name: 'Meta Konami',          description: 'Searched for "konami" in keyboard shortcuts',          tool: 'keyboard-shortcuts',        rarity: 'rare',      icon: '🎮' },
  { id: 'ph-pixel',        name: 'One Pixel Wonder',     description: 'Generated a 1x1 placeholder image',                   tool: 'placeholder-image',         rarity: 'epic',      icon: '🔍' },
  { id: 'cb-gray-world',   name: 'Gray World',           description: 'Simulated color blindness on pure gray',              tool: 'color-blindness',           rarity: 'common',    icon: '🌫️' },
  { id: 'robots-blackout', name: 'Total Blackout',       description: 'Set all robots directives to block everything',        tool: 'robots-generator',          rarity: 'rare',      icon: '🚫' },
  { id: 'dns-localhost',   name: 'DNS: Nowhere',         description: 'Looked up DNS for localhost',                          tool: 'dns-lookup',                rarity: 'common',    icon: '🔄' },
  { id: 'box-reset',       name: 'Box Model Reset',      description: 'Set all margins and paddings to zero',                tool: 'box-model',                 rarity: 'common',    icon: '📦' },
  { id: 'snippet-collector', name: 'Code Collector',     description: 'Saved 10 code snippets',                              tool: 'snippet-manager',           rarity: 'rare',      icon: '📚' },
  { id: 'schema-mega',       name: 'Schema Architect',    description: 'Generated a schema with 20+ top-level properties',    tool: 'json-schema',               rarity: 'rare',      icon: '🏗️' },
];

@Injectable({ providedIn: 'root' })
export class EasterEggService {
  private firestore = inject(Firestore);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private discovered = new Set<string>();

  discovery$ = new BehaviorSubject<EggDiscovery | null>(null);

  get totalEggs(): number { return EASTER_EGGS.length; }
  get foundCount(): number { return this.discovered.size; }

  async init(): Promise<void> {
    if (!this.isBrowser) return;
    const stored = localStorage.getItem('easter-eggs-found');
    if (stored) {
      JSON.parse(stored).forEach((id: string) => this.discovered.add(id));
    }
  }

  isFound(id: string): boolean {
    return this.discovered.has(id);
  }

  /**
   * Trigger an easter egg by ID. If it's new, shows the discovery notification
   * and persists to Firestore + localStorage.
   */
  async trigger(id: string): Promise<void> {
    if (!this.isBrowser) return;

    const egg = EASTER_EGGS.find(e => e.id === id);
    if (!egg) return;

    const isNew = !this.discovered.has(id);
    this.discovered.add(id);

    // Persist locally
    localStorage.setItem('easter-eggs-found', JSON.stringify([...this.discovered]));

    if (isNew) {
      // Track in Firestore (global discovery count)
      try {
        const ref = doc(this.firestore, 'easter-eggs', id);
        await setDoc(ref, { discoveries: increment(1), name: egg.name }, { merge: true });
      } catch { /* silent */ }
    }

    this.discovery$.next({
      egg,
      isNew,
      totalFound: this.discovered.size,
      totalEggs: EASTER_EGGS.length,
    });
  }

  /** Get global discovery count for an egg */
  async getGlobalCount(id: string): Promise<number> {
    if (!this.isBrowser) return 0;
    try {
      const snap = await getDoc(doc(this.firestore, 'easter-eggs', id));
      return snap.exists() ? (snap.data()['discoveries'] ?? 0) : 0;
    } catch { return 0; }
  }
}
