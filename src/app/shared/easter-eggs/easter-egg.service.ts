import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LazyFirestoreService } from '../lazy-firestore.service';
import { CACHE_TTL, FirestoreCacheService } from '../firestore-cache.service';
import { GameStateGateway } from '../save/game-state.gateway';
import { LocalSaveRegistry } from '../save/local-save-registry.service';
import { BehaviorSubject } from 'rxjs';

export interface EasterEgg {
  id: string;
  name: string;
  description: string;
  tool?: string;        // tool slug or 'global' for site-wide
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;         // emoji
  /**
   * Overrides the standard easter-egg XP award for this one egg. Left unset on
   * every egg that is genuinely hidden; used for the handful that are simply
   * *noticed* rather than hunted, which should not pay the same as a hunt.
   */
  xp?: number;
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
  { id: 'speed-demon',     name: 'Speed Demon',          description: 'Visited five different halls in under 60 seconds',  tool: 'global',  rarity: 'rare',      icon: '⚡' },
  { id: 'explorer',        name: 'Explorer',             description: 'Walked every hall on the World door',              tool: 'global',  rarity: 'common',    icon: '🧭' },

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

  // ── Batch 7 tools ──────────────────────────────────────────
  { id: 'resize-pixel',       name: 'Pixel Perfect',       description: 'Resized an image to 1x1 pixel',                        tool: 'image-resizer',             rarity: 'epic',      icon: '🔬' },
  { id: 'resize-batch',       name: 'Assembly Line',       description: 'Batch-resized 10 or more images at once',              tool: 'image-resizer',             rarity: 'rare',      icon: '🏭' },

