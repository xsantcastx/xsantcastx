# Save compaction (2026-10-22)

The owner's two big save documents were ~400 KB each in Firestore bytes (≈840 KB as REST JSON), against Firestore's
1 MiB per-document limit. Past it, every save and trade for that character fails. This branch brings both well under
it and keeps them bounded, without changing a single owned item, stack count or Gold.

## Root causes

| Document | What was big | Why |
|---|---|---|
| `progress/inventory` | records 229 KB | 404 items, each ~570 B: long key names, a 36-char device UUID in every revision, ISO dates, lore/name/definition strings repeated per copy. Nothing dead — every record was a real item. |
| | stackOps 66 KB | 256 of 377 ops belonged to a device last seen in August. Devices only fold their *own* ops, so a quiet device's ops stayed forever. |
| | stackFolds 44 KB | 2,048 + 1,583 folded op-id hashes (11-char strings). |
| | tombstones 63 KB | Capped at 512 with no watermark — the cap already evicted tombstones, which let stale records resurrect. |
| `economy/state` | ops 340 KB | 2,105 ops. Folding waits for every device seen in 30 days to ack the checkpoint; the owner's third device stopped one checkpoint short two days ago and held every fold. ~700 ops a day. |
| | origin 23 KB | Every fold copied the ledger's commerce receipts, acks and device clocks into the origin, where nothing reads them. |

## What changed

**Packed cloud format (inventory, `v.version: 3`).** `functions-game/src/trade-core.ts` `packInventory` /
`unpackInventory`: short record keys, revisions as `hlc.device.seq` with a device table, dates as epoch ms, closed
vocabularies as one-letter codes, repeated long strings and stat names through tables, tombstones and stack ops as one
string each, fold hashes as one fixed-width string. Lossless by construction (anything unrecognised is kept verbatim).
localStorage keeps the plain v2 ledger; the gateway encodes on write (`SyncedBlob.encode`) and decodes on read
(`decode`, `fromDoc`). Every reader decodes: `coerceInventoryLedger`, trade-core `readInventory`, keeper-budget
`wornLift` (the Hearth), the GM panel.

**Bounded inventory.** `compactInventoryLedger` runs on every InventoryService save and after every cloud merge
(`mergeInventory` in cloud-save.model.ts):
- own stack ops fold past 64 (unchanged); fold memory 2,048 → 1,024 hashes per device;
- `foldDormantDevices`: a device whose newest op is 14+ days old has its ops folded for it (its ops in any save are a
  prefix of its history, so its later ops are always above the fold);
- `boundTombstones`: tombstones past 30 days or past the cap (now 1,024) are dropped and raise `tombFloor` to
  min(revision.hlc, deletedAt) of the newest dropped one; every live record at or below the new floor is re-stamped
  just above it by the compacting device. The merge refuses any record revision at or below the floor — so a stale
  device can no longer resurrect an item whose tombstone was dropped (it could before, via the cap).
- the size guard: when the packed document passes 400,000 characters it compacts hard (other devices' ops after a day,
  half the tombstones, half the fold memory).

**Economy.** `acknowledgeAndMaybeCompact` folds past `COMPACT_FORCE_AFTER` (256) ops or a 400 KB document even if a
device has not acked (the fold's per-device `applied` watermark already makes a lagging copy safe; the barrier only
bought ordering). Origins are kept lean (`leanOrigin`).

**Merge laws.** `mergeInventoryLedgers` is now a pure join: no pruning inside it (compaction does that), records at or
below the max floor dropped, tombstones at or below it dropped. Karma property tests
(`inventory-compaction.spec.ts`, 300 random triples): commutative, associative, idempotent, packed or plain; a
compacted save merged with any stale copy in either order owns exactly what the uncompacted one would.

**Old clients.** A build from before this cannot read `version: 3` (it parses as empty). `firestore.rules`
`inventoryFormatHolds` refuses a non-packed write to an inventory document that is already packed, so an old tab can
neither overwrite nor shrink the cloud save; its refused write stays queued locally and lands after a reload. `era`
was not touched (bumping it wipes inventories). The economy document's shape is unchanged.

**Server.** trade-core reads both formats and writes back the format it read, so the Function and the Hearth shipped
before the client.

## The stale-device window (the price)

A device that has not synced since before the floor loses, on its next merge, what it holds only at older
revisions: items found offline before the floor, moves and sales made then. The floor trails the newest dropped
tombstone — 30 days, or the cap's worth of deletions (~18 days at the owner's pace). Same window as the economy's
checkpoint. A device that synced since is never affected: its revisions are above every floor it has seen.

## Proof on real saves

`node scripts/save-compaction-check.cjs <inventory.json> <economy.json>` (read-only; REST or plain docs). Runs the
compaction, the pack/unpack round trip and merges against the original in both orders, and fails unless every
record, every stack quantity and the Gold/Essence/upgrades are identical. Results 2026-10-22 in the commit message.

## Deploy order

1. `functions:game` and the Hearth (both read both formats) — done on this branch.
2. `firestore.rules` (inventoryFormatHolds; harmless while nothing is packed) — done on this branch.
3. The client (owner).
