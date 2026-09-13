# Brief: show coordination evidence in console details

Status: future engineering lane. Start only after board-frame, board-details,
complete discovery (inventory plus sampling), and the coordination read-model are
reviewed and promoted. Read repository instructions, `openspec/README.md`, this
change and those prerequisite designs/specs before work. Suggested route: engineer;
effort: High. Work in a separately authorized lane.

## Outcome and boundary

Consume only the CLI's read-only coordination projection. In Context/Evidence,
show project/outcome, assignment ID, owner and integration owner, accepted milestone,
latest delta pointer/age, blocker/decision and next action with unavailable/stale
reasons. Preserve the board's existing machine/repository coverage, fixed evidence
pane, keyboard focus, NO_COLOR cues, stable row selection, and technical attention.
Show coordination decision/blocker reasons separately; a combined count counts one
session once. A root grouping cannot become a launch target. No action is inferred
from owner, report, blocker, or deadline display.

Scope: UI-only `board/app.mjs`/`board/ui/`, `test/`, README/REFERENCE, report,
HANDOFF, and this change's observation delta sync only if not already synced by
the read-model lane. Do not add CLI control, Git/Herdr socket/target-file reads in
the UI, dependency upgrades, composer behavior, model polling, lifecycle retry, or
background coordination.

## Test-first acceptance

Observe failing built-ins-only `test/` fixtures with deliberate negative controls
for absent/ambiguous owner, stale latest report, blocker plus failed gate, unique
attention count, NO_COLOR, keyboard selection/focus, and reconnect without actions.
Serialize `npm test`, relevant controls, `git diff --check`, optional board install
and real-TTY smoke after clear process probes; distinguish simulated rendering from
observed terminal behavior. Commit report/HANDOFF, run `lane check` at final HEAD,
and leave independent review/promotion/close to the integration owner.
