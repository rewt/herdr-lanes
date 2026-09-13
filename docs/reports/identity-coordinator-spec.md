# Identity coordinator specification report

Date: 2026-09-13. Topic: `identity-coordinator-spec`. Status: proposal ready for
independent review, not adopted protocol, implemented console behavior, or live
pilot result.

## Delivered

- `openspec/changes/identity-coordinator/` contains a proposal, authority and
  report design, two proposed capability deltas, an indexed sequence, and three
  bounded briefs: manual adoption, CLI read-model, and later console detail.
- `docs/identity-coordinator-pilot.md` and its measurement template prepare a
  one-identity/two-project manual comparison. Selection is deliberately pending
  operator input. The manual pilot can precede console extensions after protocol
  review and project selection.
- No runtime, dependency, current OpenSpec capability, supervisor release,
  identity/account, inventory/frame lane, or `docs/reviews/` file changed.

## Ownership and evidence decision

The coordinator owns the explicit canonical-project roster, daily outcomes,
priority/dependency order and finite budgets. Every project has exactly one
integration owner. A project supervisor, when appointed for sustained/multi-lane
work, fills that role and owns detailed evidence/acceptance. For small work the
coordinator can be the integration owner and assign an engineer directly. The
coordinator consumes the supervisor's compact result instead of repeating its
detailed review. Project-required independent review and the existing closeout
protocol remain separate checks.

Assignments carry stable IDs/revisions and concise acceptance, budget, owner,
milestone, blocker/decision, evidence and next action. Reports carry report IDs,
sequences and changed results. Duplicate/conflicting/out-of-order, failed-delivery,
unavailable-owner, stale-handoff and resumption paths are explicitly held for
primary-evidence reconciliation, without automatic retry or role reassignment.
Git author, GitHub credential, Codex profile, and development-root grouping are
separate from canonical repository and coordination authority. A root-only request
cannot perform lane lifecycle work.

## Read-only console audit

`git show` of `lane/board-inventory` at `1fdd8f9` and `lane/board-frame` at
`9e8c8f9` was read-only; neither branch was edited or rebased. Inventory's schema-v1
row already exposes stable `row_id`, `repo_id`/`root_id`, goal/provenance, brief,
role, lane report/review, gate, status/staleness, and scope/coverage. Its report
field is not the latest coordinator delta; role/name is not the integration owner.
Frame attention is based on technical status/gate/deadline/review/freshness; it has
no coordination blocker or decision. Frame is explicitly repository-scoped until
later integration.

The proposed opt-in read-model is a distinct later CLI slice, after promoted
inventory and bounded sampling. It accepts one explicit local snapshot, verifies
canonical project and stable session-row joins, and publishes only source-labeled
nullable owner/assignment/latest-delta evidence. Duplicates or absent fields stay
unknown. A later UI slice follows frame plus complete details and consumes CLI data
only; it separates coordination from technical attention. Sampling's concurrency,
freshness and coverage prerequisites stay with `board-sampling`; complete details
stay with `board-details`; idea CLI/composer remain separate explicit-launch work.
No display datum can dispatch, focus, validate, review, promote, close or push.

## Verification and limits

Before edits, `npm test` passed 209/209, zero failures/skips, in 309.880 seconds
after a clear process probe. Another suite occupied the slot during initial reading;
this lane did not start a competing test. The operator later reserved inventory's
focused failure-first slot; our baseline had already completed and we ran no test
while that slot was reserved. No behavior changed, so no prose mirror-image test or
behavior negative control was added. Focused strict OpenSpec validation passed for
`identity-coordinator`; repository-wide strict validation passed 21/21, concurrency
one. Final whitespace/public-safety and post-commit gate evidence are recorded in
the handoff conversation because a post-commit gate cannot be committed without
becoming stale.

Environment: Node.js 20.19.4, Git 2.54.0, OpenSpec 1.6.0. No live report delivery,
project selection, supervisor adoption, pilot measurement, console implementation,
alternate-host verification, independent review, promotion, close, push, or
publication occurred. No pricing, usage, or savings estimate is asserted.
