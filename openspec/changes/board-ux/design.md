# Design: Build the fullscreen keyboard board

## UI and dependencies

Use Ink 5/React 18 plus @inkjs/ui, selecting a pinned release compatible with Node 20.
The reviewed upstream @inkjs/ui manifest reports 2.0.0, Node >=18 and Ink >=5;
verify its published package/lockfile at implementation, since moving branches are
not a lock. Keep plain .mjs/React.createElement; do not reintroduce tsx/esbuild or a
root install. Use the official components for selections, input and status where
they fit; bespoke layout uses Ink Box/Text.

Header: board title, scope/filter, server coverage, last refresh.
Left: grouped identity/repository/session list, selected row stable by ID.
Right: full goal, role, brief path/excerpt, git state, exact gate, report/verdict and
freshness, deadline/overdue, tripwire, last message and source.
Status bar: keyboard hints, connection errors, host load/free memory/worker counts.
At >=100 columns and >=24 rows use two columns; at 60-99 columns stack detail below
the list. At smaller sizes show a compact selected-row summary and resize hint.
Reserve header/footer rows; scroll content rather than terminal output. Test Unicode
display width (wide characters and combining marks) and resize without splitting
graphemes or allowing content to overrun the pane.

Keys: arrows/j/k select; Tab switches list/detail navigation; Enter focuses via
lane board focus; a remains an alias for focus with updated help; d invokes done;
h toggles history (--all); / edits repository filter; r refreshes; q/Escape quits
unless Escape is cancelling an active input. No observation steals Herdr focus.

State is text plus color: working cyan; blocked red; stale observations/gates amber;
overdue magenta; idle neutral; matching zero gate green and matching nonzero gate red.
These are separate badges, not one priority color that masks a failed gate.
Unknown is explicitly "unknown"; color is never the only cue. Respect NO_COLOR
for color suppression and document it as a UI environment variable.

Enter alternate screen once on startup. Restore previous screen, cursor, raw mode,
and observers on normal exit, Ctrl-C, SIGTERM, render failure, and editor handoff.
Ink 5 fullscreen/alternate-screen capability must be verified locally; use a tiny
UI-only lifecycle wrapper if needed, not a major Ink upgrade. No mouse modes yet.

## Verification and risks

Keep npm test dependency-free using built-ins-only state/width/process-boundary
fixtures and an injected UI-command adapter. A separately serialized optional
npm --prefix board ci plus real-TTY smoke verifies rendering and key sequences;
it is not a root test prerequisite. Report installation size/dependency count and
compare with the previous 41-package/22 MB recorded board baseline.
Do not claim real terminal input, terminal restoration, or Linux behavior from a
string rendering test. Preserve process teardown and responsiveness budgets.
