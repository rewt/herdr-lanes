# Put board observations and actions behind lane CLI

## Outcome

Expose a versioned JSON snapshot/foreground watch stream and explicit focus/done CLI actions. Rewire the existing UI to those interfaces while keeping its current layout and plain output.

## Repository context and authorization

Read `AGENTS.md`, `README.md`, `docs/REFERENCE.md`, `HANDOFF.md`, and
`openspec/README.md`, then this change's `proposal.md`, `design.md`, and
`specs/board-cli-interface/spec.md`.
Follow the shared delivery rules in `openspec/README.md`.

Prerequisites: session-registry promoted.
Contract approval: A3 must be approved before implementation.

This is a dispatchable future engineering brief, not authorization to implement it
in the planning session. When dispatched by the operator, work only in the current
`lane/board-cli` worktree; commit the authorized result; never push, publish,
promote, or close another lane. Do not edit the product contract unless the operator
has approved the exact amendment. One build/test at a time on the machine.

## Scope and limits

lane.mjs; board/app.mjs; dependency-free board entrypoints/model/client; test/; README.md; docs/REFERENCE.md; HANDOFF.md.

No new layout, machine discovery, mouse, composer, global cache, daemon, protocol server, or action retry.

Suggested route: `engineer`. Suggested effort: High; one focused engineering session.
Use the route's configured agent/model; do not change routing defaults.

## 1. Lane-sized task

- [ ] 1.1 Deliver this change's outcome and all applicable scenarios; verify the checks below, write `docs/reports/board-cli.md` and a dated HANDOFF entry, commit, then obtain a passing GATE against the final commit.

## Acceptance checks

Observe failing tests for JSON shape/framing and invalid flags, operation with no board dependencies, current table through fake CLI, stale/foreign/unnamed focus, done routing, and quit during pending refresh/reconnect. Retain split/batched frames, timeout, error-body and permanent-client-close regressions.

Each requirement in the adjacent delta spec is part of acceptance. Add and observe
failing regression tests before product changes; retain deliberate negative controls.
`npm test` must pass, `git diff --check` must be clean, and the complete diff must
contain no host-specific/private source text. All code tests are offline and clean
up system-temp fixtures. Preserve Node 20, git 2.38, and the dependency-free core.
Record skips precisely rather than reporting unexercised live behavior as passed.

## Handoff and promotion boundary

The report must list files/behavior, negative controls, test counts, measurements,
remaining limits, and any needed approval. Use a public-safe reviewed-SHA record in
`docs/reviews/board-cli/` if an independent review is requested; review is never
an automated promotion gate.

Sync only this implemented delta into its current spec before the final commit.
After the final report/HANDOFF commit, run `lane check` and paste the exact GATE
line in the conversation. Keep that final line out of a new tracked commit.
The operator promotes independently using the unchanged validated fast-forward
workflow; archive only after promotion as described in `openspec/README.md`.
