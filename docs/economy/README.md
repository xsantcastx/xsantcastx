# Economy docs

These files are for design and simulation only. No game code reads them.

- [`rebalance-spec.md`](rebalance-spec.md) is the Cookie-Clicker-curve rebalance. It covers:
  - the inventory of every Gold and Essence source and sink, with file:line
  - the before/after timings
  - the old → new numbers table
  - the save migration
  - the rollout plan
- [`../../scripts/economy-sim.mjs`](../../scripts/economy-sim.mjs) is the pure-Node simulator behind every number in the spec.
  - Run `node scripts/economy-sim.mjs --days=30 --stages`.
  - Flags: `--cps`, `--idleCpm`, `--policy=patient`, `--no-expeditions`, `--offlineRate`, `--debug`.
