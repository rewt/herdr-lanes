# Foreground lane review implementation report

Status: R-i private evidence is READY for its post-commit gate. R-ii public
projection is not yet delivered.

## R-i delivered behavior

- Added `lane review` with required explicit round and OpenSpec change or brief
  source, default/overridable review route, 1800-second default and bounded timeout,
  duplicate/unknown option refusal, and review-wide exit 2 errors.
- Resolves the reviewed lane and canonical checkout through existing Git identity and
  worktree metadata, captures full HEAD/base/merge-base, requires a clean target, and
  verifies ignored private and trackable public round paths without overwriting.
- Renders the packaged review-only template with literal sources, current gate status,
  invocation-bound review ID, exact private/public paths, zero-or-explicit run budget,
  and system-temp-only test/mutation rules. The template requires plain ASCII payload
  prose and uses an ASCII finding separator.
- Dispatches exactly one reviewer through the existing Herdr path, bounds subprocesses
  and foreground private-file polling by the deadline, preserves late/partial evidence,
  and takes no follow-up lifecycle action.
- Validates the 1 MiB UTF-8 `lane-review/v1` envelope: canonical verdict, full identity
  metadata, fixed ordered sections, tagged repository-relative findings, exact JSON
  execution/witness fields, mandatory limits, and completion marker. It then rechecks
  HEAD, branch, and the complete lane tree before emitting a verdict.
- R-i stdout is exactly PASS with exit 0 or NEEDS-WORK/FAIL with exit 1. Refusals,
  timeout, interruption, malformed evidence, or mutation exit 2 without a verdict.
  The validated private path is named on stderr. No public record is created.
- Updated usage, README, REFERENCE, shared OpenSpec guidance, template map, and the
  current foreground-lane-review spec with only R-i's complete requirement blocks.
  The combined change task remains unchecked and public evidence remains a manual
  operator artifact until R-ii lands.

## R-i regression evidence

- Baseline before feature work: `npm test` passed 69/69 in 14.947 seconds after a
  clear process probe.
- Before implementation, the five focused review groups all failed: option/source
  exits, canonical verdict outcomes, source/gate rendering, invalid/incomplete/
  timeout/mutation evidence, and output path preflight. The carried workspace refresh
  tests were added and observed failing before their separate correction commit.
- Final R-i `npm test` passed 77/77 in 23.952 seconds after a clear process probe.
- `LANE_TEST_NEGATIVE_CONTROL=1 npm test` deliberately failed all 77 controls with
  zero passes in 25.125 seconds. The focused review controls likewise failed all
  selected tests.
- Strict OpenSpec validation passed all 16 items with telemetry disabled and
  concurrency one. `git diff --check` and a full public-text/diff review are required
  immediately before the R-i commit.

The fake Herdr fixture uses the existing dispatch path and real protocol field shapes.
It writes only the rendered private path, supports all three verdicts, invalid SHA/
witness/finding modes, incomplete/oversized records, and a prohibited public mutation.
Fixtures live under the system temporary directory and are removed. One asynchronous
signal test confirms SIGTERM returns exit 2, emits no verdict, leaves the reviewer
untouched, and sends no close/remove follow-up. It was added as coverage after the
core boundary existed; its deliberate control was observed in the final full control
run rather than as a separate pre-implementation product failure.

## R-i limits

No real reviewer, live Herdr mutation, stalled real Herdr subprocess, Windows/Linux
host, SHA-prefix collision, concurrent private writer, permission-denial filesystem,
or maximum-size valid report was exercised. The checker validates evidence structure,
not the truth or semantic strength of reviewer claims. R-i intentionally does not
sanitize or publish private evidence; operators must not copy it into tracked files
without separate inspection.

No dependency, configuration key, fix loop, background watcher, promotion rule,
wrapper, UI behavior, push, promotion, archive, or `docs/reviews/` record was added.
R-ii will add deterministic sanitization and the after-check publication boundary in
a separate commit before the combined task can be marked complete.
