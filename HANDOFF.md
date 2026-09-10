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

## 2026-09-08 — roots, live board, and idea-dispatch specification

- Added a minimal OpenSpec configuration/workflow, a current lane-safety spec, and
  nine proposed product changes spanning root configuration/identity, automatic
  session metadata, a CLI board interface, machine discovery, message previews,
  terminal UX, idea dispatch, and a composer. Each change has one complete
  engineer-route lane brief; an optional two-hour mouse research brief is separate.
- Added docs/SPEC-20260908.md with framework comparison, phase acceptance, route/
  effort/dependency table, four decision recommendations, exact proposed contract
  amendments, rollout checklist, and remaining evidence gaps. Linked the workflow
  from README. No product code, tests, package files, or AGENTS.md contract changed.
- Folded in the drafted roots brief and prior board/check reviews. Preserved the
  existing environment-root meaning, proposed canonical config/identity handling,
  collision-safe display records, honest partial failures, and CLI-only UI actions.
  Kept operator configuration and raw private source briefs/reviews out of git.
- Baseline HEAD equaled main at c9d829c. One direct npm test passed 49/49, zero
  failures/skips, in 5.290 s. Runtime/test/package files remain identical to main.
  No product behavior changed, so no product failing test or negative-control suite
  was added/run. The required post-final-commit lane check uses the unchanged npm
  test validator; its exact current-HEAD GATE is reported outside tracked files.
- OpenSpec 1.6.0 strict validation passed all 10 items (nine changes and one current
  spec), with concurrency 1. An initial spec-less research change failed validation;
  inspection showed the installed tool lacks upstream skip_specs support. The final
  research brief is outside product changes, without a fabricated capability.
- Document links, requirement/scenario structure, unchecked task count, and
  public-source text were audited; git diff --check passed. This lane's own
  validation commands were serialized. Verified Node.js 20.19.4, npm 10.8.2, git 2.54.0 and
  read-only Herdr protocol-20 schema/help. No additional framework/package install.
- No implementation agent was dispatched and no live focus, TTY/editor/mouse
  interaction, root rollout, minimum-version host, Linux, or Windows behavior was
  exercised. All implementation and proposed contract approvals remain future work.
  No push performed.

## 2026-09-08 — specification verification load correction

- The first post-commit lane check at 46eceb6 passed 49/49 in 6.601 s, but the
  orchestration mistakenly ran it after a nonzero load probe identified an active
  build elsewhere on the machine. This violated the requested one-build/test rule;
  the passing result does not establish machine-exclusive verification.
- Updated the specification report and this handoff to record that limitation.
  No runtime or test files changed. git diff --check passed.
- Commit this correction, wait until the build/test process probe is clear, then
  run the ordinary lane check once against the final commit and report its exact
  GATE in the conversation. Do not stop or control the other session's processes.

## 2026-09-08 — specification round-two review corrections

- Updated the OpenSpec guide, report and briefs: roots-config needs no amendment;
  A1 describes its placement retroactively in roots-identity. Kept A1-A4 text only
  in the guide. Split board-cli into read interfaces (2b-i) and board-actions
  (2b-ii), with discovery/UX split boundaries and corrected dependency edges.
- Standardized roots-identity/mouse reports, required CLI usage and README-table
  coverage, and bounded workspace labels to 64 code points with safe truncation.
  Added docs/REVIEW-*.md to .gitignore; the pre-edit check did not match, the
  post-edit check matched, and public docs/reviews/ records remain unignored.
- Strict OpenSpec validation passed 11/11 with telemetry disabled and concurrency
  1 after a clear load probe. Links, task counts, public-text review and
  git diff --check passed. No product code, tests, package files or AGENTS.md changed.
- Reused the unchanged e0cb38c baseline: 49/49 tests. Run lane check once after
  this final commit and a fresh clear load probe; report its GATE outside git.
  No live feature, TTY/mouse, rollout or minimum-version checks were performed.

## 2026-09-09 — development-root configuration

