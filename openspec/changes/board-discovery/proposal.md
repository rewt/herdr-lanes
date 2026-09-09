# Discover local Herdr agents across repositories

Status: proposed. Initiative phase 2c; one independent lane.

## Why

A registry-only board omits manually started or unnamed agents and separates repositories into isolated views. Herdr provides the inventory, but its workspace metadata alone does not establish branch ownership.

## What Changes

Default the board to accessible local-machine Herdr scope, discover every live agent including unregistered/facilitator rows, join repositories safely, filter by repository, hide retired history, and publish explicit coverage.

## Capabilities

### New Capabilities

- `machine-session-discovery`: requirements in `specs/machine-session-discovery/spec.md`.

### Modified Capabilities

None. Existing safety guarantees remain in `openspec/specs/lane-safety/spec.md`.
These additions do not claim the whole existing board/CLI has been re-specified.

## Impact

- Scope: lane.mjs; built-ins-only board services; test/; README.md; docs/REFERENCE.md; HANDOFF.md.
- Prerequisites: board-cli promoted.
- Contract: Uses previously approved A1-A3; no further amendment proposed.
- Delivery: `lane/board-discovery`, route `engineer`; High; one focused engineering session.
- Non-goals: No filesystem-wide crawler, OS-process agent detector, remote server discovery, persistent machine registry, git identity changes, or lifecycle scheduling.

See [design](design.md) for compatibility changes and risk controls and
[tasks](tasks.md) for the complete dispatchable brief. Shared amendments and
workflow are in [the OpenSpec guide](../../README.md).
