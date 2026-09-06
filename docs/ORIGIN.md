# Origin

`lane.mjs` was written in August 2026 inside a private research repository to run
concurrent R&D by AI coding agents on one machine: one topic per branch and worktree,
a visible [herdr](https://herdr.dev) session per lane, and a promotion rule small
enough to trust. It replaced an earlier, much larger "managed worktree" control plane
(jobs, leases, review admission, one-use authorization claims, a supervisor over the
herdr socket) that was retired because the operator could not trust it. The lesson
that survived: deterministic tests decide acceptance, git truth decides everything
else, and the script should do nothing that git and herdr do not already do.

It was extracted to this repository on 2026-09-06 with its behaviour unchanged; the
repository-specific pieces (worktree root, validation command, dependency install and
build steps, the agent tier mapping) became `.lane.json`.

## Hardening history

Each entry below is a commit in the private repository, in order. Almost every one is
a guard added after the failure it prevents actually happened.

- 2026-08-30  feat(lane): add concurrent R&D lane manager over herdr worktrees
- 2026-08-30  feat(lane): resume kept unfinished work via an optional open base ref
- 2026-08-30  feat(lane): make kept unfinished work discoverable to agent sessions
- 2026-08-30  feat(lane): dispatch visible agent sessions into a lane's herdr workspace
- 2026-08-30  feat(lane): codify the dispatch model policy and wire model/env selection
- 2026-08-30  fix(lane): retry agent start until the dispatched pane's shell is ready
- 2026-08-30  feat(lane): make dispatch model-agnostic with an operator-owned tier mapping
- 2026-08-30  chore(lane): default crypto-engineering dispatch to codex max reasoning
- 2026-08-30  fix(lane): unique dispatch agent names so failed starts cannot collide
- 2026-08-30  fix(lane): cap dispatch agent names at herdr's 32-char limit
- 2026-08-30  feat(lane): dispatch panes inherit the operator persona env (ai codex personal)
- 2026-08-30  fix(lane): close retires the herdr workspace with the worktree
- 2026-08-31  fix(lane): prepare worktrees before validating
- 2026-09-01  fix(lane): gate real aggregator and console
- 2026-09-02  fix(lane): make dispatch land in the lane worktree, and open lanes from any checkout
- 2026-09-02  fix(lane): keep dispatch agent names within herdr's 32-char limit
- 2026-09-02  fix(lane): close merged lanes from any checkout; show and enforce rebase state across lanes
- 2026-09-03  fix(lane): pin max reasoning effort for dispatched codex sessions
- 2026-09-03  chore(lane): dispatch lanes to Claude Fable 5.1 at max effort by default
- 2026-09-03  chore(lane): document the Fable-max / Opus-high dispatch tiering
- 2026-09-03  chore(lane): budget revision — codex max for implementation, Opus for reviews
- 2026-09-03  chore(lane): codex for all dispatches until the weekly reset; Opus only on cyber refusal
- 2026-09-04  chore(lane): tier codex max for implementation, Opus xhigh/high for spec and review
- 2026-09-04  chore(lane): make gpt-6-astra the codex dispatch default
- 2026-09-05  chore(lane): default dispatch to Sol high; Terra for mechanical, Astra reserved for research

## Lessons the guards encode

- A herdr agent inherits the directory its pane's shell is in *at that instant*;
  started during shell init it runs the brief in the wrong directory. Poll the pane's
  cwd before starting, verify the agent's cwd from herdr's record before prompting.
- herdr agent names are capped at 32 characters; a failed start can leave a name
  registered, and a start reported as failed can still be running. Fresh name per
  attempt; adopt whatever is already on the pane.
- Worktrees carry no gitignored state. A fresh worktree fails validation for
  environmental reasons that look like real failures; prepare it first.
- Two promotions in the same checkout race on prepare/build steps. Serialize them.
- Promotion of one lane never invalidates another; it only leaves the others behind
  main. Rebase at promotion time when the dry run is clean, validate the rebased tree,
  and refuse a conflicting rebase with the file list.
- A review verdict judges the content at the reviewed commit; topology currency is
  the promoter's job and never a reason to fail a review.
