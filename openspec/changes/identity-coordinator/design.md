# Design: manual identity coordination with optional observation

## Authority and roster

The operator names one coordinator and its authority source. The coordinator keeps
one explicit daily roster: identity label, roster revision and date; each project's
canonical Git common directory, canonical checkout, integration branch, verified
instruction/goal/evidence locators, integration owner, optional project supervisor,
and open outcomes. A development-root label groups repositories but is never a
repository key. A root-only request must select a canonical repository before any
lane lifecycle command. Roster entries are private operator/project records; examples
in this change are synthetic. Reconcile each path through Git before use, including
linked worktrees. Never infer a project from basename, remote, Git author, or account.

The operator's instruction or project policy grants lifecycle authority. The
coordinator may allocate priorities, dependency order, and finite budgets within
that delegation; beyond it, a proposed change waits for an explicit decision. One
integration owner per project accepts engineering evidence and performs or directs
its review, promotion, close, and cleanup under project policy. A project supervisor,
when appointed, is that integration owner. Otherwise the coordinator is named as
integration owner and may own a small task directly with an engineer. The coordinator
reads the supervisor's compact acceptance result, not the full engineer transcript
or a duplicate detailed review. An independent reviewer remains separate wherever
the project requires one. The current [supervisor closeout protocol](../../../config/supervisor/2026.09.13.1/CLOSEOUT.md)
still governs accepted lane retirement; this proposal cannot waive its gates.

Git author identity belongs to Git configuration; GitHub credentials authorize
remote operations separately; a Codex profile selects local model/client settings;
and a development root is only a filesystem/display grouping. None is a substitute
for coordinator, integration owner, canonical repository, or permission to push.
Changing an agent/model default does not replace a running owner.

## Assignment and delta-report envelopes

Use short operator-authored records, not a task queue. An assignment has stable
`assignment_id` (opaque within a roster), monotonic `revision`, `project` (canonical
common-directory identity), `outcome_id`, `owner` (exact agent/person target),
`integration_owner`, acceptance criteria, budget ceilings and review-by time,
next milestone, blocker/decision, evidence locator, and next action. The assignment is effective
only after the named owner acknowledges the revision and its authority is checked
against the operator/project source. A revision changes scope, budget, or owner but
never reuses an assignment ID for a different project/outcome. The coordinator records
one or two daily outcomes per project and cross-project dependency edges with an
explicit unblock criterion. No implicit task dispatch follows recording.

A report contains `assignment_id`, `revision`, `report_id`, increasing `sequence`,
project, reporting owner, milestone/result, change since prior accepted report,
blocker or requested decision, evidence pointers, and exactly one next action/owner.
It is sent only at a material checkpoint, blocker, or ready handoff. Evidence is
preserved before a single no-wait notification. For engineering lanes, include
branch, full HEAD, exact gate result or unverified, and durable report path as in
`ENGINEER_REPORT_APPENDIX.md`. A compact cross-project example, with placeholders,
is below; it is not a real assignment or authorization:

```text
ASSIGN v1 id=A-001 rev=1 project=<verified-common-dir> outcome=O-1
owner=<engineer-agent> integration_owner=<named-owner>
accept=<project-check-and-independent-review> budget=<approved-ceilings>
milestone=<first-accepted-result> blocker=none evidence=<durable-index>
next=<owner-acknowledges-revision>

DELTA v1 id=A-001 rev=1 report=R-001 seq=1 project=<verified-common-dir>
owner=<engineer-agent> milestone=<result-since-assignment> blocker=none
evidence=<full-head-and-report-pointer> next=<integration-owner-verifies-gate>
```

Detailed project context stays at the project owner. The coordinator's daily view
contains only roster revision, outcomes, dependency/budget decisions, latest accepted
report IDs, evidence pointers, and next actions. Private raw output and credentials
never enter tracked documents or brief messages.

## Delivery, handoff, and resumption

- Deduplicate exact `report_id` plus content digest; record receipt without another
  action. Conflicting bytes for one ID or the same sequence are quarantined for
  explicit owner clarification. An older revision or sequence cannot roll back the
  latest accepted report. An out-of-order newer report is held until its predecessor
  and primary evidence are checked; a missing predecessor is an explicit gap, not a
  reason to replay work.
- If notification delivery fails, retain the durable report and mark delivery
  unconfirmed. Do not retry, redispatch, or infer failure of the underlying work.
  The operator or owner can make one explicit later reconciliation decision.
- A handoff is stale if its assignment revision, owner, repository identity, HEAD,
  gate, review applicability, or authoritative plan differs from current primary
  evidence. The receiving owner checks those sources before accepting. An unavailable
  owner freezes new assignment to that target; it does not create a lease expiry or
  automatic reassignment. The coordinator, within existing delegated authority or
  after operator approval, issues a new revision naming one successor. The old owner
  acknowledges when available; if unavailable, the authority source records its
  supersession explicitly. The successor acknowledges and verifies evidence. Unclear ownership
  remains blocked.
