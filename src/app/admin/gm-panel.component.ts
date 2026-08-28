/**
 * gm-panel.component.ts — the player-management half of the Control Room.
 *
 * The dashboard half (AdminComponent's own sections) reads counters. This reads
 * and edits people. It is a child component rather than four more sections in
 * admin.component.html for two reasons that are both about blast radius: the
 * dashboard is a page nobody can break by looking at it, and this is not; and
 * AdminComponent was already 336 lines of panel wiring before any of this
 * existed.
 *
 * The parent owns the sidebar and passes the chosen view down. That keeps one
 * component owning "which tab is open" — split across two, the back-button and
 * refresh behaviour would have to be reconciled between them, and there is no
 * version of that which is simpler than one input.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY EVERY DESTRUCTIVE ACTION GOES THROUGH ONE CONFIRM OBJECT
 * ─────────────────────────────────────────────────────────────────────────────
 * `pending` holds the action awaiting confirmation, its copy, and whether it
 * needs typing the player's name to proceed. One object rather than a boolean
 * per action, because the failure mode this guards against is the sixth
 * confirmation dialog being the one somebody forgot to wire — and a single
 * object makes an unconfirmed action a compile-time impossibility rather than a
 * review item.
 *
 * `severity: 'extreme'` additionally requires the operator to type the target's
 * display name. That is the double confirmation the brief asked for on Full
 * Reset, and it is deliberately the only place it applies: a confirmation
 * everybody has to defeat five times a day stops being read.
 */
import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnInit, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  AuditEntry, BanRecord, PlayerDirectoryEntry, SiteNotice,
} from '../shared/cloud-save/gm.model';
import {
  EconomySnapshotView, GmDataService, PlayerProfile,
} from './gm-data.service';

/** Which sub-view of the console is on screen. Set by the parent's sidebar. */
export type GmView = 'users' | 'economy' | 'actions' | 'logs';

/** Columns the user table can sort by. */
export type SortKey = 'displayName' | 'rank' | 'level' | 'gold' | 'totalXp' | 'lastActive';

/** An action parked behind a confirmation. */
interface PendingAction {
  title: string;
  /** What will happen, in the operator's language. Rendered as the body. */
  body: string;
  /** The button label. Imperative: "Wipe everything", not "OK". */
  confirmLabel: string;
  /**
   * 'extreme' requires typing `guardWord` to arm the button. Reserved for
   * actions with no undo — see the class header.
   */
  severity: 'normal' | 'extreme';
  guardWord: string;
  run: () => Promise<string>;
}

const PAGE_SIZE = 20;

