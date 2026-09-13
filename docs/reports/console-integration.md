# Lane console integration

Recorded 2026-09-13. This is an integration checkpoint, not a claim that the
complete console has shipped. The operator requested review of the existing
lanes, durable evidence, and the start of console integration.

## Starting state

The table below is historical starting evidence. The latest checkpoint is the
Afternoon acceptance section at the end of this report.

The canonical release is `48ee44caa26de9e6b83b99b1f2a037fe99ee2cac`, tagged
`supervisor/2026.09.13.1`. Its product tree was verified by 209/209 offline tests
with zero skips in 316.814 seconds; release-focused checks passed 3/3.

| Lane | Delivery commit | Saved validation | Independent review |
| --- | --- | --- | --- |
| board-inventory | e9e0d2b7ea657d6912443fb88b256d3f8aa729e6 | Matching HEAD, npm test exit 0, 317.176 seconds | Round 1 NEEDS-WORK |
| board-frame | 9e8c8f99ed1ffdaf35de6694fbe0a6bfbf33161f | Matching HEAD, npm test exit 1, 309.560 seconds | Not started |

Both worktrees were clean at inspection. Their committed reports are
`docs/reports/board-inventory.md` and `docs/reports/board-frame.md` in their
respective branches. Frame records a separate successful 210-test run and
terminal smoke, but its final saved gate failed on six sandbox socket fixtures.
That earlier success does not replace the required green final gate.

Inventory contains three commits and frame six beyond their common base
`de11d4b`. The canonical checkout has five subsequent release commits. A
Git merge-tree preview with object-store access reports only `HANDOFF.md`
conflicting in each lane against the starting release. Actual rebases and
later integration can still expose other issues; this preview is not validation.

## Integration order

Round 1 completed with two major and five moderate findings, review ID
`lr-7451c85a3828a7040dff8d58087b87bd`. Major findings concern cross-repository
observation fallback and actual-cwd ownership. Moderate findings cover ambiguous
registry joins, retained preview/tripwire state, cancellation, tripwire compatibility,
and plain-output coverage. The validated public projection is retained in the
inventory lane at `docs/reviews/board-inventory/e9e0d2b-r1.md`; it is still
untracked at this checkpoint. The zero-test review made no fresh execution claim.
Corrections and renewed acceptance are required before promotion.

Today's broader coordination goals are in
`docs/plans/2026-09-13-console-coordination.md`.

1. Independently review the fixed inventory delivery using its split OpenSpec
   artifacts, committed report, and inherited gate. Round 1 has a zero-test
   budget; read-only inspection is permitted. No verdict is inferred from the gate.
2. Preserve the private review and inspect its public projection. Resolve required
   findings, reconcile with current main, retain all release/handoff evidence,
   and refresh validation and review applicability for the resulting commit.
3. Promote inventory serially through the CLI's fresh validation and fast-forward
   checks. Preserve required ignored artifacts before removing a lane. Verify
   exact session ownership and retirement under the supervisor closeout protocol.
4. Reconcile frame onto the integrated main. Preserve both spec splits and
   documentation, obtain a green gate, independently review the final implementation,
   and promote and close after acceptance.
5. Record actual reviewed/promoted commits and any remaining cleanup, then identify
   the next dependency-ready slice. A pending review or cleanup is not completion.

## What these lanes do and what remains

Inventory delivers phase 2c-i: machine-scope CLI discovery through accessible local
Herdr endpoints, canonical repository joins, coverage, and history semantics.
Frame delivers phase 3a-i: fullscreen keyboard UI, stable selection, evidence regions,
focus/done actions through the CLI, and terminal cleanup. Its original prerequisite
waiver deliberately retains repository-scoped UI observations. The original brief
also records approval for the A4 UI dependency boundary applied in the frame lane.

The complete single-pane console still requires bounded sampling (2c-ii), complete
machine-scope session details and controls (3a-ii), and the separately specified
idea CLI/composer for launching work. Details depends on frame and complete discovery;
sampling depends on inventory. Those downstream changes remain unimplemented here.
The current UI contract exposes focus and display completion; Git lifecycle actions
remain with the lane CLI and the authorized supervisor workflow.

Public review projections belong under `docs/reviews/`; private review sources and
session checkpoints stay under ignored `.lane/`. Committed lane reports and HANDOFF
entries are durable engineering evidence. No remote publication is part of this
integration request. The pinned installed core snapshot is separate from repository
main and does not acquire console code merely because these lanes are integrated.

## Afternoon acceptance — 2026-09-13

Coordinator specification Round 2 passed without findings at
`6d8e74dfa43437da340f5758d79685363a3dc082`. The inspected public review was the
only successor change in `e69143a827358e1c9684f8c5d45bc007a164484f`, promoted
by validated fast-forward from `8d80ffa`. Main baseline passed 209/209 in 328.225
seconds; the final evidence-commit gate passed 209/209 in 339.648 seconds;
promotion independently revalidated 209/209 in 324.116 seconds, all zero skips.
Review remains explicitly tied to its original SHA. No runtime changed.

Reports and both public reviews are committed; private reviews and the final gate
were preserved in the canonical checkout before cleanup. The merged lane branch
and worktree are removed, its exact verified Herdr workspace and tabs are absent,
and all three registered sessions have done markers. No cleanup remains for this
lane. No push, installed-core update, protocol adoption, or live pilot occurred.

Inventory's corrected `6d63181` passed 226/226 and reported strict OpenSpec 23/23,
but independent Round 3 returned two moderate and two minor findings. The public
review is preserved in that lane at `docs/reviews/board-inventory/6d63181-r3.md`
by evidence commit `c2332c3`. Corrections address busy-refresh demand, terminal
occupant retention, eligible-join test strength, and absent-goal provenance.
Acceptance and promotion remain pending; the frame is still at its historical
delivery and awaits inventory integration, rebase, gate, and independent review.

The updated daily plan records conditional overnight assignments. Sampling waits
for inventory; coordination read-model waits for inventory plus sampling; UI
coordination waits for frame/details plus read-model. Pilot targets remain an
explicit operator choice, and no measured efficiency improvement is claimed.