  // ── Batch 8: registry repair ───────────────────────────────
  // These 58 tools already called trigger() with these IDs, but the IDs were
  // never registered here — and trigger() returns early on an unknown ID, so
  // every one of them was a silent no-op. Registering them lights them all up.
  { id: 'apca-invisible',     name: 'Invisible Ink',        description: 'Landed on an APCA contrast of exactly Lc 0',            tool: 'apca-contrast',             rarity: 'rare',      icon: '👻' },
  { id: 'ascii-hello',        name: 'ASCII Greeting',       description: 'Rendered "hello" in ASCII art',                        tool: 'ascii-art',                 rarity: 'common',    icon: '🔤' },
  { id: 'binary-hi',          name: 'Machine Whisperer',    description: 'Decoded 01101000 01101001 — binary for "hi"',          tool: 'binary-text',               rarity: 'rare',      icon: '🤖' },
  { id: 'button-forbidden',   name: 'Do Not Press',         description: 'Labelled a button "Do Not Press"',                     tool: 'button-generator',          rarity: 'epic',      icon: '🔴' },
  { id: 'caesar-uryyb',       name: 'Uryyb Jbeyq',          description: 'ROT13-ed a message containing "hello"',                tool: 'caesar-cipher',             rarity: 'rare',      icon: '🔁' },
  { id: 'char-infinity',      name: 'To Infinity',          description: 'Copied the infinity symbol from the character map',    tool: 'char-map',                  rarity: 'rare',      icon: '♾️' },
  { id: 'checklist-complete', name: 'Clean Sweep',          description: 'Ticked every single item off the checklist',           tool: 'checklist',                 rarity: 'common',    icon: '✅' },
  { id: 'clip-complex',       name: 'Polygon Architect',    description: 'Built a clip-path polygon with 12+ points',            tool: 'clip-path',                 rarity: 'rare',      icon: '🔷' },
  { id: 'color-badass',       name: 'Bada55',               description: 'Picked the colour #BADA55',                            tool: 'color-picker',              rarity: 'epic',      icon: '😎' },
  { id: 'color-rebecca',      name: 'Rebecca',              description: 'Landed on rebeccapurple — named for Rebecca Meyer',    tool: 'color-name',                rarity: 'rare',      icon: '💜' },
  { id: 'countdown-y2k',      name: 'Y2K Ready',            description: 'Set a countdown to January 1st, 2000',                 tool: 'countdown',                 rarity: 'rare',      icon: '🐛' },
  { id: 'cron-midnight',      name: 'The Witching Hour',    description: 'Searched the crontab reference for "midnight"',        tool: 'crontab-ref',               rarity: 'common',    icon: '🌙' },
  { id: 'css-var-system',     name: 'Design System',        description: 'Defined 20+ CSS custom properties in one go',          tool: 'css-variables',             rarity: 'rare',      icon: '🎛️' },
  { id: 'data-leet',          name: 'Leet',                 description: 'Converted exactly 1337 of something',                  tool: 'data-size',                 rarity: 'rare',      icon: '💾' },
  { id: 'docker-whale',       name: 'Moby Dock',            description: 'Searched the Docker reference for "whale"',            tool: 'docker-ref',                rarity: 'common',    icon: '🐳' },
  { id: 'encoding-invisible', name: 'Invisible Characters', description: 'Encoded a string made entirely of whitespace',         tool: 'encoding-converter',        rarity: 'rare',      icon: '🫥' },
  { id: 'filter-chaos',       name: 'Filter Chaos',         description: 'Maxed out every single CSS filter at once',            tool: 'css-filter',                rarity: 'epic',      icon: '🌈' },
  { id: 'git-yolo',           name: 'YOLO Push',            description: 'Looked up force push in the Git reference',            tool: 'git-reference',             rarity: 'rare',      icon: '💣' },
  { id: 'gitignore-everything', name: 'Ignore Everything',  description: 'Selected every technology in the .gitignore builder',  tool: 'gitignore-generator',       rarity: 'rare',      icon: '🙈' },
  { id: 'gradient-brand',     name: 'Brand Loyalty',        description: 'Gradient-texted the word "xsantcastx"',                tool: 'gradient-text',             rarity: 'common',    icon: '✨' },
  { id: 'heading-perfect',    name: 'Perfect Hierarchy',    description: 'Used all six heading levels with zero errors',         tool: 'heading-checker',           rarity: 'epic',      icon: '📐' },
  { id: 'hex-executable',     name: 'MZ',                   description: 'Opened a file starting with the MZ executable header', tool: 'hex-editor',                rarity: 'rare',      icon: '🧬' },
  { id: 'hmac-inception',     name: 'Secret Secret',        description: 'HMAC-ed the word "secret" using "secret" as the key',  tool: 'hmac-generator',            rarity: 'rare',      icon: '🔐' },
  { id: 'html-blink',         name: "Blink and You'll Miss It", description: 'Minified HTML containing a <blink> tag',           tool: 'html-minifier',             rarity: 'rare',      icon: '👁️' },
  { id: 'html-marquee',       name: 'Marquee Revival',      description: 'Converted HTML containing a <marquee> tag',            tool: 'html-to-md',                rarity: 'rare',      icon: '🎠' },
  { id: 'js-eval-danger',     name: 'eval() Is Evil',       description: 'Minified JavaScript containing an eval() call',        tool: 'js-minifier',               rarity: 'rare',      icon: '☠️' },
  { id: 'json-diff-same',     name: 'No Difference',        description: 'Diffed two JSON documents that were identical',        tool: 'json-diff',                 rarity: 'common',    icon: '🟰' },
  { id: 'json-tree-forest',   name: 'The Forest',           description: 'Rendered a JSON tree with 1000+ nodes',                tool: 'json-tree',                 rarity: 'epic',      icon: '🌲' },
  { id: 'json-ultra-compress', name: 'Vacuum Sealed',       description: 'Minified JSON down by more than 90%',                  tool: 'json-minifier',             rarity: 'rare',      icon: '🗜️' },
  { id: 'jwt-none-ref',       name: 'alg: none',            description: 'Looked up "none" in the JWT cheatsheet',               tool: 'jwt-cheatsheet',            rarity: 'rare',      icon: '⛔' },
  { id: 'license-wtf',        name: 'Do What You Want',     description: 'Picked the WTFPL as your licence',                     tool: 'license-picker',            rarity: 'rare',      icon: '📄' },
  { id: 'lines-clone',        name: 'Attack of the Clones', description: 'Sorted a list where every line was identical',         tool: 'line-sorter',               rarity: 'rare',      icon: '👥' },
  { id: 'mime-binary',        name: 'Pure Binary',          description: 'Looked up application/octet-stream',                   tool: 'mime-lookup',               rarity: 'common',    icon: '📦' },
  { id: 'mock-42',            name: '42 Records',           description: 'Generated exactly 42 mock records',                    tool: 'mock-data',                 rarity: 'rare',      icon: '🎲' },
  { id: 'morse-sos',          name: 'Mayday',               description: 'Sent SOS in Morse code',                               tool: 'morse-code',                rarity: 'rare',      icon: '🆘' },
  { id: 'mq-print',           name: 'Print Preview',        description: 'Built a @media print query — someone still prints',    tool: 'media-query',               rarity: 'common',    icon: '🖨️' },
  { id: 'npm-trivial',        name: 'One Line Wonder',      description: 'Searched npm for is-odd or is-even',                   tool: 'npm-search',                rarity: 'rare',      icon: '🧩' },
  { id: 'og-testing',         name: 'This Is a Test',       description: 'Left the word "test" in your OG title',                tool: 'og-image-preview',          rarity: 'common',    icon: '🧪' },
  { id: 'pkg-zero',           name: 'Version Zero',         description: 'Set your package version to 0.0.0',                    tool: 'package-json',              rarity: 'common',    icon: '🥚' },
  { id: 'pomodoro-speedrun',  name: 'Speedrun',             description: 'Set a one-minute pomodoro work session',               tool: 'pomodoro',                  rarity: 'rare',      icon: '⏱️' },
  { id: 'progress-almost',    name: 'Almost There',         description: 'Parked a progress bar at 99%',                         tool: 'progress-bar',              rarity: 'rare',      icon: '📊' },
  { id: 'regex-all-flags',    name: 'Flagged',              description: 'Turned on every regex flag at once',                   tool: 'regex-generator',           rarity: 'rare',      icon: '🚩' },
  { id: 'regex-danger',       name: 'Catastrophic Backtracking', description: 'Searched the regex cheatsheet for "catastrophic"', tool: 'regex-cheatsheet',        rarity: 'rare',      icon: '💥' },
  { id: 'responsive-pixel',   name: 'One Pixel Wide',       description: 'Previewed a page at a viewport width of 1px',          tool: 'responsive-preview',        rarity: 'epic',      icon: '📏' },
  { id: 'seo-perfect-title',  name: 'Perfect Fit',          description: 'Wrote a page title exactly 60 characters long',        tool: 'seo-checker',               rarity: 'rare',      icon: '🎯' },
  { id: 'shades-blank',       name: 'Blank Canvas',         description: 'Generated shades of pure white',                       tool: 'color-shades',              rarity: 'common',    icon: '⬜' },
  { id: 'sitemap-lonely',     name: 'Population: 1',        description: 'Built a sitemap containing a single URL',              tool: 'sitemap-generator',         rarity: 'rare',      icon: '🗺️' },
  { id: 'snap-2d',            name: 'Two Directions',       description: 'Set scroll snapping on both axes at once',             tool: 'scroll-snap',               rarity: 'common',    icon: '↔️' },
  { id: 'spacing-zero',       name: 'No Space',             description: 'Generated a spacing scale with a base of 0',           tool: 'spacing-scale',             rarity: 'common',    icon: '🚫' },
  { id: 'string-laughing',    name: 'Hahahaha',             description: 'Repeated "ha" at least 100 times',                     tool: 'string-repeater',           rarity: 'rare',      icon: '😂' },
  { id: 'svg-complex-path',   name: 'Path Master',          description: 'Edited an SVG path with 50+ commands',                 tool: 'svg-path-editor',           rarity: 'epic',      icon: '🖊️' },
  { id: 'text-shadow-deep',   name: 'Depth Perception',     description: 'Stacked 5+ text shadow layers',                        tool: 'text-shadow',               rarity: 'rare',      icon: '🌑' },
  { id: 'token-branded',      name: 'On Brand',             description: 'Defined a "brand" key in your design tokens',          tool: 'design-tokens',             rarity: 'common',    icon: '🏷️' },
  { id: 'transform-full-spin', name: 'Full Rotation',       description: 'Rotated an element a full 360 degrees',                tool: 'transform-playground',      rarity: 'common',    icon: '🔄' },
  { id: 'transition-instant', name: 'Instant',              description: 'Set a transition duration of zero',                    tool: 'transition-generator',      rarity: 'common',    icon: '⚡' },
  { id: 'ts-any',             name: 'Any Means Any',        description: 'Searched the TypeScript playground for "any"',         tool: 'ts-playground',             rarity: 'rare',      icon: '🤷' },
  { id: 'tz-same',            name: 'Same Time Zone',       description: 'Converted a time between two identical time zones',    tool: 'timezone-converter',        rarity: 'common',    icon: '🕐' },
  { id: 'ua-bot',             name: 'Beep Boop',            description: 'Parsed a user agent belonging to a bot',               tool: 'ua-parser',                 rarity: 'rare',      icon: '🤖' },
  { id: 'webhook-pong',       name: 'Pong',                 description: 'Sent a webhook payload containing "ping"',             tool: 'webhook-tester',            rarity: 'rare',      icon: '🏓' },

