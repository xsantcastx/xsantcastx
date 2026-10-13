# Watch-list cleanup, round 2

Four items from the "Known issues / watch list" in `docs/roadmap/world-plan.md`.
Two needed code, one was stale, and one needs the owner.

## 1. Paper-doll sockets on phones: fixed

**What was wrong.** A socket on the Keeper is 17% of the figure wide. Measured at
390×844 that is 35px, 33px at 375 and 39px at 1280. Sockets were aria-hidden and
`pointer-events: none`, so tapping the gear you could see did nothing. Only the
wells beside the figure responded. Those wells were already 56–64px.

**The change.** A worn socket (`.ld__socket-frame--worn`) now calls the same
`onSlotClick` as its well. Its hit area is an invisible `::after` pad,
`max(100%, 44px)`, centred on the medallion. The art does not change, so desktop
looks the same. Empty sockets and "leaving" ghosts still ignore the pointer. The
wells are still the accessible controls, so the sockets stay aria-hidden.

**Known trade-off.** At phone width the pads of neighbouring sockets overlap:
chest, trinket and hands are about 32px apart. The pads are 44px across (22px
radius), so no pad reaches another socket's centre. The overlap only decides which
socket a tap near an edge belongs to.

**Test.** `e2e/loadout-socket-targets.spec.ts` seeds seven worn artifacts and runs
at 375 and 390. It checks that:
- each pad is at least 44×44px;
- each socket's centre lands on its own socket (the topmost loadout element there);
- every well is at least 44px;
- the page has no horizontal scroll;
- tapping the head socket opens the Head slot.

It passes in chromium and webkit (4/4).

**Seen in passing, not fixed.** In WebKit at 375–390px, the NPC bubble
(`.npc__bubble`) and the forge-flame toggle (`.ff__mode`) can sit over the lower
sockets, depending on scroll. The first-visit achievement drop (`.ad--on`) also
covers the doll until it is dismissed. Both are page-level fixed chrome; see the
memory note on fixed corner widgets colliding. The spec dismisses the drop, and
its hit test only looks at loadout elements.

## 2. "New creatures still draw with the Rivet Maw rig": stale

The engine-visuals work is on main (`378269a`, "per-creature rigs"). In
`src/app/play/engine/creature-rigs.ts`:
- Prism Forager, Ephemeris Leech, Mirror Substitute, Rootglass Stag and Rivet Maw
  each have their own rig.
- `creatureRigFor` gives unknown keys `GENERIC_CREATURE`, not the Maw. The engine
  test "each painted creature gets its own rig" checks this.

Two cases still borrow a body, both on purpose:
- **Magma Maw** uses the Rivet Maw painting and rig.
- **Rune Warden** uses the Mirror Substitute painting and rig.

They borrow through `ART_ALIAS` in `src/app/shared/art/art.ts` and the matching
entries in `CREATURE_RIGS`. What's left is art: when a painting lands, give that
creature its own `RigSpec` and pose driver and remove its alias row.

In `engine.ts#creature`, the Rivet Maw also stands in for any creature until that
creature's painting has loaded. That is a loading fallback, not a missing rig.

No code changed for this item. The watch-list line has been rewritten.

## 3. Orphaned strings in the eager translation table: pruned

`node scripts/check-i18n-keys.js` listed 20 keys that were declared but never
referenced. I confirmed each one with a literal grep across `src/`, `e2e/` and
`scripts/`, specs included:
- 16 `market.*` keys left by the redesign: title, tagline, rate, categories,
  owned.n, filteredCount, pages, page, prev, next, buy (the bare key; the
  `market.buy.<code>` family is live), and state.buy/locked/held/owned/running.
- 4 nav and hero leftovers: `gfnav.world`, `gfnav.hint.world`,
  `gfnav.section.more`, `godforge.hero.cta`.

After the prune, the check reports 1494 declared, 1494 referenced and 0
unreferenced.

**Checked in the browser.** A throwaway Playwright walk covered 11 routes (`/`,
world, character, codex, exchange, grand-exchange, leaderboards, market, play,
sanctum, gambler) in EN and ES. It asserted that no text node or
aria-label/title/placeholder matched the raw-key pattern. All 22 runs passed.

**Bundle.** The initial chunk holding the table went from 94.57 to 93.19 kB raw
(24.65 to 24.32 kB transfer). That is **-1.38 kB raw, about -0.33 kB transfer**,
for 20 short strings.

## 4. "Daily Tool Generation Pipeline" fails on main: diagnosed, not fixable here

I read the logs with `gh run list` and `gh run view --log-failed`. The last
success was 2026-03-25. Every scheduled run since 2026-03-26 has failed, about
200 in a row, in about 25s. The failure is in agent 1 (research):
`pipeline/agents/research.py` → `call_claude_json` → Anthropic API **400
invalid_request_error: "Your credit balance is too low to access the Anthropic
API"**. The first failing run (`23586755799`) and the latest (`38229229648`) show
the same error.

There is a second problem, which does not stop the run: the Reddit collector gets
403 "Blocked" on `r/webdev`. The agent already falls back to "pain points from
knowledge", so this one is not fatal.

Nothing in the workflow or the script can fix this. The account needs credit. The
pipeline also generates *tools*, a surface the game cutover retired, so the
owner's choice is one of:
- top up the API credit; or
- disable the workflow (`gh workflow disable "Daily Tool Generation Pipeline"`).
  That is a remote change I did not make.

## Gates

See the final report in the session for exact results. Run on this branch: tsc,
the engine/homestead/home-forge node tests, DS adherence, the i18n check, the nav
audit, `ng build`, CSP hashes, the loadout Karma specs, and Playwright with
`PW_PORT=4295`.
