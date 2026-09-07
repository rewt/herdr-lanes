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
