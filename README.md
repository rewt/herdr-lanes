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

Edit `.lane.json` so `worktree_root`, `validate`, `prepare`, `dispatch.kind`, and the
named `routes` match the project. Put the project's instructions in `AGENTS.md` before
opening lanes. A relative `worktree_root` is resolved from the file that defines it.
Add `.lane/` to the target repository's `.gitignore`; `lane check` and `lane board`
write runtime state there, and that state must not make a worktree dirty.

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
lane config
lane status
```

Before built-in routes ship, configure a named `review` route in `.lane.json`. Then
run one independent review of a fixed lane commit with the packaged
[review template](docs/REVIEW_TEMPLATE.md):

```sh
lane review api-change --round 1 --change api-change
lane review docs-change --round 1 --brief /absolute/path/to/review-questions.md
```

The current private-evidence slice validates the reviewer's gitignored record and
prints only PASS, NEEDS-WORK, or FAIL. Until the public-projection slice lands, a
public review record is a manual operator artifact; `lane review` does not create it.

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
<worktree_root>/<repo>/lane-<topic>
<root-label>/<repo>:lane-<topic> Herdr workspace for that worktree
```

Git's canonical common-directory path—not the repository basename, remote, or
author—owns each lane. Before creating or using a worktree, `lane` verifies that
identity and its real path. New destinations inside a checkout or escaping the
selected worktree base are refused; already-registered legacy locations remain
usable. `lane` never changes git author configuration.

`lane dispatch <topic> --route <name> @brief.md` starts the route's configured agent
in that workspace, verifies its repository identity and cwd, then sends the brief.
New workspace labels include root, repository, and topic identity and are bounded to
64 Unicode code points; agent names include a repository-identity and random suffix.

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
| `lane review <topic> --round N [--change <name>] [--brief <path>] [--route <name>] [--timeout <seconds>]` | Run one foreground independent review (private evidence only for now) |
| `lane routes` | List resolved named dispatch routes |
| `lane config` | Print resolved configuration values and sources |
| `lane status` | Show lane state and overlap |
| `lane check [--cmd <validate command>]` | Record validation against this worktree's HEAD |
| `lane promote <topic>` | Rebase, validate, and fast-forward local main |
| `lane close <topic>` | Remove and delete or archive a lane |
| `lane board [--once]` | Watch registered sessions, or print one plain snapshot |
| `lane seams [pattern]` | List work that can be resumed |
| `lane prepare <topic>` | Run missing setup steps |
| `lane rebase-check <topic>` | Check whether promotion will conflict |

Requirements: Node.js 20+, git 2.38+, and [Herdr](https://herdr.dev) 0.8+ for
dispatch. Herdr is optional for git-only lane operations.

Configuration may be shared in the nearest parent `.lane.json` and overridden by the
canonical repository's `.lane.json`. `LANE_CONFIG` selects one file instead;
`LANE_VALIDATE` overrides validation, and `LANE_WORKTREE_ROOT` preserves its legacy
meaning as the final per-repository directory. Relative environment paths resolve
from the invoking shell's directory. See the reference for the exact boundaries and
merge rules.

## Lane board

The interactive board is optional. Install its isolated dependencies once:

```sh
npm --prefix /path/to/herdr-lanes/board ci
```

Add `"registry": ".lane/sessions.json"` to `.lane.json`. If a different registry
path is configured, it must also be gitignored.

```sh
lane board
lane board --once
```

Run the interactive view in a Herdr pane; use `--once` for plain, scriptable
output. A report is incomplete without the `GATE` line printed by `lane check`.
Run `lane check` again after the last commit; before handoff, the board's `GATE`
column must read `exit=0 @<head7>` against the lane's current HEAD.

See [the technical reference](docs/REFERENCE.md) for configuration, dispatch options,
board fields, status fields, recovery, archived lanes, and unattended promotion. Use the
[brief template](docs/BRIEF_TEMPLATE.md) when dispatching work.

Run this repository's offline tests with `npm test`. License: MIT.

The [specification workflow](openspec/README.md) describes planned changes and how
to take an independently promotable engineering brief.