- Added nearest-parent plus canonical-repository `.lane.json` layering, with bounded
  home/root discovery, strict selected-file validation, shallow top-level replacement,
  route-name merging, canonical linked-worktree resolution, and exact `LANE_CONFIG`
  bypass. Existing registry/seams/prepare path meanings remain unchanged.
- Added `worktree_root` as a defining-file-relative shared base with repository-name
  placement. Preserved caller-relative `LANE_WORKTREE_ROOT` as the final repository
  container, parent-derived `.worktrees` and legacy home defaults, and git-registered
  paths for every already-open lane operation. Occupied ordinary/foreign paths remain
  untouched and do not create a lane branch.
- Added deterministic source-attributed `lane config` TSV output and documented its
  syntax in CLI usage and the README table. The isolated board now receives resolved
  canonical main/registry settings without exposing route environment values.
- Baseline `npm test` passed 49/49. Before implementation, the expanded suite passed
  50/57 with seven intended failures; the focused inherited-board control also failed
  before its correction. Final `npm test` passed 58/58 in 8.105 seconds. With Herdr
  absent, 57 passed and the one Herdr-dependent test skipped explicitly; all 58
  deliberate negative controls failed.
- Strict OpenSpec validation passed 12/12, `git diff --check` was clean, and an
  added-line scan found no host/private source text. Verified with Node.js 20.19.4,
  npm 10.8.2, git 2.54.0, and OpenSpec 1.6.0. Commands were serialized; the final
  suite ran after a clear build/test process probe.
- No live dispatch, real interactive board, Linux/Windows host, regular-file
  permission denial, or path-creation race was tested. Broader realpath identity,
  root labels/accounts, workspace-label changes, and migrations remain out of scope.
  No contract amendment or additional approval is needed for roots-config; no push,
  promotion, archive, or independent review was performed.

## 2026-09-09 — foreground review and built-in configuration proposals

- Added review-cli and default-config OpenSpec changes, each with one complete
  engineer-route brief. Updated the report table, rollout checklist and guide;
  stated that interactive UI is Ink in the terminal with no browser UI planned.
- Review uses explicit rounds and PASS/NEEDS-WORK/FAIL, full-SHA/schema checks,
  witnessed test claims, private-only reviewer output, unchanged HEAD/clean-tree
  enforcement and CLI-authored sanitized public evidence. No automatic fix loop.
- Specified eight overridable built-in routes, engineer-equivalent shipped dispatch,
  built-in source attribution and repository/installed template lookup. Proposed
  exact A5 only in the guide; default-config requires approval after review-cli.
  Review-cli follows roots-config promotion to serialize lane.mjs edits.
- Strict OpenSpec validation passed 13/13 after a clear load probe, telemetry off
  and concurrency 1. Links/anchors, single-task structure, public-text review and
  git diff --check passed. Product code/tests/packages/AGENTS.md remain unchanged;
  no product negative-control run was warranted. Reused the clean 55cd44c 49/49 gate
  baseline; reserve one lane check for the final commit after a fresh clear probe.
- CLI help and official Codex docs informed effort syntax; installed-client max
  support, live reviews, agent/account availability and sanitization implementation
  remain unverified future work. No source brief was copied and no push performed.

## 2026-09-09 — development-root configuration review corrections

- Replaced the board's temporary `LANE_CONFIG` file with explicit resolved `--main`
  and `--registry` flags consumed by both isolated board entrypoints. Linked-worktree
  board runs still target the canonical checkout and inherited registry, while future
  descendant lane commands retain layered configuration resolution; no signal-cleanup
  path remains necessary because no temporary config is created.
- Strengthened offline coverage for the nearest-parent cutoff and explicit
  `LANE_CONFIG` without `worktree_root`. Added an explicit board-option regression and
  escaped control characters in `lane config` route keys so TSV rows stay three-field
  and single-line.
- Documented the canonical board retarget, trusted parent shell-command boundary,
  route-key escaping, and unsupported Git-submodule identity. Corrected the report's
  preservation-control wording and recorded the READY review of `1ebcc02`; the
  facilitator-owned review record was not modified.
