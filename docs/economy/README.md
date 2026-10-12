# Economy docs

The rebalance is implemented (economy save version 3). The numbers live in `src/app/shared/economy/economy-curve.ts`; these docs explain them.

- [`rebalance-spec.md`](rebalance-spec.md) is the Cookie-Clicker-curve rebalance. It covers:
  - the inventory of every Gold and Essence source and sink, with file:line
  - the before/after timings
  - the old → new numbers table
  - the save migration
  - the rollout plan
- [`../../scripts/economy-sim.mjs`](../../scripts/economy-sim.mjs) is the pure-Node simulator behind every number in the spec.
  - Run `node scripts/economy-sim.mjs --days=30 --stages`.
  - Flags: `--cps`, `--idleCpm`, `--policy=patient`, `--no-expeditions`, `--offlineRate`, `--debug`.
  - `--check` is the CI smoke: exits 1 when the first purchase is later than 15 s or fewer than 20 purchases land in 10 minutes.
