# Board actions and CLI-client UI

## Delivered behavior

- Added `lane board focus <row-id> [--repo <path>]`. It reloads the exact
  registered session, verifies its canonical repository and open lane worktree,
  refreshes the session through its recorded Herdr server, and rejects missing,
  replaced, stale, or foreign occupants before invoking `herdr agent focus` once.
  A verified unnamed live occupant is addressed by pane ID. Focus failures are not
  retried.
- Added `lane board done <row-id> [--repo <path>]`. It accepts only one canonical
  registered session under the existing repository-local, gitignored, untracked,
  no-symlink registry policy, then atomically writes only that session's display-only
  completion marker. It does not mutate Git, gates, validation, promotion, or other
  lifecycle state.
- Rewired the existing Ink table to one foreground
  `lane board --watch --json --repo <path>` observation child and one argument-array
  CLI child per explicit focus or done action. The UI no longer imports target-file,
  Git, registry, or Herdr socket services. Enter/`a` focuses, `d` marks done, `r`
  restarts only observation, and `q` closes the client.
- Added a dependency-free CLI client that frames split and batched schema-v1 JSON
  lines, surfaces malformed frames, diagnostics, child failures, and action
  refusals, reconnects only observation, and permanently kills observer/action
  children and timers on close. The existing table layout and navigation remain.
- Moved presentation-only table helpers into `board/view.mjs`, retained their
  `board/board.mjs` exports, synchronized the current OpenSpec capability, completed
  the change task, and documented all new commands and keys in CLI usage, README,
  and REFERENCE.

## Files and contract

- `lane.mjs`, `board/actions.mjs`, `board/cli-client.mjs`, `board/view.mjs`,
  `board/app.mjs`, and `board/board.mjs`: verified actions and the UI process
  boundary.
- `test/lane.test.mjs`: offline temporary-repository, fake-Herdr, fake-CLI, framing,
  refusal, one-call, teardown, import-boundary, and isolated-install regressions.
- `README.md`, `docs/REFERENCE.md`, the board-actions task, and
  `openspec/specs/board-session-actions/spec.md`: public command and capability
  documentation.

The operator-approved A3 text replaced the Herdr-optional Product contract bullet
in `AGENTS.md` verbatim. No other contract amendment was applied. No file under
`docs/reviews/` was changed.

## Negative controls and verification

- Baseline `npm test` passed 115/115 with zero skips in 105.361 seconds after a
  clear machine-load probe.
- Before product changes, five socket-free focused groups failed at the intended
  absent action grammar/modules/routing/UI-client boundary. The socket-backed focus
  group initially stopped before product behavior because the Codex sandbox rejected
  its temporary Unix listener with `listen EPERM`; the same focused test passed
  outside that socket restriction.
- After implementation, the combined affected set passed 7/7 in 1.423 seconds,
  including exact argument arrays, one process per action, split/batched frames,
  malformed JSON, observer child errors, and close during reconnect/refresh.
- Before the upstream sync, `npm test` passed 121/121 with zero skips in 109.948
  seconds, and `LANE_TEST_NEGATIVE_CONTROL=1 npm test` failed all 121 deliberate
  controls with zero passes in 102.969 seconds.
- Local `main` advanced during the work. The lane was cleanly rebased from
  `8881fba` onto `a7b0ac7`, retaining the promoted review HANDOFF entries before
  this entry. On the rebased tree, `npm test` passed 126/126 with zero skips in
  113.226 seconds. The focused post-rebase negative control failed all seven selected
  tests with zero passes and 97 filtered skips in 1.433 seconds.
- Strict OpenSpec validation passed 19/19 with telemetry disabled and concurrency
  one. `git diff --check` and the public-safety review passed. Every test or
  validation run followed a clear executable-aware load probe and ran alone.
- Verified Node.js v20.19.4, npm 10.8.2, Git 2.54.0, Herdr 0.8.2, and OpenSpec 1.6.0.

## Limits and unverified areas

The acceptance tests use offline fake CLI processes and a fake local Herdr protocol
server. No real interactive TTY session, live Herdr focus mutation, alternate host,
Linux/Windows run, push, promotion, archive, or independent review was performed.
The installed Ink application was not launched because no suitable real TTY/live
Herdr session was part of this lane; that check is explicitly skipped. Promotion,
review records, and archival remain facilitator/operator actions. The required final
clean-commit `lane check` is conversation-only evidence and is not recorded here so
it can measure the final commit.
