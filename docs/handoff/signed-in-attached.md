# Signed in ⇒ attached (owner bug 2026-10-26, branch `attach`)

**Symptom.** The owner was signed in on a desktop PC. Dropping an item said "Sign in to trade.": `TradeBackendService.blocked()` found `gateway.attached` false, so the save was not reaching the account either.

**How a signed-in page ends up not attached:**
1. **The page is still in the guest's profile** (character-scope "Profiles", shipped with f4feaf9a). `GameStateGateway.attach()` refuses a guest page.
   - A guest page that signs in (popup, redirect, a lapsed session coming back) relied on one reload into the account.
   - That reload kept the guest flag. If the binding write failed (a full disk) or the reload never came, the next page was the guest's again.
2. **A bind that threw before the attach.** Examples: a lazy chunk missing after a deploy (a tab left open across a release), or Firestore out of reach. The status keeps the uid, so the player looks signed in, and nothing ever retried.
3. **A bind stuck waiting.**

**Fix:**
- **Into the account, once.** `cloud-save` `reloadIntoAccount(uid)`:
  - The guest flag is cleared first, so the next page can only be the account's. The binding is written again too.
  - There is at most one such reload per tab per minute (`eclipse-profile-fix` in sessionStorage). It can never loop. When it would, the page says "Your save could not reach your account. Reload the page to try again." (status error, `stuck$`).
  - Used by `bind()` on a guest page and by the watch below.
- **Defence in depth.** `ATTACH_WATCH_MS` (8 s) after any signed-in status that is not attached, `recoverAttach()` runs:
  - **Guest page:** stamp the guest saves with the uid, then reload into the account.
  - **Account page with a bind in flight, or offline:** wait, up to three more watches.
  - **A bind that failed:** bind again from the persisted session (once).
  - **Still not attached after that:** one reload, which fetches fresh code.
  - A trade or drop calls it at once and says "your save is still connecting to your account" (`trade.why.connecting`) instead of "sign in".
- **Recovery of play that landed in the guest's saves.** On the account's character list, a made Keeper found in this device's guest saves is offered:
  - "<name> was played on this device while your account was signed in…" when stamped with this uid. Otherwise: "…was played offline on this device. If they are yours…".
  - The two buttons are **Bring to my account** and **Not mine** (never offered again).
  - Adopting copies its saves into the account as a **new** Keeper. It is never merged into a Keeper the account has, so no account data can be overwritten.
  - The new Keeper is marked for the cloud, and the guest copy is dropped from this device (local only).
  - Why offered, not automatic: a real guest on a shared PC must never land in someone's account unasked. The account holder sees the name and chooses. Nothing ever leaves an account.

**Tests:**
- Karma `cloud-attach.spec.ts`, the state machine path by path:
  - a guest page signs in: one reload, the flag cleared, then no loop;
  - the watch on a guest page;
  - a thrown bind: rebind, then one reload;
  - a slow bind: waited for;
  - the normal path.
- Karma `guest-profile.spec.ts`: offer and adopt as a new Keeper, "Not mine", and nothing offered to a guest page.
- e2e `play-cloud-attach.spec.ts`, with the fake cloud (`fake-cloud.ts`: localhost + WebDriver + `eclipse-cloud-fake`):
  - guest, then Sign in, then attached, then a drop works;
  - the redirect sign-in from a guest page ends attached.
