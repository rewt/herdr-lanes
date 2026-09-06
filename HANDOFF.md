# HANDOFF

Living log for sessions working in this repository. Newest entry last.

## 2026-09-06 — extraction

- Extracted from the private research repository (see `docs/ORIGIN.md`), generalized
  behind `.lane.json`, README and MIT license written, first commit `cb74843`.
- Smoke-tested read-only against the origin repository: `status`, `rebase-check`
  (exit 1 on a real conflict) and `verify-agent <name> /wrong/path` (exit 1) behave.
- Publication (GitHub repo creation + first push) is the next session's first task; it
  was not done by the extracting session.
- Known gaps: no tests yet; `status` piped into `head` dies with EPIPE (cosmetic; the
  original behaves the same); the private repository still runs its own copy and will
  switch to this one via `.lane.json` once this repo has tests.
