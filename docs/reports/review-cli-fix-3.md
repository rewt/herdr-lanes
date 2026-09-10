# Review CLI follow-up 3 implementation report

Status: READY for final commit and the required post-commit `lane check`.

## Delivered behavior

- Removed the whitespace-spanning slash heuristic from public sanitization. Absolute
  path handling now uses only the concrete matcher for contiguous POSIX tokens, file
  URLs, drive-letter paths, and UNC paths, without a syntax exemption. Regex literals
  and slash-delimited phrases may therefore become `[ABS_PATH]` while the record still
  publishes; reviewers should spell patterns in words. A declared identifier in
  finding prose still refuses publication.
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

- Round 2 restored the concrete POSIX start boundary after `)`, `]`, and `}` by
  temporarily skipping complete JavaScript regex-literal and shell
  command-substitution tokens. Round 4 supersedes that historical approach; the
  current sanitizer has no syntax exemption.
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

- Removed opaque shell command-substitution skipping while retaining a narrower regex
  exemption at that round. Round 4 supersedes that exemption with unconditional
  concrete path matching because syntax-shaped paths remained ambiguous. Shell
  command-substitution bodies and trailing path text continue to be sanitized.
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

## Round 4 corrections

- Removed the regex-literal scanner and the syntax-range replacement helper. All
  non-placeholder text now passes directly through the concrete absolute-path
  matcher; the already-removed command-substitution helper remains absent. This
  removes 60 net lines from `lane.mjs` (10 additions and 70 deletions).
- Adopted asymmetric sanitization: matching regex literals and slash-delimited phrases
  may become `[ABS_PATH]`; the concrete matcher does not itself refuse them, although
  the ambiguity rules can still refuse the whole record. Reviewers are directed to
  spell patterns in words. Shell command bodies remain scanned, while their remaining
  syntax stays verbatim inside the public JSON fence.
- Removed parentheses from the file-URL path class so redaction inside `$()` preserves
  the closing delimiter. Kept the settle window, timeout floor, compact blank-boundary
  matrix, post-repository-conversion ambiguity ordering, and multi-token continuation
  scan unchanged.
- Added independently controlled fixtures for two-segment and deeper flag-letter POSIX
  paths, a drive-letter flag segment, an external path inside a regex-like character
  class, protected finding locations, slash-phrase over-redaction, and a file URL in a
  command substitution. REFERENCE and design again list the ambiguous spaced-path
  refusal, and the template gives its public-safe alternative.
- Before production changes, the seven-test focus produced four expected failures and
  three already-safe coverage passes in 16.245 seconds. After implementation and two
  test-expectation corrections for documented line wrapping and intentional double
  over-redaction, all seven passed in 18.853 seconds. Every test retains its own
  deliberate `negativeControl`.
- Baseline `npm test` passed 129/129 with zero skips in 227.816 seconds. Final
  `npm test` passed 135/135 with zero skips in 242.151 seconds. The final
  `LANE_TEST_NEGATIVE_CONTROL=1 npm test` produced zero passes and all 135 deliberate
  failures in 236.331 seconds.
- Strict OpenSpec validation passed all 19 items. Verification used Node.js 20.19.4,
  npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0. No Unix-socket `listen EPERM` occurred.
- No live reviewer/Herdr mutation, alternate operating system, push, promotion,
  archive, board-code edit, or change under `docs/reviews/` was performed. The final
  commit and single post-commit gate are recorded in the operator conversation.

## Round 5 corrections

- Backslash-escaped forward separators are decoded in the residual rescan and before
  protected-value path inspection, so escaped external paths in finding prose,
  finding locations, and commands refuse instead of publishing.
- A concrete absolute-path match immediately followed by an opening parenthesis now
  refuses as ambiguous parenthesized residue. The concrete matcher still only
  replaces; spaced-path and parenthesized-residue rules can refuse the whole record.
- Added separately controlled fixtures for all three escaped fields, parenthesized
  POSIX and file-URL residues, and a relative-looking protected location. The latter
  passed on Round 4 but failed in 2.860 seconds against an isolated `e1edc15` tool
  copy, proving it distinguishes the exemption removal.
- Before implementation, the six-case focus failed five expectations and passed the
  Round 4 location guard in 13.680 seconds; the converted general-parenthesis case
  also failed alone in 2.860 seconds. After correction, all seven affected cases
  passed in 16.219 seconds.
- Baseline `npm test` passed 135/135 in 246.662 seconds. Final `npm test` passed
  140/140 with zero skips in 258.378 seconds; the deliberate-control run produced
  zero passes and all 140 expected failures in 252.556 seconds. Strict OpenSpec
  validation passed 19/19.
- Verification used Node.js 20.19.4, npm 10.8.2, Git 2.54.0, and OpenSpec 1.6.0.
  No Unix-socket `listen EPERM` occurred. No live reviewer/Herdr mutation, alternate
  operating system, push, promotion, archive, board-code edit, or `docs/reviews/`
  change was performed. The final commit and gate remain conversation-only evidence.
