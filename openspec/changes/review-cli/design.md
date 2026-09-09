# Design: Run one independent review in the foreground

## Interface and provenance

```sh
lane review <topic> --round N [--brief <path>] [--change <name>] \
  [--route <name>] [--timeout <seconds>]
```

--round is required: a positive safe integer, with no default or automatic next
round. --route defaults to review; missing/unknown routes fail without falling back
to engineer. --timeout defaults to 1800 seconds and accepts integers 1 through 7200.
Reject duplicate/unknown flags, empty/missing values, invalid topics and operands
before effects. No new config key, environment variable or runtime dependency.

Require --change or --brief (both allowed). The caller supplies --change for every
OpenSpec-origin lane, including differing topic/change names. Resolve one simple
change name under the reviewed lane's openspec/changes; reject traversal/archive
paths and incomplete artifacts. Include proposal, design, tasks and all delta
specs, plus corresponding synced current specs when present. No framework executable
is needed. --brief alone is the acceptance source; with --change it adds questions
and the run budget. Relative brief paths resolve against invocation cwd. Explicit
local/absolute briefs may be read but are never copied into tracked files.

Locate lane/<topic> through git worktree metadata from any checkout of the same
repository; verify its branch and common directory, never guess paths from labels.
Resolve the canonical non-linked checkout via git metadata for private output.
Use the resolver on main after roots-config, not a separate lane-local config path.
Capture full HEAD, head7 (first seven hex characters), configured base branch and
its full commit/merge base. Compare the captured base commit...reviewed SHA, so a
moving main cannot silently change what was reviewed. Render all artifact paths,
AGENTS.md/shared rules, identified engineer report and latest HANDOFF entry; state
absent optional files. Pass source text as literal data, never shell interpolation.

Read .lane/gate.json in the lane. A usable gate matches full HEAD and branch;
disclose its exit/signal, command and timestamps. Missing, malformed or mismatched
gates are respectively missing, unusable or stale: state no usable gate at HEAD in
stderr and the prompt and continue with the limitation. Never run prepare/check or
validation automatically, manufacture a gate, or equate a gate with a verdict.

## Tool-enforced review boundary and round outputs

| Artifact | Writer and location |
| --- | --- |
| Full private record | Reviewer only: canonical checkout .lane/reviews/<topic>/<head7>-rN.md |
| Public-safe record | lane review only, after validation: lane worktree docs/reviews/<topic>/<head7>-rN.md |
| Rendered brief | In-memory dispatch input; no persistent job record |

Before dispatch record HEAD/branch and require git status --porcelain to be empty
(including untracked files) in the lane. Require private output to be untracked and
gitignored, public output untracked and not ignored, and both selected paths absent.
Check ancestor realpaths/file types; reject symlink escapes, foreign paths or an
existing/previously tracked output. Never alter ignore rules or overwrite records.
Existing matching head7 records naming another full SHA make that prefix ambiguous:
refuse. N is always the operator's choice, even when files suggest another round.
Generate an in-memory review ID and bind the private record to that invocation.

After receiving a complete private record, recheck full HEAD/branch and a completely
clean lane tree BEFORE generating the public record. If HEAD moved or the tree is
dirty, refuse with exit 2 and preserve evidence/work. A reviewer-created public
record is a dirty-tree violation, not accepted output. No reset, cleanup or repair.
This enforces the observed before/after boundary; it is not an OS sandbox or proof
that an agent made no transient edit and reverted it. The template forbids those
edits too. Tests/mutation witnesses use cleaned temporary copies, not tracked lane
files. The private review is the only permitted repository output of the reviewer.

Operator discipline serializes reviews of a lane. Private creation is exclusive;
concurrent collisions fail rather than choose a new round. The command creates the
public file without replacement only after all checks, and verifies afterward that
it alone is the new untracked lane file and HEAD is unchanged. A concurrent mutation
at that boundary is still failure; retained output is not a successful review result.

## Template and machine-checkable record schema

The engineering lane adds docs/REVIEW_TEMPLATE.md beside BRIEF_TEMPLATE.md, initially
loaded from the tool installation. default-config later adds repository overrides.
Use documented literal placeholders, no template engine. The required sections of
the rendered brief are Role, Target and sources, Run budget, Review criteria,
Required output, and Completion. A supplied brief cannot broaden write permissions.