- Before Round 2 code changes, the focused 51-test suite passed 49 and failed exactly
  the board-option and TSV-key regressions. The nearest-parent and explicit-config
  assertions already passed and serve as coverage-only controls.
- Final `npm test` passed 60/60 in 8.727 seconds. All 60 deliberate negative controls
  failed in 9.990 seconds. With Herdr removed from `PATH`, 59 passed and the single
  live-Herdr guard skipped with its explicit reason in 12.924 seconds. Strict OpenSpec
  validation passed 12/12 with telemetry disabled and concurrency one.
- Verified with Node.js 20.19.4, npm 10.8.2, git 2.54.0, and OpenSpec 1.6.0. Tests were
  serialized; the unavailable run waited for three unrelated Vitest workers to exit.
  No live dispatch, interactive TTY board, submodule checkout, Linux/Windows host,
  permission-denial model, or path-creation race was exercised. No new approval is
  needed; promotion and archival remain operator actions, and nothing was pushed.

## 2026-09-09 — specification third-review corrections

- Rebased lane/spec onto promoted roots-config main at 5da8868, preserving both
  handoff histories in commit-time order and the facilitator's d0c4e53-r3 review
  record byte-for-byte. It remains historical evidence for its original SHA.
- Updated review-cli/default-config proposals, designs, deltas, briefs, guide and
  report: named independent split boundaries; deterministic sanitization/refusals;
  system-temp-only reviewer fixtures; exact exit-2 errors and publication recovery;
  route prerequisites, map maintenance, A3/A5 wording and review-effort ratification.
  Added MODIFIED root-configuration blocks for built-in precedence/provenance.
- Strict OpenSpec validation passed 14/14 after a clear load probe, telemetry off
  and concurrency 1. Links/anchors, task/split structure, retained current scenarios,
  public-text inspection and git diff --check passed. Product code, tests, packages
  and AGENTS.md match main; no product negative control was warranted for prose.
- Reused promoted main's 60/60 baseline; reserve one lane check for the final commit
  after a fresh clear load probe and report its GATE outside git. Sanitizer/defaults
  implementation, live review/Herdr, client support and minimum-version hosts remain
  unverified. No push or product implementation.

## 2026-09-09 — repository-safe roots identity

- Made the real absolute Git common directory authoritative for repository ownership,
  resolved the canonical non-linked checkout (including a primary checkout with a
  separately stored Git directory), and verified every created or registered lane's
  identity and branch before use. Existing verified legacy paths remain in place.
- Added pre/post realpath guards for selected bases and lane destinations. Open now
  refuses symlink escapes, canonical/registered/foreign checkout descendants, and
  shared-base foreign occupants before mutation, with no temporary fallback or
  automatic cleanup/adoption.
- Verified Herdr `repo_key`, `repo_root`, `checkout_path`, and linked status before
  using opaque parent/lane workspace IDs. Linked invocation targets the canonical
  repository workspace; stale foreign metadata is not used for dispatch or close.
  Added 64-code-point grapheme-safe root/repository/topic labels with collision
  digests and 32-character identity-aware randomized agent names.
- Appended operator-approved Amendment A1 verbatim to the `AGENTS.md` Product contract;
  no other amendment was applied. Documented the behavior and synced only the
  repository-identity delta into the current OpenSpec capability.
- Baseline `npm test` passed 60/60. Before implementation, the expanded suite passed
  59/67 with eight intended failures covering the new acceptance fixtures. Final
  `npm test` passed 67/67 in 13.483 seconds; all 67 deliberate negative controls
  failed in 15.889 seconds. With Herdr absent, 66 passed and the single live guard
  skipped with its explicit reason in 13.675 seconds.
