# herdr-lanes

Concurrent R&D lanes for AI coding agents, as one script.

A *lane* is one topic, one `lane/<topic>` branch, one git worktree, and (optionally)
one visible agent session running in it. Several lanes run at once on one machine
without sharing a checkout. Promotion is always the same move and nothing else:

```text
clean worktree  ->  rebased onto current main  ->  validation green  ->  fast-forward
```

No merge commits, no push, no policy gates. Deterministic tests decide acceptance;
git truth decides everything else. `lane.mjs` is a thin layer over `git worktree`
that is aware of [herdr](https://herdr.dev), the terminal workspace manager for
coding agents: with herdr running, each lane gets its own console workspace, and
`dispatch` starts an agent in it with a brief as the first prompt, so an operator
can watch, attach, and steer. Without herdr, `open`, `status`, `promote`, and
`close` still work on plain git worktrees; only `dispatch` needs the herdr server.

This is the script that has run a private cryptography research repository's
lanes since August 2026: dozens of reviewed promotions a day, three or more agent
sessions in flight, different agent kinds and models per lane. It was extracted
here unchanged in behaviour, with the repository-specific parts moved into a
config file.

## Lifecycle

```sh
lane open <topic> [base-ref]      # cut lane/<topic> from main into ~/.herdr/worktrees/<repo>/lane-<topic>
lane dispatch <topic> @brief.md   # start a visible agent session there and submit the brief
lane status                       # every open lane: distance from main, dirty?, rebases cleanly?, shared files
lane promote <topic>              # clean + rebased + validation green -> fast-forward main; never pushes
lane close <topic>                # remove the worktree; delete a merged branch, archive-tag an unmerged one
```

Also: `seams [pattern]` lists kept unfinished work (unmerged branches and
`archive/*` tags) so a new lane can resume a seam with `open <topic> <ref>`;
`prepare <topic>` runs the repository's prepare steps in a worktree;
`rebase-check <topic> [--against <ref>]` and `verify-agent <name> <path>` are the
two guards exposed as commands so their negative controls can be run by hand.

### Promotion, precisely

1. The lane worktree and the canonical checkout must both be clean.
2. If main moved since the lane was cut, a dry-run rebase (`git merge-tree`) must be
   clean; then the lane is rebased. A conflicting rebase is refused with the file
   list and goes back to the implementer.
3. The worktree is prepared (see below) and the repository's validation command
   runs **on the rebased tree**.
4. If main moved during validation, promotion is refused; run it again.
5. `git merge --ff-only`. No push.

Promotion of one lane never invalidates another; it only leaves the others behind
main. `status` shows each lane's distance behind main, whether it rebases cleanly,
and any file two open lanes both change. Scope concurrent lanes to disjoint files
by brief; when they cannot be disjoint, serialize them.

### Worktrees carry no gitignored state

A fresh worktree has no `node_modules` and no built artifacts. Validation there
fails for environmental reasons that look exactly like real failures (many test
*files* failing to load while every assertion that ran passed). The repository
declares what "prepared" means, each step skipped when its `unless` path already
exists:

```json
"prepare": [
  { "unless": "node_modules", "run": "pnpm install --ignore-scripts --prefer-offline" },
  { "unless": "packages/core/dist", "run": "pnpm --filter ./packages/core build" }
]
```

Never run two promotions in the same checkout at once: their prepare and build
steps race and produce spurious failures. `contrib/promote-safely.sh` refuses to
start while another promotion is running and prints one `OUTCOME:` line with the
real exit code, for supervisors that only see the tail of a log.

## Dispatch guards

`dispatch` is where an unattended workflow goes wrong, so it is deliberately
paranoid. Each of these guards exists because the failure it prevents happened:

- **The pane's shell must be in the lane worktree before anything starts.** An
  agent started during shell init inherits the wrong directory and runs the brief
  there. The tab is polled until its foreground cwd is the worktree; otherwise it
  is closed and nothing is started.
- **The agent's cwd is verified again after start**, from herdr's own record, and
  the brief is only sent if it matches. `verify-agent <name> /wrong/path` must
  exit 1; that is the control.
- **Agent names are unique per attempt and capped at herdr's 32 characters.** A
  failed start can leave a name registered, and a start herdr reports as failed can
  still have launched the agent; every attempt uses a fresh name and adopts
  whatever is already running in the pane.
- **The directory-trust prompt is answered** for agent kinds that ask it, because
  the directory is the repository's own worktree.
- **Dispatch is model-agnostic.** The operator owns the mapping from "dispatch a
  session" to a concrete agent kind, model, and flags, in `.lane.json`. `--kind`,
  `--model`, `--env K=V` and `--arg <raw>` override it per dispatch; `--arg`
  *replaces* the configured args, so repeat every model flag when you pass one.

Rule inheritance is the repository's business: codex reads `AGENTS.md` natively,
Claude Code reads `CLAUDE.md` (keep it a one-line `@AGENTS.md` import so the rules
stay one file), and other kinds should be briefed to read the instructions.

## Configuration

`<repo>/.lane.json` (or `$LANE_CONFIG`). Every key is optional; see
`.lane.json.example`.

| key | meaning | default |
| --- | --- | --- |
| `main` | integration branch | `main` |
| `validate` | shell command that must exit 0 before a fast-forward; `$LANE_VALIDATE` overrides at run time | `npm test` |
| `prepare` | steps run in a fresh worktree before validation | none |
| `dispatch` | `{kind, model, env, args}` operator-owned agent mapping | kind `claude`, no model flag |
| `seams_doc` | path of a topic map shown by `seams` | none |

Worktrees live under `~/.herdr/worktrees/<repo-basename>/lane-<topic>`
(`$LANE_WORKTREE_ROOT` overrides), which is where herdr expects them.

## Requirements

- Node 20 or later; no dependencies.
- git 2.38 or later (`merge-tree --write-tree` is the conflict dry run).
- [herdr](https://herdr.dev) 0.8 or later for workspaces and `dispatch`; optional
  for everything else.

## Install

```sh
git clone https://github.com/rewt/herdr-lanes
ln -s "$PWD/herdr-lanes/lane.mjs" ~/.local/bin/lane   # or run node lane.mjs from any checkout
```

Run it from inside any checkout of the repository; it finds the repository root
and the canonical (non-linked) worktree itself, so opening a lane from within
another lane works.

## What this is not

It is not a job system, a lease manager, or a policy engine, and it is not
publication tooling. It never pushes. Reviewing a lane before promotion is the
operator's process, not the script's: this script guarantees only that what lands
on main was clean, rebased, and green at the moment it landed.

## License

MIT.
