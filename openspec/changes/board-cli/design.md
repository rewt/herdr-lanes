# Design: Put board observations and actions behind lane CLI

## Commands and boundary

- `lane board --once [--repo <path>]`: dependency-free plain snapshot.
- `lane board --json [--repo <path>]`: one JSON snapshot, no Ink, one stdout document.
- `lane board --watch --json [--repo <path>]`: foreground newline-delimited JSON
  snapshots; no detached process or persistent observation cache.
- `lane board focus <row-id>`: refresh and verify the selected live occupant, then
  invoke `herdr agent focus` using the explicit pane/name and server.
- `lane board done <row-id>`: mark an existing registered session done through the
  registry adapter. Unregistered rows give a clear unsupported message.
- `lane board`: interactive UI using only these CLI interfaces.

Reject contradictory modes, unknown flags, extra operands, and missing values
before effects. Help documents the interface; one-shot errors go to stderr.
This slice keeps the existing repository default scope. Machine default arrives in
board-discovery; retain the same interfaces and make scope explicit in JSON now.

JSON schema v1 has schema_version=1, captured_at (UTC), scope, coverage, repositories,
rows, host, and errors. Each row carries an opaque row_id, repo_id, root_id, server_id,
name (nullable), pane/tab/workspace IDs, registered, topic/branch/role, goal,
brief {path, excerpt}, status, done, git {head, ahead, behind, dirty, available},
gate {state, head, exit_code, signal}, report {path, mtime, verdict, reviewed_head},
deadline, overdue, last_message {text, source, observed_at, truncated, available},
tripwire, and stale. Unknowns are null/available=false, never green or clean.
Support optional fields being absent in v1; unknown fields are ignored by consumers.
Snapshot row IDs must survive sorting and refresh while the same session exists.
Repository records include repo_id, root_id, canonical path, root/repository labels,
and the resolved lane destination base, so the UI need not resolve paths itself.
Gate state is pass, fail, stale, or missing; the human display remains
exit=0 `@<head7>`, `exit=<n>` `@<head7>`, STALE, or -. Observation staleness is separate
from gate-head mismatch. A failed prepare step writes no new gate, matching current
check behavior; document this when updating the reference.

For this slice last_message retains the old value but labels it "pane-output";
board-messages replaces it. Do not claim the footer is a real assistant message.
A done marker never changes git or gate data. A report can have a verdict and full
reviewed_head (when supplied); absence of reviewed_head means freshness unknown.

The core may reuse the existing built-ins-only board services as children/modules;
lane.mjs remains dependency-free. UI imports UI/presentation code and uses argument-
array child processes to call its own installation's lane.mjs. It does not read
target-repository files, run git, open Herdr sockets, or write metadata. Focus/done
are CLI calls even from a UI key. An import/process-boundary regression pins this.

## Lifetime and failure behavior

Use one observation process per board. EOF, q, SIGINT, SIGTERM, and render errors
close subscriptions, pending requests, timers, and children. Preserve permanent
client shutdown; a late refresh cannot revive it. Reconnect only observations,
never focus/done/start/prompt. No action has an automatic retry.

An opaque row ID is a reference, not authority: verify its server, current terminal
occupant, canonical repo, and metadata target at action time. Stale, tampered,
missing, or now-foreign IDs fail without focusing another pane or writing files.
No shell interpolation of IDs, task text, repository names, or paths.
