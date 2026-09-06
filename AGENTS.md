# herdr-lanes — agent instructions

This repository is a single script, `lane.mjs`, plus its config contract, README and
a small contrib wrapper. Public, MIT, owned by GitHub user `rewt` (Kevin Gibson).

## What you may and may not do

- Commit and push to `origin main` of **this** repository only, with the `rewt`
  identity: `GH_CONFIG_DIR=~/.config/gh-rewt`, remote `git@github-rewt:rewt/herdr-lanes.git`,
  author `Kevin Gibson <kevgibson@gmail.com>`. Never use another gh config dir or SSH key.
- Never touch the private research repository this script was extracted from, and never
  copy its paths, package names, fixture names, or internal documents into this repo.
  Anything here is public the moment it is pushed. `docs/ORIGIN.md` already says
  everything about the origin that should be said.
- Keep `lane.mjs` dependency-free (Node built-ins only) and keep its behaviour
  identical to the private copy unless a change is deliberate and documented in
  `HANDOFF.md`; the private repository will re-import this script later.
- Do not add a job system, leases, policy gates, or any push inside `promote`. The
  script's contract is: clean + rebased + green → fast-forward, never push.

## How to work

- Read `HANDOFF.md` first; append a dated entry when you finish a slice.
- Every behaviour change ships with a test in `test/` that was observed failing
  before the change. Tests must run offline in a temporary git repository and must
  not require herdr (skip, do not fail, when `herdr` is absent).
- Report plainly: what you measured, what you did not verify.