  // ── Batch 9: newly wired tools ─────────────────────────────
  { id: 'b64-decoder-ring',   name: 'Decoder Ring',         description: 'Base64-encoded the word "secret"',                     tool: 'base64-encoder',            rarity: 'common',    icon: '💍' },
  { id: 'regex-ouroboros',    name: 'Ouroboros',            description: 'Wrote a regex that matches its own source',           tool: 'regex-builder',             rarity: 'epic',      icon: '🐍' },
  { id: 'palette-monochrome', name: 'Monochrome Master',    description: 'Extracted a palette where every colour shares one hue', tool: 'color-palette',           rarity: 'epic',      icon: '🎨' },
  { id: 'gradient-rainbow-bridge', name: 'Rainbow Bridge',  description: 'Built a gradient with 8 or more colour stops',        tool: 'gradient-generator',        rarity: 'rare',      icon: '🌈' },
  { id: 'img-pixel-pincher',  name: 'Pixel Pincher',        description: 'Compressed an image below 1KB',                       tool: 'image-compressor',          rarity: 'epic',      icon: '🤏' },
  { id: 'pw-fort-knox',       name: 'Fort Knox',            description: 'Generated a 128-character password',                  tool: 'password-generator',        rarity: 'rare',      icon: '🏰' },
  { id: 'uuid-factory',       name: 'UUID Factory',         description: 'Generated 100 UUIDs in a single visit',               tool: 'uuid-generator',            rarity: 'rare',      icon: '🏭' },
  { id: 'hash-miner',         name: 'Hash Miner',           description: 'Produced a hash starting with four zeros',            tool: 'hash-generator',            rarity: 'legendary', icon: '⛏️' },
  { id: 'grocery-big-shop',   name: 'The Big Shop',         description: 'Checked out a cart of 20 or more items',              tool: 'grocery-manager',           rarity: 'rare',      icon: '🛒' },

