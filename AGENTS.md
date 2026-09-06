# herdr-lanes agent instructions

These instructions apply to every coding agent working in this repository.

## Start here

Before changing files:

1. Read `README.md` and `HANDOFF.md` completely.
2. Run `git status --short --branch` and inspect recent commits.
3. Run `npm test` to establish the current baseline.
4. Confirm the requested work is limited to this repository.

Do not continue a stale task merely because it appears in `HANDOFF.md`. The current
user request defines the work; the handoff provides state and prior verification.

## Repository map

- `lane.mjs`: the complete CLI; keep it dependency-free.
- `test/lane.test.mjs`: offline behavioral tests using temporary git repositories.
- `.lane.json.example`: portable target-repository configuration.
- `contrib/promote-safely.sh`: serialized wrapper for unattended promotion.
- `docs/BRIEF_TEMPLATE.md`: reusable input for `lane dispatch`.
- `README.md`: public installation, configuration, command, and recovery reference.
- `HANDOFF.md`: chronological maintenance and verification record.

## Product contract

- One topic maps to one `lane/<topic>` branch and one git worktree.
- Herdr integration is optional except for `dispatch`.
- Promotion means clean checkout, clean rebase, green validation, and fast-forward.
- `promote` must never push, create merge commits, or bypass validation.
- Unmerged work closed through the CLI must remain recoverable through an archive tag.
- Keep the tool a thin layer over git and Herdr. Do not add a job system, leases,
  remote policy gates, or hidden background coordination.

## User workflow the documentation must preserve

An unfamiliar user or agent must be able to determine, in order:

1. how to install `lane` and Herdr;
2. how to configure validation, preparation, and the agent kind;
3. how to start the canonical checkout's parent Herdr workspace;
4. how `open` creates an isolated branch, worktree, and optional workspace;
5. how `dispatch` verifies cwd before sending a brief;
6. how multiple implementation lanes run concurrently and report overlap;
7. why promotion is serialized and exactly which checks it performs;
8. how to close, archive, and resume a lane.

Keep that path short, command-led, and free of project-specific assumptions.

## Change rules

- Treat every tracked file as public. Do not add credentials, personal paths,
  unrelated repository names, internal documents, or organization-specific defaults.
- Preserve Node.js 20 and git 2.38 compatibility.
- Use Node.js built-ins only in `lane.mjs` and the test suite.
- Keep configuration repository-neutral and document every public key or environment
  variable in `README.md`.
- Every behavior change requires a test in `test/` that is observed failing before
  the implementation changes.
- Tests must run offline, create their repositories under the system temp directory,
  and clean them up.
- Tests must not require Herdr. Skip Herdr-dependent checks with an explicit reason
  when the executable is absent.
- Do not weaken cwd checks, clean-tree checks, conflict checks, validation, or
  fast-forward-only promotion.

## Working procedure

1. Reproduce or specify the behavior under test.
2. Add the smallest failing test or deliberate negative control.
3. Implement the change without expanding the product contract.
4. Run `npm test` and `git diff --check`.
5. Review the complete diff for host-specific or sensitive text.
6. Append a dated `HANDOFF.md` entry with changes, measurements, and unverified areas.

Do not commit, push, publish, delete remote data, or rewrite history unless the user
explicitly requests that action. Use the identity and remote already configured for
the current repository; never impersonate a repository owner.

## Handoff format

Record:

- files and behavior changed;
- tests run and their results;
- negative controls observed before behavior changes;
- environment versions when relevant;
- anything not verified or still open.
