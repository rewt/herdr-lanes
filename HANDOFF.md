# HANDOFF

Living log for agents maintaining this repository. Newest entry last.

## 2026-09-06 — initial public release

- Published https://github.com/rewt/herdr-lanes as an MIT-licensed, dependency-free
  Node.js CLI with `.lane.json` configuration.
- Added offline lifecycle coverage for open, status, promote, close, rebase-check,
  prepare, usage exits, EPIPE handling, and the optional Herdr cwd guard.
- Before the CLI fixes, the normal suite passed 13/15: no-command usage exited 0 and
  `status | head` raised EPIPE. Both now exit correctly. Existing behavior assertions
  were exercised with the suite's deliberate negative-control mode.
- Verified with Node.js 20.19.4 and git 2.54.0: 15/15 tests passed with Herdr present;
  with Herdr absent, 14 passed and the Herdr-dependent test skipped.
- Commits: `cbe3a29` (tests and CLI fixes), `bf19edb` (release handoff).

## 2026-09-06 — agent-first operational documentation

- Replaced the README narrative with installation, target-repository configuration,
  Herdr bootstrap, end-to-end lane operation, command syntax, status interpretation,
  promotion checks, recovery actions, and development verification.
- Reworked `AGENTS.md` into portable repository instructions with a file map, product
  invariants, offline-test rules, a repeatable work procedure, and a handoff format.
  Added `CLAUDE.md` instruction discovery and `docs/BRIEF_TEMPLATE.md` for dispatch.
- Generalized `.lane.json.example`, `package.json`, and the `lane.mjs` description.
  Removed the obsolete origin document and stale next-session prompt, and condensed
  earlier handoff notes to public maintenance facts.
- No runtime behavior changed. `npm test` passed 15/15 with Herdr 0.8.2 available;
  with Herdr removed from PATH, 14 passed and one Herdr-dependent test skipped.
- Checked the documented Herdr commands against Herdr 0.8.2 CLI help and the official
  agent setup guide. A current-tree text scan found no former domain or source-context
  references; the copyright holder remains in `LICENSE`.
- Did not run a live end-to-end dispatch, test a non-Node target repository, test on
  Windows, or rewrite existing git history.

## 2026-09-06 — concise workspace and concurrency workflow

- Condensed the README from 296 to 210 lines and made it a linear setup and operating
  guide: install, configure, start the canonical Herdr workspace, open and dispatch a
  lane, run implementation lanes concurrently, promote serially, then close or resume.
- Made the operator/agent boundary explicit: operators manage lanes from the canonical
  checkout; agents work and commit only inside their lane worktrees.
- Documented status fields, overlap handling, per-worktree preparation, the effect of
  one promotion on other lanes, and the exact seven-step promotion gate.
- Added the required user workflow to `AGENTS.md` so future documentation changes keep
  workspace setup, concurrency, and promotion discoverable.
- No runtime behavior changed. Baseline `npm test` passed 15/15 before the edit.
- Did not run live workspace creation or dispatch during this documentation-only slice.

## 2026-09-06 — quick-start landing page

- Reduced the README from 210 to 100 lines. Its opening workflow now shows exactly how
  to install the script, copy configuration into a target repository, provide agent
  instructions, start Herdr, dispatch two concurrent lanes, inspect them, and promote
  and close one lane.
- Kept the public explanation focused on lane use: agents implement concurrently in
  isolated worktrees; the operator promotes lanes one at a time into local main.
- Moved configuration fields, dispatch safeguards, status definitions, failure
  recovery, archive behavior, and unattended promotion to `docs/REFERENCE.md`.
- Updated `AGENTS.md` so future documentation work preserves a short, command-led
  README and keeps technical detail in the reference.
- No runtime behavior changed. Baseline and final `npm test` runs passed 15/15.
- Did not run live workspace creation or dispatch during this documentation-only slice.

## 2026-09-07 — named dispatch routes

- Added `.lane.json` `routes` with per-route `kind`, `model`, `env`, `args`, and
  descriptive `use` fields. `lane dispatch --route` resolves global defaults, the
  named route, and command-line overrides in that order; environment entries append,
  while explicit `--arg` entries replace configured arguments.
- Added `lane routes`, deterministic route-name ordering, resolved route output, and
  early unknown-route errors that report the configured names without calling Herdr.
- Added offline coverage for resolved route kind/model/arguments/`use`, the empty-route
  error, and rejection of an unknown route before the Herdr availability check.
