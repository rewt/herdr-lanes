# herdr-lanes

Run coding agents concurrently in isolated git worktrees, then promote completed
work through one validation gate.

```text
task -> lane/<topic> branch -> worktree -> optional Herdr workspace + agent
```

The operator manages lanes from the canonical checkout. Each agent works and commits
only in its lane worktree. `lane promote` updates local main and never pushes.

## Setup

Requirements: Node.js 20+, git 2.38+, and [Herdr](https://herdr.dev) 0.8+ for agent
dispatch. `lane.mjs` itself has no package dependencies.

Install the CLI:

```sh
git clone https://github.com/rewt/herdr-lanes.git
mkdir -p ~/.local/bin
ln -s "$PWD/herdr-lanes/lane.mjs" ~/.local/bin/lane
```

In the repository that will use lanes, add `.lane.json`:

```json
{
  "main": "main",
  "validate": "npm test",
  "prepare": [
    { "unless": "node_modules", "run": "npm ci" }
  ],
  "dispatch": {
    "kind": "codex"
  }
}
```

Change the commands and agent kind for the project. Every key is optional; see
[.lane.json.example](.lane.json.example).

Add project rules to `AGENTS.md`. For Claude Code, add `CLAUDE.md` containing
`@AGENTS.md`. Tell other agents to read `AGENTS.md` in the brief. A reusable brief is
available at [docs/BRIEF_TEMPLATE.md](docs/BRIEF_TEMPLATE.md).

Install Herdr using its [installation guide](https://herdr.dev/docs/install/), then
start the parent workspace from a normal terminal:

```sh
cd /path/to/target-repository
herdr
```

If `HERDR_ENV=1` is set, you are already inside Herdr; do not start a nested client.
Verify the parent workspace with:

```sh
herdr status server
herdr workspace list
```

If the repository is not listed:

```sh
herdr workspace create --cwd /path/to/target-repository --label target-repository --focus
```

Herdr is optional for git operations. Without it, `open` uses `git worktree` and
`dispatch` is unavailable.

## Create and manage a lane

From the clean canonical checkout:

```sh
lane open update-api
lane dispatch update-api --kind codex @/absolute/path/to/update-api-brief.md
lane status
```

`open` creates:

- `lane/update-api` from configured main;
- `~/.herdr/worktrees/<repo>/lane-update-api`;
- a Herdr workspace for that worktree when Herdr is running.

`dispatch` creates a tab, starts the agent, verifies its cwd is the lane worktree, and
only then sends the brief. It prints commands for watching and attaching to the agent.
List supported agent kinds with `herdr agent start --help`.

The agent implements, tests, and commits in the lane worktree. The operator uses the
canonical checkout to inspect all lanes:

```text
main 10ca91f
lane/update-api  +2/-1 vs main  /worktrees/lane-update-api  DIRTY  rebase: clean
shared files: lane/update-api × lane/update-docs: src/client.js
```

- `+N`: commits unique to the lane
- `-N`: main commits missing from the lane
- `DIRTY`: uncommitted changes
- `rebase: clean`: safe to replay onto current main
- `rebase: CONFLICT`: manual conflict resolution required
- `shared files`: overlapping changes between lanes

Close a finished lane with `lane close update-api`. A merged branch is deleted. An
unmerged branch is first preserved as `archive/lane/update-api`.

Resume unfinished work with:

```sh
lane seams
lane open resumed-task archive/lane/update-api
```

## Concurrency model

Open one lane per independent task:

```sh
lane open backend-change
lane open docs-change
lane dispatch backend-change --kind codex @/briefs/backend.md
lane dispatch docs-change --kind claude @/briefs/docs.md
lane status
```

Implementation is concurrent; promotion is serialized:

- Each lane has its own branch, worktree, dependencies, build output, and agent.
- Scope lanes to different files when possible.
- If `status` reports `shared files`, coordinate those lanes or run them sequentially.
- Promote only one lane at a time because all promotions update the same local main.
- After one promotion moves main, other lanes become behind. Their promotion rebases
  automatically when clean and stops with a file list when conflicts exist.

For unattended promotion, use the serialized wrapper:

```sh
contrib/promote-safely.sh /path/to/repo backend-change /tmp/backend-promote.log
```

## Promotion process

Commit the lane, then run from the clean canonical checkout:

```sh
lane rebase-check update-api
lane promote update-api
```

Promotion performs exactly these steps:

1. Require clean lane and canonical worktrees.
2. Dry-run the lane rebase onto current main.
3. Refuse and list files if the rebase conflicts.
4. Rebase automatically when clean.
5. Run missing `prepare` steps and `validate` in the lane worktree.
6. Refuse if main moved during validation.
7. Fast-forward local main without a merge commit or push.

If validation fails, main is unchanged. If another promotion moved main, rerun
`promote`; it checks and rebases against the new head.

After success, review and push main through the project's normal workflow, then run:

```sh
lane close update-api
```

## Command reference

| Command | Purpose |
| --- | --- |
| `lane open <topic> [base-ref]` | Create the lane branch, worktree, and optional workspace |
| `lane dispatch <topic> [options] [@brief \| prompt]` | Start and prompt an agent |
| `lane status` | Show commit distance, dirtiness, rebase state, and overlap |
| `lane prepare <topic>` | Run setup steps whose `unless` path is absent |
| `lane rebase-check <topic> [--against <ref>]` | Test rebase compatibility |
| `lane promote <topic>` | Rebase, validate, and fast-forward local main |
| `lane close <topic>` | Remove the worktree and delete or archive the branch |
| `lane seams [pattern]` | List resumable branches and archive tags |
| `lane verify-agent <name> <path>` | Verify an agent's Herdr cwd |

Topics are 2–61 lowercase letters, digits, or hyphens and begin with a letter or
digit.

Dispatch options are `--kind`, `--model`, repeated `--env KEY=VALUE`, and repeated
`--arg <raw-agent-argument>`. Any `--arg` replaces configured `dispatch.args`.

Configuration keys are `main`, `validate`, `prepare`, `dispatch`, and `seams_doc`.
Overrides are `LANE_CONFIG`, `LANE_VALIDATE`, and `LANE_WORKTREE_ROOT`. Do not store
secrets in tracked configuration.

## Develop this repository

```sh
npm test
```

Tests are offline and use temporary git repositories. Herdr-only coverage skips when
Herdr is absent. Maintenance rules are in [AGENTS.md](AGENTS.md); current verification
is in [HANDOFF.md](HANDOFF.md).

## License

MIT.
