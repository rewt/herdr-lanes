# Lane console integration

Recorded 2026-09-13. This is an integration checkpoint, not a claim that the
complete console has shipped. The operator requested review of the existing
lanes, durable evidence, and the start of console integration.

## Starting state

The canonical release is `48ee44caa26de9e6b83b99b1f2a037fe99ee2cac`, tagged
`supervisor/2026.09.13.1`. Its product tree was verified by 209/209 offline tests
with zero skips in 316.814 seconds; release-focused checks passed 3/3.

| Lane | Delivery commit | Saved validation | Independent review |
| --- | --- | --- | --- |
| board-inventory | e9e0d2b7ea657d6912443fb88b256d3f8aa729e6 | Matching HEAD, npm test exit 0, 317.176 seconds | Round 1 started; no verdict yet |
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
