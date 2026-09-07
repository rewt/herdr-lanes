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
  "routes": {
    "engineer": {
      "kind": "codex",
      "model": "engineering-model",
      "env": ["ROLE=engineer"],
      "args": ["--agent-flag"],
      "use": "Implementation work that needs full repository context"
    }
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
| `routes` | none | Named dispatch configurations selected with `--route` |
| `routes.<name>.kind` | `dispatch.kind` | Herdr agent kind for this route |
| `routes.<name>.model` | `dispatch.model` | Model for this route |
| `routes.<name>.env` | none | Environment appended after `dispatch.env` |
| `routes.<name>.args` | `dispatch.args` | Raw agent arguments replacing `dispatch.args` when present |
| `routes.<name>.use` | none | Operator note describing when to select the route; dispatch ignores it |
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
  [--route <name>] [--kind <agent>] [--model <model>] \
  [--env KEY=VALUE ...] [--arg <raw-agent-argument> ...] \
  [@brief-file | prompt text]
```

Without `--route`, values come from `dispatch`. With a route, its `kind`, `model`,
and `args` replace the corresponding dispatch defaults when present; its `env`
entries append to `dispatch.env`. Explicit `--kind` and `--model` flags override
the route. Supplying any `--arg` replaces route arguments, while command-line
`--env` entries append after both configured environment lists. The route's `use`
text is descriptive and never passed to Herdr. List supported kinds with
`herdr agent start --help`.

`lane routes` prints each configured route, sorted by name, with its resolved kind,
model, arguments, and `use` note. It exits 1 when no routes are configured. An
unknown `--route` is rejected before any Herdr call.

Before sending the brief, `dispatch` waits for the pane shell to reach the lane
worktree, starts the agent with a unique name, and verifies the agent cwd reported by
Herdr. A failed cwd check closes the tab without sending the brief.

## Model routing guidance

Operators should map stable role names to models using the vendors' own current
recommendations, then record why each mapping exists in the route's `use` field.
The table below summarizes the vendor guidance fetched on 2026-09-07; availability
and recommendations can change, so recheck the linked source when updating routes.

| Model | Vendor positioning | Example route fit |
| --- | --- | --- |
| [`gpt-6-astra`](https://learn.chatgpt.com/docs/models) | OpenAI's most capable model for complex work across code, apps, and research, with stronger judgment | Planning and unblocking |
| [`gpt-5.6-sol`](https://learn.chatgpt.com/docs/models) | Most capable GPT-5.6 model for complex coding, computer use, and research | Engineering lanes |
| [`gpt-5.6-terra`](https://learn.chatgpt.com/docs/models) | Balanced everyday work at lower cost | Mechanical or isolated changes |
| [`gpt-5.6-luna`](https://learn.chatgpt.com/docs/models) | Fast and affordable for clear, repeatable tasks such as extraction and classification | Repeatable, well-specified work |
| [`gpt-5.4-mini`](https://learn.chatgpt.com/docs/models) | Fast mini model for responsive coding tasks and subagents | Small responsive tasks or subagents |
| [`claude-opus-5`](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) | Complex agentic coding and enterprise work, including large refactors and complex systems engineering; start at its default `high` effort | Independent review |
| [`claude-sonnet-5`](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) | Speed and capability for everyday coding and agent workloads | Everyday engineering |
| [`claude-haiku-4-5`](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) | Lowest latency and price, including sub-agent tasks | Narrow or high-volume tasks |
| [`claude-fable-5-1`](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) | Highest capability for agent sessions that run for hours and multistep research | Long-running facilitator |

For OpenAI models that accept reasoning effort, the configurable levels are `none`,
`low`, `medium`, `high`, `xhigh`, and `max`. Start low for clear work and raise effort
as ambiguity, complexity, or risk increases. Vendor recommendations are starting
points: validate route choices against the repository's real tasks, latency needs,
and budget.

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
