# Session registry implementation report

Topic: `session-registry`

Measured implementation commit:
`25aeab386ce5714a73f3390be42dd678ccd281e4`

Status: READY for the final post-commit gate, then operator review and promotion.

## Delivered behavior

- Successful dispatch writes one immutable, UUID-named record under
  `<registry>.d/` after startup, cwd verification, and prompt delivery. Records carry
  canonical repository/root identity, actual Herdr identifiers, route, brief, bounded
  goal, report convention, and timestamps without copying prompt bodies.
- Dispatch preflights the canonical repository-local registry before any Herdr call:
  the registry and sidecar must be untracked, gitignored, symlink-safe, and writable.
  Prompt and persistence failures preserve the known outcome, identify live work, and
  never replay or close an agent after an ambiguous or delivered prompt.
- The dependency-free registry reader combines legacy arrays, per-session records,
  and atomic done markers. It assigns stable legacy IDs, retains healthy entries when
  individual files are malformed, and prevents concurrent record or marker updates
  from losing unrelated state.
- The board exposes localized registry errors, marks the selected session by ID, and
  resolves relative reports in the lane checkout before the canonical checkout.
- `lane close` marks every exact repository/topic session done only after the Git
  close succeeds. Refused/failed closes leave metadata unfinished; Git-only close
  creates no registry; post-close metadata failure reports that Git already closed.
- README, REFERENCE, command usage, the current `session-metadata` capability, and the
  change task now describe the implemented boundary. The operator-approved A2 text
  was appended verbatim to the Product contract in `AGENTS.md`; no other amendment
  was applied. Nothing under `docs/reviews/` changed.

## Regression evidence and measurements

- Baseline `npm test` passed 92/92 in 70.739 seconds after a clear process probe.
- The initial seven-group focused run selected one preservation case and six new
  behavior groups: the preservation case passed and all six feature groups failed
  before product changes. A fake-Herdr shell-escaping defect discovered in that run
  was corrected before implementation evidence was interpreted.
- After implementation, the focused feature groups passed. The first expanded full
  run passed 97/101 and exposed four fixture expectations, which were corrected
  without weakening production safeguards.
- The repository-wide deliberate negative-control run then failed all 101 selected
  controls with zero passes in 90.125 seconds. The later board-completion safety
  regression's focused deliberate control also failed as intended: zero passes, one
  failure, and 79 name-filtered skips in 0.122 seconds.
- Final `npm test` passed 102/102 with zero skips in 101.776 seconds. The concurrency
  case completed in 0.070 seconds while retaining a legacy entry, two independently
  written session records, and three simultaneous completion attempts including a
  repeated same-session mark.
- An earlier 101-test no-Herdr run passed 100 tests with one explicit unavailable-
  Herdr skip in 130.124 seconds. All fake-Herdr behavior remained offline and used
  system-temporary fixtures with cleanup.
- Strict OpenSpec validation passed 17/17. Staged `git diff --check`, complete added-
  text privacy scanning, and review of the full staged diff were clean.
- Verification used Node.js 20.19.4, npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0.

## Remaining limits

No live Herdr mutation, real concurrent dispatch against a daemon, alternate host,
filesystem race, Linux/Windows run, push, promotion, archive, or independent review
was performed. Permission and persistence failures use controlled offline filesystem
fixtures rather than an operating-system fault injector. The registry remains
gitignored display metadata and cannot authorize scheduling, retries, validation,
promotion, pushing, deletion, or any background coordination.