Required output must say explicitly: writing the designated PRIVATE RECORD FILE is
mandatory completion work and is permitted despite the prohibition on changing
tracked files. The reviewer must not write the public record, stage, commit, fix,
rebase, promote, push or send work back to an engineer. Only temporary test fixtures
and that gitignored private record may be written. A chat verdict is insufficient.

Default run budget is zero build/test/prepare/install/check commands. An explicit
Review run budget section in --brief may authorize exact commands with a finite
maximum count per command, including witness commands. Absent/ambiguous permission
means zero and an Unverified entry. The CLI passes this as text and executes none
of it. Read-only git/file inspection remains allowed. The reviewer follows this
budget instead of generic engineering baseline/commit instructions. Before each
build/test, wait for an explicit clear machine load probe; never stop another
session's work. A timeout or unavailable slot is a limit, not permission to overrun.

New records use a strict v1 Markdown envelope. The first physical line is exactly
one of **PASS**, **NEEDS-WORK**, **FAIL** (including the Markdown double asterisks,
no prefix/title/blank line). These spellings match the existing board parser.
No other bold verdict tokens are allowed; historical records are not rewritten.
Use mandatory, unique header lines followed by the exact sections below:

```text
**PASS**
Schema: lane-review/v1
Reviewed commit: <full SHA>
Topic: <topic>
Round: <N>
Review ID: <invocation token>
Base branch: <branch>
Base commit: <full SHA>

## Findings
- [Major] <repository-relative file>:<positive line> — <finding>; Fix: <concrete change>

## Re-executed
<one JSON fenced block containing the execution array described below>

## Non-claims
- <claims this evidence does not establish>

## Unverified
- <unexercised check, reason and limit>

## Private identifiers
<one JSON fenced block listing private user/host names and other redactable values>

## Analysis
<full private reasoning and additional evidence, never copied publicly>

<!-- lane-review-complete -->
```

Findings use only [Major], [Moderate], [Minor] with file:line and a concrete Fix;
no findings is the literal None. Non-claims and Unverified are mandatory and use
None when empty. Private identifiers is mandatory (an empty array is valid) and
must disclose any private identifiers appearing in the fields intended for public
projection, including names belonging to other people/hosts. Never put credentials
in either output. Analysis may be empty; other unknown/duplicate sections refuse.

Re-executed is an array, empty when no command was run. Each entry has exactly
command (nonempty string), cwd (lane or scratch), exit_code (integer), result
(nonempty string), tests_pass (boolean), and witness (null or the object below).
This structure is a small built-ins-only schema check, not a JSON-schema dependency.
Every tests_pass=true entry needs exit_code=0 and a witness object with kind
(negative-control or mutation), command, cwd, exit_code and result, plus a nonempty
observed_failure explaining the detection expected and actually seen. A failure
must be observed, not merely a planned command or a green rerun. Witness execution
counts against the run budget. A mutation uses a temporary copy with cleanup and
never edits tracked files in the reviewed lane. Witnesses may be reused only when
their stated scope actually covers each linked claim.

Tests-pass assertions belong only to these witnessed entries, not free prose.
An existing green gate is disclosed as inherited evidence, not inserted into
Re-executed or presented as a fresh test-pass claim. If its witness is unavailable,
state that limit in Unverified. The CLI checks evidence structure, not the truth of
a reviewer's reported execution or the semantic adequacy of a mutation. Reviewers
must assess those, and must not claim tests passed without the required witness.

Record size is bounded at 1 MiB, valid UTF-8, with the final completion marker;
partial writes wait within the deadline. A completed invalid record fails. Compare
Reviewed commit to both captured and current full HEAD, not head7 alone, and verify
round/topic/review ID/base. A mismatch refuses. PASS means acceptance is supported;
NEEDS-WORK means concrete revisions are needed; FAIL means the result is unsuitable
or a fundamental requirement fails. The reviewer decides from the evidence; there
is no automatic severity-to-verdict formula.

## Public projection and verified sanitization

