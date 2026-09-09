# Design: Build the fullscreen keyboard board

## UI and dependencies

Discovery supplies grouped rows, machine coverage and --all filtering; messages
supplies substantive previews. Both must be promoted. The focus/done and UI process
boundary arrive through discovery's board-actions (2b-ii) prerequisite.

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

## Pre-agreed split point

Choose combined delivery or this exact split at dispatch, before implementation.
The split needs no new product decision. If the combined scope will exceed one
focused session, use these boundaries:

| Subphase / topic | Scope and required acceptance | Depends on |
| --- | --- | --- |
| 3a-i / board-frame | Alternate-screen header/list/basic selected-row panel/footer, responsive geometry, Unicode clipping, stable selection, Enter focus, NO_COLOR, and terminal/observer teardown. Own Fullscreen responsive board, One-action keyboard focus, and Terminal and dependency isolation. Test all listed keys and resize/exit paths; retain existing gate colors and a basic detail summary. | board-discovery (2c), board-messages (2d); approved A4 |
| 3a-ii / board-details | Complete goal/brief/report/message detail content, @inkjs/ui component adoption for selectors/status, upgrade the frame's simple repository/history controls to those components, and all state badges/colors. Own Complete session details plus the final component/dependency-footprint checks. Verify simultaneous working/overdue/stale/failed indicators, input focus, expanded details and the isolated install/TTY smoke. | board-frame (3a-i) |

When activated, partition complete requirement blocks into those two OpenSpec
changes and one dispatchable brief each before writing code. Each gets a
`docs/reports/<topic>.md` report, tests and post-commit check. The frame uses Ink/
React with simple controls first; complete details and @inkjs/ui adoption follow
in board-details. Full UX acceptance, idea-composer, and optional mouse research
wait for board-details to promote. Do not sync unfinished detail requirements or
mark the original combined task complete after shipping the frame alone.
