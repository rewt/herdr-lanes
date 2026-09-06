# herdr-lanes

A dependency-free Node.js CLI for running coding-agent tasks in isolated git
worktrees. One lane maps a task topic to:

```text
topic -> lane/<topic> branch -> git worktree -> optional Herdr workspace and agent
```

Herdr is optional for branch and worktree operations. It is required for
`dispatch`, which starts an interactive coding agent in the lane worktree.

Promotion has one fixed contract:

```text
clean worktree -> clean rebase onto current main -> green validation -> fast-forward
```

`promote` never pushes.

## Requirements

- Node.js 20 or later
- git 2.38 or later (`git merge-tree --write-tree` is used for conflict checks)
- [Herdr](https://herdr.dev/docs/) 0.8 or later for workspaces and agent dispatch
- A supported coding-agent CLI installed for `dispatch`

The lane CLI itself uses only Node.js built-ins.

## Install the lane CLI

Clone the repository and expose `lane.mjs` on PATH:

```sh
git clone https://github.com/rewt/herdr-lanes.git
cd herdr-lanes
mkdir -p ~/.local/bin
ln -s "$PWD/lane.mjs" ~/.local/bin/lane
lane status
```

Alternatively, call it by absolute path from the repository you want to manage:

```sh
node /path/to/herdr-lanes/lane.mjs status
```

Every lane command must run from a checkout of the target repository. The script
resolves that repository's canonical checkout even when invoked from a linked
worktree.

## Configure a target repository

Add `.lane.json` at the target repository root. Every key is optional:

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

Change `validate` and `prepare` for the target project's toolchain. Remove
`prepare` when the project needs no generated or ignored files before validation.
Use [.lane.json.example](.lane.json.example) as a copyable example.

| Key | Type | Purpose | Default |
| --- | --- | --- | --- |
| `main` | string | Local integration branch | `main` |
| `validate` | shell command | Required promotion check | `npm test` |
| `prepare` | array of `{unless, run}` | Build or install steps for fresh worktrees | none |
| `dispatch.kind` | string | Herdr-supported agent kind | `claude` |
| `dispatch.model` | string | Model passed as `--model` | none |
| `dispatch.env` | string array | Environment entries passed to the Herdr tab | none |
| `dispatch.args` | string array | Raw arguments passed to the agent CLI | none |
| `seams_doc` | string | Optional project task-map path printed by `seams` | none |

Environment overrides:

| Variable | Effect |
| --- | --- |
| `LANE_CONFIG` | Use a config file outside `<repo>/.lane.json` |
| `LANE_VALIDATE` | Replace the configured validation command for one run |
| `LANE_WORKTREE_ROOT` | Replace `~/.herdr/worktrees/<repo-name>` |

Do not place secrets in `.lane.json`. Use the invoking environment or a local
configuration file selected with `LANE_CONFIG` for sensitive values.

## Add repository instructions for agents

Each target repository should define its own build, test, safety, and delivery
rules in `AGENTS.md`. Codex reads that file directly. For Claude Code, add a
one-line `CLAUDE.md`:

```text
@AGENTS.md
```

Other agent kinds should be explicitly told to read `AGENTS.md` in the task brief.
Start briefs from [docs/BRIEF_TEMPLATE.md](docs/BRIEF_TEMPLATE.md). A brief should
name the outcome, in-scope files, constraints, acceptance checks, and required
handoff.

## Start the Herdr workspace

Install Herdr using its [installation guide](https://herdr.dev/docs/install/), then
open the target repository in Herdr:

```sh
cd /path/to/target-repository
herdr
```

Running `herdr` attaches to its persistent server and creates a workspace for the
current repository. Run it from a normal terminal. If `HERDR_ENV=1` is already set,
you are inside a Herdr pane and must not start a nested Herdr client.

Useful checks from another terminal or an existing Herdr pane:

```sh
herdr --version
herdr status server
herdr workspace list
```

If the server is running but the canonical checkout has no workspace, create one:

```sh
herdr workspace create --cwd /path/to/target-repository --label target-repository --focus
```

The canonical checkout workspace is the parent used when `lane open` creates or
repairs a lane workspace.

Without Herdr, `open`, `status`, `prepare`, `rebase-check`, `promote`, `close`, and
`seams` still operate through git. `open` reports that it used the git fallback;
`dispatch` exits with an error until Herdr is available.

## Run one lane end to end

From the clean canonical checkout of the target repository:

```sh
lane open update-api
lane dispatch update-api --kind codex @/absolute/path/to/update-api-brief.md
lane status
```

The agent runs in `lane/update-api` at:

```text
~/.herdr/worktrees/<repo-name>/lane-update-api
```

When the lane's changes are committed and ready:

```sh
lane rebase-check update-api
lane promote update-api
lane close update-api
```

`promote` validates and updates local `main`. Review and push remain separate
operator actions.

## Command reference

| Command | Operation |
| --- | --- |
| `lane open <topic> [base-ref]` | Create `lane/<topic>` and its worktree; request a Herdr workspace when available |
| `lane dispatch <topic> [options] [@brief-file \| prompt]` | Start and prompt an agent in the lane's Herdr workspace |
| `lane status` | Show open lanes, main distance, dirty state, rebase state, and shared files |
| `lane prepare <topic>` | Run configured prepare steps whose `unless` paths do not exist |
| `lane rebase-check <topic> [--against <ref>]` | Dry-run the rebase and return `0` when clean or `1` on conflict |
| `lane promote <topic>` | Rebase if needed, validate, and fast-forward local main |
| `lane close <topic>` | Remove the worktree and delete or archive the branch |
| `lane seams [pattern]` | List unmerged branches and `archive/*` tags available as resume bases |
| `lane verify-agent <name> <path>` | Return `0` only when Herdr reports the expected agent cwd |

Topics must be 2–61 characters of lowercase letters, digits, and hyphens, beginning
with a letter or digit.

### Dispatch options

```sh
lane dispatch <topic> \
  [--kind <agent-kind>] \
  [--model <model>] \
  [--env KEY=VALUE ...] \
  [--arg <raw-agent-argument> ...] \
  [@brief-file | prompt text]
```

- `--kind`, `--model`, and `--env` extend or override `.lane.json` values.
- Supplying any `--arg` replaces `dispatch.args`; repeat every required raw flag.
- `@brief-file` is read before dispatch. Use an absolute path when the brief is not
  inside the current checkout.
- Agent names are unique per attempt and capped for Herdr compatibility.
- The brief is sent only after Herdr confirms the agent is in the lane worktree.

Supported kinds are reported by:

```sh
herdr agent start --help
```

## Read `lane status`

Example:

```text
main 10ca91f
lane/update-api  +2/-1 vs main  /worktrees/lane-update-api  DIRTY  rebase: clean
shared files: lane/update-api × lane/update-docs: src/client.js
```

- `+N` is the number of commits unique to the lane.
- `-M` is the number of main commits missing from the lane.
- `DIRTY` means the lane worktree has uncommitted changes.
- `rebase: clean` means the dry-run rebase onto current main succeeds.
- `rebase: CONFLICT <files>` blocks promotion until resolved.
- `shared files` identifies overlapping changes between open lanes.

## Promotion checks

`lane promote <topic>` performs these steps in order:

1. Require a clean lane worktree.
2. Require a clean canonical checkout.
3. If main moved, dry-run the rebase with `git merge-tree`.
4. Refuse and list files when the dry run conflicts.
5. Rebase the lane onto main when the dry run is clean.
6. Run applicable `prepare` steps in the lane worktree.
7. Run `validate` in the lane worktree.
8. Refuse if main moved during validation.
9. Fast-forward local main with `git merge --ff-only`.

No merge commit is created and no remote is updated.

## Close and resume unfinished work

`lane close <topic>` requires a clean worktree.

- If main contains the lane commit, the lane branch is deleted.
- If the lane is unmerged, its commit is tagged as `archive/lane/<topic>` before the
  branch is deleted.

List resumable branches and tags, then open a new lane from one:

```sh
lane seams
lane open resumed-task archive/lane/old-task
```

## Failure recovery

| Output | Action |
| --- | --- |
| `herdr workspace: none` | Start Herdr in the canonical checkout; retry `dispatch` |
| `lane worktree is not clean` | Commit or stash the lane changes |
| `canonical main checkout is not clean` | Commit or stash the canonical checkout changes |
| `validation failed ... nothing merged` | Fix the lane and rerun `promote` |
| `does not rebase cleanly; conflicts in:` | Rebase manually in the lane worktree and resolve the listed files |
| `main moved during validation` | Rerun `promote`; it rechecks the new main |
| `agent ... not the lane worktree` | Inspect the Herdr pane/workspace; the brief was not sent |

For automated promotion, `contrib/promote-safely.sh` serializes promotions and emits
one `OUTCOME:` line with the real exit status:

```sh
contrib/promote-safely.sh /path/to/target-repository update-api /tmp/update-api-promote.log
```

Do not run two promotions in the same canonical checkout concurrently. Prepare and
validation steps can modify shared ignored files.

## Develop this repository

```sh
npm test
```

The test suite is offline and dependency-free. It creates temporary git repositories
and removes Herdr from PATH for lifecycle tests. Herdr-dependent coverage skips when
the executable is absent.

Repository maintenance rules are in [AGENTS.md](AGENTS.md). Current verification and
handoff notes are in [HANDOFF.md](HANDOFF.md).

## License

MIT.
