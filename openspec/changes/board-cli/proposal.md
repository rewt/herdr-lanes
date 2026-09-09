# Put board observations and actions behind lane CLI

Status: proposed. Initiative phase 2b; one independent lane.

## Why

The existing UI opens the Herdr socket, runs git sampling, reads reports, and rewrites registry files itself. A single CLI boundary must exist before adding more UI actions.

## What Changes

Expose a versioned JSON snapshot/foreground watch stream and explicit focus/done CLI actions. Rewire the existing UI to those interfaces while keeping its current layout and plain output.

## Capabilities

### New Capabilities

- `board-cli-interface`: requirements in `specs/board-cli-interface/spec.md`.

### Modified Capabilities

None. Existing safety guarantees remain in `openspec/specs/lane-safety/spec.md`.
These additions do not claim the whole existing board/CLI has been re-specified.

## Impact

- Scope: lane.mjs; board/app.mjs; dependency-free board entrypoints/model/client; test/; README.md; docs/REFERENCE.md; HANDOFF.md.
- Prerequisites: session-registry promoted.
- Contract: A3 must be approved before implementation.
- Delivery: `lane/board-cli`, route `engineer`; High; one focused engineering session.
- Non-goals: No new layout, machine discovery, mouse, composer, global cache, daemon, protocol server, or action retry.

See [design](design.md) for compatibility changes and risk controls and
[tasks](tasks.md) for the complete dispatchable brief. Shared amendments and
workflow are in [the OpenSpec guide](../../README.md).
