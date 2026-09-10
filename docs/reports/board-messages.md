# Substantive agent message previews

## Delivered behavior

- Online plain, JSON, and watch board reads now use the same conservative Codex
  and Claude rendered-output adapters. The table shows the first substantive line;
  JSON preserves the bounded multiline message and its provenance.
- Recognized prompts, echoed input, tool blocks, spinners, dividers, and footer
  chrome cannot become `LAST MESSAGE`. Unsupported, footer-only, tool-only, or
  ambiguous output is explicitly unavailable, with any terminal excerpt separately
  labeled `pane-output`.
- Each read requests at most 200 `recent_unwrapped` lines and retains at most the
  final 16 KiB. Results expose kind, observation time, Herdr revision, truncation,
  staleness, and limitations. Read errors retain a matching cached preview only as
  stale.
- Cached previews are memory-only and keyed to the current Herdr agent-session
  occupant. A response that completes after the occupant changes is discarded.
- Watch mode reads registered panes on the existing five-second refresh and after
  status or output changes, with event reads coalesced to at most one per pane per
  second. Tripwire matching remains a separate, live-only subscription.

## Files

- `board/message-preview.mjs`: built-ins-only parsing, byte/excerpt limits,
  occupant identity, stale retention, and late-response rejection.
- `board/herdr-client.mjs`: protocol-20 `pane.read` adapter with explicit text,
  ANSI-stripping, source, and line parameters.
- `board/board.mjs`, `board/view.mjs`, and `lane.mjs`: shared one-shot/watch reads,
  event coalescing, table/UI summaries, structured provenance/coverage, and localized
  message errors.
- `test/message-preview.test.mjs`, `board/test/board.test.mjs`,
  `board/test/herdr-client.test.mjs`, and `test/lane.test.mjs`: synthetic Codex and
  Claude fixtures, protocol-shape tests, bounded/stale/replacement cases, and fake
  Herdr one-shot/watch parity.
- `README.md`, `docs/REFERENCE.md`, the completed change task, and
  `openspec/specs/agent-message-preview/spec.md`: public behavior, limits, schema,
  and only this implemented delta synchronized into the current specification.

`board/app.mjs` and every file under `docs/reviews/` remain unchanged.

## Negative controls and verification

- Baseline `npm test`: 120/120 passed, zero skips, in 110.716 seconds after a clear
  load probe.
- Before product changes, the five parser/read tests failed 0/5 because the new
  module did not exist. The first fake-Herdr integration attempt was unexercised
  because the sandbox refused the system-temp Unix socket with `listen EPERM`; an
  immediate run with local socket access reached product behavior and failed 0/1
  because the board still rendered `LAST OUTPUT` instead of `LAST MESSAGE`.
- Post-change focused parser tests passed 5/5 in 0.033 seconds. Before integration,
  the selected fake-Herdr test passed 1/1 with 98 unrelated tests skipped in 1.314
  seconds, and the combined board/client/parser focus passed 28/28 in 0.347 seconds.
- The parity test observed exactly four bounded reads: one plain snapshot, one JSON
  snapshot, one initial watch snapshot, and one coalesced read for two rapid watch
  events. Every request used 200 lines, `recent_unwrapped`, text format, and ANSI
  stripping.
- Complete post-change `npm test`: 127/127 passed, zero skips, in 112.536 seconds.
  `LANE_TEST_NEGATIVE_CONTROL=1 npm test` then failed all 127 named controls with
  zero passes in 104.647 seconds.
- The lane was then rebased onto concurrent board-actions implementation `3ef8230`,
  retaining its HANDOFF entry first and preserving its CLI-only UI/action boundary.
  On the integrated tree, the model/client/parser focus passed 28/28 in 0.340 seconds
  and the fake-Herdr parity case passed 1/1 with 104 unrelated tests skipped in 1.282
  seconds. Full `npm test` passed 133/133, zero skips, in 114.802 seconds. A final
  no-conflict rebase onto facilitator-reviewed tip `8a98b80` inherited its review
  record unchanged.
- The first integrated negative-control run encountered the known sandbox-only Unix
  socket `listen EPERM` in the inherited board-focus case and was not used as control
  evidence. Repeating with local socket access failed all 133 deliberate controls
  with zero passes or skips in 110.015 seconds. No test or product code was changed
  for the sandbox artifact.
- Final strict OpenSpec validation passed 20/20 with telemetry disabled and
  concurrency one. All test and validation runs were serialized after clear
  executable-aware process probes.
- Verified Node.js 20.19.4, npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0. The new tests
  are offline, create fixtures under the system temp directory, clean them up, and
  inherit the suite's isolated Git configuration with system configuration disabled.

## Remaining limits and approval

The adapters intentionally recognize only the covered visible Codex and Claude
formats. They do not provide a semantic transcript, crawl vendor files, recover
missing alternate-screen history, or guarantee an answer when Herdr reports only a
truncated tail. Raw excerpts remain terminal output, never inferred messages.

No live Herdr pane, interactive TTY, alternate host, model API, action against a
non-fixture session, push, promotion, archive, or independent review was exercised.
No contract amendment or further implementation approval is needed for this read-only
delta. Promotion, archival, and any independent review remain operator actions; the
final clean-commit gate is conversation-only evidence.
