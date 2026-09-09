## Purpose

Dispatch one independent review of a fixed lane commit, validate its private
record and generate public evidence through bounded foreground observation.

## ADDED Requirements

### Requirement: Explicit source round and captured target
The CLI SHALL require --round and --change or --brief, resolve an existing clean
lane by git metadata, capture full HEAD/base and disclose its gate or the absence
of a usable current gate without automatically running validation.
#### Scenario: OpenSpec source with a different topic
- **WHEN** topic differs from --change and a supplemental brief is supplied
- **THEN** the reviewer receives all change artifacts, available current specs, AGENTS.md/shared rules and the supplement, bound to captured HEAD/base.
#### Scenario: Brief-only review and missing gate
- **WHEN** --brief is supplied without --change and the gate is missing, stale or unusable
- **THEN** no framework is needed, gate absence is explicit and review continues with the limitation rather than inventing validation evidence.
#### Scenario: Explicit round and early refusal
- **WHEN** round is omitted/invalid, an output already exists, source/route is invalid, or paths/lane state are unsafe
- **THEN** review exits 2 before dispatch/writes; it never infers a next round or overwrites existing records.

### Requirement: Mandatory private reviewer output and finite checks
The reusable template SHALL require a private record as an explicitly permitted
write, forbid reviewer public-record or tracked-file edits and commits, and state
a finite check budget plus the one-build/test machine rule.
#### Scenario: No run authorization
- **WHEN** no unambiguous Review run budget is supplied
- **THEN** the template permits zero build/test/prepare/install/check commands, still requires the private record, and lists omitted verification as Unverified.
#### Scenario: Budgeted checks and mutation witness
- **WHEN** tests are authorized
- **THEN** commands including negative controls stay within the finite budget after a clear load probe, and mutation work uses temporary copies with cleanup rather than tracked lane files.

### Requirement: Machine-checkable review evidence
New private records SHALL use the design's v1 envelope with a fixed first-line
PASS, NEEDS-WORK or FAIL verdict, full Reviewed commit, explicit round, tagged
findings and mandatory Re-executed, Non-claims and Unverified sections.
#### Scenario: Missing witness or malformed schema
- **WHEN** a tests-pass entry has no observed negative-control/mutation witness, or required metadata/sections/tags are invalid
- **THEN** the completed record is refused with exit 2 and no public evidence or verdict is emitted.
#### Scenario: Mismatched reviewed SHA
- **WHEN** Reviewed commit differs from captured or current HEAD, even with the same abbreviation
- **THEN** the review is refused, private evidence is retained and no public record is created.

### Requirement: Tool-enforced unchanged lane
Review SHALL record HEAD and a clean-tree check before dispatch, and require the
same HEAD/branch and a completely clean tree after private completion and before
writing public output.
#### Scenario: Reviewer or engineer changes the worktree
- **WHEN** HEAD moves or tracked/index/untracked state is dirty, including a reviewer-written public record
- **THEN** the command exits 2, preserves all work/evidence, and neither resets files nor accepts the review.

### Requirement: Orchestrator-only sanitized public record
Only lane review SHALL generate docs/reviews/<topic>/<head7>-rN.md after validating
the private canonical .lane/reviews/<topic>/<head7>-rN.md and verifying sanitization.
#### Scenario: Sanitizable private evidence
- **WHEN** a valid record contains removable absolute paths or declared/local user and host names
- **THEN** the CLI publishes a bounded schema-preserving projection with explicit placeholders/redaction labels, retains exact private evidence and leaves the public record untracked.
#### Scenario: Sanitization cannot be verified
- **WHEN** private strings remain, encoding/markup is ambiguous, or redaction loses a finding's location/meaning
- **THEN** the command exits 2, writes no public record, retains the private record and does not leak it through diagnostics.

### Requirement: Single dispatch bounded observation and explicit outcomes
Review SHALL call the existing dispatch path once, default to review, enforce the
documented --timeout and stop local observation without any follow-up lifecycle action.
#### Scenario: Recorded verdict
- **WHEN** valid unchanged-target evidence is sanitized and published
- **THEN** stdout is PASS with exit 0 or NEEDS-WORK/FAIL with exit 1, and no other action follows.
#### Scenario: Missing result or interrupted wait
- **WHEN** dispatch stalls, the record stays missing/incomplete, timeout occurs, or observation is interrupted
- **THEN** the command exits 2 with no verdict, closes local children/timers, keeps evidence and states that the Herdr reviewer may still write late output.
#### Scenario: Later review round
- **WHEN** --round is 3 or greater
- **THEN** documentation recommends a higher explicitly chosen review route; the command never chooses a tier/round, loops, commits, fixes, re-dispatches engineers, promotes or pushes.

### Requirement: Offline tests and discoverable protocol
The implementation SHALL use built-ins-only fake-reviewer tests and document the
command/template/protocol in usage, the README table, REFERENCE and shared rules.
#### Scenario: No real agent or UI dependencies
- **WHEN** the offline suite runs in cleaned temporary repositories
- **THEN** a fake reviewer writing only the private file exercises all verdict/error paths, mutation refusal and public sanitization without real Herdr, nested builds/tests or UI installation.