  // ── Batch 10: the Codex ────────────────────────────────────
  // Awarded for opening /codex. It is not hidden — it is on the nav — so it
  // pays 25 rather than the standard 200: finding the record of every secret is
  // the start of the hunt, not a result of one.
  { id: 'codex-archivist',    name: 'The Archivist',        description: 'Opened the Codex for the first time',                 tool: 'global',                    rarity: 'rare',      icon: '📜', xp: 25 },
  { id: 'trials-first',       name: 'The Proving Ground',   description: 'Stood before the Arena gates',                        tool: 'global',                    rarity: 'common',    icon: '⚔️', xp: 25 },

  // ── Batch 11: the Ambient Forge ────────────────────────────
  // Earned by presence rather than by hunting, so every one of them carries an
  // explicit `xp` well under the standard 200. Paying a hunt's price for
  // sitting still would quietly out-earn the quests these are meant to sit
  // alongside — a capped day of idling is worth ~60 XP, and a single 200 XP
  // drop for reaching it would be three days' allowance in one moment.
  { id: 'idle-patient-one',      name: 'The Patient One',        description: 'Earned 100 XP from ambient forge energy',              tool: 'global', rarity: 'rare',      icon: '🕯️', xp: 40 },
  { id: 'idle-forge-meditation', name: 'Forge Meditation',       description: 'Kept the forge in sight for thirty unbroken minutes',  tool: 'global', rarity: 'epic',      icon: '🧘', xp: 60 },
  { id: 'idle-vigil',            name: 'The Vigil',              description: 'Earned 500 XP from ambient forge energy',              tool: 'global', rarity: 'epic',      icon: '🌙', xp: 80 },
  { id: 'idle-eternal-flame',    name: 'Eternal Flame',          description: 'Earned 2000 XP from ambient forge energy',             tool: 'global', rarity: 'legendary', icon: '🔥', xp: 150 },
  { id: 'idle-never-sleeps',     name: 'The Godforge Never Sleeps', description: 'Had the forge open as the date rolled over',        tool: 'global', rarity: 'rare',      icon: '🌌', xp: 50 },
  { id: 'idle-forge-striker',    name: 'Forge Striker',          description: 'Struck the forge one thousand times',                  tool: 'global', rarity: 'epic',      icon: '🔨', xp: 80 },
  { id: 'idle-obsidian-hammer',  name: 'Obsidian Hammer',        description: 'Struck the forge ten thousand times',                  tool: 'global', rarity: 'legendary', icon: '⚒️', xp: 200 },