- Strict OpenSpec validation passed 13/13 with telemetry disabled and concurrency one;
  `git diff --check` and the public added-line scan passed. Long Unicode fixtures
  produced distinct 62-code-point labels under the 64-point limit, and exercised
  agent names were 32 characters. Verified Node.js 20.19.4, npm 10.8.2, Git 2.54.0,
  OpenSpec 1.6.0, and installed Herdr protocol fields.
- Tests/validation were serialized after clear process probes; the no-Herdr run waited
  for another lane's Cargo test. No live Herdr mutation, real-TTY rendering, forced
  digest collision, path race, bare repository, linked separate-Git-dir invocation,
  Linux, or Windows was exercised. No additional approval is needed; review,
  promotion, and archival remain operator actions, and nothing was pushed or written
  under `docs/reviews/`.

## 2026-09-09 — repository-safe roots identity review corrections

- Rebased onto main at `ada3157`, retained both HANDOFF histories in chronological
  order, and carried the facilitator-owned review record through unchanged. Amendment
  A1 remains verbatim in the Product contract; no other amendment was applied.
- Made canonical-checkout absence non-fatal for bare-plus-linked `config` and `status`
  reads while guarding mutations; distinguished missing registered worktrees with
  `git worktree prune` guidance; and reported one Git-only close note for mismatched
  Herdr metadata.
- Consulted live agent names before start, reused one Herdr workspace listing until a
  mutation needs refresh, removed the no-op worktree-list quoting flags and redundant
  stem slice, restored verbatim spec sync, and documented the legacy-home refusal.
- Five focused tests failed before the Round 2 product changes and passed afterward.
  The Round 1 evidence is corrected to nine changed expectations, not eight. Final
  `npm test` passed 69/69 in 13.684 seconds; all 69 deliberate controls failed in
  13.441 seconds; and the no-Herdr run passed 68 with one explicit skip in 13.500
  seconds. Strict OpenSpec validation passed 15/15; `git diff --check` and the
  public-safety scan were clean.
- Verified Node.js 20.19.4, npm 10.8.2, Git 2.54.0, OpenSpec 1.6.0, and Herdr 0.8.2.
  No live Herdr mutation, forced digest/name collision, real TTY, linked separate-Git-
  directory invocation, Linux, or Windows run was performed. Promotion and archival
  remain operator actions; nothing was pushed or changed under `docs/reviews/`.

## 2026-09-09 — repository-safe roots identity promotion-test correction

- Reproduced the promotion failure by injecting `user.name=Leaked` through Git's
  environment-level configuration: 68/69 tests passed and the repository-identity
  fixture alone failed because the injected name overrode its local test identity.
- Kept the correction test-only. Fixture Git and lane children now remove inherited
  `GIT_CONFIG_*`, author, committer, and `EMAIL` variables, then use an empty
  system-temp global config with system configuration disabled. Audited the new
  identity, HOME-boundary, bare/linked, separate-Git-dir, and direct-Git fixtures.
- The identical injected-config run then passed 69/69 in 13.277 seconds. Ordinary
  `npm test` passed 69/69 in 18.821 seconds, and all 69 deliberate negative controls
  failed with zero passes in 21.115 seconds. Tests waited for clear process probes;
  no product code or review record changed, and nothing was pushed.

## 2026-09-09 — Herdr workspace snapshot refresh

- Refetched the authoritative Herdr workspace list before accepting worktree metadata,
  preventing `open` after a Git fallback and `dispatch` from comparing a newly visible
  workspace against a stale pre-create snapshot.
- Added offline fake-Herdr coverage for a failed create that still registers workspace
  metadata and for metadata becoming visible between dispatch listings. Both focused
  tests first failed with the stale-metadata refusal and include deliberate negative
  controls.
- Baseline `npm test` passed 69/69. Final `npm test` passed 71/71 after a clear load
  probe, and `git diff --check` passed. No live Herdr mutation was performed, no
  review feature work is included in this correction, and nothing was pushed.

## 2026-09-09 — foreground review R-i private evidence

