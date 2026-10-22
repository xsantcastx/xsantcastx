# Agent brief — read this instead of long prompts

You are building **Eclipse Realms** (Angular 21 SSR, Firebase). The task prompt tells you WHAT; this file is HOW.
Keep token use lean: read the handoff summaries for the systems you touch (`docs/handoff/<name>.md`), not whole
design bibles, unless the task says "your spec". Don't re-read large files you've already read; grep first.
Find files via `docs/agents/SYSTEMS.md` before searching.

## Setup (once)
1. If your branch has no commits: `git fetch origin && git reset --hard origin/main` (or the base the task names).
2. `ln -s "/Users/xsantcastx/Documents/1. Projects/xsantcastx/node_modules" node_modules` if missing.
3. Before any gate, move untracked sync duplicates out of the tree (they make local checks lie):
   `find src -name "* [0-9].*" -type f` minus `git ls-files` → move to your scratchpad. Never `git add` "<name> 2.*".

## Rules (owner)
Everything needs meaning (source, use, lore, visible) — `npm run -s check:meaning`. Terraria is the art/feel reference.
Gold only, never real money. Stations: one plain primary action. Phones: ≥44px, nothing over the centre 50%.
Lore is pre-approved: write it, ship it, log it in `docs/world/lore-addendum.md` ("shipped — owner reviews in play").
**The Dungeon Master owns the story** (owner rule, 2026-10-22). Before writing any quest, NPC, dialogue, unique, set,
zone or lore, read `docs/world/canon.md` (the canon bible) and `docs/world/campaign.md` (the arc and the "next to
build" queue). Build quests from that queue, and reuse canon names, motives and planted clues, never inventing new
ones that clash. Record anything new in canon.md's registries. If something must contradict canon, stop and flag it
in your report. The DM role is `~/.claude/agents/dungeon-master.md`; the coordinator has it review lore-heavy branches.
**Zones feel like a dark D&D dungeon** (owner, 2026-10-22); towns and hearths stay cozy as the safe light. Making or
editing a zone? Its entry in canon.md's **Zone bible** is your brief: mood, lighting, set dressing, sounds, encounters
and hidden rewards.
New player text goes in LAZY i18n tables, EN + ES. Saved state only through the save gateway, merge-safe.
Never push, deploy, or touch `firestore.rules`, `functions/`, or market flags.

## Menus (owner rule, 2026-10-15; cozy look 2026-10-19 — every menu, new or old)
**Cozy wooden windows, simple, no scrolling** (references: `docs/design/refs/cozy/`, handoff `docs/handoff/cozy-ui.md`). Every
menu is ONE window cut from the town's timber: a dark-plank plate, a square wood frame (seam, lit bevel, timber band, dark
outline — `--px-win-rim`), brass for the one primary button, cream lettering, titles in `--font-display`, body in `--font-game`.
The goal is a parchment quest scroll (`.px-parch`). Colours come ONLY from `src/styles/tokens/_cozy.css`; inside a window the
site's obsidian/violet/gold tokens are remapped to wood/brass (side-scroller.component.css), so kits recolour themselves — never
hard-code a hex. No decorative clutter (corner ticks, dashed rules, glow washes). Keep: a plain title, one pixel × (`.px-x`), 44px
targets, and the placement from menus-orientation (portrait sheet, landscape side panel, desktop window). Square corners, 2px
stepped edges, no soft blur, crisp art. Fewer words: one obvious
primary action; explanations live behind a pixel **?** (`.px-help`) that opens a short card, never on the main screen. MapleStory
crafting is the template: a paged icon grid with category tabs, ONE result card (icon + rarity-coloured name, ingredient icons with
have/need green/red), ONE big button. Locked = greyed icon + pixel padlock. **Never a scrolling column for the main task:** the
primary action is in plain view the moment the menu opens at 390x844 and 844x390 (≤2 taps); long lists page with pixel ◀ ▶
(`.px-arrow`) or tabs. Kit: `shared/station-ui` does all of this itself when it sits inside `.place` (the in-world panel); a new
station that uses the kit gets it free. Test: `e2e/play-menus-orientation.spec.ts` (`noScroll: true` on a menu).

## Art (style rule, owner 2026-10-15)
Pixel art, Terraria-crisp: one grid (4 world px per art px; 2 in the Delve), one 1-px outline (`keeper-paint.ts OUTLINE`),
light from the upper left, colours only from the art-bible ramps. Proportions and feel are **chibi, MapleStory-cute**:
people ~31 art px tall, head 15×14 to body ~15 rows (1 : 1–1.3), eyes 2×3 with a white highlight, small mouth, optional
rosy cheeks, tiny hands/feet, soft rounded silhouettes, oversized weapons, hats/helms on the big head. Alive: idle breath,
blinks, bouncy steps, landing squash, a face flash on joy. Creatures: round bodies, big eyes that glare on the wind-up,
still clear threats. Every figure is cached (one frame sheet per KeeperPainter); tags/bubbles anchor on `painter.top`.
Galleries: `node scripts/keeper-gallery.mjs <dir> <prefix>`. Details: `docs/handoff/chibi-keepers.md`.

## The gate (run ONCE at the end, long steps in the background — the disk is slow)
```
npm run -s check:meaning
npx tsc --noEmit -p tsconfig.app.json && npx tsc --noEmit -p tsconfig.spec.json
node --test scripts/seamworks-engine.test.cjs scripts/homestead.test.cjs scripts/home-forge.test.cjs scripts/delve-endless.test.cjs
node scripts/check-ds-adherence.js && node scripts/check-i18n-keys.js && node scripts/audit-nav.js
node scripts/economy-sim.mjs --check && node scripts/combat-sim.mjs --check
npm run build            # initial < 1.85 MB; then: git checkout -- src/sitemap.xml
node scripts/verify-csp-hashes.js
npx ng test --watch=false --browsers=ChromeHeadless --include='<the specs you touched>'
PW_PORT=<your own free port> npx playwright test e2e/play- --project=chromium
```
Run the full play suite once, after your last code change. If one spec fails, rerun just it; if it passes alone, say
so and move on. In specs that assert English copy, `localStorage.setItem('preferred-language','en')` in `beforeEach`.

## Finish
Commit (end messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`), write a short handoff
`docs/handoff/<feature>.md`, update `docs/roadmap/ROADMAP.md`. Final report ≤ 40 lines: branch, head sha, what a
player gets, gate results, anything unverified. Screenshots go in `output/<feature>/` (not committed).
