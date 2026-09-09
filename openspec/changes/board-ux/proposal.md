# Build the fullscreen keyboard board

Status: proposed. Initiative phase 3a; one independent lane.

## Why

A wide text table wastes pane space and mixes goal, gate, and output into hard-to-scan columns. Operators need a stable session list and an actionable detail view.

## What Changes

Add an alternate-screen layout, responsive master/detail view, explicit state colors and keyboard focus, using the official Ink UI package within the isolated board package.

## Capabilities

### New Capabilities

- `board-terminal-ux`: requirements in `specs/board-terminal-ux/spec.md`.

### Modified Capabilities

None. Existing safety guarantees remain in `openspec/specs/lane-safety/spec.md`.
These additions do not claim the whole existing board/CLI has been re-specified.

## Impact

- Scope: board/app.mjs; board/ui/; board/package.json and lockfile; test/; README.md; docs/REFERENCE.md; HANDOFF.md.
- Prerequisites: board-messages promoted.
- Contract: A4 must be approved before adding @inkjs/ui or UI-only modules.
- Delivery: `lane/board-ux`, route `engineer`; High; one focused engineering session.
- Non-goals: No mouse support, new discovery logic, direct UI git/Herdr/file access, major Ink upgrade, visual-history store, or composer.

See [design](design.md) for compatibility changes and risk controls and
[tasks](tasks.md) for the complete dispatchable brief. Shared amendments and
workflow are in [the OpenSpec guide](../../README.md).
