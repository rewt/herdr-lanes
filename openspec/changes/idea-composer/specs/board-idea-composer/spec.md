## Purpose

Let an operator choose a repository and route, describe work, and obtain a visible
registered lane from the board through the existing idea-dispatch command.

## ADDED Requirements

### Requirement: Repository and route composer
The UI SHALL provide task/topic inputs, root-qualified repository selection, route
selection with use notes, and an explicit submit action.
#### Scenario: Same-named repositories
- **WHEN** two discovered repositories share a basename
- **THEN** the operator can distinguish their roots, and changing selection loads only the chosen repository's routes.
#### Scenario: No route or empty task
- **WHEN** required fields are absent or invalid
- **THEN** submission is unavailable and no CLI mutation is invoked.

### Requirement: CLI-only single submission
The composer SHALL call lane new once with literal argument values and SHALL not
reimplement brief writing, lane creation, dispatch, or registration.
#### Scenario: Double submit and partial failure
- **WHEN** submit is pressed twice before the command exits and dispatch reports partial failure
- **THEN** only one command runs, its precise recovery information appears, and no retry occurs.
#### Scenario: Successful idea
- **WHEN** the CLI successfully creates and registers the session
- **THEN** the board refreshes/selects the row and Enter can focus its actual Herdr tab.

### Requirement: Usable long-text and editor flow
The composer SHALL support long task input and an explicit edit-then-dispatch
handoff, restoring terminal/observation state afterward.
#### Scenario: Editor cancelled
- **WHEN** the external editor is cancelled or leaves empty text
- **THEN** the board returns with the CLI's preserved-draft information and no new lane/agent.
#### Scenario: Input focus owns keys
- **WHEN** a user types d, q, n, or Enter into a task control
- **THEN** the keystroke edits/submits that control only and does not mark sessions done, quit, or open another composer.