The CLI parses the private record and constructs a new public envelope from its
validated metadata, Findings, Re-executed, Non-claims and Unverified. It does not
copy Analysis, Private identifiers, raw transcripts, or unknown fields. Retain the
verdict, full reviewed SHA and substantive findings; never upgrade the verdict or
omit a finding to make publication possible. The public envelope adds a Sanitization
section recording placeholder substitutions by category/count, without the original
private values. Keep it within 120 lines and 64 KiB; never silently truncate evidence.

Sanitize every projected string, including commands/results and Markdown links:
convert paths proven inside the reviewed repository to relative paths, replace
other absolute paths (POSIX, drive-letter, UNC and file-URL forms) with explicit
placeholders, and strip user/host names using local OS identity/hostname aliases
and the reviewer's declared identifier set. Do not gather or log credential stores.
Public commands changed by sanitization are labeled redacted; exact commands remain
in the private record, and public output must not pretend a substituted command
was executed literally. Public finding locations must still be usable file:line;
if redaction destroys that or the fix/evidence meaning, refuse publication.

Verify the transformed structure again, rescan all projected fields for absolute
paths and known/declared private tokens, and require stable/idempotent redaction.
Reject unresolved escapes/encodings, ambiguous token replacement, unsupported
markup, leftover private material or an inability to preserve required fields.
On any unverifiable case, exit 2 with no public record and a concise diagnostic;
retain the private file for operator inspection. Never echo private content.
This verifies a documented mechanical sanitization policy; it cannot certify the
absence of every possible secret or undeclared human name in arbitrary prose.
The template requires disclosure/public-safe wording, the checker fails closed on
uncertainty it detects, and the operator still inspects the result before committing.

## Foreground lifecycle and exit codes

Use the existing dispatch path exactly once, with a separate reviewer session,
selected review route and rendered brief. Preserve route handling, cwd verification
and existing bounded startup checks; add no new start/prompt retry or second control
path. A narrow shared adapter or own-installed-CLI child is acceptable. Timeout is
end-to-end from completed preflight through dispatch, private record wait and
publication, including stalled dispatch calls. Bound subprocesses by remaining time.

Poll the one expected private file with foreground timers (250 ms to 1 s), not a
busy loop. Do not infer completion from an agent footer, exit or chat message.
Publication and final integrity checks must complete before reporting a verdict.

| Exit | Result on stdout |
| --- | --- |
| 0 | PASS followed by a newline; public record successfully written. |
| 1 | NEEDS-WORK or FAIL followed by a newline; public record successfully written. |
| 2 | No verdict; timeout, missing/incomplete/invalid record, dirty/moved target, unverified sanitization, dispatch/preflight/write failure or interruption. |

Gate disclosure, diagnostics and paths go to stderr. Timeout, Ctrl-C, SIGTERM or
stdout closure ends local children/timers promptly with exit 2, never a synthetic
PASS. Preserve other commands' exit semantics. Do not kill the Herdr reviewer or
delete partial/late records: report that it may still finish, with available session
identifiers. No local watcher remains and no command resumes/redispatches itself.

## Operator ownership, escalation and documentation

The CLI-created public record is intentionally untracked after success. The
operator inspects and authorizes its later commit with any fixes. A new commit
needs a fresh lane check; the old record still names its original reviewed SHA.
Do not exempt evidence from clean-tree checks or trigger self-review after a
record-only commit. Promotion always revalidates and never depends on a verdict.

Recommend an explicit higher review route for round 3 or later: review-xhigh for
adversarial, crypto or semantics work, review-max after repeated NEEDS-WORK. Until
those routes are configured or default-config ships, use operator-owned equivalents.
The operator chooses --round and --route on every invocation; advice never selects
a model, advances a round, re-dispatches an engineer, loops or promotes automatically.
Any review-fix loop belongs to the operator or a separately authorized contrib
wrapper with a fixed round cap. No wrapper is specified in this lane: fix authority
and round policy exceed one foreground review.

Document syntax/defaults/flags in usage and the README command table, link the new
template, and put gate/source/budget/schema/witness/sanitization/exit/recovery details
in REFERENCE. Update shared rules to distinguish review-only permissions from
engineering delivery. No AGENTS.md amendment is needed for review-cli.
