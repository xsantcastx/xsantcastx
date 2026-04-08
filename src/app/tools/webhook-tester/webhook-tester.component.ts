import { Component, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { SITE_URL } from '../../seo.service';
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

interface WebhookHeader { key: string; value: string; }

@Component({
  selector: 'app-webhook-tester',
  templateUrl: './webhook-tester.component.html',
  styleUrls: ['./webhook-tester.component.css'],
  standalone: false
})
export class WebhookTesterComponent {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private eggs = inject(EasterEggService);

  readonly twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent('Free Webhook Tester — build payloads with templates!')}&url=${encodeURIComponent(SITE_URL + '/tools/webhook-tester')}`;
  readonly linkedInShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(SITE_URL + '/tools/webhook-tester')}`;

  url = '';
  method = 'POST';
  body = '';
  headers: WebhookHeader[] = [{ key: 'Content-Type', value: 'application/json' }];
  copied = false;

  readonly methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  readonly templates: Record<string, string> = {
    'GitHub Push': JSON.stringify({ ref: 'refs/heads/main', repository: { full_name: 'user/repo', html_url: 'https://github.com/user/repo' }, pusher: { name: 'user', email: 'user@example.com' }, commits: [{ id: 'abc123', message: 'Update README', timestamp: '2024-01-15T10:30:00Z' }] }, null, 2),
    'Stripe Payment': JSON.stringify({ id: 'evt_1234', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1234', amount: 2000, currency: 'usd', status: 'succeeded', customer: 'cus_1234' } } }, null, 2),
    'Slack Message': JSON.stringify({ text: 'Hello from webhook!', channel: '#general', username: 'webhookbot', icon_emoji: ':robot_face:', attachments: [{ color: '#00ffcc', title: 'Notification', text: 'Something happened' }] }, null, 2),
  };

  constructor(private router: Router) {}

  goBack() { this.router.navigate(['/tools']); }

  loadTemplate(name: string) {
    this.body = this.templates[name];
    this.checkEasterEgg();
  }

  onBodyChange() {
    this.checkEasterEgg();
  }

  private checkEasterEgg() {
    if (this.body.toLowerCase().includes('"ping"') || this.body.toLowerCase().includes("'ping'") || this.body.toLowerCase().trim() === 'ping') {
      this.eggs.trigger('webhook-pong');
    }
  }

  addHeader() {
    this.headers.push({ key: '', value: '' });
  }

  removeHeader(i: number) {
    this.headers.splice(i, 1);
  }

  get curlCommand(): string {
    let cmd = `curl -X ${this.method}`;
    for (const h of this.headers) {
      if (h.key && h.value) cmd += ` \\\n  -H "${h.key}: ${h.value}"`;
    }
    if (this.body && this.method !== 'GET') {
      cmd += ` \\\n  -d '${this.body.replace(/'/g, "\\'")}'`;
    }
    cmd += ` \\\n  "${this.url || 'https://example.com/webhook'}"`;
    return cmd;
  }

  async copyCurl() {
    if (!this.isBrowser) return;
    try {
      await navigator.clipboard.writeText(this.curlCommand);
      this.copied = true;
      setTimeout(() => (this.copied = false), 2000);
    } catch {}
  }

  clearAll() {
    this.url = '';
    this.method = 'POST';
    this.body = '';
    this.headers = [{ key: 'Content-Type', value: 'application/json' }];
  }
}
