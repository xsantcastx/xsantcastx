# Eclipse Realms Roadmap

The long arc for xsantcastx.com, in six phases.

The public roadmap on [/blueprint](https://xsantcastx.com/blueprint#roadmap) has a Now / Next / Later view — that answers *what is being worked on this month*. This document answers the other question: **where is all of it going.**

The phases are named for the Eclipse Realms cosmology — a Sun that breaks, a world that wakes to what broke it, and an alignment that either heals it or finishes it. The machine-readable version lives at [`src/app/blueprint/eclipse-roadmap.ts`](../src/app/blueprint/eclipse-roadmap.ts) and is what the site renders; this file is the prose.

## The honesty rule

A phase is marked **Complete** only when every item under it has actually shipped. **Vision** means exactly that — an intention with no commitment behind it, no date, and no promise.

If something slips, it moves backwards here. The point of a public roadmap is lost the moment it is quietly rewritten to match what happened.

## Status legend

| Status | Colour | Means |
|---|---|---|
| **Complete** | gold `#C9A84C` | Every item shipped. |
| **In progress** | cyan `#00d4ff` | Being worked on now. Some items are done, some are not. |
| **Planned** | muted `#7d918c` | Committed to, not started. |
| **Vision** | violet `#c48bff` | An intention. No date, no commitment. |

---

## Phase I — Genesis · Complete · v1.0 – v2.9

> *In the beginning, there was the Sun — whole, silent, and dreaming.*

**A world, and things in it worth using.**

- ✦ **126 tools, all client-side.** Every tool runs in the tab. Nothing is uploaded, so there is no server to pay for and no queue to wait in.
- ✦ **The cosmic engine.** Constellation canvas, cursor pulsar, scroll reveal, magnetic CTAs, click ripples — 22 systems, all SSR-safe and all with a reduced-motion path.
- ✦ **English and Spanish throughout.** Every string behind `TranslationService`, including the 122 input placeholders that had been left in English.
- ✦ **Blueprint, dev log and public roadmap.** The order of work, in public, with cards that move backwards when that is what happened.
- ✦ **Accessibility and mobile passes.** Every control has an accessible name, every standalone control clears 44px, and the drawer works on a notched phone.

## Phase II — Awakening · Complete · v2.10 – v2.13

> *The soul remembers both.*

**The site starts remembering who is using it.**

- ✦ **XP and ten ranks.** Wanderer → Seeker → Forgehand → Realm Walker → Convergent → Shadow Weaver → Neon Architect → Godforge Keeper → Eclipse Sage → Eclipse Lord. Earned from tool use, page visits, copies, shares and secrets.
- ✦ **Daily streak.** Compounds 50 XP a day to a 600 cap, resets on the first day missed, and keeps your best so the loss is visible.
- ✦ **Aether and Nox.** XP splits by what you actually use — design work feeds one energy, security and code work the other.
- ✦ **The rarity ladder.** Mortal, Eclipsed, Sacred, Anomalous, Mythic, Singular. Each with its own colour, synthesised sound and screen effect. Singular is awarded for being first in the realm to find a secret.
- ✦ **Five realms.** Twelve tool categories grouped into Luminous, Umbral, Verge, Archivum and Nexus, with a realm badge on every tool page.
- ✦ **The Arena.** Eight gates, each chained by a secret, each inheriting that secret's tier.

## Phase III — Eclipse · In progress · next

> *The Eclipse Sun aligns every thirty-three years, and for seven days the realms are one.*

**Progression that survives changing device.**

- ◦ **Accounts and cloud progress.** The Firestore progress adapter is stubbed and documented; it needs a sign-in and a reconciliation rule (highest lifetime XP wins, achievement sets union) before it can be switched on.
- ◦ **Global first-in-realm ledger.** Singular already reads the global discovery counter. The public record of who got there first does not exist yet.
- ◦ **Realm-tinted tool chrome.** The realm badge landed; tinting the tool page itself — accent, focus ring, output panel — has not.
- ◦ **Playable Arena gates.** The eight gates unlock, but nothing is behind them yet. Shadow Puzzle first.
- ◦ **Error tracking.** A client crash is currently invisible. Nothing above ships safely until that is not true.

## Phase IV — Convergence · Planned · after Eclipse

> *Balance sustains existence.*

**The tools reach people who never visit the site.**

- ◦ **Browser extension.** The ten most-used tools from a popup, same cosmic chrome.
- ◦ **VS Code extension.** A command-palette entry that opens a tool in a webview. The MCP server already exists to repackage.
- ◦ **PWA.** Most tools already work offline. A manifest and a service worker make that official.
- ◦ **CLI.** `npx xsantcastx box-shadow` opens the tool deep-linked. Small and shareable.
- ◦ **Cross-surface progression.** XP earned in the extension counts. This is why Eclipse has to land first.

## Phase V — Godforge · Planned · later

> *The Godforge opens during the Eclipse, and forces you to meet the other version of yourself.*

**The engine becomes something other people can build with.**

- ◦ **`@xsantcastx/cosmic-engine`.** The engine extracted from `index.html` into a package anyone can install.
- ◦ **A tool SDK.** One manifest and one component, and a new tool inherits routing, SEO, i18n, embeds, realms and secrets.
- ◦ **Community tools.** Tools contributed by other people, carrying the same guarantees: no upload, no account, no tracking.
- ◦ **Public API.** The registry, the realm map and the rarity ladder as data other projects can read.

## Phase VI — Final Eclipse · Vision · no date, and no commitment

> *The world shall end not in fire nor shadow, but when the Convergent forgets which one they were.*

**The whole thing as one world rather than a site with features bolted on.**

- ◦ **A realm map you can walk.** Not a filter — a map, where tools sit in a place and the place means something.
- ◦ **Seasons.** Singular is one-of-a-kind *per season* in the economy doc. Seasons do not exist here yet.
- ◦ **Convergent profiles.** A public page for a rank, an energy balance and the secrets someone found first.
- ◦ **The lore, playable.** The codex stops being flavour text and becomes something you move through.

---

## Related

- [`src/app/blueprint/eclipse-roadmap.ts`](../src/app/blueprint/eclipse-roadmap.ts) — the data the site renders
- [`src/app/shared/realms/realm.model.ts`](../src/app/shared/realms/realm.model.ts) — the five realms
- [`src/app/shared/rarity/rarity.model.ts`](../src/app/shared/rarity/rarity.model.ts) — the six tiers
- [`src/app/shared/gamification/gamification.model.ts`](../src/app/shared/gamification/gamification.model.ts) — ranks, XP table, streak curve
- [Eclipse Realms Lore Codex](https://github.com/xsantcastx/EclipseRealms/blob/main/Eclipse_Realms_Lore_Codex.md)
- [Eclipse Realms Economy & Balance](https://github.com/xsantcastx/EclipseRealms/blob/main/Eclipse_Realms_Economy_Balance.md)
