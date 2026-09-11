# Board inventory delivery report

Date: 2026-09-11

## Result

The dependency-free board read path now defaults to accessible local-machine Herdr
scope. It enumerates and canonicalizes local endpoints, keeps failures as coverage
errors, identifies repositories only by Git common directory, unions registry history
with all live agents, and supports canonical `--repo` filtering plus independent
`--all` history inclusion. Rows are ordered by development root, repository, then
facilitator/lane group. Unregistered, unnamed, non-Git, facilitator, Herdr-done, and
metadata-done-but-active agents retain honest unknown and completion state.

The JSON document remains schema v1. Existing fields retain their meanings; inventory
adds scope history state, endpoint coverage, repository display disambiguators, row
goal provenance, active-after-done state, and grouping. Discovery, endpoint,
repository, registry, and message errors remain outside agent state.

The pre-agreed OpenSpec split was activated first in commit `e226e60`. The original
board-discovery change remains as a superseded, unchecked proposal. The inventory
change owns its three complete requirements; responsive bounded observation remains
unchecked in board-sampling. The implementation checkpoint is `f500351`.

## Regression evidence

- Untouched baseline: `npm test` passed 206/206 with zero skips in 315.780 seconds.
- Before product changes, `test/board-inventory.test.mjs` passed 0/4: three groups
  failed because the inventory service did not exist, and the CLI group failed because
  `--all` was rejected.
- Corrected focused inventory run: 4/4 passed in 1.134 seconds.
- Existing board compatibility focus: 20/20 passed with 122 name-filter skips in
  8.986 seconds; the complete inventory file then passed 4/4 in 1.134 seconds.
- Deliberate inventory controls: with `LANE_TEST_NEGATIVE_CONTROL=1`, 0/4 passed and
  all four groups failed at their named control in 1.195 seconds.
- First full post-change run reached 209/210 in 317.460 seconds; its only failure was
  the old README/usage assertion omitting the new `--all` flag. The corrected focused
  documentation test passed 1/1.
- Final `npm test`: 210/210 passed, zero skips, in 317.701 seconds. The run was outside
  the filesystem sandbox so the existing local Unix-socket fixtures could listen.
- `OPENSPEC_TELEMETRY=0 openspec validate --all --strict --no-interactive
  --concurrency 1`: 23/23 items passed.
- Syntax checks for `lane.mjs` and `board/inventory.mjs` and `git diff --check` passed
  during implementation. Final whitespace and public-safety checks are recorded in
  the handoff.

Every full-suite or build-like verification was started only after a process probe
showed no running `vitest`, `npm test`, `node --test`, or lane check/promote process.
One sibling suite was observed and allowed to finish before the final full runs;
focused checks also ran serially.

## Live and environment checks

A read-only live smoke check emitted only aggregate data: machine scope discovered two
local endpoint records, one accessible endpoint, seven canonical repositories, and
nineteen rows; discovery was correctly partial with one endpoint error. No raw socket
path, repository path, workspace label, agent identity, or pane output was copied into
this report.

Verification used Node.js 20.19.4, npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0. Local
main remained the merge base at `de11d4b`; no rebase was needed.

## Limits and unchanged behavior

`board/app.mjs` and `board/ui/` were not changed because the sibling board-frame lane
owns the Ink frame. Its current repository anchor is documented; the underlying
foreground JSON watch is machine-capable for that lane to consume. Sampling retains
the existing five-second refresh, subscriptions, and message-preview coalescing. This
change makes no responsiveness or freshness claim; board-sampling owns those future
guarantees.

No filesystem crawler, OS-process agent detector, remote discovery, persistent machine
registry, Git identity mutation, lifecycle scheduling, push, promotion, close,
history rewrite, or `docs/reviews/` edit occurred. Live coverage used only one
accessible server; multiple accessible endpoints, malformed/foreign registries, and
offline behavior were verified with protocol-shaped offline fixtures. The final lane
gate is intentionally conversation-only evidence and remains to be run against the
final documentation commit.