- Before implementation, the expanded suite passed 15/17: `routes` fell through to
  usage and unknown-route dispatch reached the Herdr guard. The addendum's focused
  negative control then failed because route output omitted `use`.
- Documented configuration and precedence, added repository-neutral example routes,
  and recorded model-routing guidance from the official OpenAI and Anthropic pages
  fetched on 2026-09-07. The README quick start now selects a named route.
- Verified with Node.js 20.19.4 and git 2.54.0: normal `npm test` passed 17/17;
  `LANE_TEST_NEGATIVE_CONTROL=1 npm test` failed all 17 deliberate controls, including
  both new route controls. `git diff --check` passed.
- Did not run a live route dispatch against Herdr or validate vendor/model availability
  for a particular operator account; the behavior suite remained offline as required.

## 2026-09-07 — post-review route documentation corrections

- Corrected the OpenAI guidance to match the cited models page: Low, Medium
  (default), High, Extra High, Max, and Ultra. Removed `gpt-5.4-mini` from the
  current-routing table and documented its 2026-08-31 Codex retirement for ChatGPT
  sign-in plus the recommended `gpt-5.6-luna` replacement.
- Clarified that command-line `--arg` replaces `dispatch.args` when no route is
  selected and aligned the `routes` usage description with the other commands.
- Extended the offline unknown-route test to cover the exact `(none configured)`
  message and confirm that this path also stops before the Herdr availability check.
- Baseline and final `npm test` runs passed 17/17. The focused unknown-route test
  passed after adding the assertion, showing that this was missing coverage rather
  than a runtime defect. `LANE_TEST_NEGATIVE_CONTROL=1 npm test` failed all 17
  deliberate controls, including the expanded unknown-route control.
- Verified with Node.js 20.19.4 and git 2.54.0; `git diff --check` passed. No live
  Herdr dispatch or account-specific model availability check was performed.

## 2026-09-08 — live lane board

- Added `lane board` as a spawned Ink 5/React child package and dependency-free
  `lane board --once` output. The board joins a repository session registry with
  Herdr agent/pane state, lane ahead/dirty state, report verdict and mtime, deadline,
  output tripwires, last output, and lightweight host metrics.
- Added a protocol-20 Unix-socket client with caller request IDs, one-shot snapshots,
  long-lived agent/output subscriptions, and capped exponential reconnect backoff.
  A live read-only probe verified one request per connection and the ID-less event
  envelopes that follow the `subscription_started` response.
- Added offline tests against an injected in-memory fake socket server plus board model,
  plain rendering, registry update, and CLI coverage. The deliberate pre-implementation
  run failed because both board modules were absent and `board --once` was unknown.
- Documented setup, the optional `.lane.json` `registry` key, registry fields,
  interactive keys, protocol behavior, and limits. The task brief remains excluded
  because it contains host- and account-specific text unsuitable for public tracking.
- Baseline `npm test` passed 17/17 with Node.js 20.19.4 and git 2.54.0. Final
  `npm test` passed 26/26, including the board package tests; `git diff --check`
  passed. Live checks exercised protocol-20 snapshot/subscription handshakes,
  plain output, and Ink startup/quit. No live status-change event was induced, no
  non-macOS host was tested, and no push was performed.

## 2026-09-08 — lane board post-review corrections

- Gitignored `.lane/` and documented that every configured registry path must be
  gitignored, with promotion coverage proving a present registry does not dirty the
  canonical checkout. Lane dirtiness now prefers the target repository's worktree for
  the lane branch and only trusts workspace checkout metadata when repository root and
  branch both match.
- Made Herdr client shutdown permanent, rejected pending requests on close, prevented
  subscriptions after close, and guarded late React refreshes after unmount. Added
  fake-server coverage for split and batched frames, timeouts, error bodies,
  close-before-reply, and subscribe-after-close.
- Replaced JSX/`tsx` with a plain Node.js 20 `React.createElement` entrypoint, added a
  concise non-TTY failure pointing to `--once`, removed the undocumented
  `LANE_BOARD_REPO`, validated missing `--repo` values, and standardized board install
  instructions on `npm --prefix board ci`.
- Corrected worker sampling to use `ps -Ao command=` and executable basenames, showed
  report mtimes without a stray verdict separator, clarified malformed-registry
  errors, named a missing registry under `--once`, generalized the ignored brief
  pattern, and documented that tripwire and last-output values are live-only.