  // ── Batch 12: the Godforge Market ──────────────────────────
  // Six awarded by the ledger rather than by an input into a tool. They pay
  // below the standard 200 for the same reason The Archivist does: the Market
  // is linked from the header and the Forge Flame is on every page, so these
  // are the record of a habit rather than the result of a hunt.
  //
  // There is no strike-count achievement here. 'idle-forge-striker' and
  // 'idle-obsidian-hammer' above already pay at a thousand and ten thousand,
  // and the Market's flame drives that same counter — a second pair keyed on
  // the same act would put two cards on the wall for one thing and let a
  // visitor bank both for a single swing.
  { id: 'forge-first-purchase',      name: 'First Purchase',          description: 'Bought anything at all in the Godforge Market',       tool: 'global', rarity: 'common', icon: '🪙',  xp: 25 },
  { id: 'forge-investor',            name: 'Forge Investor',          description: 'Owned five upgrades across the two ladders',          tool: 'global', rarity: 'rare',   icon: '📈', xp: 50 },
  { id: 'forge-market-mogul',        name: 'Market Mogul',            description: 'Owned fifteen upgrades across the two ladders',       tool: 'global', rarity: 'epic',   icon: '🏦', xp: 100 },
  { id: 'forge-artifact-collector',  name: 'Artifact Collector',      description: 'Held three of the five artifacts at once',            tool: 'global', rarity: 'legendary', icon: '💠', xp: 200 },
  { id: 'forge-complete-collection', name: 'The Complete Collection', description: 'Held every artifact the Market will ever sell',       tool: 'global', rarity: 'legendary', icon: '👑', xp: 500 },
  { id: 'forge-click-frenzy',        name: 'Click Frenzy',            description: 'Struck the Forge Flame 100 times inside one minute',  tool: 'global', rarity: 'epic',   icon: '🌀', xp: 100 },

