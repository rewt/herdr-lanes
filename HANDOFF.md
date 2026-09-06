# HANDOFF

Living log for sessions working in this repository. Newest entry last.

## 2026-09-06 — extraction

- Extracted from the private research repository (see `docs/ORIGIN.md`), generalized
  behind `.lane.json`, README and MIT license written, first commit `cb74843`.
- Smoke-tested read-only against the origin repository: `status`, `rebase-check`
  (exit 1 on a real conflict) and `verify-agent <name> /wrong/path` (exit 1) behave.
- Publication (GitHub repo creation + first push) is the next session's first task; it
  was not done by the extracting session.
- Known gaps: no tests yet; `status` piped into `head` dies with EPIPE (cosmetic; the
  original behaves the same); the private repository still runs its own copy and will
  switch to this one via `.lane.json` once this repo has tests.

## 2026-09-06 — publication and offline tests

- Published the repository at https://github.com/rewt/herdr-lanes, verified it is
  public, set the `herdr`, `git-worktree`, `ai-agents`, and `coding-agents` topics,
  and verified GitHub's README API returns `README.md`.
- Added the dependency-free `node --test` suite in `test/lane.test.mjs`. It covers
  open input guards, status distance/dirtiness/shared files, every promotion guard
  and the clean rebase/fast-forward path, both close outcomes and its dirty guard,
  rebase-check exit codes, prepare/unless behavior, usage exits, EPIPE, and the
  optional herdr cwd mismatch control.
- Before changing `lane.mjs`, the normal suite passed 13/15: the no-command usage
  assertion failed because it exited 0, and `status | head` failed with an unhandled
  EPIPE. The already-implemented behavior assertions were each also observed failing
  under `LANE_TEST_NEGATIVE_CONTROL=1`, which deliberately fails at the end of every
  exercised test.
- Deliberate behavior changes from the extracted copy: a missing command now prints
  usage and exits 1, and an EPIPE on stdout exits quietly. Added `npm test` and the
  testing contract to the README. Commit: `cbe3a29`.
- Verified on Node 20.19.4 and git 2.54.0: `npm test` passes 15/15 with the installed
  herdr CLI; with herdr removed from PATH, 14 pass and the herdr-dependent test skips.
  All lifecycle tests ran offline in temporary git repositories.
- Did not exercise live herdr workspace creation or dispatch, did not test other Node
  or git versions, and did not visually inspect the README in a browser.
