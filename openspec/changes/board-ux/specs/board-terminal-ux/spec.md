## Purpose

Let operators inspect session intent and evidence in a responsive full-pane terminal
view and reach the selected Herdr session with one keyboard action.

## ADDED Requirements

### Requirement: Fullscreen responsive board
The UI SHALL render header, grouped session list, detail panel, and status bar in
alternate screen with the design's responsive layout and display-width handling.
#### Scenario: Resize and Unicode content
- **WHEN** a selected session contains wide/combining characters and the terminal changes between 120x40, 80x24, and 40x12
- **THEN** selection remains stable, content stays within the viewport, and the compact mode states its limitation.

### Requirement: Complete session details
The selected row SHALL expose goal, brief excerpt, gate, report/verdict, recent
message, git state, deadlines, and provenance without treating unknowns as success.
#### Scenario: Conflicting indicators
- **WHEN** a working session is overdue and has a stale or failed gate
- **THEN** all applicable text badges remain visible with distinct documented colors.

### Requirement: One-action keyboard focus
Enter SHALL focus the selected verified Herdr session through the CLI; all listed
keys SHALL work without mouse input, and errors SHALL remain inside the board.
#### Scenario: Focus and history toggle
- **WHEN** the user selects a live row, presses Enter, returns, and toggles history
- **THEN** the intended tab receives focus, completed rows toggle predictably, and observation alone never changes focus.

### Requirement: Terminal and dependency isolation
Exiting the UI SHALL restore terminal state and stop all observer resources. Plain
and JSON commands and npm test SHALL remain usable without UI dependencies.
#### Scenario: Exit during refresh
- **WHEN** q, Ctrl-C, SIGTERM, or a render error occurs during a pending refresh
- **THEN** the previous screen, cursor and terminal input mode are restored and no child or reconnect timer remains.
#### Scenario: No color
- **WHEN** NO_COLOR is set
- **THEN** state remains understandable from text with no color-dependent information.