  // ── The Rune Forge ──────────────────────────────────────────────
  // Eight, and the shape of the ladder is the drop table's. The three
  // collection rungs are priced off how many strikes they actually take at the
  // published rates rather than off how they read: ten uniques is most of one
  // sitting, twenty is a long week, and all twenty-five needs the 0.05% rune,
  // which is why it and 'rune-void-voice' are the only two filed Mythic.
  //
  // 'rune-breath-of-void' carries no `xp` override and no explicit tier here
  // because it is not authored as Singular — Singular is earned at runtime when
  // the global discovery count comes back exactly 1, and this is the one
  // achievement on the wall genuinely capable of returning that.
  { id: 'rune-first',                name: 'First Rune',              description: 'Took the first rune off the anvil',                   tool: 'global', rarity: 'common', icon: '🪨', xp: 25 },
  { id: 'rune-collector',            name: 'Rune Collector',          description: 'Found ten of the twenty-five runes',                  tool: 'global', rarity: 'rare',   icon: '🗿', xp: 75 },
  { id: 'rune-master',               name: 'Rune Master',             description: 'Found twenty of the twenty-five runes',               tool: 'global', rarity: 'epic',   icon: '⛰️', xp: 250 },
  { id: 'rune-complete-set',         name: 'The Complete Set',        description: 'Found all twenty-five runes, Void included',          tool: 'global', rarity: 'legendary', icon: '🌑', xp: 1000 },
  { id: 'rune-first-word',           name: 'First Runeword',          description: 'Set runes into a word and made it hold',              tool: 'global', rarity: 'epic',   icon: '📜', xp: 150 },
  { id: 'rune-word-scholar',         name: 'Runeword Scholar',        description: 'Completed three Runewords',                           tool: 'global', rarity: 'legendary', icon: '📖', xp: 400 },
  { id: 'rune-void-voice',           name: 'Voice of the Void',       description: 'The Void rune fell. It falls once in two thousand.',  tool: 'global', rarity: 'legendary', icon: '👁️', xp: 2000 },
  { id: 'rune-breath-of-void',       name: 'Breath of the Void',      description: 'Completed the last Runeword in the Archivum',         tool: 'global', rarity: 'legendary', icon: '🕳️', xp: 5000 },

  // ── Lore Scrolls ────────────────────────────────────────────────
  // Two, not eight. The scrolls already pay out as they are found — every one
  // is a page of the codex that was not readable before — so the wall only
  // needs to mark the two thresholds a collector actually aims at. A rung at
  // one, five, fifteen and twenty as well would be four more cards for the same
  // act, which is the mistake the strike-count note above records not making.
  { id: 'scroll-lore-hunter',        name: 'Lore Hunter',             description: 'Turned up ten of the twenty-five Lore Scrolls',       tool: 'global', rarity: 'epic',   icon: '📜', xp: 300 },
  { id: 'scroll-full-codex',         name: 'The Full Codex',          description: 'Every scroll, including the page that is blank',      tool: 'global', rarity: 'legendary', icon: '📖', xp: 2500 },

  // ── The character sheet ─────────────────────────────────────────
  // Paid at 25 like The Archivist, and for the same reason: this one is
  // *noticed* rather than hunted, and a page you can reach from the navbar
  // should not pay what a four-leading-zero hash pays.
  { id: 'forge-self-aware',          name: 'Self-Aware',              description: 'Opened your own Forge for the first time',            tool: 'global', rarity: 'rare',   icon: '🪞', xp: 25 },

  // ── Cloud save ──────────────────────────────────────────────────
  // Bound the forge to an account, so the save outlives the browser it was made
  // in. Announced rather than hidden — the button says exactly what it does —
  // so it pays 50 rather than a hunt's 200, above Self-Aware and The Archivist
  // because opening a page is a click and this is a decision. The tier is
  // Eclipsed rather than Mortal for the same reason: most visitors will use
  // every tool on the site and never make it.
  { id: 'cloud-eternal-archive',     name: 'The Eternal Archive',     description: 'Bound your progress to the cloud',                    tool: 'global', rarity: 'rare',   icon: '☁️', xp: 50 },