- Baseline `npm test` passed 26/26. Before implementation, the expanded suite passed
  29/37 with eight expected failures covering the main regressions; the malformed
  registry and missing-registry hint controls were also observed failing in focused
  runs before their fixes. Final `npm test` passed 39/39, and
  `LANE_TEST_NEGATIVE_CONTROL=1 npm test` failed all 39 deliberate controls, including
  all 18 board-package tests. `git diff --check` passed.
- `npm --prefix board ci` installed 41 packages in under one second with two direct
  dependencies. Removing `tsx` reduced the lockfile from 1,059 to 569 lines and the
  installed package footprint from the reviewed 33 MB to 22 MB. Removed the three
  empty temporary client directories identified by the review.
- Verified with Node.js 20.19.4, npm 10.8.2, and git 2.54.0. No live interactive key
  sequence, live Herdr event, Linux host, or Unicode display-width behavior was tested.
  Async git/process sampling and display-width-aware truncation remain deferred as the
  two non-trivial review nits. No push was performed.

## 2026-09-08 — lane board round-two review corrections

- Removed the unreachable workspace checkout fallback because protocol 20 does not
  provide a worktree branch; git dirtiness now comes only from the target repository's
  worktree registered to the lane branch. Updated the test fixture and implementation
  report to use only protocol fields Herdr sends.
- Counted worker scripts launched by common interpreters using the basename of the
  script argument, and gave the interactive footer the same missing-registry message
  as `--once`. Added negative-controlled tests for both behaviors.
- Added `board/` to the repository map and documented the isolated Ink/React entrypoint
  exception while retaining the built-ins-only rules for `lane.mjs` and tests.
- Baseline `npm test` passed 39/39. Before implementation, the two focused behavior
  tests failed as expected. Final `npm test` passed 41/41, all 41 deliberate negative
  controls failed, and `git diff --check` passed.
- No real-TTY interaction, live Herdr event, or Linux host was tested. No push was
  performed.

## 2026-09-08 — commit-bound validation gates

- Added `lane check [--cmd <validate command>]`, using promotion's existing
  `.lane.json`/`npm test` default and `LANE_VALIDATE` override. It refuses a dirty
  current worktree, atomically records full HEAD, branch, verbatim command, exit,
  UTC timestamps, and numeric duration in `.lane/gate.json`, prints one `GATE` line,
  and returns the validator's exit code.
- Added a board `GATE` column sourced from each registered lane worktree. Matching
  records show the exit and seven-character head, mismatched heads show `STALE`, and
  missing or unusable records show `-`; only Ink colors matching zero/non-zero exits
  green/red.
- Before implementation, all three focused CLI checks and all four focused board
  expectations failed. Final `npm test` passed 44/44;
  `LANE_TEST_NEGATIVE_CONTROL=1 npm test` deliberately failed all 44 controls (0
  passed), and `git diff --check` passed. Verified with Node.js 20.19.4, npm 10.8.2,
  and git 2.54.0. The clean-tree gate line is recorded in the implementation report.
- No live Herdr event, real-TTY Ink color sequence, Linux host, or Windows host was
  tested. No push was performed.

## 2026-09-08 — lane check round-two review corrections

- Made `check` run configured preparation before validation, matching `promote`, and
  preserved signal termination as a named `signal` plus shell-compatible
  `exit_code`. Added coverage for both behaviors and for detached HEAD, unknown
  options, missing/empty `--cmd`, and the board's absent `-` state.
- Derived the wide board breakpoint from its columns, passed the exact GATE cell
  offset to Ink coloring, and aligned the multiline `check` usage entry.
- Generalized the `.lane/` gitignore requirement beyond board setup and documented
  that handoff requires re-running `lane check` after the final commit until the
  board shows `exit=0` against current HEAD.
- Before implementation, focused tests failed for prepare parity, signal/null signal
  recording, usage alignment, and board layout. Existing refusal and absent-state
  behavior passed normally, then failed under their deliberate negative controls.
- Baseline `npm test` passed 44/44. Final `npm test` passed 49/49, and
  `LANE_TEST_NEGATIVE_CONTROL=1 npm test` deliberately failed all 49 controls (0
  passed), and `git diff --check` passed. Verified with Node.js 20.19.4, npm 10.8.2,
  and git 2.54.0; the post-commit GATE is reported after the final commit. No live
  Herdr event, real-TTY Ink color sequence, Linux host, or Windows host was tested.
  No push was performed.
