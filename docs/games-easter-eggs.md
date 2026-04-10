# Games & Easter Eggs — Architecture

## Overview

A discovery-based game unlock system layered on top of the existing tool suite.
Users find Easter eggs by doing interesting/unexpected things inside tools.
Each egg unlocks a themed mini-game accessible at `/games`.

---

## System Components

### 1. EasterEggService (`src/app/shared/easter-eggs/easter-egg.service.ts`)
- Master registry: `EASTER_EGGS[]` — 106 eggs defined (4 global + 102 tool-specific)
- State: `discovered: Set<string>` — loaded from localStorage on `init()`
- Persistence: localStorage (`easter-eggs-found`) + Firestore (`easter-eggs/{id}` global counts)
- Public API:
  - `trigger(id)` — mark discovered, show toast, persist, emit on `discovery$`
  - `isFound(id)` — check local state
  - `foundCount` — getter, count of discovered eggs
  - `totalEggs` — getter, total in registry

### 2. EggDiscoveryComponent (`src/app/shared/easter-eggs/egg-discovery.component.ts`)
- Toast notification with glassmorphism styling
- Rarity-based glow colors: cyan (common) → violet (rare) → magenta (epic) → gold (legendary)
- Auto-dismisses after 6s, shows progress (X/106)
- Subscribes to `EasterEggService.discovery$`

### 3. GlobalEggTriggersService (`src/app/shared/easter-eggs/global-egg-triggers.service.ts`)
- Auto-triggers on app init:
  - `night-owl` — hour >= 2 && < 5
  - `konami` — keyboard sequence ↑↑↓↓←→←→BA
  - `speed-demon` — 5 tools visited in 60s

### 4. GamesComponent (`src/app/games/games.component.ts`)
- Route: `/games`
- Reads lock state from `EasterEggService.isFound(unlockEggId)` on init
- Shows 8 game cards: locked (hint + 🔒) or unlocked (play button)
- Progress bar: eggs found / total

---

## Easter Egg Coverage

| Status | Count |
|--------|-------|
| Tool components with `.trigger()` calls | 109 / 135 |
| Tools missing Easter egg wiring | ~26 |
| Global eggs (auto-triggered) | 4 |
| Total eggs defined | 106 |

### Tools missing egg wiring (not yet triggering)
These tools have eggs defined in `EASTER_EGGS` but no `.trigger()` call in the component:
- `box-shadow-generator` ✅ **wired 2026-04-10** (`shadow-lord` on 5+ layers)
- `json-formatter` — `json-inception` (10+ nesting levels)
- `regex-tester` — `regex-master` (lookahead + lookbehind)
- `color-palette` — `palette-void`
- `ssl-certificate-inspector` — `ssl-localhost`
- `base64-encoder` — `b64-mirror`
- `image-compressor` — `img-tiny`
- `svg-to-code` — `svg-code`
- `pdf-generator` — `pdf-catalog`
- `gmail-deliverability-checker` — `gmail-self`
- `font-pairer` — `font-disco`
- `gradient-generator` — `gradient-mono`
- `contrast-checker` — `monochrome`
- `jwt-decoder` — `jwt-expired`
- `meta-tag-generator` — `meta-ego`
- `uuid-generator` — `uuid-lucky`

---

## Trigger Pattern (standard usage in tool components)

```typescript
import { EasterEggService } from '../../shared/easter-eggs/easter-egg.service';

// In class:
private readonly eggs = inject(EasterEggService);

// In method (after condition met):
if (this.layers.length >= 5) this.eggs.trigger('shadow-lord');
```

---

## Game Library (8 games, all scaffold-ready)

| Game | Unlock Egg | Tool | Rarity |
|------|-----------|------|--------|
| Shadow Puzzle | `shadow-lord` | Box Shadow Generator | rare |
| Regex Race | `regex-master` | Regex Tester | epic |
| JSON Tower | `json-inception` | JSON Formatter | rare |
| UUID Lottery | `uuid-lucky` | UUID Generator | epic |
| Color Memory | `color-void` | Color Converter | common |
| Chmod Chess | `chmod-god` | Chmod Calculator | rare |
| Hash Hunt | `hash-meaning` | Hash Generator | rare |
| CSS Golf | `css-important` | CSS Minifier | rare |

---

## Architecture Decisions

**Why localStorage + Firestore?**
localStorage gives instant, offline-first state. Firestore is append-only (discovery counts only — no user data), used for future leaderboard/global stats.

**Why unlock via Easter eggs, not usage counts?**
Ties game discovery to exploration behavior. Users who push tools to extremes are the audience for the games. Creates a natural funnel: casual user → power user → game player.

**Why `/games` as a separate route?**
Clean separation of concerns. Tools stay focused. Games are a reward destination.
Allows future game routing: `/games/shadow-puzzle`, `/games/regex-race`, etc.

---

## Next Steps (Backlog)

See `docs/games-backlog.md` for per-game implementation plans.

1. Wire remaining ~16 missing tool egg triggers (see table above)
2. Implement actual game logic for Shadow Puzzle (most straightforward first)
3. Add leaderboard Firestore collection (`games/{gameId}/scores`)
4. Add "recently unlocked" animation on `/games` page when arriving from a tool
5. Add global egg: `completionist` — find all 106 eggs (legendary rarity)
