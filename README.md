# herdr-lanes

Open one isolated git worktree per task, run an agent in each Herdr workspace, and
promote completed lanes into local main.

## Quick start

Install `lane` once:

```sh
git clone https://github.com/rewt/herdr-lanes.git
mkdir -p ~/.local/bin
ln -s "$PWD/herdr-lanes/lane.mjs" ~/.local/bin/lane
```

In the repository you want agents to work on:

```sh
cp /path/to/herdr-lanes/.lane.json.example .lane.json
```

Edit `.lane.json` so `validate`, `prepare`, `dispatch.kind`, and the named `routes`
match the project. Put the project's instructions in `AGENTS.md` before opening lanes.

Start Herdr in that repository:

```sh
cd /path/to/your-repository
herdr
```

From an operator terminal or Herdr pane, open and dispatch one lane per task:

```sh
lane open api-change
lane dispatch api-change --route engineer @/absolute/path/to/api-change-brief.md

lane open docs-change
lane dispatch docs-change --route engineer @/absolute/path/to/docs-change-brief.md

lane routes
lane status
```

The agents now run concurrently in separate branches, worktrees, and Herdr
workspaces. Each agent should test and commit only in its own lane.

When a lane is ready, promote and close it from the clean main checkout (the original,
non-lane checkout):

```sh
lane promote api-change
lane close api-change
```

Promote lanes one at a time. `promote` rebases the lane onto current main, runs the
configured validation in the lane worktree, and fast-forwards local main. It stops on
dirty files, conflicts, failed validation, or a concurrent change to main. It never
pushes.

## How lanes work

`lane open <topic>` creates:

```text
lane/<topic> branch
~/.herdr/worktrees/<repo>/lane-<topic>
Herdr workspace for that worktree
```

`lane dispatch <topic> --route <name> @brief.md` starts the route's configured agent
in that workspace, verifies its cwd, then sends the brief.

`lane status` shows each lane's commits ahead/behind main, dirty state, rebase state,
and files changed by more than one lane. Keep concurrent lanes in separate files when
possible. If `shared files` appears, coordinate or serialize those lanes.

After one lane is promoted, the others are behind the new main. Their next promotion
rebases automatically when clean and refuses with a file list when conflicts exist.

## Commands

| Command | Purpose |
| --- | --- |
| `lane open <topic> [base-ref]` | Create a lane |
| `lane dispatch <topic> [--route <name>] [options] [@brief \| prompt]` | Start and prompt its agent |
| `lane routes` | List resolved named dispatch routes |
| `lane status` | Show lane state and overlap |
| `lane promote <topic>` | Rebase, validate, and fast-forward local main |
| `lane close <topic>` | Remove and delete or archive a lane |
| `lane seams [pattern]` | List work that can be resumed |
| `lane prepare <topic>` | Run missing setup steps |
| `lane rebase-check <topic>` | Check whether promotion will conflict |

Requirements: Node.js 20+, git 2.38+, and [Herdr](https://herdr.dev) 0.8+ for
dispatch. Herdr is optional for git-only lane operations.

See [the technical reference](docs/REFERENCE.md) for configuration, dispatch options,
status fields, recovery, archived lanes, and unattended promotion. Use the
[brief template](docs/BRIEF_TEMPLATE.md) when dispatching work.

Run this repository's offline tests with `npm test`. License: MIT.
