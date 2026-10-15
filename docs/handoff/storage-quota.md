# Storage quota: "That pickup could not be saved"

**Owner bug (2026-10-15, real phone, heavy play).** Every pickup said `play.hud.msg.pickupFailed`.

## Root cause

- **Mechanism.** `InventoryService.save()` writes the ledger and then reads it back to check the write. `GameStateGateway.writeRaw` swallowed the `setItem` QuotaExceededError, so the read-back saw the old blob and every grant rolled back.
- **What filled the disk.** `godforge-economy.ops`. `EconomyService.flush()` appends a `credit-gold` op on every 5-second persist, which is about 720 ops (~260 KB of UTF-16) per hour of play.
- **Why it never shrank.** The only folder for that log is the cloud commit (`acknowledgeAndMaybeCompact`).
  - A signed-out device never runs it.
  - A signed-in device folds only after every device seen in the last 30 days has acknowledged the last checkpoint.
- **How long it takes.** A signed-out phone hits WebKit's 5 MB quota after roughly 19 hours of play.

## Measured: heavy play through the real services (dev build, `ng` global)

The run covered four hours of credits, 6,000 pickups, five Delve cores 60% dug, and 1,200 far sectors explored. Sizes are UTF-16 bytes, the way WebKit counts its quota.

| key | before | after |
|---|---:|---:|
| `godforge-economy` | **1,038.5 KB** (2,880 ops, +260 KB/h) | **2.6 KB** (1 op) |
| `godforge-delve` | 232.1 KB | 232.1 KB |
| `godforge-inventory` | 79.8 KB | 79.8 KB |
| 32 region slots (`godforge-delve-r*`, `godforge-rift-*-r*`) | 35.4 KB each | 35.4 KB each |
| **total** | **2,275.7 KB** (growing) | **1,239.7 KB** (flat) |

The before run gave `godforge-economy` growth of 130 KB per simulated 30 minutes, perfectly linear.

The budget test models a full year (`STORAGE_TABLE=1 node --test scripts/storage-budget.test.cjs`). It comes to about 1.6 MB:

| key | size |
|---|---:|
| inventory (200 gear, full tombstones) | 406 KB |
| activity (at its cap) | 244 KB |
| `godforge-delve` | 175 KB |
| 32 region slots | 11 KB each |
| economy | 7.6 KB |
| everything else | under 80 KB each |

The budget is 2 MB, which is 40% of the quota.

## What changed

1. **Credits coalesce** (`economy.service.ts` `creditOp`).
   - A credit grows the newest credit op of its kind, but only while that op has never left the device. The test is `GameStateGateway.sendCount`, which every push and every sign-in pull bumps before reading the blobs.
   - Any other op seals the credits before it, so replay order is unchanged.
   - When signed in, the economy also persists every 30 s instead of 5 s (`PERSIST_INTERVAL_SYNCED_MS`). Each push seals one op. Purchases still flush at once, and idle Gold re-settles from `lastIdleAt`.
2. **A never-synced log folds itself** (`economy-ops.ts` `compactLocalLedger`, `neverSynced`).
   - This runs only for a ledger with no checkpoint, no acks, no other device seen, and only its own ops.
   - It folds past 128 ops and keeps 16.
   - `pickOrigin` now merges two origins whose watermarks name disjoint devices conservatively, as two legacy saves are merged, and keeps both watermarks. That way a locally folded phone signing into a cloud-folded account replays nothing twice.
3. **This also migrates existing saves.** The first persist after the update folds an existing bloated never-synced log, which frees the room. The e2e test covers this with a 6,000-op log on a full disk.
4. **A full disk no longer refuses play** (`game-state.gateway.ts` `persist`/`spilled`).
   - On a quota error the gateway frees the merge backup and the `fs-cache:*` read cache, then retries.
   - If the write still fails, it holds the value in memory. Reads see it and the cloud queue sends it.
   - Every later successful write retries the held values (`retrySpilled`).
   - Grant ids stay the idempotency key, so a retried pickup lands once.
   - `pickupFailed` stays, because a non-serialisable blob can still fail, but it is no longer reachable through quota.
5. **The merge backup holds only what the merge moved.** `godforge-save-backup` used to copy every blob on every attach and every tab refocus, which doubled the save on disk.
6. **`godforge-bank-seen` is pruned.** It drops gear ids no longer held and keeps stack ids.
7. **Monitor** (`storage-health.service.ts`, `storage-usage.ts`).
   - Dev builds log a per-key table and `navigator.storage.estimate`.
   - The play HUD tells the player once when the disk passes 80%, and again when anything is held in memory only. These are three lazy `hud.i18n` keys in EN and ES.

## Tests

- `scripts/storage-budget.test.cjs`: a year of heavy play stays under budget, the economy and inventory histories are bounded, and the old behaviour overflows the quota in 36 days.
- `economy-local-compact.spec.ts`:
  - The fold keeps the balance.
  - Synced ledgers never fold locally.
  - A stale self-copy merges exactly.
  - Disjoint lineages merge commutatively and idempotently.
  - 720 persists produce 1 op, a spend seals, and a sent op is never edited.
- `game-state.quota.spec.ts`:
  - A `setItem` throw keeps the value readable.
  - Reclaim drops the backup and retries.
  - Held values reach the disk when there is room.
  - A pickup lands on a full disk exactly once.
- `e2e/play-storage-quota.spec.ts`:
  - The real Chromium quota is filled, then the Keeper digs. Blocks land, the HUD names the cause, and after room returns the save reaches the disk and survives a reload.
  - A bloated log is folded on load, and the pickups are written to disk while the filler is still in place.

## Not done / follow-ups

- **Signed-in, compaction blocked.** The fold still waits on every device seen in 30 days to acknowledge the checkpoint, so a phone and a rarely used PC grow by about 120 ops an hour (~43 KB/h) between PC visits.
  - The Firestore document's 1 MiB cap is the harder ceiling there.
  - The ack barrier looks over-strict, because the per-device `applied` watermark already stops double-applying. It is worth a careful review before relaxing.
- **Delve region slots.** 32 synced slots live in localStorage, with up to ~190 KB per fully dug region. They are fine at realistic dig counts. If the Delve grows, move the slots behind IndexedDB and have the gateway push from there.
- Inventory gear records and the 512 tombstones are legitimate state, at about 400 KB for a heavy bag.