  // ── The combo ladder ────────────────────────────────────────────
  // Consecutive paid strikes on the Forge Flame. The 500ms cooldown caps the
  // rate at two a second, so these are the only achievements on the wall priced
  // in *time held* rather than in a thing done: x9,999 is 83 minutes of unbroken
  // rhythm, and a single gap over two seconds puts it back to zero.
  //
  // The payouts climb steeply because the difficulty does. x10 is an accident on
  // the way to somewhere else; x5,000 is forty minutes of not stopping. Every
  // one carries an explicit `xp` — the standard 200 would be robbery at the
  // bottom of the ladder and an insult at the top.
  { id: 'combo-rapid-strike',        name: 'Rapid Strike',            description: 'Reached a x10 strike combo',                          tool: 'global', rarity: 'common',    icon: '⚡',  xp: 25 },
  { id: 'combo-forge-frenzy',        name: 'Forge Frenzy',            description: 'Reached a x50 strike combo',                          tool: 'global', rarity: 'rare',      icon: '🔥',  xp: 60 },
  { id: 'combo-century-forge',       name: 'Century Forge',           description: 'Reached a x100 strike combo',                         tool: 'global', rarity: 'epic',      icon: '💯',  xp: 120 },
  // 666 is passed through on the way to a thousand rather than climbed to, so
  // it pays less than the rung below it despite the rarer tier. It is a thing
  // you find, not a thing you hold.
  { id: 'combo-forbidden-count',     name: 'The Forbidden Count',     description: 'Struck the number that must not be named',            tool: 'global', rarity: 'legendary', icon: '🜏',  xp: 100 },
  { id: 'combo-relentless',          name: 'The Relentless',          description: 'Reached a x500 strike combo',                         tool: 'global', rarity: 'epic',      icon: '⛓️',  xp: 200 },
  { id: 'combo-millennium-strike',   name: 'Millennium Strike',       description: 'Reached a x1,000 strike combo',                       tool: 'global', rarity: 'legendary', icon: '🌩️', xp: 350 },
  { id: 'combo-eclipse-breaker',     name: 'Eclipse Breaker',         description: 'Reached a x5,000 strike combo',                       tool: 'global', rarity: 'legendary', icon: '🌘',  xp: 700 },
  { id: 'combo-first-sun',           name: 'First Sun Shatter',       description: 'Reached the maximum x9,999 strike combo',             tool: 'global', rarity: 'legendary', icon: '☀️',  xp: 1_500 },
];

/**
 * Eggs the public Codex and chrome counts are allowed to show.
 *
 * Anything with a non-global `tool` is a leftover of the deleted developer-tool
 * product. Those records stay in `EASTER_EGGS` so an old save still hydrates,
 * but they are not a public achievement.
 */
export function isPublicCodexEgg(egg: EasterEgg): boolean {
  return !egg.tool || egg.tool === 'global';
}

export const PUBLIC_CODEX_EGGS: EasterEgg[] = EASTER_EGGS.filter(isPublicCodexEgg);

/** localStorage key holding the array of discovered egg ids. */
export const EGGS_FOUND_KEY = 'easter-eggs-found';
/**
 * localStorage key holding `{ eggId: ISO timestamp }`.
 *
 * A second key rather than a richer value under the first: the found-ids array
 * has been written by every build since the egg system shipped, and changing its
 * shape would strand everyone's existing discoveries behind a migration. Eggs
 * found before this key existed simply have no date, which the Codex renders as
 * "found before the Codex opened" rather than inventing one.
 */
export const EGGS_DATES_KEY = 'easter-eggs-dates';

