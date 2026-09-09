# Design: Compose and dispatch an idea from the board

## Interaction

Press n from the session list to open a composer. Choose a repository from the CLI
feed's canonical repository inventory, labeled by root/repo, or enter an explicit
path. A path entry is validated through lane routes --repo --json; it does not add a
persistent global catalog. Load that repository's routes and show each resolved use
note beside its name (a missing use note is shown as "no usage note").
Do not embed agent kinds/models or account choices in the UI. A repository with no
routes shows an actionable error and cannot dispatch.

Enter task text and a topic. Suggest a valid kebab-case topic locally, but require
the operator to see/edit it. Show repository, root/worktree destination, route/use,
topic, and a brief task preview before the submit control. Changing repository
invalidates a route selection that is no longer present. Standard typing, Enter,
and Escape inside controls never invoke session-list shortcuts (especially d/q/n).

Submit once by invoking lane new with an argument array. Disable duplicate submission
while that foreground command is running. This is transient UI state only; it is
not persisted or resumed as a job. On success, refresh and select the registered
row without stealing Herdr focus. A following Enter focuses it. On partial failure,
show the CLI's existing lane/agent/brief details and do not automatically retry.

For long text the explicitly labeled "Edit then dispatch" action calls
lane new --edit with inherited terminal input. Close/suspend the observation child,
leave alternate screen and release raw mode before the editor takes over; after
the foreground command exits, restore the board and refresh. Editor cancellation
preserves the draft and performs no dispatch. A CLI-provided duplicate-brief error
shows its recovery path rather than overwriting it.

## Verification and risks

Use @inkjs/ui selection/text controls, keeping the application exclusively on CLI
interfaces. Draft form fields live only in UI memory; only the CLI writes the
ignored brief. Tests exercise a built-ins-only form/action model and fake CLI
responses without importing UI dependencies. A separate real-TTY smoke checks focus
ownership, editor handoff/return, long text, cancellation, and success selection.
Include one offline end-to-end new -> registered row -> focus -> close -> hidden row
scenario across two same-named repositories in different roots.
