# Lane check implementation report

Date: 2026-09-08

## Result

Implemented `lane check [--cmd <validate command>]` and the board `GATE` column.
Checks now bind a validation exit to the full pre-validation HEAD in
`.lane/gate.json`; the board independently compares that record with the registered
lane worktree's current HEAD.

## Behavior delivered

- `lane check` accepts the configured validator, the existing `LANE_VALIDATE`
  override, or a per-run `--cmd` override without introducing another default.
- A dirty current worktree is rejected before validation or gate replacement.
- Green and failed validations both produce an atomic JSON record and a single
  `GATE <full-head> exit=<n> (<duration>)` line; the process returns `<n>`.
- Board snapshots render `exit=0 @<head7>`, a matching non-zero exit, `STALE`, or
  `-`. Only the interactive Ink view colors matching results green or red.

## Test-first controls

The focused pre-implementation CLI run failed 3/3 new `check` tests because the
command was unknown. The focused board run failed 4/4 changed expectations because
gate collection, rendering, and freshness comparison were absent. Every affected
test includes the suite's `negativeControl` call.

## Verification

- Baseline: `npm test` passed 41/41 before changes.
- Final `npm test` passed 44/44; `LANE_TEST_NEGATIVE_CONTROL=1 npm test`
  deliberately failed all 44 controls (0 passed).
- `git diff --check` passed.
- Verified with Node.js 20.19.4, npm 10.8.2, and git 2.54.0.
- Clean-tree implementation gate:
  `GATE ec88e4b42d49dd413aa29fb06fbdf56bebf96be5 exit=0 (4.941s)`

## Unverified

No live Herdr event or interactive terminal color sequence was exercised. Board gate
collection and plain rendering are covered offline in temporary repositories; Ink
color selection is covered through the row presentation state.