@Injectable({ providedIn: 'root' })
export class EasterEggService {
  private lazyFirestore = inject(LazyFirestoreService);
  private cache = inject(FirestoreCacheService);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private saves = inject(LocalSaveRegistry);
  private store = inject(GameStateGateway);
  private discovered = new Set<string>();
  private dates: Record<string, string> = {};

  discovery$ = new BehaviorSubject<EggDiscovery | null>(null);

  get totalEggs(): number { return PUBLIC_CODEX_EGGS.length; }
  get foundCount(): number {
    return PUBLIC_CODEX_EGGS.reduce((n, egg) => n + (this.discovered.has(egg.id) ? 1 : 0), 0);
  }
  /** Raw discovered ids, including retired tool eggs kept only in the save. */
  get discoveredCount(): number { return this.discovered.size; }

  async init(): Promise<void> {
    if (!this.isBrowser) return;
    this.readFound();
    this.readDates();

    // Two keys, two owners. `trigger()` writes the whole discovered set from
    // memory, so discoveries merged in from another device would be dropped by
    // the next egg found on this one — and the dates blob alongside it.
    this.saves.register(EGGS_FOUND_KEY, {
      // Deliberately silent: this replaces the set with the union of both
      // devices, and announcing those would fire a drop toast per egg the other
      // device found. They are not new discoveries, they are the same ones.
      rehydrate: () => this.readFound(),
    });
    this.saves.register(EGGS_DATES_KEY, { rehydrate: () => this.readDates() });
  }

  /** Replace the discovered set from storage. */
  private readFound(): void {
    const stored = this.store.readRaw(EGGS_FOUND_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) this.discovered = new Set<string>(parsed);
    } catch { /* unparseable blob — keep what we have rather than throw on boot */ }
  }

  /** Replace the first-found dates from storage. */
  private readDates(): void {
    const dates = this.store.readRaw(EGGS_DATES_KEY);
    if (!dates) return;
    try {
      const parsed = JSON.parse(dates);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) this.dates = parsed;
    } catch { /* same */ }
  }

  isFound(id: string): boolean {
    return this.discovered.has(id);
  }

  /** ISO timestamp of first discovery, or null when unknown. */
  foundAt(id: string): string | null {
    return this.dates[id] ?? null;
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
    try {
      this.store.write(EGGS_FOUND_KEY, [...this.discovered]);
      if (isNew) {
        this.dates = { ...this.dates, [id]: new Date().toISOString() };
        this.store.write(EGGS_DATES_KEY, this.dates);
      }
    } catch { /* quota or private mode — the drop still fires, it just won't stick */ }

    // Announce first, persist second. The global counter now travels through
    // a lazily-downloaded Firestore SDK, and the player should never wait on a
    // network chunk to see their own discovery.
    this.discovery$.next({
      egg,
      isNew,
      totalFound: this.foundCount,
      totalEggs: this.totalEggs,
    });

    if (isNew) {
      // Track in Firestore (global discovery count) — fire and forget.
      void this.lazyFirestore.get().then(handle => {
        if (!handle) return;
        const { db, api } = handle;
        return api.setDoc(
          api.doc(db, 'easter-eggs', id),
          { discoveries: api.increment(1), name: egg.name },
          { merge: true }
        );
      }).catch(() => { /* silent */ });
    }
  }

  /**
   * How many people have found this egg, site-wide.
   *
   * Cached for an hour. This is the "0.4% of visitors found this" line on a
   * discovery toast — a bragging figure, not a number anything branches on, so
   * it is not worth a document read every time an egg fires.
   */
  async getGlobalCount(id: string): Promise<number> {
    if (!this.isBrowser) return 0;
    return this.cache.through(`easter-eggs/${id}`, CACHE_TTL.counters, async () => {
      const handle = await this.lazyFirestore.get();
      if (!handle) return 0;
      const { db, api } = handle;
      const snap = await api.getDoc(api.doc(db, 'easter-eggs', id));
      return snap.exists() ? ((snap.data()['discoveries'] as number) ?? 0) : 0;
    }).catch(() => 0);
  }
}
