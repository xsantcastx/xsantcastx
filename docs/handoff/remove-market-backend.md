# Remove the player market backend (2026-10-15)

Owner-approved. The player market's server half is gone.

## Removed
- `functions/src/market/**` (engine, matching, pricing, escrow store, rate limit, summary, types, config, generated reference) and the three callables.
- `functions/src/index.ts`: the `market` export block and its import.
- `functions/test/` (market engine tests + fake store), `functions/tsconfig.test.json`, the `test` npm script, and the market eslint override.
- `scripts/generate-market-reference.mjs` and `src/app/shared/market/market-reference.spec.ts` (only existed to pin the generated server copy).
- `docs/handoff/player-market/firestore.rules.proposed` and `firestore.indexes.json.proposed` (never applied).

## firestore.rules and indexes: nothing to remove
The market rules and indexes were only ever *proposed* (files above). `firestore.rules` and `firestore.indexes.json` have no market blocks and are byte-identical to main (empty diff). `firebase.json` differs only in a `//csp-connect-src` comment (market callables no longer mentioned); the CSP value is unchanged. CI's automatic rules/indexes deploy on push to main therefore changes nothing for the market: there were no market rules in production to disappear. The server wrote through the Admin SDK, which bypasses rules.

## Client
After merging the game-only shell, the client market code is already gone from main. `exchange.model.ts` stays (NPC vendor / meaning check use it). `INVENTORY_BAG_CAP` stays exported.

## Owner follow-up
- Cloud Functions are NOT removed by CI. They go away only when you run `firebase deploy --only functions` (it prompts to delete functions no longer in source). Functions that will be deleted, if they were ever deployed:
  - `market-placeOrder`
  - `market-cancelOrder`
  - `market-collect`

  (The roadmap says the market deploy never happened, so they likely do not exist.)
- Firestore data: if any was written, it lives under `market/v1/` (`orders`, `trades`, `prices`, `escrow`, `listed`, `summary`) plus the `market/v1` config doc (`enabled` flag). Delete in the console if present. Not touched here.

## Verification
`cd functions && npm ci && npm run build` passes. (`npm run lint` was already failing on style in other files.)
