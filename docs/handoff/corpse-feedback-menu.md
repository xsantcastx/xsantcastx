# Corpses, Send feedback, the Game Menu, and the peer-tap fix (2026-10-21)

- **Corpses** (`td-corpse.ts`, `td-corpse-art.ts`): a fall leaves its creature's own sprite flattened and darkened; fresh 50 s, rotting to 130 s (flies, none under reduced motion), bones to 210 s, gone; bosses twice as long; cap 40. Loot lies beside it tagged `Drop.corpse`; walk-over pickup unchanged; E or a tap opens the window. Co-op: every member lays a corpse from the host's kill event (`coopFell`); loot stays personal.
- **Send feedback** (`shared/feedback/`): Firestore `player-feedback` (signed-in only), one per minute via `player-feedback-limits/{uid}` stamp in the same batch. Rules need deploying. GM console: Logs view, next to Player reports.
- **Game Menu** (Esc / Menu button): replaces the Map's footer; the Map shows only the map. `e2e/play-helpers.ts openMenu(page)`.
- **Tap fix**: the HUD's click handler ran the side view's station pick after the top-down engine had already handled the tap; it now skips top-down. The engine weighs Keeper / corpse / stall by distance.