- Added one foreground `lane review` dispatch with explicit source/round, captured
  full HEAD/base/gate context, route and deadline handling, private-path safeguards,
  strict `lane-review/v1` validation, unchanged-lane enforcement, and exact PASS,
  NEEDS-WORK, FAIL, or refusal outcomes. R-i creates no public record.
- Added the packaged plain-ASCII review-only template and documented its mandatory
  private write, zero-or-finite command budget, witnessed test claims, system-temp
  fixtures, forbidden lane/public/commit actions, and canonical verdict vocabulary.
  Usage, README, REFERENCE, shared guide, repository map, implementation report and
  current R-i OpenSpec requirements are synchronized. The combined task is unchecked.
- Five focused groups failed before implementation. Final `npm test` passed 77/77 in
  23.952 seconds; all 77 deliberate controls failed with zero passes in 25.125
  seconds; strict OpenSpec validation passed 16/16. Each run followed a clear load
  probe and ran alone.
- No real reviewer/live Herdr mutation, alternate host, filesystem race, semantic
  evidence verification, sanitizer, public projection, or publication boundary was
  exercised. Public review evidence remains a manual operator artifact until R-ii.
  Nothing was pushed, promoted, archived, or written under `docs/reviews/`.

## 2026-09-09 — foreground review R-ii public projection

- Added deterministic sanitization and bounded public projection after private schema
  validation and the unchanged-lane check. Repository/POSIX/drive/UNC/file-URL paths,
  OS user/home/host aliases and declared private tokens use fixed placeholders with
  exact counts, longest-first precedence, protected locations and idempotent rescans.
- Enforced plain-ASCII payloads and fail-closed ambiguity, markup, encoding, residual,
  reserved-placeholder, line/size and schema checks. Analysis/private identifiers are
  omitted. The CLI creates the public record exclusively, leaves it untracked, and
  rechecks HEAD/branch plus the exact single new file before any verdict.
- Five focused R-ii groups failed before implementation; final-audit relative-path
  preservation and repository-prefix controls also failed before their matcher fixes.
  Final `npm test` passed 81/81 in 35.956 seconds; all 81 deliberate controls failed
  with zero passes in
  35.876 seconds; strict OpenSpec validation passed 16/16. Tests and validation ran
  alone after clear load probes with Node.js v20.19.4, npm 10.8.2, Git 2.54.0, and
  OpenSpec 1.6.0. R-i's post-commit gate passed 77/77 at `76cb545`.
- README, REFERENCE, shared protocol, current OpenSpec and the implementation report
  now describe the complete boundary, including late-publication/same-round recovery.
  The combined change task is complete. No live reviewer/Herdr mutation, alternate
  host, semantic secret proof, push, promotion, archive, or `docs/reviews/` change was
  performed.

## 2026-09-09 — foreground review round-two corrections

- Fixed compact section extraction, applied all public payload restrictions to finding
  locations, delayed literal source insertion until metadata validation, narrowed the
  unwitnessed test-claim guard, and added reviewer agent/tab identifiers to timeout and
  interruption recovery messages. REFERENCE now describes the shipped public boundary
  and the finding-location policy.
- Seven focused expectations failed before the changes and passed afterward, each with
  a deliberate control. Final `npm test` passed 85/85 in 42.164 seconds; all 85
  deliberate controls failed with zero passes in 42.452 seconds; strict OpenSpec
  validation passed 16/16. Runs were serialized after clear process probes using
  Node.js v20.19.4, npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0.
- No live reviewer/Herdr mutation, alternate host, push, promotion, archive, or change
  under `docs/reviews/` was performed. The post-commit lane check remains the final
  untracked verification step.

## 2026-09-09 — foreground review round-three corrections

- Trimmed trailing blank-line runs at review section boundaries, added a specific
  Findings-spacing refusal for internal blank lines, and changed finding idempotence
  checks to use the captured description and fix fields so relative locations with
  spaces publish correctly.
- Three focused expectations failed before implementation and passed afterward, each
  with a deliberate control. Final `npm test` passed 88/88 in 52.668 seconds; all 88
  deliberate controls failed with zero passes in 49.173 seconds; strict OpenSpec
  validation passed 16/16. Every run followed a clear process probe and ran alone.
