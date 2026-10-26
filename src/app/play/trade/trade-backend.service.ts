/**
 * trade-backend.service.ts — where trade-flow.ts's verbs go.
 *
 * Production: the `tradeApi` Cloud Function (functions-game/src/trade.ts) with this account's Firebase ID token, and the
 * save moved through GameStateGateway — `syncNow()` before (the Function reads the cloud's copy), `pullKeys()` after
 * (the Function wrote it; the merge adopts the move, see trade-core's header and trade-merge.spec).
 *
 * The local e2e (localhost, a WebDriver browser, `eclipse-trade-fake` = 1 and a `fake.<uid>` Hearth token): the
 * Hearth's /fake-trade stand-in (scripts/trade-fake.mjs) runs the same trade-core over an in-memory "Firestore"; this
 * service plays the gateway's part against it — read the document, merge with the client's own merge, write it back
 * (refused like the rule refuses a lower serverSeq), and after a move read, merge, cache and rehydrate the owner.
 */
import { Injectable, inject } from '@angular/core';
import { CloudSaveService } from '../../shared/cloud-save/cloud-save.service';
import { mergeEconomyLedgers } from '../../shared/economy/economy-ops';
import { mergeInventoryLedgers } from '../../shared/rpg/inventory-ops';
import { characterDocPath } from '../../shared/save/character-scope';
import { ECONOMY_STATE_KEY, GameStateGateway } from '../../shared/save/game-state.gateway';
import { LocalSaveRegistry } from '../../shared/save/local-save-registry.service';
import { hearthEndpoint } from '../social/social-room';
import type { TradeBackend } from './trade-flow';

/** The Function (its cloudfunctions.net host is already in firebase.json's connect-src). */
export const TRADE_URL = 'https://us-central1-xsantcastx-1694b.cloudfunctions.net/tradeApi';
const INVENTORY_KEY = 'godforge-inventory';
const FAKE_KEY = 'eclipse-trade-fake';
const FAKE_TOKEN_KEY = 'eclipse-hearth-fake-token';

/** The local e2e's stand-in, on localhost in a WebDriver browser only (never on the site). */
function fakeToken(): string | null {
  try {
    if (typeof navigator === 'undefined' || !navigator.webdriver || !['localhost', '127.0.0.1'].includes(location.hostname)) return null;
    if (localStorage.getItem(FAKE_KEY) !== '1') return null;
    return localStorage.getItem(FAKE_TOKEN_KEY);
  } catch { return null; }
}

/** The e2e's fake Google sign-in + Firestore is on (shared/cloud-save/fake-cloud.ts). */
function fakeCloud(): boolean {
  try { return !!navigator.webdriver && ['localhost', '127.0.0.1'].includes(location.hostname) && !!localStorage.getItem('eclipse-cloud-fake'); } catch { return false; }
}

@Injectable({ providedIn: 'root' })
export class TradeBackendService implements TradeBackend {
  private readonly gateway = inject(GameStateGateway);
  private readonly cloud = inject(CloudSaveService);
  private readonly owners = inject(LocalSaveRegistry);

  get character(): string { return this.gateway.character; }

  blocked(): 'signin' | 'lease' | 'connecting' | null {
    // The trade stand-in skips the cloud save — unless the e2e's fake cloud is on, which tests exactly that binding.
    if (fakeToken() && !fakeCloud()) return null;
    if (!this.gateway.attached) {
      // Signed in but the save is not on the account yet (owner bug 2026-10-26: "Sign in to trade" while signed in):
      // say so, and put it right now rather than at the next watch (cloud-save recoverAttach).
      if (this.cloud.signedIn) { this.cloud.recoverAttach(); return 'connecting'; }
      return 'signin';
    }
    return this.gateway.mayWriteCloud ? null : 'lease';
  }

  async prepare(): Promise<void> {
    if (fakeToken()) { for (const key of [INVENTORY_KEY, ECONOMY_STATE_KEY]) await this.fakePush(key); return; }
    await this.gateway.syncNow();
  }

  async call(verb: 'execute' | 'cancel' | 'drop' | 'pickup', body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    const fake = fakeToken();
    const token = fake ?? await this.cloud.idToken();
    if (!token) return { status: 401, body: { error: 'Sign in to trade.' } };
    const url = fake ? `${hearthEndpoint()}/fake-trade/api/${verb}` : `${TRADE_URL}/${verb}`;
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(20000),
    });
    const out = await res.json().catch(() => ({})) as Record<string, unknown>;
    return { status: res.status, body: out && typeof out === 'object' ? out : {} };
  }

  async settle(): Promise<void> {
    if (fakeToken()) { for (const key of [INVENTORY_KEY, ECONOMY_STATE_KEY]) await this.fakePull(key); return; }
    await this.gateway.pullKeys([INVENTORY_KEY, ECONOMY_STATE_KEY]);
  }

  // ── The local e2e's stand-in for the gateway's half (see the header) ──
  private fakePath(key: string): string {
    const uid = /^fake\.([A-Za-z0-9_-]{1,64})/.exec(fakeToken() ?? '')?.[1] ?? '';
    const [collection, doc] = key === INVENTORY_KEY ? ['progress', 'inventory'] : ['economy', 'state'];
    return ['users', uid, ...characterDocPath(this.character, collection, doc)].join('/');
  }
  private merge(key: string, cloud: unknown, local: unknown): unknown {
    return key === INVENTORY_KEY ? mergeInventoryLedgers(cloud, local) : mergeEconomyLedgers(cloud, local);
  }
  private async fakeDoc(path: string, op: 'get' | 'put', data?: unknown): Promise<{ status: number; data: unknown }> {
    const res = await fetch(`${hearthEndpoint()}/fake-trade/doc/${op}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fakeToken()}` },
      body: JSON.stringify({ path, ...(op === 'put' ? { data } : {}) }),
    });
    const out = await res.json().catch(() => ({})) as { data?: unknown };
    return { status: res.status, data: out.data ?? null };
  }
  private async fakePush(key: string): Promise<void> {
    this.owners.flush(key);
    const path = this.fakePath(key);
    for (let i = 0; i < 3; i++) {
      const held = (await this.fakeDoc(path, 'get')).data as { v?: unknown } | null;
      const merged = this.merge(key, held?.v ?? null, this.gateway.read(key));
      const put = await this.fakeDoc(path, 'put', { v: JSON.parse(JSON.stringify(merged)), updatedAt: new Date().toISOString() });
      if (put.status === 200) return;
      if (put.status !== 409) throw new Error('save push failed');
    }
    throw new Error('save push refused');
  }
  private async fakePull(key: string): Promise<void> {
    this.owners.flush(key);
    const held = (await this.fakeDoc(this.fakePath(key), 'get')).data as { v?: unknown } | null;
    if (!held?.v) return;
    this.gateway.write(key, this.merge(key, held.v, this.gateway.read(key)));
    this.owners.rehydrate(key);
  }
}
