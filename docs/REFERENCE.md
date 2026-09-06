# Technical reference

## Configuration

`lane` reads `.lane.json` from the target repository root. Every key is optional:

```json
{
  "main": "main",
  "validate": "npm test",
  "prepare": [
    { "unless": "node_modules", "run": "npm ci" }
  ],
  "dispatch": {
    "kind": "codex",
    "model": "model-name",
    "env": ["KEY=value"],
    "args": ["--agent-flag"]
  },
  "seams_doc": "docs/tasks.md"
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `main` | `main` | Local integration branch |
| `validate` | `npm test` | Shell command required for promotion |
| `prepare` | none | `{unless, run}` steps for fresh worktrees |
| `dispatch.kind` | `claude` | Herdr agent kind |
| `dispatch.model` | none | Model passed to the agent |
| `dispatch.env` | none | Environment added to the Herdr tab |
| `dispatch.args` | none | Raw agent arguments |
| `seams_doc` | none | Optional task-map path printed by `seams` |

Overrides: `LANE_CONFIG`, `LANE_VALIDATE`, and `LANE_WORKTREE_ROOT`. Do not put
secrets in tracked configuration.

## Workspace setup

The canonical checkout must have a Herdr workspace before dispatch:

```sh
cd /path/to/repository
herdr
```

If already inside Herdr (`HERDR_ENV=1`), do not start a nested client. Check the
parent workspace with:

```sh
herdr status server
herdr workspace list
```

Create it only when the repository is not listed:

```sh
herdr workspace create --cwd /path/to/repository --label repository --focus
```

Without Herdr, `open` falls back to `git worktree`; `dispatch` is unavailable.

## Dispatch options

```sh
lane dispatch <topic> \
  [--kind <agent>] [--model <model>] \
  [--env KEY=VALUE ...] [--arg <raw-agent-argument> ...] \
  [@brief-file | prompt text]
```

Command-line kind and model override configuration. Environment entries are added.
Supplying any `--arg` replaces configured `dispatch.args`. List supported kinds with
`herdr agent start --help`.

Before sending the brief, `dispatch` waits for the pane shell to reach the lane
worktree, starts the agent with a unique name, and verifies the agent cwd reported by
Herdr. A failed cwd check closes the tab without sending the brief.

## Status

```text
main 10ca91f
lane/api-change  +2/-1 vs main  /worktrees/lane-api-change  DIRTY  rebase: clean
shared files: lane/api-change × lane/docs-change: src/client.js
```

- `+N`: commits unique to the lane
- `-N`: main commits missing from the lane
- `DIRTY`: uncommitted changes
- `rebase: clean`: clean dry-run replay onto main
- `rebase: CONFLICT <files>`: manual resolution required
- `shared files`: paths changed by more than one lane

## Promotion

`lane promote <topic>`:

1. Requires clean lane and canonical worktrees.
2. Dry-runs a rebase onto current main.
3. Refuses and lists files on conflict.
4. Rebases automatically when clean.
5. Runs missing prepare steps and validation in the lane.
6. Refuses if main moved during validation.
7. Fast-forwards local main without merging or pushing remotely.

Run only one promotion at a time. For unattended callers:

```sh
/path/to/herdr-lanes/contrib/promote-safely.sh /path/to/repo api-change /tmp/api-promote.log
```

The wrapper refuses concurrent promotion and prints one `OUTCOME:` line with the real
exit status.

## Close and resume

`lane close <topic>` requires a clean lane worktree. A merged branch is deleted. An
unmerged branch is tagged as `archive/lane/<topic>` before deletion.

```sh
lane seams
lane open resumed-task archive/lane/old-task
```

## Common failures

| Message | Action |
| --- | --- |
| `herdr workspace: none` | Start Herdr in the canonical checkout and retry dispatch |
| `lane worktree is not clean` | Commit or stash lane changes |
| `canonical main checkout is not clean` | Commit or stash canonical changes |
| `validation failed ... nothing merged` | Fix the lane and promote again |
| `does not rebase cleanly` | Rebase manually and resolve the listed files |
| `main moved during validation` | Promote again against the new main |

## Development

`npm test` runs offline behavioral tests in temporary git repositories. Herdr-only
coverage skips when Herdr is absent.
