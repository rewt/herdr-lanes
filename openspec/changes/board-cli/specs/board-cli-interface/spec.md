## Purpose

Provide a single dependency-free CLI interface for board data and explicit session
actions so the optional UI remains a replaceable presentation client.

## ADDED Requirements

### Requirement: Scriptable board observations
The CLI SHALL provide plain, JSON, and foreground JSON-watch output with the
documented v1 schema and correct unknown/error states.
#### Scenario: UI dependencies absent
- **WHEN** board/node_modules is absent and plain or JSON output is requested
- **THEN** observations work using built-ins only, with no install or build.
#### Scenario: Stream framing and errors
- **WHEN** observations change while a JSON watch is running
- **THEN** each stdout line is a complete snapshot, diagnostics do not corrupt JSON, and contradictory flags fail clearly.

### Requirement: UI calls the CLI
The interactive UI SHALL acquire observations and invoke actions solely through
lane CLI processes; existing board behavior SHALL remain usable in this slice.
#### Scenario: Existing table interaction
- **WHEN** a user starts the current table, selects a row, marks it done, refreshes, and quits
- **THEN** behavior goes through the CLI boundary and no direct UI git/socket/registry control path remains.

### Requirement: Verified explicit focus
A CLI focus action SHALL verify the current live session and call herdr agent focus
with its explicit target, never change focus during observation, and never retry.
#### Scenario: Agent exits before Enter
- **WHEN** the selected agent disappears or the pane now hosts a different agent
- **THEN** focus fails with a readable stale-selection message and does not target the replacement.
#### Scenario: Unnamed live agent
- **WHEN** a valid live row has no agent name
- **THEN** focus uses its verified pane ID and works without renaming the agent.

### Requirement: Permanent observer teardown
Observer termination SHALL close all pending resources and preserve the permanent
shutdown behavior established by the previous board reviews.
#### Scenario: Quit during pending snapshot or reconnect
- **WHEN** the UI exits before an outstanding snapshot settles
- **THEN** no later response resubscribes, no timer/process remains alive, and no lifecycle action is replayed.