- On resumption, compare current operator direction and project instructions,
  canonical Git common directory, branch/full HEAD/clean state, exact gate and
  independent review record, durable reports, and freshly observed Herdr occupant
  identities. Continue only the uncompleted authorized step. Saved roster, board,
  session registry, done markers, and pane status are hints, never authority.

No background scheduler, routine model poll, heartbeat traffic, state-driven
lifecycle call, or observation-reconnect replay is part of this design.

## Existing JSON and console dependency audit

Read-only `git show` of `lane/board-inventory` at `1fdd8f9` shows schema-v1
`row_id`, canonical `repo_id`/`root_id`, repository `path`, `goal`/`goal_source`,
`brief.excerpt`, `role`, `report.path`/`mtime`/`verdict`/`reviewed_head`, gate,
status, deadline, staleness, scope and coverage. It does not provide an assignment
ID, integration owner, accepted milestone, latest coordination delta, or decision
needed. A report path is not a latest coordination report. Read-only `git show` of
`lane/board-frame` at `9e8c8f9` shows attention computed from blocked/current failed
gate/stale/verified overdue/current non-pass review/unknown agent state; no
coordination ownership signal exists. Frame labels `single repository scope` and
renders only supplied document fields. These are branch observations, not deployed
behavior claims; the inventory branch can advance independently.

| Need | Existing field | Later owner / constraint |
| --- | --- | --- |
| Session goal | `row.goal`, `goal_source`, `brief.excerpt` | Inventory supplies title fallback; `coordination.outcome_goal` is a separate explicit assignment field, not a substitute for session title. |
| Canonical project | `repo_id`, repository `path`, `scope`, `coverage` | Inventory; development root only groups. A root cannot execute a lane. |
| Owner | `role` and `name` identify route/agent, not integration ownership | Coordination read-model brief adds `coordination.owner_id` and `integration_owner_id`, nullable and source-labeled. |
| Latest report | `report` is lane/review evidence | Coordination read-model adds one `latest_delta` pointer/sequence/revision and freshness, never raw text. |
| Attention | Frame computes technical attention reasons | A later UI may display separate coordination decision/blocker reasons; no auto-action or double counting of sessions. |

The pending `lane/board-inventory` sampling split (2c-ii, `board-sampling`) owns
bounded asynchronous sampling, stale/error semantics, two-child concurrency, and
the 100-session fixture; its inventory split owns machine/repository coverage and
canonical joins. The pending `lane/board-frame` frame split (3a-i) may remain
repository-scoped; its `board-details` split (3a-ii) waits for frame plus complete
discovery and owns complete evidence views. New coordination fields belong to this
separate later read-model and UI brief, not inventory, sampling, or frame. The
[idea CLI](../idea-cli/) and [composer](../idea-composer/) remain later explicit
repo/route launch work; no assignment implies automatic dispatch or destination.
The board UI must consume CLI observations and actions only. Display data never
authorizes focus, done, review, promotion, close, push, or resource allocation.

The read-model is explicitly opt-in: `lane board --json --coordination <path>` or
`lane board --watch --json --coordination <path>` reads one operator-maintained,
local JSON snapshot; no default path, file discovery, or writer is added. The
`--coordination` path is an argument, not an authority source. Its v1 object has
`schema_version`, `recorded_at`, and `projects[]`; each project has
`git_common_dir` and `assignments[]`. An assignment has the manual envelope's
`assignment_id`, `revision`, `outcome_id`, `outcome_goal`, `owner_id`,
`integration_owner_id`, `session_row_ids[]`, `milestone`, `blocker`,
`decision_needed`, `next_action`, and nullable `latest_delta` containing
`report_id`, `sequence`, `recorded_at`, and `evidence_ref`. The CLI verifies a
project's canonical common directory against discovered repository identity and
matches only exact stable row IDs listed in an assignment. Duplicated project,
assignment, or row mappings yield localized unavailable/error state, never a
chosen winner. Unknown fields remain ignored for schema-v1 compatibility. The
snapshot is a display projection of already-decided assignments, not the roster's
authority or a place to store raw reports. It may be private; tracked examples use
placeholders only. A matching row gains nullable `coordination` fields matching
the input names plus `source: explicit-snapshot`, `recorded_at`, `stale`, and
`unavailable_reason`; top-level `coverage.coordination` is `not-selected`,
`available`, `partial`, or `unavailable`. `latest_delta` is a reported pointer,
not an independently verified accepted result. On each foreground refresh, bounded reads and last-known-value
staleness follow board-sampling's limits. New CLI flags and fields must be documented
in README/REFERENCE when implemented, not in today's current command docs.

The read-model brief may start only after inventory and sampling are promoted and
reviewed, so it can consume stable machine coverage and bounded observation. A UI
details extension starts after frame, details, and the read-model are promoted.
The manual protocol/pilot needs neither console extension, only operator protocol
review and explicit identity/two-project selection.
