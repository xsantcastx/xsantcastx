import { Component, OnDestroy, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { ToolsSharedModule } from '../../shared/tools-shared.module';
import { FormsModule } from '@angular/forms';
import { TranslationService } from '../../translation.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

/** One coloured span in the pattern's syntax-highlight overlay. */
type TokenType =
  | 'literal'
  | 'escape'
  | 'class'
  | 'quantifier'
  | 'group'
  | 'anchor'
  | 'alternation'
  | 'dot';

interface RegexToken {
  text: string;
  type: TokenType;
}

/** A single capture group inside one match. */
interface CaptureGroup {
  /** 1-based group number as JS reports it. */
  number: number;
  /** Present only for `(?<name>…)` groups. */
  name?: string;
  /** `undefined` when the group did not participate in the match. */
  value: string | undefined;
}

interface MatchResult {
  /** 0-based index into the test string. */
  index: number;
  length: number;
  value: string;
  groups: CaptureGroup[];
}

interface FlagDef {
  key: 'g' | 'i' | 'm' | 's' | 'u' | 'y';
  name: string;
  tooltip: string;
}

interface Preset {
  label: string;
  pattern: string;
  flags: string;
  sample: string;
  note: string;
}

interface Flavor {
  id: 'javascript' | 'python' | 'go' | 'java' | 'pcre' | 'dotnet';
  label: string;
  /** Differences from the JavaScript engine that actually runs here. */
  notes: string[];
}

interface CheatsheetGroup {
  title: string;
  rows: { token: string; meaning: string }[];
}

/**
 * Matching is capped so a pathological pattern cannot lock the tab up
 * indefinitely. These are generous relative to real-world use.
 */
const MAX_TEST_LENGTH = 50_000;
const MAX_MATCHES = 5_000;

@Component({
  selector: 'app-regex-builder',
  templateUrl: './regex-builder.component.html',
  styleUrls: ['./regex-builder.component.css'],
  imports: [ToolsSharedModule, FormsModule]
})
export class RegexBuilderComponent implements OnInit, OnDestroy {
  private readonly translationService = inject(TranslationService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly eggs = inject(EasterEggService);
  private readonly route = inject(ActivatedRoute);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  translate(key: string): string {
    return this.translationService.translate(key);
  }

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Regex Builder & Tester — build, test and debug regular expressions with live match highlighting. No sign-up needed!')}&url=${encodeURIComponent(SITE_URL + '/tools/regex-builder')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/regex-builder')}`;

  // ── State ─────────────────────────────────────────────────────
  pattern = '\\b(\\w+)@(\\w+)\\.(\\w{2,})\\b';
  testString = `Reach me at hello@xsantcastx.com or support@example.org.
Invalid: not-an-email, @nope.com, missing@tld
Second line with team@xsantcastx.dev in it.`;

  flags: Record<FlagDef['key'], boolean> = {
    g: true, i: false, m: false, s: false, u: false, y: false
  };

  replaceMode = false;
  replacement = '[$1 AT $2]';

  flavorId: Flavor['id'] = 'javascript';
  cheatsheetOpen = false;
  copiedField: string | null = null;

  // ── Derived output ────────────────────────────────────────────
  matches: MatchResult[] = [];
  error: string | null = null;
  replacedText = '';
  matchDurationMs = 0;
  truncated = false;
  activeMatchIndex: number | null = null;

  /** Escaped + span-wrapped HTML for the two overlay layers. */
  highlightedPattern = '';
  highlightedTest = '';

  // ── Static data ───────────────────────────────────────────────
  readonly flagDefs: FlagDef[] = [
    { key: 'g', name: 'global', tooltip: 'Find all matches, not just the first one.' },
    { key: 'i', name: 'ignoreCase', tooltip: 'Match regardless of upper/lower case.' },
    { key: 'm', name: 'multiline', tooltip: '^ and $ match the start/end of each line instead of the whole string.' },
    { key: 's', name: 'dotAll', tooltip: 'Let . match newline characters too.' },
    { key: 'u', name: 'unicode', tooltip: 'Treat the pattern as a sequence of Unicode code points. Enables \\p{…} and \\u{…}.' },
    { key: 'y', name: 'sticky', tooltip: 'Match only from lastIndex — no scanning ahead for the next match.' },
  ];

  readonly flavors: Flavor[] = [
    {
      id: 'javascript',
      label: 'JavaScript',
      notes: []
    },
    {
      id: 'python',
      label: 'Python (re)',
      notes: [
        'Named groups use (?P<name>…) — Python also accepts (?<name>…) only from 3.12 onward.',
        'Backreferences to named groups are (?P=name), not \\k<name>.',
        'Flags are arguments (re.I, re.M, re.S) rather than trailing letters.',
        'Python has no sticky flag; use re.match() to anchor at a position.'
      ]
    },
    {
      id: 'go',
      label: 'Go (RE2)',
      notes: [
        'RE2 has no backreferences and no lookahead/lookbehind — those patterns will not compile.',
        'RE2 guarantees linear time, so catastrophic backtracking is impossible by design.',
        'Named groups use (?P<name>…).',
        'Inline flags go at the front: (?i) instead of a trailing /i.'
      ]
    },
    {
      id: 'java',
      label: 'Java',
      notes: [
        'Patterns live in Java string literals, so every backslash must be doubled: \\\\d not \\d.',
        'Java supports possessive quantifiers (a*+) and atomic groups (?>…), which JavaScript does not.',
        '\\b inside a character class means backspace, same as JavaScript.',
        'Flags are Pattern.CASE_INSENSITIVE, Pattern.MULTILINE, Pattern.DOTALL.'
      ]
    },
    {
      id: 'pcre',
      label: 'PCRE / PHP',
      notes: [
        'Patterns need delimiters: /pattern/flags or #pattern#flags.',
        'Supports recursion (?R), atomic groups (?>…) and possessive quantifiers — none exist in JavaScript.',
        '\\A, \\z and \\Z anchors are available in addition to ^ and $.',
        'The u flag means UTF-8 mode rather than JavaScript-style Unicode mode.'
      ]
    },
    {
      id: 'dotnet',
      label: '.NET',
      notes: [
        'Supports variable-length lookbehind, which JavaScript only partly allows.',
        'Named groups use (?<name>…) and can be duplicated across alternatives.',
        'Right-to-left matching is available via RegexOptions.RightToLeft.',
        'Use verbatim strings (@"\\d+") to avoid doubling backslashes.'
      ]
    },
  ];

  readonly presets: Preset[] = [
    {
      label: 'Email address',
      pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.-]+',
      flags: 'gi',
      sample: 'Contact hello@xsantcastx.com or first.last+tag@sub.example.co.uk — but not @broken or plain-text.',
      note: 'Pragmatic email match. The RFC 5322 grammar is far larger; validate by sending mail, not by regex.'
    },
    {
      label: 'URL',
      pattern: 'https?:\\/\\/[\\w.-]+(?:\\.[\\w.-]+)+(?:[\\w\\-._~:/?#[\\]@!$&\'()*+,;=]*)?',
      flags: 'gi',
      sample: 'Visit https://xsantcastx.com/tools/regex-builder?q=1 and http://example.org/path#frag today.',
      note: 'Matches http and https URLs including query strings and fragments.'
    },
    {
      label: 'Phone (international)',
      pattern: '\\+?\\d{1,3}[\\s.-]?\\(?\\d{2,4}\\)?[\\s.-]?\\d{3,4}[\\s.-]?\\d{3,4}',
      flags: 'g',
      sample: 'Call +1 (555) 123-4567, +44 20 7946 0958 or 555.867.5309 for support.',
      note: 'Loose international phone shape. Normalise to E.164 before storing.'
    },
    {
      label: 'IPv4 address',
      pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\b',
      flags: 'g',
      sample: 'Valid: 192.168.1.1, 8.8.8.8, 255.255.255.0. Invalid: 999.1.1.1 and 256.0.0.1',
      note: 'Strict — each octet is bounded to 0-255, so 256.0.0.1 correctly fails.'
    },
    {
      label: 'Date (YYYY-MM-DD)',
      pattern: '(?<year>\\d{4})-(?<month>0[1-9]|1[0-2])-(?<day>0[1-9]|[12]\\d|3[01])',
      flags: 'g',
      sample: 'Shipped 2026-08-11, planned 2026-12-25, invalid 2026-13-01 and 2026-02-30.',
      note: 'Uses named groups. Note 2026-02-30 still matches — calendar validity needs a date library.'
    },
    {
      label: 'Hex colour',
      pattern: '#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\\b',
      flags: 'g',
      sample: 'Brand cyan #00ffcc, short #0fc, with alpha #00ffcc80, invalid #xyz123.',
      note: 'Handles 3, 6 and 8 digit forms including the alpha channel.'
    },
    {
      label: 'UUID v4',
      pattern: '[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}',
      flags: 'gi',
      sample: 'Good: 3f2504e0-4f89-41d3-9a0c-0305e82c3301\nBad version: 3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      note: 'Enforces the version nibble (4) and the variant nibble (8, 9, a or b).'
    },
    {
      label: 'Semver',
      pattern: '\\bv?(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?:-(?<pre>[\\w.-]+))?\\b',
      flags: 'g',
      sample: 'Releases: v2.2.1, 1.0.0, 3.4.5-beta.2, and the malformed 1.2 tag.',
      note: 'Named groups make the parts easy to read out of match.groups.'
    },
    {
      label: 'HTML tag',
      pattern: '<\\/?(?<tag>[a-zA-Z][\\w-]*)(?<attrs>[^>]*)>',
      flags: 'g',
      sample: '<div class="card"><a href="/x">link</a></div><br />',
      note: 'Fine for quick scraping. Never parse untrusted HTML with regex — use a real parser.'
    },
    {
      label: 'Slug',
      pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
      flags: 'gm',
      sample: 'regex-builder\nvalid-slug-123\nInvalid Slug\ntrailing-\n--double',
      note: 'Anchored with the m flag so each line is validated separately.'
    },
    {
      label: 'Strong password',
      pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^\\w\\s]).{12,}$',
      flags: 'gm',
      sample: 'Correct-Horse-9!\nweakpassword\nSh0rt!aA\nAnother-Strong-1@',
      note: 'Four lookaheads assert each requirement without consuming any characters.'
    },
    {
      label: 'Duplicate word',
      pattern: '\\b(\\w+)\\s+\\1\\b',
      flags: 'gi',
      sample: 'This this is a a common typo that that slips past readers.',
      note: 'Backreference \\1 re-matches whatever group 1 captured. RE2 (Go) cannot do this.'
    },
    {
      label: 'Trailing whitespace',
      pattern: '[ \\t]+$',
      flags: 'gm',
      sample: 'clean line\nline with trailing spaces   \nanother\t\t\nfine',
      note: 'The m flag makes $ mean end-of-line, which is what a linter wants.'
    },
    {
      label: 'CSS hex → var()',
      pattern: '#([0-9a-f]{6})\\b',
      flags: 'gi',
      sample: '.a { color: #00ffcc; } .b { border-color: #7b61ff; background: #0a0f1e; }',
      note: 'Pair with replace mode and a replacement of var(--c-$1) to see the rewrite.'
    },
  ];

  readonly cheatsheet: CheatsheetGroup[] = [
    {
      title: 'Character classes',
      rows: [
        { token: '.', meaning: 'Any character except newline (add the s flag to include newlines)' },
        { token: '\\d  \\D', meaning: 'A digit 0-9  /  anything that is not a digit' },
        { token: '\\w  \\W', meaning: 'Word character [A-Za-z0-9_]  /  anything else' },
        { token: '\\s  \\S', meaning: 'Whitespace (space, tab, newline)  /  anything else' },
        { token: '[abc]', meaning: 'Any one of a, b or c' },
        { token: '[^abc]', meaning: 'Any character except a, b or c' },
        { token: '[a-z0-9]', meaning: 'Any character in either range' },
        { token: '\\p{L}', meaning: 'Any Unicode letter — requires the u flag' },
      ]
    },
    {
      title: 'Quantifiers',
      rows: [
        { token: '*', meaning: 'Zero or more (greedy)' },
        { token: '+', meaning: 'One or more (greedy)' },
        { token: '?', meaning: 'Zero or one — makes the preceding token optional' },
        { token: '{3}', meaning: 'Exactly three times' },
        { token: '{2,}', meaning: 'Two or more times' },
        { token: '{2,5}', meaning: 'Between two and five times' },
        { token: '*?  +?  ??', meaning: 'Lazy — match as few characters as possible' },
      ]
    },
    {
      title: 'Anchors & boundaries',
      rows: [
        { token: '^', meaning: 'Start of string (start of each line with the m flag)' },
        { token: '$', meaning: 'End of string (end of each line with the m flag)' },
        { token: '\\b', meaning: 'Word boundary — the edge between \\w and \\W' },
        { token: '\\B', meaning: 'Not a word boundary' },
      ]
    },
    {
      title: 'Groups & references',
      rows: [
        { token: '(abc)', meaning: 'Capturing group — its text is saved and numbered' },
        { token: '(?:abc)', meaning: 'Non-capturing group — groups without saving' },
        { token: '(?<name>abc)', meaning: 'Named group — read it back from match.groups.name' },
        { token: '\\1  \\k<name>', meaning: 'Backreference — match the same text the group captured' },
        { token: 'a|b', meaning: 'Alternation — match a or b' },
      ]
    },
    {
      title: 'Lookaround',
      rows: [
        { token: '(?=abc)', meaning: 'Lookahead — next text is abc, but do not consume it' },
        { token: '(?!abc)', meaning: 'Negative lookahead — next text is not abc' },
        { token: '(?<=abc)', meaning: 'Lookbehind — preceding text is abc' },
        { token: '(?<!abc)', meaning: 'Negative lookbehind — preceding text is not abc' },
      ]
    },
    {
      title: 'Replacement tokens',
      rows: [
        { token: '$&', meaning: 'The whole match' },
        { token: '$1  $2', meaning: 'The text captured by group 1, group 2, …' },
        { token: '$<name>', meaning: 'The text captured by a named group' },
        { token: '$`  $\'', meaning: 'Everything before / after the match' },
        { token: '$$', meaning: 'A literal dollar sign' },
      ]
    },
  ];

  constructor(private router: Router) {}

  // ── Lifecycle ─────────────────────────────────────────────────

  ngOnInit(): void {
    this.hydrateFromQueryParams();
    this.run();
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  goBack(): void {
    this.router.navigate(['/tools']);
  }

  /** Restores a shared permalink: ?p=pattern&f=flags&t=test&r=replacement&m=replace */
  private hydrateFromQueryParams(): void {
    const qp = this.route.snapshot.queryParamMap;
    const p = qp.get('p');
    const f = qp.get('f');
    const t = qp.get('t');
    const r = qp.get('r');
    const m = qp.get('m');

    if (p !== null) this.pattern = p;
    if (t !== null) this.testString = t.slice(0, MAX_TEST_LENGTH);
    if (r !== null) this.replacement = r;
    if (m === 'replace') this.replaceMode = true;

    if (f !== null) {
      for (const def of this.flagDefs) {
        this.flags[def.key] = f.includes(def.key);
      }
    }
  }

  // ── Input handling ────────────────────────────────────────────

  /**
   * Debounced at 150ms so typing stays smooth on long test strings.
   *
   * The visible glyphs come from the highlight layer, not the textarea (whose
   * text is transparent), so anything affecting *text* must repaint
   * synchronously — only the match *results* are allowed to lag.
   */
  onInputChange(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.run(), 150);
  }

  onPatternChange(): void {
    // Enter would otherwise smuggle a newline into a single-line pattern.
    if (/[\r\n]/.test(this.pattern)) this.pattern = this.pattern.replace(/[\r\n]/g, '');
    // Tokenizing is pure and cheap — repaint now so the field never lags.
    this.highlightedPattern = this.buildPatternHighlight();
    this.onInputChange();
  }

  onTestChange(): void {
    // Offsets just shifted, so the old spans no longer line up. Drop to plain
    // text now and let the debounced run paint the new matches back on.
    this.highlightedTest = this.escapeHtml(this.testString.slice(0, MAX_TEST_LENGTH)) + '\n';
    this.onInputChange();
  }

  /** Flags and toggles are discrete — no reason to make the user wait. */
  onImmediateChange(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.run();
  }

  toggleFlag(key: FlagDef['key']): void {
    this.flags[key] = !this.flags[key];
    this.onImmediateChange();
  }

  toggleReplaceMode(): void {
    this.replaceMode = !this.replaceMode;
    this.onImmediateChange();
  }

  toggleCheatsheet(): void {
    this.cheatsheetOpen = !this.cheatsheetOpen;
  }

  applyPreset(preset: Preset): void {
    this.pattern = preset.pattern;
    this.testString = preset.sample;
    for (const def of this.flagDefs) {
      this.flags[def.key] = preset.flags.includes(def.key);
    }
    this.activeMatchIndex = null;
    this.onImmediateChange();
  }

  clearAll(): void {
    this.pattern = '';
    this.testString = '';
    this.replacement = '';
    this.activeMatchIndex = null;
    this.onImmediateChange();
  }

  selectMatch(i: number): void {
    this.activeMatchIndex = this.activeMatchIndex === i ? null : i;
    this.highlightedTest = this.buildTestHighlight();
  }

  // ── Getters ───────────────────────────────────────────────────

  get flagString(): string {
    return this.flagDefs.filter(d => this.flags[d.key]).map(d => d.key).join('');
  }

  get flavor(): Flavor {
    return this.flavors.find(f => f.id === this.flavorId) ?? this.flavors[0];
  }

  get literal(): string {
    return `/${this.pattern || '(?:)'}/${this.flagString}`;
  }

  get testLength(): number {
    return this.testString.length;
  }

  get overLimit(): boolean {
    return this.testString.length > MAX_TEST_LENGTH;
  }

  /** Ready-to-paste snippet for whichever flavor is selected. */
  get codeSnippet(): string {
    const p = this.pattern;
    const f = this.flagString;

    switch (this.flavorId) {
      case 'python': {
        const opts = [
          this.flags.i ? 're.IGNORECASE' : '',
          this.flags.m ? 're.MULTILINE' : '',
          this.flags.s ? 're.DOTALL' : '',
        ].filter(Boolean).join(' | ');
        const args = opts ? `r"${p}", ${opts}` : `r"${p}"`;
        return `import re\n\npattern = re.compile(${args})\nmatches = pattern.findall(text)`;
      }
      case 'go': {
        const inline = [this.flags.i ? 'i' : '', this.flags.m ? 'm' : '', this.flags.s ? 's' : ''].filter(Boolean).join('');
        const body = inline ? `(?${inline})${p}` : p;
        return `re := regexp.MustCompile(\`${body}\`)\nmatches := re.FindAllString(text, -1)`;
      }
      case 'java': {
        const opts = [
          this.flags.i ? 'Pattern.CASE_INSENSITIVE' : '',
          this.flags.m ? 'Pattern.MULTILINE' : '',
          this.flags.s ? 'Pattern.DOTALL' : '',
        ].filter(Boolean).join(' | ');
        const escaped = p.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const args = opts ? `"${escaped}", ${opts}` : `"${escaped}"`;
        return `Pattern pattern = Pattern.compile(${args});\nMatcher matcher = pattern.matcher(text);\nwhile (matcher.find()) {\n    System.out.println(matcher.group());\n}`;
      }
      case 'pcre': {
        const delimited = `/${p.replace(/\//g, '\\/')}/${f.replace(/[gyu]/g, '')}`;
        return `preg_match_all('${delimited}', $text, $matches);\nprint_r($matches);`;
      }
      case 'dotnet': {
        const opts = [
          this.flags.i ? 'RegexOptions.IgnoreCase' : '',
          this.flags.m ? 'RegexOptions.Multiline' : '',
          this.flags.s ? 'RegexOptions.Singleline' : '',
        ].filter(Boolean).join(' | ');
        const escaped = p.replace(/"/g, '""');
        const args = opts ? `@"${escaped}", ${opts}` : `@"${escaped}"`;
        return `var regex = new Regex(${args});\nforeach (Match m in regex.Matches(text))\n{\n    Console.WriteLine(m.Value);\n}`;
      }
      default: {
        if (this.replaceMode) {
          return `const re = ${this.literal};\nconst output = text.replace(re, ${JSON.stringify(this.replacement)});`;
        }
        return `const re = ${this.literal};\nconst matches = [...text.matchAll(re)];`;
      }
    }
  }

  // ── The engine ────────────────────────────────────────────────

  private run(): void {
    this.highlightedPattern = this.buildPatternHighlight();

    // RegExp execution is browser-only so the prerendered HTML stays
    // deterministic — the client fills results in on hydration.
    if (!this.isBrowser) {
      this.matches = [];
      this.error = null;
      this.replacedText = '';
      this.highlightedTest = this.escapeHtml(this.testString);
      return;
    }

    if (!this.pattern) {
      this.matches = [];
      this.error = null;
      this.replacedText = this.testString;
      this.matchDurationMs = 0;
      this.truncated = false;
      this.highlightedTest = this.escapeHtml(this.testString) + '\n';
      return;
    }

    let re: RegExp;
    try {
      re = new RegExp(this.pattern, this.flagString);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Invalid regular expression';
      this.matches = [];
      this.replacedText = '';
      this.highlightedTest = this.escapeHtml(this.testString) + '\n';
      return;
    }

    this.error = null;
    const subject = this.testString.slice(0, MAX_TEST_LENGTH);
    const groupNames = this.extractGroupNames(this.pattern);

    const started = this.now();
    try {
      this.matches = this.collectMatches(re, subject, groupNames);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Matching failed';
      this.matches = [];
      this.highlightedTest = this.escapeHtml(this.testString) + '\n';
      return;
    }
    this.matchDurationMs = this.now() - started;

    if (this.activeMatchIndex !== null && this.activeMatchIndex >= this.matches.length) {
      this.activeMatchIndex = null;
    }

    this.highlightedTest = this.buildTestHighlight();
    this.checkOuroboros();

    if (this.replaceMode) {
      try {
        // Rebuild so the loop above does not leave lastIndex dangling.
        this.replacedText = subject.replace(new RegExp(this.pattern, this.flagString), this.replacement);
      } catch (err) {
        this.replacedText = '';
        this.error = err instanceof Error ? err.message : 'Replacement failed';
      }
    }
  }

  /**
   * Egg: a pattern that matches its own source text.
   *
   * The metacharacter requirement is what makes this worth anything. Any plain
   * literal matches its own source — /xyz/ finds "xyz" in the string "xyz" —
   * so without it the egg would fire the moment anyone typed a word, which is
   * a tautology rather than a discovery. Requiring at least one metacharacter
   * means the pattern has to actually be a regex that happens to describe its
   * own notation.
   *
   * Runs on a freshly built RegExp so a dangling `lastIndex` from the `g` flag
   * cannot skew test(), and only for short patterns — a catastrophic
   * backtracker fed its own source is exactly the input that would hang the tab.
   */
  private checkOuroboros(): void {
    if (this.pattern.length < 2 || this.pattern.length > 120) return;
    if (!/[\\[\]().*+?{}^$|]/.test(this.pattern)) return;
    try {
      const self = new RegExp(this.pattern, this.flagString.replace('g', ''));
      if (self.test(this.pattern)) this.eggs.trigger('regex-ouroboros');
    } catch { /* pattern already reported as invalid upstream */ }
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private collectMatches(re: RegExp, subject: string, groupNames: (string | undefined)[]): MatchResult[] {
    const out: MatchResult[] = [];
    this.truncated = false;

    const iterating = re.global || re.sticky;
    if (!iterating) {
      const m = re.exec(subject);
      if (m) out.push(this.toResult(m, groupNames));
      return out;
    }

    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(subject)) !== null) {
      out.push(this.toResult(m, groupNames));

      // A zero-length match would otherwise spin forever on the same index.
      if (m.index === re.lastIndex) re.lastIndex++;

      if (out.length >= MAX_MATCHES) {
        this.truncated = true;
        break;
      }
    }
    return out;
  }

  private toResult(m: RegExpExecArray, groupNames: (string | undefined)[]): MatchResult {
    const groups: CaptureGroup[] = [];
    for (let i = 1; i < m.length; i++) {
      groups.push({ number: i, name: groupNames[i], value: m[i] });
    }
    return { index: m.index, length: m[0].length, value: m[0], groups };
  }

  // ── Group-name extraction ─────────────────────────────────────

  /**
   * Walks the pattern counting capturing groups so each group number can be
   * labelled with its `(?<name>…)` name. Index 0 is unused (that's the whole
   * match), so the array is 1-indexed to line up with RegExpExecArray.
   */
  private extractGroupNames(src: string): (string | undefined)[] {
    const names: (string | undefined)[] = [undefined];
    let i = 0;
    let inClass = false;

    while (i < src.length) {
      const ch = src[i];

      if (ch === '\\') { i += 2; continue; }
      if (inClass) { if (ch === ']') inClass = false; i++; continue; }
      if (ch === '[') { inClass = true; i++; continue; }

      if (ch === '(') {
        const next = src[i + 1];
        if (next !== '?') {
          // Plain capturing group.
          names.push(undefined);
          i++;
          continue;
        }
        const third = src[i + 2];
        if (third === '<' && src[i + 3] !== '=' && src[i + 3] !== '!') {
          // Named capturing group — read up to the closing '>'.
          const close = src.indexOf('>', i + 3);
          if (close === -1) { i++; continue; }
          names.push(src.slice(i + 3, close));
          i = close + 1;
          continue;
        }
        // (?: (?= (?! (?<= (?<! — all non-capturing.
        i += 2;
        continue;
      }
      i++;
    }
    return names;
  }

  // ── Pattern syntax highlighting ───────────────────────────────

  private buildPatternHighlight(): string {
    if (!this.pattern) return '';
    return this.tokenizePattern(this.pattern)
      .map(t => `<span class="rb-tok rb-tok--${t.type}">${this.escapeHtml(t.text)}</span>`)
      .join('');
  }

  private tokenizePattern(src: string): RegexToken[] {
    const tokens: RegexToken[] = [];
    let i = 0;
    let inClass = false;
    /** Runs of plain literals are buffered so we emit one span, not one per char. */
    let buffer = '';

    const flush = () => {
      if (buffer) { tokens.push({ text: buffer, type: 'literal' }); buffer = ''; }
    };
    const push = (text: string, type: TokenType) => {
      flush();
      tokens.push({ text, type });
    };

    while (i < src.length) {
      const ch = src[i];

      // Escape sequences — always two chars, plus a braced tail for \p{…} / \u{…}.
      if (ch === '\\') {
        const next = src[i + 1] ?? '';
        if ((next === 'p' || next === 'P' || next === 'u' || next === 'k') && src[i + 2] === '{') {
          const close = src.indexOf('}', i + 3);
          if (close !== -1) { push(src.slice(i, close + 1), 'escape'); i = close + 1; continue; }
        }
        if (next === 'k' && src[i + 2] === '<') {
          const close = src.indexOf('>', i + 3);
          if (close !== -1) { push(src.slice(i, close + 1), 'group'); i = close + 1; continue; }
        }
        push(src.slice(i, i + 2), 'escape');
        i += 2;
        continue;
      }

      // Inside [...] almost everything is a literal, so colour the whole class.
      if (inClass) {
        if (ch === ']') { push(ch, 'class'); inClass = false; i++; continue; }
        push(ch, 'class');
        i++;
        continue;
      }

      if (ch === '[') { push(ch, 'class'); inClass = true; i++; continue; }

      if (ch === '(') {
        // Consume the whole group prefix so (?<name> reads as one token.
        if (src[i + 1] === '?') {
          const third = src[i + 2];
          if (third === '<' && src[i + 3] !== '=' && src[i + 3] !== '!') {
            const close = src.indexOf('>', i + 3);
            if (close !== -1) { push(src.slice(i, close + 1), 'group'); i = close + 1; continue; }
          }
          if (third === '<') { push(src.slice(i, i + 4), 'group'); i += 4; continue; }
          push(src.slice(i, i + 3), 'group');
          i += 3;
          continue;
        }
        push(ch, 'group');
        i++;
        continue;
      }

      if (ch === ')') { push(ch, 'group'); i++; continue; }
      if (ch === '^' || ch === '$') { push(ch, 'anchor'); i++; continue; }
      if (ch === '|') { push(ch, 'alternation'); i++; continue; }
      if (ch === '.') { push(ch, 'dot'); i++; continue; }

      if (ch === '*' || ch === '+' || ch === '?') {
        // A trailing ? makes the quantifier lazy — keep them in one token.
        if (src[i + 1] === '?' && ch !== '?') { push(src.slice(i, i + 2), 'quantifier'); i += 2; continue; }
        push(ch, 'quantifier');
        i++;
        continue;
      }

      if (ch === '{') {
        const close = src.indexOf('}', i + 1);
        const body = close === -1 ? '' : src.slice(i + 1, close);
        if (close !== -1 && /^\d+(,\d*)?$/.test(body)) {
          const lazy = src[close + 1] === '?';
          push(src.slice(i, close + 1 + (lazy ? 1 : 0)), 'quantifier');
          i = close + 1 + (lazy ? 1 : 0);
          continue;
        }
        buffer += ch;
        i++;
        continue;
      }

      buffer += ch;
      i++;
    }

    flush();
    return tokens;
  }

  // ── Test-string match highlighting ────────────────────────────

  private buildTestHighlight(): string {
    const subject = this.testString.slice(0, MAX_TEST_LENGTH);
    if (this.error || this.matches.length === 0) {
      return this.escapeHtml(subject) + '\n';
    }

    let html = '';
    let cursor = 0;

    this.matches.forEach((m, idx) => {
      if (m.index < cursor) return; // defensive: never emit overlapping spans
      html += this.escapeHtml(subject.slice(cursor, m.index));

      // Alternate two tints so touching matches stay visually separable.
      const tint = idx % 2 === 0 ? 'a' : 'b';
      const active = this.activeMatchIndex === idx ? ' rb-hl--active' : '';
      const body = this.escapeHtml(subject.slice(m.index, m.index + m.length));

      // Zero-length matches have nothing to paint, so show a caret marker.
      html += m.length === 0
        ? `<span class="rb-hl rb-hl--empty${active}">&#8203;</span>`
        : `<span class="rb-hl rb-hl--${tint}${active}">${body}</span>`;

      cursor = m.index + m.length;
    });

    html += this.escapeHtml(subject.slice(cursor));
    // Trailing newline keeps a final blank line visible under white-space: pre-wrap.
    return html + '\n';
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Sharing & clipboard ───────────────────────────────────────

  buildShareUrl(): string {
    const params = new URLSearchParams();
    params.set('p', this.pattern);
    params.set('f', this.flagString);
    if (this.testString) params.set('t', this.testString.slice(0, 2000));
    if (this.replaceMode) {
      params.set('m', 'replace');
      params.set('r', this.replacement);
    }
    return `${SITE_URL}/tools/regex-builder?${params.toString()}`;
  }

  copyShareUrl(): void {
    this.copy(this.buildShareUrl(), 'share');
  }

  copyPattern(): void {
    this.copy(this.literal, 'pattern');
  }

  copySnippet(): void {
    this.copy(this.codeSnippet, 'snippet');
  }

  copyReplaced(): void {
    this.copy(this.replacedText, 'replaced');
  }

  copyMatches(): void {
    this.copy(this.matches.map(m => m.value).join('\n'), 'matches');
  }

  private async copy(text: string, field: string): Promise<void> {
    if (!this.isBrowser || !text) return;
    try {
      await navigator.clipboard.writeText(text);
      this.flagCopied(field);
    } catch {
      this.fallbackCopy(text, field);
    }
  }

  private fallbackCopy(text: string, field: string): void {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    this.flagCopied(field);
  }

  private flagCopied(field: string): void {
    this.copiedField = field;
    setTimeout(() => {
      if (this.copiedField === field) this.copiedField = null;
    }, 2000);
  }
}
