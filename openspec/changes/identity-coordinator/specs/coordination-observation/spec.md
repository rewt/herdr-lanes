## Purpose

Propose an optional, read-only board view of manually authorized coordination
records after complete machine discovery; this capability is not current behavior.

## ADDED Requirements

### Requirement: Source-labeled coordination projection
A future CLI snapshot SHALL, when given `--coordination <path>`, project the
design's explicitly selected local schema-v1 snapshot into nullable assignment ID,
project/outcome goal, owner, integration owner, milestone, latest delta pointer,
blocker/decision, and next action fields. It SHALL join by canonical repository
and stable assignment and row IDs, label source/revision/observation freshness,
and leave unknown or conflicting
values unavailable rather than guessing from session name, route, root, or title.
#### Scenario: Ambiguous or absent assignment
- **WHEN** two assignments match a session ambiguously, a report is stale, or no coordination source is selected
- **THEN** the row retains its existing goal/report/gate fields, coordination fields are unavailable with a reason, and no work action is inferred.

### Requirement: Separate coordination attention
A later console view SHALL distinguish explicit coordination blocker/decision
attention from existing technical attention and SHALL not count duplicate reports as
new work or change verified focus/done eligibility.
#### Scenario: Blocker alongside failed gate
- **WHEN** one session has both an explicit assignment blocker and a current failed gate
- **THEN** both reasons are visible, the session is counted once in a combined view, and neither reason triggers review, promotion, close, dispatch, or focus.

### Requirement: Bounded read lifetime
Coordination projection SHALL respect machine observation coverage, bounded
sampling, stale/error semantics, and foreground lifetime. It SHALL not add a
background scheduler, model polling, heartbeat, persistent queue, or replay on
reconnect.
#### Scenario: Unavailable source during refresh
- **WHEN** the optional record cannot be read or becomes stale during a refresh
- **THEN** previous values are visibly stale or unavailable, errors are localized, and no lifecycle action runs.
