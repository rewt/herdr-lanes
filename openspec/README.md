# Specification workflow

Use OpenSpec's `spec-driven` artifacts as portable Markdown. Read the root
`AGENTS.md`, this file, and a change's proposal, design, specs, and tasks before
working. Any capable agent can follow them through `lane dispatch`; no slash
commands, generated agent integration, framework install, or runtime hook is needed.

[The initiative report](../docs/SPEC-20260908.md) explains the selection, sequence,
estimates, and operator rollout. All changes here are **proposed**, with unchecked
tasks. This planning commit neither implements them nor approves contract amendments.

## Layout and lifecycle

- `specs/lane-safety/spec.md` records the relevant existing behavior.
- `changes/<change>/proposal.md` gives motivation, impact, and prerequisites.
- `changes/<change>/specs/<capability>/spec.md` holds proposed requirement deltas.
- `design.md` records decisions; `tasks.md` is the complete dispatchable lane brief.
- The optional [mouse research brief](../docs/tasks/board-mouse.md) lives outside
  product changes: its output is a decision report, not a fictional capability.

One product change is one lane, including tests and documentation. The four initiative
phases are divided into numbered subphases so each can promote independently.
Create the lane from the current canonical checkout, then dispatch its tasks file:

```sh
lane open roots
lane dispatch roots --route engineer @openspec/changes/roots-config/tasks.md
```

Use each tasks file's topic for subsequent lanes. Resolve its dependencies on local
main before opening it. Check off its single task only after implementation,
verification, and the report are complete; this means ready for promotion, not
already promoted. Commit only when the dispatch authorizes it; never push under
these briefs. Promotion remains the operator's serialized, validated fast-forward.

For an implemented change, sync its deltas into `openspec/specs/<capability>/spec.md`
in the final implementation commit: ADDED becomes the main Requirements section;
MODIFIED replaces the complete matching requirement. The synced spec and code become
current together when that lane promotes. After promotion, archive the completed
change into `openspec/changes/archive/YYYY-MM-DD-<change>/` in a separately
authorized documentation lane or the next dependent lane. Verify the recorded
implementation commit is an ancestor of local main before archiving. Do not reapply
already-synced deltas. Never archive these proposals now or mark an unimplemented
downstream phase current. No empty archive scaffold is necessary.