- No live reviewer/Herdr mutation, alternate host, push, promotion, archive, or change
  under `docs/reviews/` was performed. The post-commit lane check remains the final
  conversation-only verification.

## 2026-09-09 — foreground review round-four corrections

- Unified private-record and section newline normalization across completion and
  validation, including last-non-empty-line marker detection. A 39-run boundary
  matrix covers zero, one, and two blank lines throughout the record; the separately
  tested refusal for blank lines between Findings entries is now documented.
- Contained unexpected top-level review failures with exit 2, empty stdout, and one
  path-free diagnostic; a vanished post-dispatch worktree regression verifies that
  late private evidence is retained without leaking Git's raw error.
- Three of four focused expectations failed before implementation; the fourth
  confirmed the retained Findings-spacing rule. Final `npm test` passed 90/90 in
  71.879 seconds; all 90 deliberate controls failed with zero passes in 74.921
  seconds; strict OpenSpec validation passed 16/16. Runs were serialized after clear
  load probes.
- No live reviewer/Herdr mutation, alternate host, push, promotion, archive, or
  `docs/reviews/` change was performed. The post-commit lane check remains the final
  conversation-only verification.

## 2026-09-09 — foreground review round-five corrections

- Made completion detection strictly more permissive than validation by trimming
  trailing whitespace before the marker comparison. Accepted boundary fixtures all
  traverse the probe, while whitespace-only, tab-only, and CRLF malformed endings
  now fail fast with schema diagnostics instead of timing out.
- Expanded unexpected-error recovery wording to require inspection of potentially
  retained private and public evidence, with an injected post-publication failure
  proving exit 2, empty stdout, path-free output, and public-record retention.
- Documented consecutive entries for Findings, Non-claims, and Unverified and synced
  the completion invariant into the review design and both specs. Final `npm test`
  passed 92/92 in 70.787 seconds; all 92 deliberate controls failed with zero passes
  in 70.762 seconds; strict OpenSpec validation passed 16/16.
- No live reviewer/Herdr mutation, alternate host, push, promotion, archive, or
  `docs/reviews/` change was performed. The post-commit lane check remains the final
  conversation-only verification.

## 2026-09-09 — concurrent session registry and close completion

- Added immutable per-session dispatch records and atomic done markers alongside
  legacy registry arrays. Dispatch records only after verified startup/cwd/prompt,
  refuses unsafe registry paths before Herdr, reports partial persistence honestly,
  and never replays delivered work. The board merges both formats, exposes localized
  errors, marks by session ID, and resolves lane reports before canonical fallback.
- Successful Git close now marks all exact repository/topic sessions done; dirty or
  failed archive paths leave them open, no-registry close remains Git-only, and a
  post-close write failure says the lane is already closed. README, REFERENCE, usage,
  current OpenSpec, task state, and `docs/reports/session-registry.md` are synchronized
  at implementation commit `25aeab386ce5714a73f3390be42dd678ccd281e4`.
- Appended the operator-approved A2 text verbatim to the Product contract in
  `AGENTS.md`; no other amendment was applied. No file under `docs/reviews/` changed.
- Baseline `npm test` passed 92/92. Six new focused feature groups failed before
  product changes while one preservation control passed; a fake-Herdr escaping defect
  was corrected before interpreting that evidence. The 101-test deliberate-control
  run failed all tests in 90.125 seconds, and the later focused board-safety control
  failed its one selected test with 79 filtered skips in 0.122 seconds.
- Final `npm test` passed 102/102 with zero skips in 101.776 seconds. The concurrency
  case retained one legacy entry, two concurrent records, and all three simultaneous
  completion attempts in 0.070 seconds. The earlier no-Herdr matrix passed 100/101
  with one explicit skip in 130.124 seconds. Strict OpenSpec validation passed 17/17;
  staged diff checks and the public-text scan were clean.
