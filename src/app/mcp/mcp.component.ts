import { Component, OnInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../seo.service';

interface McpTool {
  name: string;
  description: string;
  example: string;
}

interface WhyCard {
  icon: string;
  title: string;
  body: string;
}

@Component({
  selector: 'app-mcp',
  standalone: false,
  template: `
    <div class="mcp-page">

      <!-- Hero -->
      <section class="hero-section">
        <div class="hero-content">
          <div class="hero-badge">
            <span class="badge-dot"></span>
            npm package
          </div>
          <h1 class="hero-title">xsantcastx MCP Server</h1>
          <p class="hero-sub">14 developer tools for your AI agents</p>
          <p class="hero-desc">
            Works with Claude Desktop, Claude Code, and any MCP-compatible client.
            Zero API calls. All local computation.
          </p>
          <div class="hero-actions">
            <a href="https://www.npmjs.com/package/xsantcastx-mcp-server" target="_blank" rel="noopener noreferrer" class="btn-primary">
              View on npm
            </a>
            <a href="https://github.com/xsantcastx/xsantcastx-mcp-server" target="_blank" rel="noopener noreferrer" class="btn-ghost">
              GitHub
            </a>
          </div>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="terminal-card">
            <div class="terminal-header">
              <span class="dot red"></span>
              <span class="dot yellow"></span>
              <span class="dot green"></span>
            </div>
            <div class="terminal-body">
              <span class="prompt">$</span>
              <span class="cmd"> npm install -g xsantcastx-mcp-server</span>
              <br />
              <span class="out">+ xsantcastx-mcp-server@1.0.0</span>
              <br />
              <span class="out ok">✓ 14 tools registered</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Install -->
      <section class="section install-section">
        <div class="section-inner">
          <h2 class="section-title">Install</h2>
          <div class="code-block">
            <code class="code-text">npm install -g xsantcastx-mcp-server</code>
            <button
              class="copy-btn"
              [class.copied]="installCopied"
              (click)="copy('npm install -g xsantcastx-mcp-server', 'install')"
              aria-label="Copy install command"
            >
              <svg *ngIf="!installCopied" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <svg *ngIf="installCopied" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              {{ installCopied ? 'Copied!' : 'Copy' }}
            </button>
          </div>
        </div>
      </section>

      <!-- Claude Desktop -->
      <section class="section config-section">
        <div class="section-inner two-col">
          <div class="config-block">
            <h2 class="section-title">Use with Claude Desktop</h2>
            <p class="config-label">
              Add to <code class="inline-code">~/Library/Application Support/Claude/claude_desktop_config.json</code>
            </p>
            <div class="code-block multiline">
              <button
                class="copy-btn corner"
                [class.copied]="desktopCopied"
                (click)="copy(desktopConfig, 'desktop')"
                aria-label="Copy Claude Desktop config"
              >
                <svg *ngIf="!desktopCopied" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <svg *ngIf="desktopCopied" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {{ desktopCopied ? 'Copied!' : 'Copy' }}
              </button>
              <pre class="pre-code">{{ desktopConfig }}</pre>
            </div>
          </div>

          <!-- Claude Code -->
          <div class="config-block">
            <h2 class="section-title">Use with Claude Code</h2>
            <p class="config-label">Run this command in your terminal:</p>
            <div class="code-block">
              <code class="code-text">claude mcp add xsantcastx-mcp-server -- xsantcastx-mcp-server</code>
              <button
                class="copy-btn"
                [class.copied]="codeCopied"
                (click)="copy('claude mcp add xsantcastx-mcp-server -- xsantcastx-mcp-server', 'code')"
                aria-label="Copy Claude Code command"
              >
                <svg *ngIf="!codeCopied" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <svg *ngIf="codeCopied" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {{ codeCopied ? 'Copied!' : 'Copy' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Tools Grid -->
      <section class="section tools-section">
        <div class="section-inner">
          <h2 class="section-title centered">14 Built-in Tools</h2>
          <p class="section-sub centered">Every tool runs locally — no network, no latency, no keys required.</p>
          <div class="tools-grid">
            <div class="tool-card glass" *ngFor="let tool of tools">
              <div class="tool-name">{{ tool.name }}</div>
              <div class="tool-desc">{{ tool.description }}</div>
              <div class="tool-example">
                <code>{{ tool.example }}</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Why section -->
      <section class="section why-section">
        <div class="section-inner">
          <h2 class="section-title centered">Why xsantcastx MCP Server?</h2>
          <div class="why-grid">
            <div class="why-card glass" *ngFor="let card of whyCards">
              <div class="why-icon" [innerHTML]="card.icon"></div>
              <h3 class="why-title">{{ card.title }}</h3>
              <p class="why-body">{{ card.body }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Links section -->
      <section class="section links-section">
        <div class="section-inner links-inner">
          <a href="https://www.npmjs.com/package/xsantcastx-mcp-server" target="_blank" rel="noopener noreferrer" class="link-card glass">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M0 0v24h6.545V6.545h4.364V24H24V0z"/>
            </svg>
            <div>
              <div class="link-label">npm</div>
              <div class="link-name">xsantcastx-mcp-server</div>
            </div>
          </a>
          <a href="https://github.com/xsantcastx/xsantcastx-mcp-server" target="_blank" rel="noopener noreferrer" class="link-card glass">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
            </svg>
            <div>
              <div class="link-label">GitHub</div>
              <div class="link-name">xsantcastx/xsantcastx-mcp-server</div>
            </div>
          </a>
        </div>
      </section>

    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    /* ── Page shell ───────────────────────────────────────────────────────── */
    .mcp-page {
      min-height: 100vh;
      background: #0a0f1e;
      color: #e2e8f0;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    }

    /* ── Hero ─────────────────────────────────────────────────────────────── */
    .hero-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 3rem;
      padding: 6rem 2rem 4rem;
      max-width: 1100px;
      margin: 0 auto;
    }

    .hero-content {
      flex: 1;
      min-width: 0;
    }

    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(0, 212, 255, 0.1);
      border: 1px solid rgba(0, 212, 255, 0.25);
      border-radius: 999px;
      padding: 0.3rem 0.9rem;
      font-size: 0.78rem;
      color: #00d4ff;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
    }

    .badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #00d4ff;
      box-shadow: 0 0 6px #00d4ff;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .hero-title {
      font-family: 'Orbitron', 'Courier New', monospace;
      font-size: clamp(2rem, 5vw, 3.25rem);
      font-weight: 700;
      color: #fff;
      line-height: 1.15;
      margin: 0 0 0.75rem;
      background: linear-gradient(135deg, #ffffff 0%, #00d4ff 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .hero-sub {
      font-size: 1.2rem;
      color: #00d4ff;
      margin: 0 0 1rem;
      font-weight: 500;
    }

    .hero-desc {
      font-size: 1rem;
      color: #94a3b8;
      line-height: 1.7;
      max-width: 520px;
      margin: 0 0 2rem;
    }

    .hero-actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #00d4ff;
      color: #0a0f1e;
      font-weight: 700;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.9rem;
      transition: opacity 0.2s, transform 0.2s;
    }

    .btn-primary:hover {
      opacity: 0.9;
      transform: translateY(-1px);
    }

    .btn-ghost {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.15);
      color: #e2e8f0;
      font-weight: 600;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      text-decoration: none;
      font-size: 0.9rem;
      transition: border-color 0.2s, transform 0.2s;
    }

    .btn-ghost:hover {
      border-color: #00d4ff;
      color: #00d4ff;
      transform: translateY(-1px);
    }

    /* ── Terminal card ────────────────────────────────────────────────────── */
    .hero-visual {
      flex-shrink: 0;
    }

    .terminal-card {
      background: rgba(15, 20, 40, 0.85);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 12px;
      width: 340px;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(0,212,255,0.08);
    }

    .terminal-header {
      display: flex;
      gap: 6px;
      padding: 0.75rem 1rem;
      background: rgba(255,255,255,0.03);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    .dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .dot.red    { background: #ff5f57; }
    .dot.yellow { background: #ffbd2e; }
    .dot.green  { background: #28ca41; }

    .terminal-body {
      padding: 1.25rem 1.25rem 1.5rem;
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 0.82rem;
      line-height: 1.8;
    }

    .prompt { color: #00d4ff; }
    .cmd    { color: #e2e8f0; }
    .out    { color: #64748b; }
    .out.ok { color: #22d3a5; }

    /* ── Sections ────────────────────────────────────────────────────────── */
    .section {
      padding: 4rem 2rem;
    }

    .section-inner {
      max-width: 1100px;
      margin: 0 auto;
    }

    .section-title {
      font-family: 'Orbitron', 'Courier New', monospace;
      font-size: clamp(1.25rem, 3vw, 1.75rem);
      font-weight: 700;
      color: #fff;
      margin: 0 0 1.5rem;
    }

    .section-title.centered {
      text-align: center;
    }

    .section-sub {
      color: #64748b;
      font-size: 0.95rem;
      margin: -1rem 0 2.5rem;
    }

    .section-sub.centered {
      text-align: center;
    }

    /* ── Install ─────────────────────────────────────────────────────────── */
    .install-section {
      background: rgba(0, 212, 255, 0.02);
      border-top: 1px solid rgba(0, 212, 255, 0.08);
      border-bottom: 1px solid rgba(0, 212, 255, 0.08);
    }

    /* ── Code blocks ─────────────────────────────────────────────────────── */
    .code-block {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: rgba(15, 20, 40, 0.8);
      border: 1px solid rgba(0, 212, 255, 0.15);
      border-radius: 10px;
      padding: 1rem 1.25rem;
      position: relative;
    }

    .code-block.multiline {
      flex-direction: column;
      align-items: flex-start;
      padding: 1rem;
    }

    .code-block.multiline .copy-btn.corner {
      position: absolute;
      top: 0.75rem;
      right: 0.75rem;
    }

    .code-text {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 0.88rem;
      color: #00d4ff;
      flex: 1;
    }

    .pre-code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 0.82rem;
      color: #a5f3fc;
      margin: 0;
      white-space: pre;
      line-height: 1.7;
      overflow-x: auto;
      width: 100%;
    }

    .inline-code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 0.82em;
      background: rgba(0,212,255,0.1);
      border: 1px solid rgba(0,212,255,0.2);
      border-radius: 4px;
      padding: 0.1em 0.4em;
      color: #00d4ff;
    }

    .copy-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(0, 212, 255, 0.1);
      border: 1px solid rgba(0, 212, 255, 0.25);
      border-radius: 6px;
      color: #00d4ff;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      cursor: pointer;
      transition: background 0.2s, color 0.2s;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .copy-btn:hover {
      background: rgba(0, 212, 255, 0.2);
    }

    .copy-btn.copied {
      background: rgba(34, 211, 165, 0.15);
      border-color: rgba(34, 211, 165, 0.4);
      color: #22d3a5;
    }

    /* ── Config two-col ──────────────────────────────────────────────────── */
    .two-col {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
    }

    .config-label {
      font-size: 0.88rem;
      color: #64748b;
      margin: -0.5rem 0 1rem;
      line-height: 1.6;
    }

    /* ── Tools grid ──────────────────────────────────────────────────────── */
    .tools-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 1.25rem;
    }

    .glass {
      background: rgba(255, 255, 255, 0.03);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
    }

    .tool-card {
      padding: 1.25rem 1.25rem 1rem;
      transition: border-color 0.2s, transform 0.2s;
    }

    .tool-card:hover {
      border-color: rgba(0, 212, 255, 0.3);
      transform: translateY(-2px);
    }

    .tool-name {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 0.9rem;
      font-weight: 700;
      color: #00d4ff;
      margin-bottom: 0.4rem;
    }

    .tool-desc {
      font-size: 0.85rem;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 0.75rem;
    }

    .tool-example {
      background: rgba(0, 212, 255, 0.04);
      border: 1px solid rgba(0, 212, 255, 0.1);
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
    }

    .tool-example code {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 0.75rem;
      color: #64748b;
      word-break: break-all;
    }

    /* ── Why grid ────────────────────────────────────────────────────────── */
    .why-section {
      background: rgba(0, 212, 255, 0.02);
      border-top: 1px solid rgba(0, 212, 255, 0.08);
      border-bottom: 1px solid rgba(0, 212, 255, 0.08);
    }

    .why-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
      gap: 1.5rem;
    }

    .why-card {
      padding: 1.75rem 1.5rem;
      text-align: center;
      transition: border-color 0.2s, transform 0.2s;
    }

    .why-card:hover {
      border-color: rgba(0, 212, 255, 0.3);
      transform: translateY(-2px);
    }

    .why-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 212, 255, 0.1);
      border-radius: 12px;
      color: #00d4ff;
    }

    .why-title {
      font-family: 'Orbitron', 'Courier New', monospace;
      font-size: 0.9rem;
      font-weight: 700;
      color: #fff;
      margin: 0 0 0.5rem;
    }

    .why-body {
      font-size: 0.85rem;
      color: #64748b;
      line-height: 1.6;
      margin: 0;
    }

    /* ── Links section ───────────────────────────────────────────────────── */
    .links-section {
      padding-bottom: 6rem;
    }

    .links-inner {
      display: flex;
      gap: 1.5rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    .link-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem 2rem;
      text-decoration: none;
      color: #e2e8f0;
      min-width: 260px;
      transition: border-color 0.2s, transform 0.2s;
    }

    .link-card:hover {
      border-color: rgba(0, 212, 255, 0.4);
      transform: translateY(-2px);
      color: #fff;
    }

    .link-card svg {
      color: #00d4ff;
      flex-shrink: 0;
    }

    .link-label {
      font-size: 0.75rem;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.15rem;
    }

    .link-name {
      font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
      font-size: 0.85rem;
      color: #00d4ff;
      font-weight: 600;
    }

    /* ── Responsive ──────────────────────────────────────────────────────── */
    @media (max-width: 860px) {
      .hero-section {
        flex-direction: column;
        padding-top: 4rem;
      }

      .terminal-card {
        width: 100%;
        max-width: 400px;
      }

      .two-col {
        grid-template-columns: 1fr;
        gap: 2rem;
      }
    }

    @media (max-width: 520px) {
      .tools-grid {
        grid-template-columns: 1fr;
      }

      .why-grid {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 400px) {
      .why-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class McpComponent implements OnInit {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  installCopied = false;
  desktopCopied = false;
  codeCopied    = false;

  readonly desktopConfig = `{
  "mcpServers": {
    "xsantcastx": {
      "command": "xsantcastx-mcp-server"
    }
  }
}`;

  readonly tools: McpTool[] = [
    { name: 'json_format',          description: 'Pretty-print or minify JSON.',                                   example: 'json_format({ json: \'{"a":1}\', indent: 2 })' },
    { name: 'json_schema_generate', description: 'Infer a JSON Schema from a sample object.',                      example: 'json_schema_generate({ sample: \'{"id":1,"name":"Alice"}\' })' },
    { name: 'uuid_generate',        description: 'Generate a v4 UUID.',                                            example: 'uuid_generate({ count: 5 })' },
    { name: 'uuid_validate',        description: 'Validate a UUID string.',                                        example: 'uuid_validate({ uuid: "..." })' },
    { name: 'base64_encode',        description: 'Encode text to Base64.',                                         example: 'base64_encode({ text: "hello" })' },
    { name: 'base64_decode',        description: 'Decode Base64 to text.',                                         example: 'base64_decode({ encoded: "aGVsbG8=" })' },
    { name: 'jwt_decode',           description: 'Decode a JWT (no verification).',                                example: 'jwt_decode({ token: "eyJ..." })' },
    { name: 'regex_test',           description: 'Test a string against a regex pattern.',                         example: 'regex_test({ pattern: "\\\\d+", input: "abc123" })' },
    { name: 'regex_replace',        description: 'Replace matches in a string using regex.',                       example: 'regex_replace({ pattern: "foo", replacement: "bar", input: "foo baz" })' },
    { name: 'hash_generate',        description: 'Generate a hash (MD5/SHA-1/SHA-256/SHA-512).',                   example: 'hash_generate({ text: "hello", algorithm: "sha256" })' },
    { name: 'hash_verify',          description: 'Verify text against a known hash.',                              example: 'hash_verify({ text: "hello", hash: "...", algorithm: "sha256" })' },
    { name: 'color_contrast',       description: 'Calculate WCAG color contrast ratio.',                           example: 'color_contrast({ foreground: "#fff", background: "#0a0f1e" })' },
    { name: 'cron_parse',           description: 'Parse a cron expression into human-readable form.',              example: 'cron_parse({ expression: "0 9 * * 1-5" })' },
    { name: 'cron_build',           description: 'Build a cron expression from schedule params.',                   example: 'cron_build({ minute: "0", hour: "9", weekday: "1-5" })' },
  ];

  readonly whyCards: WhyCard[] = [
    {
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      title: 'Zero API Calls',
      body: 'Runs entirely on your machine. No network requests, no latency.'
    },
    {
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
      title: 'No Secrets Required',
      body: 'No API keys, no environment variables, no auth.'
    },
    {
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
      title: 'Pure Node.js',
      body: 'Lightweight, fast, zero native dependencies.'
    },
    {
      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
      title: 'MIT Licensed',
      body: 'Open source. Use it, fork it, extend it.'
    },
  ];

  constructor(private router: Router) {}

  ngOnInit(): void {
    // SEO is handled via route data in app-routing.module.ts (SeoService)
  }

  async copy(text: string, target: 'install' | 'desktop' | 'code'): Promise<void> {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      this.fallbackCopy(text);
    }
    this.setFeedback(target);
  }

  private setFeedback(target: 'install' | 'desktop' | 'code'): void {
    if (target === 'install') {
      this.installCopied = true;
      setTimeout(() => (this.installCopied = false), 2000);
    } else if (target === 'desktop') {
      this.desktopCopied = true;
      setTimeout(() => (this.desktopCopied = false), 2000);
    } else {
      this.codeCopied = true;
      setTimeout(() => (this.codeCopied = false), 2000);
    }
  }

  private fallbackCopy(text: string): void {
    if (!this.isBrowser) return;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}
