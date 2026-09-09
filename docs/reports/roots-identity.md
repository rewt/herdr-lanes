# Roots identity implementation report

Verdict: READY for operator promotion after the required post-commit gate.

## Delivered behavior

- `lane.mjs` now treats the real absolute Git common-directory path as repository
  identity, resolves the canonical non-linked checkout, verifies every registered or
  newly created lane's identity and branch, and reports the full canonical checkout,
  repository identity, and development-root identity from `lane open`.
- New destinations are resolved through existing real-path ancestors and refused
  before branch or Herdr mutation when they escape the selected base, lie in a
  canonical/registered/foreign checkout, or are occupied by another repository.
  Created paths are checked again. Existing registered legacy locations are retained.
- Herdr parent, source, and lane workspace metadata must match canonical `repo_key`,
  `repo_root`, `checkout_path`, and linked status before opaque workspace IDs are
  used. Linked invocations still create children under the canonical repository
  workspace; stale foreign metadata is not used for dispatch or close.
- New labels use `<root-label>/<repo-name>:lane-<topic>`. Long or colliding labels
  keep grapheme-safe root/repository/topic fragments and an identity digest within 64
  Unicode code points. Agent names keep a readable stem plus identity and random
  suffixes within Herdr's 32-character grammar.
- `README.md` and `docs/REFERENCE.md` document ownership, path refusal, label/name,
  stale-metadata, and compatibility behavior. The repository-identity delta is synced
  to `openspec/specs/repository-identity/spec.md`.
- Operator-approved Amendment A1 was appended verbatim to the `AGENTS.md` Product
  contract. No other contract amendment was applied. Lane never sets Git author or
  signing identity.

## Regression evidence

- Baseline at the lane point: 60/60 tests passed in 7.291 seconds.
- Before product changes, the expanded suite passed 59/67 and failed eight intended
  regression fixtures: same-named root/repository identity labels and agent stems;
  long Unicode labels; realpath/checkouts; changed registered ownership; stale Herdr
  metadata; linked canonical parent labeling; separate Git-directory identity; and
  shared-base foreign ownership messaging.
- Final ordinary `npm test`: 67/67 passed in 13.483 seconds.
- `LANE_TEST_NEGATIVE_CONTROL=1 npm test`: all 67 deliberate controls failed, with
  zero passes, in 15.889 seconds.
- With Herdr removed from `PATH`: 66 passed and the single live-Herdr mismatch guard
  skipped with `herdr is absent; herdr-dependent tests are skipped`, in 13.675
  seconds. Git-only open/status/promote/close coverage remained active.
- Strict OpenSpec validation passed 13/13 with telemetry disabled and concurrency one.
  `git diff --check` passed, and the added-line public-safety scan found no host paths,
  private source names, or raw socket/identity data.

The Unicode fixtures used combining-mark and multi-code-point emoji graphemes with
common prefixes. Both generated labels measured 62 code points against the 64-point
limit, retained all three readable fragments, and had distinct eight-hex identity
suffixes. Exercised agent names measured 32 characters and matched Herdr's naming
grammar. Fake Herdr replies used the installed protocol's real workspace/worktree/
agent field names and opaque IDs.

## Remaining limits and approval

No live Herdr workspace was created, dispatched, or closed, and no real TTY label
rendering was exercised. No forced SHA-256 prefix collision, concurrent path-creation
race, bare repository, linked invocation with an externally separated Git directory,
Linux host, or Windows host was tested. The post-create checks cover path races by
refusal but intentionally do not remove or adopt a mismatched result.

Verified with Node.js 20.19.4, npm 10.8.2, Git 2.54.0, OpenSpec 1.6.0, and the installed
Herdr command/protocol schema. Tests and validators ran one at a time after clear
process probes; one no-Herdr run waited for another lane's Cargo test to finish.

No additional contract approval is needed. Promotion, the optional independent
review record, and post-promotion archival remain operator actions. Nothing was
pushed, published, promoted, archived, or written under `docs/reviews/`.
