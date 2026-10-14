# UI clean pass — subtract, don't add (roadmap item 1)

The owner said: "the slate, the inventory, going to a slot machine there is just too much, look at the
Diablo 2 inventory, it's just the slots and worn items". This pass takes things off screens. No feature
was removed: everything that left a first screen now sits one tap away. Screenshots (before/after, 390×844
and 1280×800) are in `docs/handoff/ui-clean-pass/`.

## The Satchel (in-world inventory, `play/side-scroller.component.*`)

Opening it now shows two things: the worn-items paper doll and the slot grid.

| Was | Now | Why |
|---|---|---|
| "SATCHEL" kicker + "What you carry" title + a big `9/40` + `9 / 40 SLOTS` + bar | One row: **Satchel** · `9 / 40 slots` with a thin bar · **Stats** · Close | The count was printed twice and the header used three lines. |
| Eight worn wells as a row of tabs (scrolled sideways on a phone, cutting off "Legs") | A **paper doll**: trinket/head on top, weapon/chest/off-hand, hands/legs/feet; charms add a ring of three when you own one. A rarity pip tops each filled well. | It reads as a body (Diablo II), and nothing scrolls sideways. |
| The Keeper stat sheet always open between the doll and the grid | Behind **Stats** (the one details affordance), with the "N more in your Vault" note | It pushed the grid down to a single row on desktop. |
| A pocket list that stopped after the last item | Pockets, then **empty cells up to the satchel's cap** (`.cell-empty`, aria-hidden) | The bag reads as a fixed grid of slots; you can see the space you have. |
| The item slip always showing (it auto-picked the first pocket, or said "Choose a pocket…") | **The item card appears only on a tap.** Tap again, or ×, to put it away. The name and frame are in the item's rarity colour; stats and the wear-compare stay. | Nothing to read until you ask. |
| Equip/Stow/Open and "Send to Vault" as two equal framed buttons | **One primary button** (Equip, Stow or Open) and "Send to Vault" as a quiet text action | One primary action per panel. |
| Tapping an empty worn well opened a card saying "Nothing rests in this place." | It closes the card instead | An empty card is clutter. |

Removed i18n keys: `play.hud.book.title`, `play.hud.book.choose`. Added `play.hud.book.statsShort` (EN+ES).
Unchanged: tap-to-equip (pick a pocket → Equip), Stow, Send to Vault (×N groups), crates' Open, the
`I` key, Escape, focus return to the clasp, every `aria-label` the specs read (`.pocket[aria-label]`,
`.capacity span`, `.slip h3`, `.book-close`).

### The character page loadout (`shared/rpg/equipment-panel.*`)

The doll and the charm row stay; the totals line, the live stat sheet, the Build card and the charm
totals/hint moved into one **Keeper stats** fold (`details.ld__more`) under them. The slot picker
(tap a well) is untouched. No Angular logic changed.

## The Mirror Slate (`shared/slate/*`)

| Was | Now |
|---|---|
| Opened on the last tab, which by default was Tables → a second row of game tabs → a rules note → the Reels already loaded | Opens on a **home face**: four big table tiles (Reels, Rune Drop, Seam Sweeper, Eclipse Ascent), then Homestead (its Gold/s, and a dot when something is waiting) and, at tier II, Map & bounties. One tap reaches the slot machine. |
| Two rows of tabs on every screen | Each screen has **Back** and its own title, nothing else above it. |
| Homestead: purse, rate, a Collect card (disabled when empty), next building, Crew card, "In the world" list | Purse and rate, the Collect card only when something is waiting, the one Build button. Crew and "where things are" sit under one fold. |
| Desktop: an 800px bezel filling the screen | On the home face the bezel hugs the tiles (640px, auto height). |

The game component still loads into the always-present `#gameHost` (now only when a table is tapped,
not on every open). The remembered last tab (`eclipse-slate-view` in localStorage) is gone, because
the Slate always opens on home now. The rules note "Same odds, same bet limits…" moved into Details.
Added `slate.back`, `slate.factory.more` (EN+ES). The tiles' glyphs are procedural CSS until the
Slate art lands.

## The sweep

- **Station panels (all of them, via `station-ui/station-shell`)**: in the world (`showTitle=false`)
  the purpose sentence moved from beside the wallet into the Details drawer. The panel head already
  names the place; the sentence wrapped to three lines on phones (the Vendor, the Reels).
- **Place panel head on phones**: "Open full page" and the `Esc` hint are hidden under 900px. The panel
  already fills the screen there, and the link made station titles wrap to two lines.
- **Glim's talk card**: Close is now a quiet text action, so Glim's answers are the only framed buttons.
- **Rift Anchor sheet**: the anchor rows are sentence-case in the lore face at 52px instead of
  shouted uppercase Orbitron that wrapped to two lines on a phone.

Colours and fonts are existing tokens only; `check-ds-adherence` is at baseline.

## Tests touched

`e2e/play-slate.spec.ts`: `.sl-tab`/`.sl-game` became the home tiles (`.sl-tile[data-game]`,
`.sl-tile[data-face]`) and `.sl-back`. It also asserts the home face (4 tables + Homestead, no map at
tier I) and the 44px tile and Back sizes on a phone. No other spec's selectors changed.

## Left alone, on purpose

- The station kit's anatomy (tabs → skill strip → list | detail → requirements → action row). It is
  the owner-approved MapleStory journal. Only its in-world purpose line moved.
- The desktop HUD tally (Coins/Ore/Ember/Edge/Damage/Defeated). Specs read it, and it is the
  desktop-only readout. A candidate for the next pass.
- `play/engine/sprite.ts` and the Keeper renderer (the parallel character-creator work).