This is the standard [OpenSpec separation of current specs and proposed changes](https://github.com/Fission-AI/OpenSpec/blob/main/docs/concepts.md),
adapted to git promotion. The [default schema](https://github.com/Fission-AI/OpenSpec/blob/main/schemas/spec-driven/schema.yaml)
supplies the artifact shapes. Optional local validation, using an existing OpenSpec
installation, is:

```sh
OPENSPEC_TELEMETRY=0 openspec validate --all --strict --no-interactive --concurrency 1
```

That variable controls the external authoring tool, not `lane`. Do not add OpenSpec
to package manifests, installation steps, or `npm test`.

## Common delivery rules

Each task includes its relevant requirements and adds these shared requirements:

1. Read `AGENTS.md`, `README.md`, `HANDOFF.md`, `docs/REFERENCE.md`, and its change
   artifacts completely. Work only in the dispatched repository and lane worktree.
2. Inspect status/recent commits and run the baseline. Run one build/test command at
   a time on the machine. This is operator discipline, not a new scheduler or lock.
3. For each behavior, add the smallest offline test in `test/` and observe its
   failure before implementation; retain the suite's deliberate negative control.
   Existing `board/test/` coverage stays, but new regressions must also satisfy
   the root `test/` instruction. Use built-ins and temporary repositories with cleanup.
   Fake Herdr responses must contain real protocol fields; skip live-only checks with
   an explicit reason when Herdr or a suitable terminal is absent.
4. Run `npm test`, relevant negative controls, and `git diff --check`, serialized.
   Describe measured results and limits. Do not lower or bypass the validator.
5. Document every new public key, flag, and environment variable in the short
   command-led README, with full semantics in REFERENCE. Keep fixtures and all
   tracked artifacts public-safe. Never copy raw local briefs, transcripts, process
   lists, socket paths, identities, or operator configuration into git.
6. Commit the report and dated HANDOFF entry with implementation. Run `lane check`
   after the final commit; quote its exact GATE in the conversation. Do not create
   another report commit to store that final line: it would stale the gate.
7. A gate is not a review verdict. Promotion always revalidates, regardless of board
   metadata, report wording, completion flags, or a previously green gate.

## Proposed contract amendments — pending operator approval

The operator must approve these exact texts before their dependent implementation.
Keep the current root `AGENTS.md` unchanged in this planning lane. Approval is for a
concrete amendment; it is not required to finish the present specification.

**A1 — append to Product contract (roots-identity):**

> A repository is identified by its canonical git common directory, never by its
> basename, workspace label, remote, or author name alone. Development-root lane
> paths are outside the canonical checkout, with no automatic temporary-directory
> fallback. Existing registered worktrees remain usable without automatic migration.
> Lane commands do not set git identity; git configuration remains authoritative.

**A2 — append to Product contract (session-registry):**

> The session registry and completion markers are gitignored local display metadata.
> Dispatch may record a session and close may mark its sessions done; the board may
> discover sessions and explicitly mark a row done. This data must never authorize,
> schedule, retry, lease, validate, promote, push, or delete work. Concurrent metadata
> updates must not lose unrelated sessions. No daemon or background job coordination
> is added.

**A3 — replace the Herdr-optional bullet in Product contract (board-cli):**

> Herdr integration is optional for git-only operations and offline board snapshots.
> Dispatch, dispatch-from-idea, live discovery, and session focus require an available
> Herdr server. The optional board UI invokes lane CLI interfaces for observations
> and actions; it does not implement a second git or Herdr control path. Reconnection
> may restore display subscriptions only and must never replay lifecycle actions.

**A4 — replace the built-ins/UI-exception bullet in Change rules (board-ux):**

> Use Node.js built-ins only in lane.mjs, dependency-free board services, and the test
> suite. The isolated board/app.mjs entrypoint and UI-only modules under board/ui/
> may use Ink, React, and @inkjs/ui from board/package.json. Keep their dependencies
> and lockfile isolated; git-only commands, plain/JSON board output, and npm test
> must run without installing the UI package. Preserve Node.js 20 compatibility.

A2 clarifies the display-only exception already identified in the promoted board
reviews. A3 makes the requested CLI boundary explicit; it does not permit a job
system. A4 extends the existing Ink/React exception only as far as the chosen official
UI component package and UI modules. Any further dependency needs its own proposal.

## Shared decisions

Machine-wide means agents discoverable through accessible **local Herdr servers**,
including unnamed agents and facilitator sessions. It cannot promise arbitrary
processes outside Herdr or inaccessible servers. Show coverage and errors instead
of silently presenting partial results as complete. Do not connect remote sessions,
scan the entire filesystem, or launch a server to discover it.

Default to machine scope, with `--repo <path>` as a canonical-repository filter.
Identity groups represent development-root paths, not author-email groups; the CLI
does not assign identities. Show git identity only through existing git tooling.

Keep review records in each target repository's tracked
`docs/reviews/<topic>/<head7>-r<N>.md`. Each record names the full reviewed SHA,
verdict, findings, test evidence, and limits, uses public-safe prose, and contains
no raw transcript or local paths. Historical reviews remain immutable evidence;
they do not make a newer commit reviewed or green. Private source material stays
local. No review writer, review enforcement, or remote policy is added to the CLI.

New workspace labels include repository and root identity:
`<root-label>/<repo-name>:lane-<topic>`. Add a short identity digest when readable
labels coincide. Labels are display text; operations use opaque Herdr IDs and
verified git paths. Retain existing labels and find old workspaces by path/ID.

Give mouse research one **optional, two-hour lane** after keyboard UX. Enter-to-focus
is the acceptance requirement; a negative mouse result is useful evidence and does
not hold the composer. Successful research proposes a later product change;
it does not silently add mouse support.

No automatic action retries, task queue, job record, leases, or unattended promotion.
Existing bounded shell/cwd readiness checks remain checks. Observation reconnect is
display-only, tied to the foreground board lifetime.
