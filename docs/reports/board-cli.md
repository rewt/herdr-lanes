# Board CLI read interfaces

## Delivered behavior

- `lane board --once [--repo <path>]` now produces its plain snapshot directly
  through dependency-free services owned by `lane.mjs`.
- `lane board --json [--repo <path>]` emits one compact schema-v1 JSON document;
  `lane board --watch --json [--repo <path>]` emits foreground newline-delimited
  documents for the initial sample and observation events.
- `--repo` resolves from the caller, selects the canonical Git repository and its
  layered configuration, and works when the caller is outside a checkout. Duplicate,
  contradictory, unknown, extra, and missing arguments refuse before observation.
- Schema v1 exposes explicit scope/coverage/errors, canonical repository and root
  identity, stable session row IDs, structured Git/gate/report/message state, nullable
  unknowns, and raw host measurements. Gate mismatch and observation staleness remain
  independent; the historical output sample is labeled `pane-output`.
- Watch shutdown on SIGINT, SIGTERM, downstream pipe closure, fatal service error,
  pending snapshot, or pending reconnect permanently closes client requests,
  subscriptions, and timers. Observation sends only snapshot/subscription requests;
  it writes no registry state and performs no focus or lifecycle action.
- The existing Ink entrypoint is unchanged. Its imported board services and the
  dependency-free direct board entrypoint retain their existing behavior.

## Files

- `lane.mjs`: board argument parsing, canonical target selection, one-shot reads,
  JSON framing, foreground watch orchestration, signal and EPIPE cleanup, and usage.
- `board/board.mjs`: structured Git/gate/report/host data, observation error capture,
  timestamped pane output, and schema-v1 document projection.
- `test/lane.test.mjs`: five offline temporary-repository acceptance groups using a
  local fake protocol-20 socket server and an isolated tool copy without packages.
- `README.md` and `docs/REFERENCE.md`: commands, dependency boundary, schema,
  unknown/error semantics, and lifetime behavior.
- `openspec/specs/board-cli-interface/spec.md` and the completed change task: only
  this implemented read-interface delta was synchronized into current specs.

`board/app.mjs` remains byte-identical to its pre-change blob
`7de812842cc65bf0b7cc1b40a74902c2b76d8f08`. No file under `docs/reviews/` changed.

## Negative controls and verification

- Baseline `npm test`: 109/109 passed, zero skips, in 107.459 seconds after a clear
  machine-load probe.
- Before product changes, all five new focused groups failed: canonical `--repo` and
  JSON shape/read-only behavior, built-ins-only operation, duplicate/contradictory
  option handling, localized service errors, and watch framing/teardown. An initial
  sandboxed attempt could not create local sockets; the repeated offline run with
  local Unix-socket access reached product behavior and passed 0/5.
- Focused post-change run: 5/5 passed in 1.704 seconds. It exercised split and batched
  frames plus SIGINT/SIGTERM, pending snapshot, pending reconnect, and closed-consumer
  shutdown.
- Complete post-change `npm test`: 114/114 passed, zero skips, in 110.725 seconds.
  The retained client cases cover split/batched responses, timeout, Herdr error
  bodies, close-before-reply, and subscribe-after-permanent-close.
- Final pre-commit `npm test`: 114/114 passed, zero skips, in 108.233 seconds.
- `LANE_TEST_NEGATIVE_CONTROL=1 npm test`: all 114 controls failed with zero passes
  in 100.707 seconds.
- Strict OpenSpec validation passed 18/18 with telemetry disabled and concurrency one.
  `git diff --check`, the added-line public-safety scan, and the unchanged-UI check
  passed.
- Verified Node.js 20.19.4, npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0. Every test or
  validation run followed a clear process probe and ran alone.

## Limits and approval

The new tests use an offline fake local Herdr server; no live board snapshot/event or
Herdr mutation, real TTY, Linux/Windows host, or observation interval longer than the
bounded teardown cases was exercised. This phase remains repository-scoped and
registered-session-only: machine discovery, semantic messages, actions, UI rewiring,
and asynchronous bounded multi-repository sampling remain later changes. No contract
amendment or further approval is needed for this read-only delta. Promotion,
archival, and any independent review remain operator actions; nothing was pushed or
published.
