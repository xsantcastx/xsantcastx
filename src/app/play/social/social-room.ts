const KEEPER_ANIMATIONS = new Set(['idle', 'run', 'jump', 'fall', 'attack', 'dodge', 'hurt']);
export interface RoomPlayer { id: string; name: string; x: number; y: number; zone: string; facing?: number; animation?: string }
export interface RoomMessage { id: string; playerId: string; name: string; text: string; at: number }
export interface RoomSnapshot { status: string; connected: boolean; players: RoomPlayer[]; messages: RoomMessage[]; id: string }

/** The room owns only presence and chat; inventory never leaves the save gateway. */
export class SocialRoom {
  private token = '';
  private stream?: AbortController;
  private generation = 0;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private reconnectAttempts = 0;
  private updating = false;
  private lastUpdate = 0;
  private snapshot: RoomSnapshot = { status: 'Solo — join the hearth to meet other Keepers.', connected: false, players: [], messages: [], id: '' };
  private readonly endpoint = ['localhost', '127.0.0.1'].includes(location.hostname)
    ? `${location.protocol}//${location.hostname}:4320` : '/social';
  constructor(private readonly changed: (state: RoomSnapshot) => void) {}
  private publish(patch: Partial<RoomSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch }; this.changed(this.snapshot);
  }
  async join(name: string): Promise<void> {
    this.leave();
    const generation = this.generation;
    this.publish({ status: 'Joining the hearth…' });
    try {
      const response = await fetch(`${this.endpoint}/join`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Join failed');
      const result = await response.json();
      if (generation !== this.generation) {
        void this.post('leave', {}, result.token).catch(() => {}); return;
      }
      this.token = result.token;
      this.publish({ id: result.id, players: result.players, messages: result.messages });
      this.stream = new AbortController();
      void this.listen(generation, this.stream.signal);

    } catch {
      if (generation === this.generation) this.publish({ status: 'The room server is unavailable. You can keep playing solo.', connected: false });
    }
  }
  private async listen(generation: number, signal: AbortSignal): Promise<void> {
    let openedAt: number | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const response = await fetch(`${this.endpoint}/events`, { headers: { Authorization: `Bearer ${this.token}` }, signal });
      if (generation !== this.generation || signal.aborted) { await response.body?.cancel(); return; }
      if (response.status === 401) {
        this.leave(); this.publish({ status: 'Your room session expired. Join again to reconnect.' }); return;
      }
      if (!response.ok || !response.body) throw new Error('Stream unavailable');
      if (generation !== this.generation) return;
      openedAt = performance.now();
      this.publish({ status: 'Connected to the hearth', connected: true });
      reader = response.body.getReader();
      const decoder = new TextDecoder(); let pending = '';
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        pending += decoder.decode(value, { stream: true });
        let end: number;
        while ((end = pending.indexOf('\n\n')) !== -1) {
          const packet = pending.slice(0, end); pending = pending.slice(end + 2);
          const line = packet.split('\n').find(line => line.startsWith('data:'));
          if (!line || generation !== this.generation) continue;
          const data = JSON.parse(line.slice(5));
          if (data.type === 'snapshot') this.publish({ players: data.players, messages: data.messages });
          if (data.type === 'players') this.publish({ players: data.players });
          if (data.type === 'chat' && !this.snapshot.messages.some(m => m.id === data.message.id)) {
            this.publish({ messages: [...this.snapshot.messages, data.message].slice(-50) });
          }
        }
      }
      if (!signal.aborted) throw new Error('Stream ended');
    } catch {
      if (generation !== this.generation || signal.aborted) return;
      if (openedAt !== undefined && performance.now() - openedAt > 10000) this.reconnectAttempts = 0;
      if (this.reconnectAttempts >= 5) {
        this.leave(); this.publish({ status: 'Connection lost. Join again to reconnect.' }); return;
      }
      const delay = Math.min(1000 * 2 ** this.reconnectAttempts++, 8000);
      this.publish({ connected: false, status: 'Reconnecting to the hearth…' });
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = undefined;
        if (generation !== this.generation || !this.token) return;
        this.stream = new AbortController();
        void this.listen(generation, this.stream.signal);
      }, delay);
    } finally {
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
    }
  }
  async chat(text: string): Promise<boolean> {
    if (!this.snapshot.connected) return false;
    try { await this.post('chat', { text }); return true; }
    catch { this.publish({ status: 'Message not sent. Wait a moment and try again.' }); return false; }
  }
  update(x: number, y: number, zone: string, facing = 1, animation = 'idle'): void {
    if (!this.token || this.updating || performance.now() - this.lastUpdate < 200) return;
    const generation = this.generation;
    this.updating = true; this.lastUpdate = performance.now();
    void this.post('update', { x, y, zone, facing: facing === -1 ? -1 : 1, animation: KEEPER_ANIMATIONS.has(animation) ? animation : 'idle' }).catch(() => {
      if (generation === this.generation && this.snapshot.connected) this.publish({ status: 'Position update interrupted.' });
    }).finally(() => { if (generation === this.generation) this.updating = false; });
  }
  private async post(path: string, body: unknown, token = this.token): Promise<void> {
    const response = await fetch(`${this.endpoint}/${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body), signal: AbortSignal.timeout(5000), keepalive: path === 'leave',
    });
    if (!response.ok) throw new Error('Room request failed');
  }
  leave(): void {
    this.generation++; this.stream?.abort(); this.stream = undefined;
    clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined;
    this.reconnectAttempts = 0; this.updating = false; this.lastUpdate = 0;
    const token = this.token; this.token = '';
    if (token) void this.post('leave', {}, token).catch(() => {});
    this.publish({ connected: false, players: [], messages: [], id: '', status: 'Solo — join the hearth to meet other Keepers.' });
  }
}