@Component({
  selector: 'app-gm-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gm-panel.component.html',
  styleUrls: ['./gm-panel.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GmPanelComponent implements OnInit {
  private readonly gm = inject(GmDataService);
  private readonly cdr = inject(ChangeDetectorRef);

  @Input() view: GmView = 'users';

  /** Identity of the signed-in operator, for the audit trail. */
  @Input() set actor(value: { uid: string; email: string }) {
    this.gm.actorUid = value.uid;
    this.gm.actorEmail = value.email;
  }

  loading = true;
  /** Set when the whole console could not load — usually undeployed rules. */
  loadError = '';

  players: PlayerDirectoryEntry[] = [];
  bans = new Map<string, BanRecord>();
  stats: EconomySnapshotView | null = null;
  audit: AuditEntry[] = [];
  notice: SiteNotice | null = null;

  // ── User table state ──────────────────────────────────────────────────
  search = '';
  sortKey: SortKey = 'lastActive';
  sortDesc = true;
  page = 0;
  readonly pageSize = PAGE_SIZE;

  // ── Detail drawer ─────────────────────────────────────────────────────
  selected: PlayerDirectoryEntry | null = null;
  profile: PlayerProfile | null = null;
  profileLoading = false;
  profileError = '';

  // ── Action inputs ─────────────────────────────────────────────────────
  grantAmount: number | null = null;
  banReason = '';
  broadcastText = '';
  maintenanceOn = false;
  maintenanceNote = '';

  // ── Confirmation ──────────────────────────────────────────────────────
  pending: PendingAction | null = null;
  guardTyped = '';
  busy = false;
  /** Last action's outcome, shown as a transient line above the table. */
  flash = '';

  ngOnInit(): void {
    void this.reload();
  }

  // ── Loading ───────────────────────────────────────────────────────────

  /**
   * Read the directory, the ban index, the audit trail and the notice.
   *
   * Not cached through FirestoreCacheService the way the dashboard panels are,
   * and deliberately: those are counters nobody acts on within the minute, and
   * this is the table somebody is about to ban a person from. Showing a
   * five-minute-old Gold balance next to a "Reset Stats" button would be
   * actively misleading. The reads are cheap — one collection scan each, and
   * the ban index is normally empty.
   */
  async reload(): Promise<void> {
    this.loading = true;
    this.loadError = '';
    this.cdr.markForCheck();
    try {
      const [players, bans, audit, notice] = await Promise.all([
        this.gm.players(),
        this.gm.bannedUids(),
        this.gm.auditLog(),
        this.gm.notice(),
      ]);
      this.players = players;
      this.bans = bans;
      this.audit = audit;
      this.notice = notice;
      this.maintenanceOn = notice?.maintenance ?? false;
      this.broadcastText = notice?.message ?? '';
      this.maintenanceNote = notice?.maintenanceNote ?? '';
      this.stats = this.gm.summarise(players, Date.now());
    } catch (err) {
      this.loadError = describe(err);
    }
    this.loading = false;
    this.cdr.markForCheck();
  }

  // ── Table ─────────────────────────────────────────────────────────────

  /** Search, then sort. Recomputed per change-detection pass — the list is small. */
  get filtered(): PlayerDirectoryEntry[] {
    const needle = this.search.trim().toLowerCase();
    const rows = needle
      ? this.players.filter(p =>
          p.displayName.toLowerCase().includes(needle) ||
          p.email.toLowerCase().includes(needle) ||
          p.uid.toLowerCase().includes(needle) ||
          p.rank.toLowerCase().includes(needle))
      : this.players;

    const key = this.sortKey;
    const dir = this.sortDesc ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir;
      }
      return ((av as number) - (bv as number)) * dir;
    });
  }

  get pageRows(): PlayerDirectoryEntry[] {
    const start = this.page * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  get pageCount(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  sortBy(key: SortKey): void {
    if (this.sortKey === key) {
      this.sortDesc = !this.sortDesc;
    } else {
      this.sortKey = key;
      // Numbers open descending (biggest first is what you want from "Gold"),
      // names open ascending. Guessing wrong here costs a click every time.
      this.sortDesc = key !== 'displayName' && key !== 'rank';
    }
    this.page = 0;
  }

  onSearch(): void {
    this.page = 0;
  }

  prevPage(): void { if (this.page > 0) this.page--; }
  nextPage(): void { if (this.page < this.pageCount - 1) this.page++; }

  isBanned(uid: string): boolean {
    return this.bans.has(uid);
  }

  // ── Detail drawer ─────────────────────────────────────────────────────

  async open(player: PlayerDirectoryEntry): Promise<void> {
    this.selected = player;
    this.profile = null;
    this.profileError = '';
    this.profileLoading = true;
    this.grantAmount = null;
    this.banReason = this.bans.get(player.uid)?.reason ?? '';
    this.cdr.markForCheck();
    try {
      this.profile = await this.gm.profile(player.uid);
    } catch (err) {
      this.profileError = describe(err);
    }
    this.profileLoading = false;
    this.cdr.markForCheck();
  }

  close(): void {
    this.selected = null;
    this.profile = null;
    this.cdr.markForCheck();
  }

  // ── Actions ───────────────────────────────────────────────────────────

  askGrantGold(): void {
    const player = this.selected;
    const amount = Math.floor(this.grantAmount ?? 0);
    if (!player || !Number.isFinite(amount) || amount <= 0) return;
    this.ask({
      title: 'Grant Gold',
      body: `Add ${amount.toLocaleString('en-US')} Gold to ${player.displayName}. `
        + 'This is written as a credit in the ledger’s operation log, so it lands '
        + 'on every device they play on and survives every future sync.',
      confirmLabel: `Grant ${amount.toLocaleString('en-US')} Gold`,
      severity: 'normal',
      guardWord: '',
      run: async () => {
        const balance = await this.gm.grantGold(player.uid, player.displayName, amount);
        return `Granted. New balance: ${balance.toLocaleString('en-US')} Gold.`;
      },
    });
  }

  askResetStats(): void {
    const player = this.selected;
    if (!player) return;
    this.ask({
      title: 'Reset stats',
      body: `Set ${player.displayName}’s XP, level and Gold back to zero. `
        + 'Inventory, quests and achievements are left alone. '
        + 'The Gold reset holds on every device. The XP reset holds against the '
        + 'account, but a device that is still signed in with the old total will '
        + 'push it back on its next sync — progression merges by keeping the '
        + 'larger number, and it cannot tell an admin reset from a stale phone. '
        + 'Use Full Reset when it has to stick.',
      confirmLabel: 'Reset stats',
      severity: 'normal',
      guardWord: '',
      run: async () => {
        await this.gm.resetStats(player.uid, player.displayName);
        return 'Stats reset.';
      },
    });
  }

  askResetInventory(): void {
    const player = this.selected;
    if (!player) return;
    this.ask({
      title: 'Reset inventory',
      body: `Clear every item ${player.displayName} owns. Each one is written as `
        + 'a deletion the save already understands, so the items stay gone on '
        + 'every device rather than reappearing at the next sync. '
        + 'Gold, XP and quests are untouched.',
      confirmLabel: 'Clear inventory',
      severity: 'normal',
      guardWord: '',
      run: async () => {
        const removed = await this.gm.resetInventory(player.uid, player.displayName);
        return `Cleared ${removed} item${removed === 1 ? '' : 's'}.`;
      },
    });
  }

  askFullReset(): void {
    const player = this.selected;
    if (!player) return;
    this.ask({
      title: 'Full reset',
      body: `Delete ${player.displayName}’s entire save — Gold, XP, `
        + 'inventory, quests, lore, achievements, everything — and mark the '
        + 'account wiped so every device they are signed in on wipes itself too. '
        + 'This is the only action that cannot be undone by a device pushing its '
        + 'copy back, and it cannot be undone by you either.',
      confirmLabel: 'Wipe this account',
      severity: 'extreme',
      guardWord: player.displayName,
      run: async () => {
        await this.gm.fullReset(player.uid, player.displayName);
        this.close();
        return 'Account wiped.';
      },
    });
  }

  askBan(): void {
    const player = this.selected;
    if (!player) return;
    const reason = this.banReason.trim();
    this.ask({
      title: 'Ban account',
      body: `Ban ${player.displayName}. They will see a notice with the reason `
        + 'and the database will refuse every save they attempt. Their progress '
        + 'is kept, not deleted.'
        + (reason ? '' : ' No reason has been entered — they will be told one was not recorded.'),
      confirmLabel: 'Ban',
      severity: 'normal',
      guardWord: '',
      run: async () => {
        await this.gm.ban(player.uid, player.displayName, reason);
        await this.refreshBans();
        return 'Banned.';
      },
    });
  }

  askUnban(): void {
    const player = this.selected;
    if (!player) return;
    this.ask({
      title: 'Lift ban',
      body: `Let ${player.displayName} save again. The account keeps a record `
        + 'that it was once banned.',
      confirmLabel: 'Lift ban',
      severity: 'normal',
      guardWord: '',
      run: async () => {
        await this.gm.unban(player.uid, player.displayName);
        await this.refreshBans();
        return 'Ban lifted.';
      },
    });
  }

  askSaveNotice(): void {
    const message = this.broadcastText.trim();
    const maintenance = this.maintenanceOn;
    const note = this.maintenanceNote.trim();
    this.ask({
      title: maintenance ? 'Turn on maintenance warning' : message ? 'Broadcast announcement' : 'Clear notice',
      body: maintenance
        ? 'Every visitor will see a maintenance warning above the page.'
        : message
          ? `Every visitor will see: “${message}”`
          : 'The announcement strip will stop appearing.',
      confirmLabel: 'Publish',
      severity: 'normal',
      guardWord: '',
      run: async () => {
        await this.gm.setNotice({ message, maintenance, maintenanceNote: note });
        this.notice = await this.gm.notice();
        // Visitors already holding a cached copy keep it until their own TTL
        // expires; nothing here can reach into their localStorage. Saying so
        // in the result line is more useful than implying it is instant.
        return 'Published. Visitors see it within five minutes.';
      },
    });
  }

  askResetDailyQuests(): void {
    const count = this.players.length;
    this.ask({
      title: 'Reset daily quests',
      body: `Clear today’s daily quest claims for all ${count} known players, `
        + 'so everybody can claim them again. This reads and rewrites one document '
        + `per player — ${count} reads and up to ${count} writes. `
        + 'Emergency use: it exists for the day a quest ships broken, not for tuning.',
      confirmLabel: 'Reset daily quests',
      severity: 'extreme',
      guardWord: 'RESET DAILIES',
      run: async () => {
        const touched = await this.gm.resetDailyQuests(this.players);
        return `Reset dailies for ${touched} player${touched === 1 ? '' : 's'}.`;
      },
    });
  }

  askPurgeLeases(): void {
    const count = this.players.length;
    this.ask({
      title: 'Purge expired device leases',
      body: 'Delete every write lease whose heartbeat has stopped. A stale lease '
        + 'makes a player’s other device sit in read-only mode until it times '
        + `out on its own. Reads one document per player — ${count} reads.`,
      confirmLabel: 'Purge stale leases',
      severity: 'normal',
      guardWord: '',
      run: async () => {
        const purged = await this.gm.purgeExpiredLeases(this.players);
        return purged
          ? `Purged ${purged} stale lease${purged === 1 ? '' : 's'}.`
          : 'No stale leases found.';
      },
    });
  }

  // ── Confirmation plumbing ─────────────────────────────────────────────

  private ask(action: PendingAction): void {
    this.pending = action;
    this.guardTyped = '';
    this.cdr.markForCheck();
  }

  cancel(): void {
    this.pending = null;
    this.guardTyped = '';
    this.cdr.markForCheck();
  }

  /** True when an 'extreme' action's guard word has been typed exactly. */
  get armed(): boolean {
    if (!this.pending) return false;
    if (this.pending.severity !== 'extreme') return true;
    return this.guardTyped.trim() === this.pending.guardWord;
  }

  async confirm(): Promise<void> {
    const action = this.pending;
    if (!action || !this.armed || this.busy) return;
    this.busy = true;
    this.cdr.markForCheck();
    try {
      this.flash = await action.run();
      // The directory row and the profile on screen are both now stale in at
      // least one field. Re-reading the whole console is the cheap, obviously
      // correct move — every read here is a single collection scan.
      await this.reload();
      if (this.selected) {
        const fresh = this.players.find(p => p.uid === this.selected!.uid);
        if (fresh) await this.open(fresh);
      }
    } catch (err) {
      this.flash = `Failed: ${describe(err)}`;
    }
    this.busy = false;
    this.pending = null;
    this.guardTyped = '';
    this.cdr.markForCheck();
  }

  private async refreshBans(): Promise<void> {
    this.bans = await this.gm.bannedUids();
  }

  // ── Formatting ────────────────────────────────────────────────────────

  num(n: number | null | undefined): string {
    return n === null || n === undefined ? '—' : Math.round(n).toLocaleString('en-US');
  }

  ago(ms: number | null | undefined): string {
    if (!ms) return '—';
    const secs = Math.floor((Date.now() - ms) / 1000);
    if (secs < 60) return 'just now';
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    const days = Math.floor(secs / 86400);
    if (days < 30) return `${days}d ago`;
    return new Date(ms).toISOString().slice(0, 10);
  }

  /** Short uid for the table — the full one is on the profile. */
  shortUid(uid: string): string {
    return uid.length > 12 ? `${uid.slice(0, 6)}…${uid.slice(-4)}` : uid;
  }

  /** How many items a profile's inventory holds, without unpacking it in the template. */
  itemCount(profile: PlayerProfile | null): number {
    const records = profile?.inventory?.['records'];
    return Array.isArray(records) ? records.length : 0;
  }

  /** Equipped slot → item id, for the profile's loadout list. */
  equipped(profile: PlayerProfile | null): { slot: string; id: string }[] {
    const raw = profile?.ledger?.['equipped'];
    if (typeof raw !== 'object' || raw === null) return [];
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, id]) => typeof id === 'string' && id.length > 0)
      .map(([slot, id]) => ({ slot, id: id as string }));
  }

  /** A ledger or progression field, read defensively for the profile readout. */
  field(source: Record<string, unknown> | null | undefined, key: string): number {
    const value = source?.[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  text(source: Record<string, unknown> | null | undefined, key: string): string {
    const value = source?.[key];
    return typeof value === 'string' ? value : '—';
  }

  /**
   * An ISO instant as a plain date.
   *
   * `createdAt` is stored as a full ISO string, and rendering it raw put
   * "2026-01-04T10:00:00.000Z" in a definition list next to "12 days" — the
   * only field on the profile a person had to parse rather than read. The time
   * of day somebody first struck the Flame is not a fact anybody needs.
   */
  date(source: Record<string, unknown> | null | undefined, key: string): string {
    const value = source?.[key];
    if (typeof value !== 'string') return '—';
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return '—';
    return new Date(ms).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  trackPlayer = (_: number, p: PlayerDirectoryEntry) => p.uid;
  trackAudit = (_: number, a: AuditEntry) => a.id ?? String(a.at);
  trackSlot = (_: number, s: { slot: string }) => s.slot;
}

/**
 * Turn a Firestore rejection into something worth reading.
 *
 * `permission-denied` is the one that will actually happen, and it has exactly
 * one likely cause on this page: the rules granting the owner access to
 * `users/**` have not been deployed yet. Saying that is worth more than the
 * SDK's own message, which says only that the operation was denied.
 */
function describe(err: unknown): string {
  const code = (err as { code?: string } | null)?.code ?? '';
  if (code === 'permission-denied') {
    return 'Permission denied. Deploy the rules with `firebase deploy --only firestore:rules` — '
      + 'the owner grants on users/**, player-directory, admin-bans and admin-logs are new.';
  }
  if (code === 'unavailable') {
    return 'Firestore is unreachable. Check the connection and try again.';
  }
  const message = (err as { message?: string } | null)?.message;
  return message || 'Unknown error.';
}
