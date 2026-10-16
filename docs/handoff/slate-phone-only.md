# The Slate is just a phone

Owner: the window around the phone (title bar, x, dashed frame, "What the Slate is" footer) goes; the phone must keep one
size on every page; every app opens inside it.

- **No window.** `.place--slate` is now a veil (light dim, blur on desktop) with the `.phone` floating on it
  (`shared/slate/slate.component.*`). The place head is hidden. Put away: the phone's home bar (from home), a pull down on
  the status bar / home bar, Escape or P, a tap on the dim. In an app the home bar returns to the home screen first.
- **Fixed size.** Portrait (phone upright, desktop, tablet): 9 : 19.5, `min(380px, veil width, height-fitted)`.
  Landscape (`orientation: landscape` and `max-height: 520px`): the same phone turned on its side (19.5 : 9), home key on
  the right edge. Sized with `cqw/cqh` from the veil (`container-type: size`). Content scrolls inside the screen.
- **Apps inside.** Pets (`app-pet-sheet`, frame stripped) and the Codex (built through `PANEL_REGISTRY.codex`) now live in
  the screen; `SlateService.launch$` is gone, replaced by `close$` and `petFelt$` (the play view reacts). Hosted games and
  the Codex that lay out by viewport width are zoomed down to fit the screen (`fit()`); the Codex also gets its small-screen
  rules under `:host-context(.sl-codex)`. "What the Slate is" is the About app (lore, rules). Scan "hold the glass up" still
  puts the phone away and the HUD Slate button pulses with the warmth (the small HUD widget).
- **Tests.** `e2e/play-slate-phone.spec.ts`: at 390x844, 844x390, 1280x800 the phone box is identical on home page 1, page 2
  and all 11 apps; the app content is inside the screen rect, no sideways scroll; put-away routes. Other slate specs updated.
- Screenshots: `docs/handoff/slate-phone-only/` (`before-*` from the world-clock handoff, the rest from the new run).