- Verified Node.js 20.19.4, npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0. No live Herdr
  mutation, daemon-backed concurrent dispatch, alternate host, filesystem race,
  Linux/Windows run, push, promotion, archive, or independent review was performed.

## 2026-09-09 — review command-string and round-five follow-up

- Exempted Re-executed command and witness-command strings from only the prose markup
  and encoded-text checks. Their remaining machine syntax is serialized inside the
  public JSON fence after the unchanged ASCII, reserved-placeholder, path, alias,
  residual and idempotence checks; all prose fields retain the stricter refusal.
- Added a CRLF-specific private-record diagnostic and documented LF-only records plus
  verbatim command rendering in the template and REFERENCE. Updated the review design
  to name Findings, Non-claims, and Unverified as consecutive-line lists and synced the
  command/prose boundary into the change and current specs.
- Added a negative-controlled production regression covering angle brackets,
  redirection, backticks, brackets, emphasis-like syntax, a dollar variable and
  encoded-looking text in both command fields, while the same finding prose refuses.
  Reserved-placeholder and non-ASCII command controls remain refusals. The 39-case
  boundary matrix now uses an explicit two-second timeout.
- Before implementation, focused controls reproduced the command refusal and missing
  CRLF diagnostic, and the documentation control caught the Findings-only design text.
  Baseline `npm test` passed 92/92 in 73.462 seconds. Final `npm test` passed 93/93 in
  81.835 seconds; all 93 deliberate negative controls failed with zero passes in
  73.878 seconds; strict OpenSpec validation passed 16/16; `git diff --check` passed.
- Verified with Node.js v20.19.4, npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0. Runs were
  serialized after clear process probes. No live reviewer/Herdr mutation, alternate
  host, push, promotion, archive, or `docs/reviews/` change was performed. The final
  post-commit lane check remains conversation-only evidence.

## 2026-09-09 — session registry Round 2 review corrections

- Addressed both Moderate and all five Minor findings from the authoritative private
  review of `10103cd`: canonical-index tracked checks, warning-only unrelated close
  read errors, fatal done-marker write preservation, containment-before-symlink
  ordering, actionable path guidance, throwing post-delivery resolution, inline ATX
  goals, and the unused board import. Measured correction commit is
  `1c7129a3caaed5af1f6a573254ab8738e291c96e`.
- Seven focused expectations failed before product edits while one preservation case
  passed; all eight passed afterward. Final `npm test` passed 106/106 in 99.146
  seconds, all 106 deliberate controls failed in 95.005 seconds, the no-Herdr run
  passed 105 with one explicit skip in 142.780 seconds, and strict OpenSpec validation
  passed 17/17. Every run followed a clear machine-load probe and ran alone.
- Updated README, REFERENCE, and the implementation report addendum. No live Herdr
  mutation, alternate host, push, promotion, archive, or `docs/reviews/` change was
  performed; the final clean-commit gate remains conversation-only evidence.

## 2026-09-09 — session registry Round 3 review corrections

- Rebased onto main at `4e55e4c`, kept both HANDOFF histories in commit-time order,
  and preserved the facilitator-owned Round 2 record as unchanged blob `ab07a630`.
- Fixed all four Round 2 findings at `e5d3dcf`: close policy refusals now warn after
  successful Git close while marker writes remain fatal; inline goals use the first
  unfenced content line with conditional ATX stripping; one exported socket helper
  supplies both the record writer and board client. Public docs and specs match.
- Three focused tests failed before product edits; afterward those tests plus the
  retained fatal-write boundary passed. Final `npm test` passed 109/109 in 102.306
  seconds; all 109 deliberate controls failed in 98.812 seconds; without Herdr, 108
  passed and one skipped explicitly in 105.630 seconds; strict OpenSpec passed 17/17;
  full-lane diff and public-safety checks were clean.
- A2 remains the sole unchanged amendment. No live Herdr mutation, alternate host,
  push, promotion, archive, or `docs/reviews/` edit was performed. The final clean-
  commit gate remains conversation-only evidence.
