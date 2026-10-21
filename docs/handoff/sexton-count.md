# The Sexton's Count — Ember Isle's first story chain (2026-10-21)

Design: `docs/design/design-bible.md` §9.3 (as built) and §10 item 8. Lore: `docs/world/lore-addendum.md`.

## What the player does

1. **Sexton Aldous Wren** (Seamworks) has a "!" — he offers *The Sexton's Count* first, his town tasks one
   "Something else" away. Take it.
2. **Read the stones** — three chalk-marked graves in the Hushed Barrow (west of town; a pale glint over each unread one).
3. **The page in the dark** — at night or under an eclipse, the barrow's Nightroad opens; on its nook lies a ledger page
   that is only there in the dark (hidden and unusable by day).
4. **The one who walks the rows** — *Hollis the Row-Walker* (a unique Bone Walker pack) rises at the plot while this is
   the step; laying it down gives Barrow Key 1.
5. **Barrow Door 1** — the plot's new crypt door leads down to `hushed-barrow-1`; the locked door opens with the key.
6. **The forty-first** — the Uncounted (new boss, level 7) guards the grave; once it falls, read the grave: the cursed
   *Sexton's Lost Cowl* (Hollow Ward) lands in the satchel under a fixed id. Back at Wren ("?"): lay it to rest (free
   cleanse + extra Gold) or keep it cursed.

Lumvesh (Seek) points at the current step's place (after a fallen purse). The quest scroll shows a row (step n/6) that
opens the journal; Wren's talk window has a Journal button too.

## Where it lives

- `src/app/shared/sexton/` — the chain's model (facts → step, events, journal, seek target, pay), service (records facts,
  hands over the cowl, pays receipt-first), i18n (EN + ES), the journal component (own stylesheet).
- Save: the town tasks blob `godforge-town-tasks` v3 adds `chains: { id: { fact: firstReachedAt } }` — per character via
  the gateway, merged as a union (earlier time wins), so a merge never sends a Keeper back a step; a choice made
  differently on two devices resolves to the earlier one.
- `src/app/play/td/td-sexton.ts` — placement (stones, page, Row-Walker spot, vault keyhole/grave) and pixels.
  `td-engine.ts`: stalls `sexton:*`, `setSextonCount`, `onSexton`, the Row-Walker, the door, the Seek target.
- `src/app/play/td/maps/hushed-barrow.ts` — the vault floor; `td-level.ts` gains locked doors (`door` legend) and a
  `grave` object; `continent.ts` ways gain `at` (the barrow door stands where the plot's stone stood).
- `td-mobs.ts` — `the-uncounted`; `boss-uniques.ts` — `unique-sextons-lost-cowl` (+2 light).

## Tests

- Karma: `sexton-count.model.spec.ts` (step machine), `sexton-count.service.spec.ts` (gateway, cowl, pay once, merge),
  `td-sexton.spec.ts` (door, placement, seek).
- E2E: `e2e/td-sexton.spec.ts` walks the whole chain with `?fxsexton=1` (automation only: `window.__tdSexton.to/smite/seek`).
  Screenshots: `docs/handoff/cozy-ui/sexton-*.jpg`.

## Not built

The Hollow Footsteps leading back to the vault; a key ring inventory item (Barrow Key 1 is a chain fact shown in the
journal); the Barrow's lantern as a house decoration; Margin Notes.
