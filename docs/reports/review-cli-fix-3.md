# Review CLI follow-up 3 implementation report

Status: READY for final commit and the required post-commit `lane check`.

## Delivered behavior

- Removed the whitespace-spanning slash heuristic from public sanitization. Absolute
  path handling now uses only the concrete matcher for contiguous POSIX tokens, file
  URLs, drive-letter paths, and UNC paths. Its POSIX start boundary also excludes a
  slash immediately following common JavaScript regex-closing delimiters.
- A finding description containing a JavaScript regex literal with flags, a
  slash-delimited phrase, and an HTTPS-like token now validates and projects those
  forms literally. A real external absolute path still becomes `[ABS_PATH]`, and a
  declared identifier in finding prose still refuses publication.
- After the completion marker appears, review now requires the private record's size
  and modification time to remain unchanged for two continuous seconds. Any change
  resets the interval. The command then re-reads the bytes with metadata checks
  immediately before validation and projects only that final read.
- REFERENCE, the shared OpenSpec guide, review design, change delta, and current
  capability now document the concrete path boundary and settle interval. No contract
  amendment, configuration key, command option, dependency, board behavior, or
  promotion rule changed.

## Regression evidence

- Baseline `npm test` passed 127/127 with zero skips in 110.784 seconds after a clear
  process probe.
- Before product changes, the two focused regressions both failed. The slash-prose
  case exited 2 with `projected payload contains an ambiguous absolute path`; the
  rewrite case returned the first `PASS` with exit 0 instead of the later
  `NEEDS-WORK` record.
- After implementation, the two focused regressions passed in 8.664 seconds. The
  rewrite fixture writes a complete PASS record, rewrites it after 500 milliseconds,
  and verifies that the final NEEDS-WORK verdict and projected field are used after
  the settle interval.
- A broader five-test review focus passed its four runtime groups; its documentation
  group first exposed line-wrap-sensitive test matchers, which were corrected and
  then passed in a separate focused run.
- Final `npm test` passed 129/129 with zero failures or skips in 309.921 seconds.
  `LANE_TEST_NEGATIVE_CONTROL=1 npm test` deliberately failed all 129 controls with
  zero passes in 295.665 seconds, including both new controls.
- `OPENSPEC_TELEMETRY=0 openspec validate --all --strict --no-interactive
  --concurrency 1` passed all 19 items. All test and validation commands ran alone
  after a clear process probe. `git diff --check` passed.

## Environment and limits

Verification used Node.js 20.19.4, npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0.
Fake reviewers and temporary repositories remained under the system temporary
directory and were cleaned up. No Unix-socket `listen EPERM` occurred.

No live reviewer or Herdr mutation, alternate operating system, filesystem timestamp
resolution edge, same-size/same-mtime adversarial rewrite, push, promotion, archive,
or change under `docs/reviews/` was performed. The metadata checks narrow the rewrite
race but do not provide an OS-level lock against a write beginning after the final
read. The final clean-commit gate remains conversation-only evidence.

## Round 2 corrections

- Restored the concrete POSIX start boundary after `)`, `]`, and `}`. Complete
  JavaScript regex-literal tokens with flags and shell command-substitution tokens
  are skipped as syntax instead, so plain and quantifier-ending regex bodies project
  literally while protected locations containing delimiter-following absolute paths
  refuse.
- Reintroduced a narrow ambiguity refusal: when a concrete absolute-path match is
  followed by a space and the next whitespace-delimited token still contains a path
  separator, publication stops instead of exposing a possible spaced-path suffix.
  The check runs before repository-root conversion and the existing alias rescan is
  unchanged.
- Raised the explicit timeout floor from one to three seconds so a caller-selected
  deadline can include the two-second settle window and a polling interval. Corrected
  the design to place malformed-record validation after that settle interval.
- Reduced the accepted blank-boundary end-to-end matrix from 39 invocations to four
  representative fixtures. It retains record-start, after-heading, before-heading,
  after-marker, and zero/one/two-blank-line coverage without paying 39 settle windows.
- The four focused behavior/documentation groups failed before production changes
  with zero passes in 31.819 seconds. After correction, all four passed in 51.564
  seconds; each group retains its deliberate `negativeControl`.
- The final ordinary `npm test` passed 129/129 with zero skips in 235.993 seconds.
  The representative boundary test took 11.092 seconds, down from 113.762 seconds in
  the 338.171-second Round 2 baseline; the complete suite improved by 102.177 seconds.
- The final `LANE_TEST_NEGATIVE_CONTROL=1 npm test` produced zero passes and all 129
  deliberate failures in 234.225 seconds. An earlier complete attempt also reached
  zero passes and 129 failures but its sandboxed board socket coverage reported
  `listen EPERM: operation not permitted`; the final rerun reached the intended
  socket controls.
- Strict OpenSpec validation passed all 19 items. `git diff --check` and the added-line
  public-text scan passed, and main remained at `3367cd5`, so no rebase was required.
  Verification used Node.js 20.19.4, npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0.
  The final commit and post-commit gate are recorded in the operator conversation.

## Round 3 corrections

- Simplified syntax handling to exempt only complete JavaScript regex literals. A
  candidate now ends at its first unescaped slash, so an external POSIX path ending
  in a flag-letter segment cannot be mistaken for regex syntax. Shell
  command-substitution delimiters remain literal while their bodies and trailing path
  text are sanitized; fixtures cover POSIX, drive-letter, and UNC paths inside them.
- Moved spaced-path ambiguity detection after repository-root conversion. Its
  continuation scan now crosses any number of separator-free tokens, stops at an
  independently sanitizable absolute path, and refuses a separator-bearing suffix.
  Two adjacent in-repository absolute paths therefore convert safely.
- Corrected the representative boundary matrix to exercise one and two leading blank
  lines and a zero-blank before-section boundary. REFERENCE, the review design, and
  both synced capability specs describe the corrected scanner and ordering.
- Before production changes, a four-group focus recorded three failures in 54.040
  seconds: adjacent repository paths refused, command-substitution paths leaked, and
  a protected flag-segment path projected. A reordered refusal focus then recorded
  the multi-token spaced-path leak in 36.417 seconds. Every affected group retains a
  deliberate `negativeControl`.
- After implementation, all four focused groups passed in 76.485 seconds. The final
  ordinary `npm test` passed 129/129 with zero skips in 231.430 seconds, compared with
  the clean 222.803-second baseline. The final
  `LANE_TEST_NEGATIVE_CONTROL=1 npm test` produced zero passes and all 129 deliberate
  failures in 221.923 seconds.
- Strict OpenSpec validation passed all 19 items. `git diff --check` and the added-line
  public-text scan passed. Verification used Node.js 20.19.4, npm 10.8.2, Git 2.54.0,
  and OpenSpec 1.6.0. No Unix-socket `listen EPERM` occurred.
- No live reviewer/Herdr mutation, alternate operating system, push, promotion,
  archive, board-code edit, or change under `docs/reviews/` was performed. The final
  commit and single post-commit gate are recorded in the operator conversation.
