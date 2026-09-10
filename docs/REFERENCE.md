# Technical reference

## Configuration

Every key is optional. A repository can inherit reusable settings from one parent
`.lane.json` and override them in its own canonical-checkout `.lane.json`:

```json
{
  "main": "main",
  "worktree_root": "../.worktrees",
  "validate": "npm test",
  "registry": ".lane/sessions.json",
  "prepare": [
    { "unless": "node_modules", "run": "npm ci" }
  ],
  "dispatch": {
    "kind": "codex",
    "model": "model-name",
    "env": ["KEY=value"],
    "args": ["--agent-flag"]
  },
  "routes": {
    "engineer": {
      "kind": "codex",
      "model": "engineering-model",
      "env": ["ROLE=engineer"],
      "args": ["--agent-flag"],
      "use": "Implementation work that needs full repository context"
    }
  },
  "seams_doc": "docs/tasks.md"
}
```

| Key | Default | Meaning |
| --- | --- | --- |
| `main` | `main` | Local integration branch |
| `worktree_root` | see below | Shared base directory for repository worktree containers |
| `validate` | `npm test` | Shell command required for promotion |
| `registry` | `.lane/sessions.json` | Gitignored legacy session array and base path for per-session display records |
| `prepare` | none | `{unless, run}` steps for fresh worktrees |
| `dispatch.kind` | `claude` | Herdr agent kind |
| `dispatch.model` | none | Model passed to the agent |
| `dispatch.env` | none | Environment added to the Herdr tab |
| `dispatch.args` | none | Raw agent arguments |
| `routes` | none | Named dispatch configurations selected with `--route` |
| `routes.<name>.kind` | `dispatch.kind` | Herdr agent kind for this route |
| `routes.<name>.model` | `dispatch.model` | Model for this route |
| `routes.<name>.env` | none | Environment appended after `dispatch.env` |
| `routes.<name>.args` | `dispatch.args` | Raw agent arguments replacing `dispatch.args` when present |
| `routes.<name>.use` | none | Operator note describing when to select the route; dispatch ignores it |
| `seams_doc` | none | Optional task-map path printed by `seams` |

### File discovery and merging

Without `LANE_CONFIG`, `lane` identifies the canonical checkout through git's common
directory. It searches upward from the canonical checkout's parent and loads only the
nearest `.lane.json` it finds, then loads the canonical checkout's `.lane.json` if
present. Invoking the command in a linked worktree therefore uses the same operational
files as invoking it in main; a linked worktree's copy is not another layer.

For a repository below the current user's home directory, the search excludes home
and every ancestor above it. If the canonical checkout is home, no parent is searched.
Outside home, the search stops before the filesystem root. A missing optional parent
or repository file contributes nothing.

Top-level keys merge shallowly, with the repository value replacing the parent value.
Arrays such as `prepare`, `dispatch.env`, and `dispatch.args` never concatenate across
files, and a repository `dispatch` object replaces the parent object as a whole. The
only special case is `routes`: route names merge, while a repository route replaces
the complete same-named parent route. Dispatch's documented global-to-route-to-CLI
resolution occurs after this file merge, so its existing environment append behavior
is unchanged.

`LANE_CONFIG` selects exactly one file and bypasses both discovered layers. A relative
`LANE_CONFIG` is resolved from the command's invoking directory. The selected file
must exist. Selected files that cannot be read, contain malformed JSON, or give a
known key the wrong type stop the command before git, validation, setup, or Herdr
actions. Optional absent discovered files are allowed. Configuration is parsed as JSON
only; values are not interpolated or executed during loading or `lane config`.

Because `validate` and `prepare[].run` are trusted shell commands, place shared parent
configuration only in directories controlled by the operator.

Repository identity is the real absolute path returned by Git for its common
directory. The canonical checkout is the non-linked checkout whose own Git directory
is that common directory; when invoked in the primary checkout, this also supports a
Git directory stored separately from the working tree. A bare repository or a linked
invocation for which Git cannot identify that primary checkout can still run read-only
`config` and `status` inspection from the linked checkout, but fails clearly before a
lane mutation. Repository basenames, remotes, workspace labels, and author settings
are never treated as ownership.

### Worktree-root precedence

`worktree_root` is a shared base. A relative value is resolved from the directory of
the parent or repository file that defines it, then the canonical repository basename
is appended. New lane paths use this order:

| Winning setting | Repository worktree directory |
| --- | --- |
| `LANE_WORKTREE_ROOT` | `<env-directory>` |
| Repository `worktree_root` | `<resolved-base>/<repo-name>` |
| Parent `worktree_root` | `<resolved-base>/<repo-name>` |
| Parent file present without the key | `<parent-directory>/.worktrees/<repo-name>` |
| No parent and no key | `<home>/.herdr/worktrees/<repo-name>` |

`LANE_WORKTREE_ROOT` intentionally keeps its earlier meaning: it is the final
per-repository directory, so no repository segment is appended. A relative value is
resolved from the invoking directory. When `LANE_CONFIG` is explicit and its one file
omits `worktree_root`, the legacy home default applies; the selected file's directory
does not count as discovered parent configuration.

The legacy default is refused when home is inside a checkout; set `worktree_root` or
`LANE_WORKTREE_ROOT` to a directory outside any repository.

Only `worktree_root` is relative to its defining configuration file. `registry` and
`seams_doc` remain relative to the canonical repository, and `prepare[].unless`
remains relative to the worktree being prepared. Changing root settings affects only
new lanes. Every existing lane operation locates registered worktrees through git and
never moves or adopts them. Before using one, `lane` verifies that its real Git common
directory is the canonical repository identity and that its checked-out branch is the
expected lane branch.

Before creating a lane, `lane` resolves the selected base, repository worktree
directory, destination, and existing ancestors through real paths. It refuses a
destination outside the selected base; in or equal to the canonical checkout, a
registered checkout, or another repository; or already occupied by a foreign
repository. These refusals happen before branch creation or a Herdr mutation. The
created path and Git identity are checked again after Git or Herdr returns. There is
no automatic temporary-directory fallback. Choose distinct worktree bases when two
repositories would otherwise occupy the same destination.

`LANE_VALIDATE` overrides `validate` at execution time. Do not put secrets in tracked
configuration.

### Explain configuration

`lane config` prints deterministic tab-separated rows:

```text
key<TAB>JSON-value<TAB>source
```

It reports `dispatch`, `main`, `prepare`, `registry`, `seams_doc`, `validate`, the
fully resolved per-repository `worktree_root`, and one `routes.<name>` row per merged
route. Rows are sorted by key; JSON values stay on one line. Each source is `env`,
`default`, or the absolute defining file path. A parent-derived `.worktrees` default
names that parent file as its source. `LANE_VALIDATE` and `LANE_WORKTREE_ROOT` appear
with source `env`; `LANE_CONFIG`-selected values name the selected file. The command
does not run prepare/validate commands or contact Herdr. In route keys, backslashes,
tabs, carriage returns, and newlines are escaped as `\\`, `\t`, `\r`, and `\n` so
each TSV record remains one line with three fields.

## Check

`lane check [--cmd <validate command>]` validates the current clean worktree and
records the result against its exact commit. The command is resolved in the same
order as promotion: `.lane.json` `validate`, otherwise `npm test`, with
`LANE_VALIDATE` overriding either. `--cmd` overrides the command for that run and
is recorded verbatim. Before validation, `check` runs the configured `prepare`
steps in the current worktree just as `promote` does.

The command refuses with exit 1 before validation when `git status --porcelain`
is non-empty. `lane check` writes `.lane/gate.json`; `.lane/` must be in the target
repository's `.gitignore`, or the gate makes the worktree dirty and blocks the next
`lane check` and `lane promote`. After validation, `check` atomically writes the
gate file even when validation fails:

```json
{
  "head": "0123456789abcdef0123456789abcdef01234567",
  "branch": "lane/example",
  "command": "npm test",
  "exit_code": 0,
  "signal": null,
  "started_at": "2026-09-08T14:00:00.000Z",
  "finished_at": "2026-09-08T14:00:03.250Z",
  "duration_s": 3.25
}
```

`head` is the full SHA captured before validation, `branch` is the current branch,
the timestamps are ISO-8601 UTC, and `duration_s` is numeric. The command prints
`GATE <full-head> exit=<n> (<duration>)` after writing the file and exits with the
validation command's exit code, so scripts see a failed gate directly. `signal` is
the terminating signal name or `null`; when validation dies by signal, `exit_code`
uses the shell convention 128 plus that signal's number.

Run `lane check` again after the last commit. The `GATE` line pasted into a report
names the commit it measured; the board's `GATE` column must read
`exit=0 @<head7>` against the lane's current HEAD before handoff. Because
`.lane/gate.json` is untracked, re-running the check does not dirty the worktree.

## Board

Install the isolated Ink package once with `npm --prefix board ci`. `lane
board` starts that package as a child process, so `lane.mjs` remains dependency-free.
`lane board --once` uses only Node.js built-ins and prints the same columns without
ANSI styling.

From a linked worktree, `lane board` retargets the canonical checkout and passes the
resolved main branch and inherited registry explicitly, while descendant lane commands
retain normal layered configuration resolution.

The configured registry may be a legacy JSON array. Every legacy entry has string fields `name`
(the Herdr agent name), `workspace` (workspace ID or label), `lane` (topic or
`lane/<topic>` branch), `role`, and `report` (absolute or repository-relative
path), plus `deadline` (an ISO-8601 timestamp or `null`) and `done` (boolean).
Optional `tripwires` is an array of literal output substrings. The default registry
path is `.lane/sessions.json`. The configured registry path must be covered by the
target repository's `.gitignore`.

Automated dispatch does not rewrite that shared array. It writes one immutable JSON
record per successful session at `<registry>.d/<session-id>.json`; completion is an
atomic `<registry>.d/<session-id>.done.json` marker. The board merges both formats,
derives deterministic IDs for legacy entries, overlays completion markers, and
reports malformed entries locally while retaining healthy sessions. Concurrent
record and marker writes therefore do not lose unrelated sessions. This is local
display metadata only: it does not authorize, schedule, retry, lease, validate,
promote, push, or delete work.

New records contain `session_id`, canonical `repo_id`, development `root_id`,
canonical `repo`, `topic`, actual Herdr `name`, opaque `workspace` and `pane`, local
`server` endpoint, full `lane` branch, selected route `role` (or `agent`), absolute
source `brief` path or null, bounded `goal`, conventional `report`, null `deadline`,
false `done`, and UTC `created_at`. The conventional report is
`docs/reports/<topic>.md`; the board looks in the lane checkout first and the
canonical checkout after promotion or close. A missing report has no implied verdict.

The board joins each entry with the Herdr snapshot, the lane worktree, and its report.
It shows agent status and pane ID, commits ahead of the configured main branch, dirty
state, gate state, report mtime and verdict, overdue state, the latest tripwire match,
and the last matched output line. The footer samples one-minute load, free memory, and
processes whose commands identify them as `vitest`, `cargo`, `go`, or `rustc` workers.

The `GATE` column reads `<lane worktree>/.lane/gate.json` and compares its full
`head` with that worktree's current HEAD:

| State | Meaning |
| --- | --- |
| `exit=0 @<head7>` | Matching HEAD passed validation; green in the interactive Ink view |
| `exit=<n> @<head7>` | Matching HEAD failed with non-zero `<n>`; red in Ink |
| `STALE` | A gate file exists for a different HEAD |
| `-` | No usable gate file exists |

`lane board --once` prints these values as plain text without color or ANSI escapes.

Interactive keys are arrow keys or `j`/`k` to select, `a` to display `herdr agent
attach <name>`, `d` to atomically set the selected registry entry's `done` field,
`r` to refresh, and `q` to quit. It redraws for subscribed events and on a five-second
host/git/report tick; there is no busy loop. Herdr sets `HERDR_SOCKET_PATH` inside its
panes. Outside Herdr, `--once` degrades to offline status while retaining git, report,
deadline, and host data. `TRIPWIRE` and `LAST OUTPUT` are live-only columns populated
by interactive subscriptions, so they display `-` under `--once`.

## Workspace setup

The canonical checkout must have a Herdr workspace before dispatch:

```sh
cd /path/to/repository
herdr
```

If already inside Herdr (`HERDR_ENV=1`), do not start a nested client. Check the
parent workspace with:

```sh
herdr status server
herdr workspace list
```

Create it only when the repository is not listed:

```sh
herdr workspace create --cwd /path/to/repository --label repository --focus
```

Without Herdr, `open` falls back to `git worktree`; `dispatch` is unavailable.

New lane workspace labels use `<root-label>/<repo-name>:lane-<topic>`. The root is
the real directory containing the inherited parent configuration, or the canonical
repository's real parent when no parent configuration is inherited. If the readable
label exceeds 64 Unicode code points or matches another identity, `lane` keeps
grapheme-safe root/repository/topic fragments and appends a SHA-256 identity suffix.
Digest collisions lengthen the suffix while fragment budgets shrink to retain the
bound. Existing open workspace labels are not renamed.

Workspace controls use opaque Herdr IDs only after `repo_key`, `repo_root`,
`checkout_path`, and linked-worktree metadata match Git's canonical identity and real
path. A stale or foreign match is not used. When `close` encounters that mismatch, it
reports that Herdr was skipped and removes the worktree through Git only. New
workspaces are created or opened from the canonical non-linked repository workspace
even when `lane open` runs in a linked checkout.

## Dispatch options

```sh
lane dispatch <topic> \
  [--route <name>] [--kind <agent>] [--model <model>] \
  [--env KEY=VALUE ...] [--arg <raw-agent-argument> ...] \
  [@brief-file | prompt text]
```

Without `--route`, values come from `dispatch`. With a route, its `kind`, `model`,
and `args` replace the corresponding dispatch defaults when present; its `env`
entries append to `dispatch.env`. Explicit `--kind` and `--model` flags override
the route. Supplying any `--arg` replaces route arguments, or `dispatch.args` when
no route is selected. Command-line `--env` entries append after both configured
environment lists. The route's `use` text is descriptive and never passed to Herdr.
List supported kinds with `herdr agent start --help`.

`lane routes` prints each configured route, sorted by name, with its resolved kind,
model, arguments, and `use` note. It exits 1 when no routes are configured. An
unknown `--route` is rejected before any Herdr call.

Before sending the brief, `dispatch` waits for the pane shell to reach the lane
worktree, starts the agent with a unique name, and verifies the agent cwd reported by
Herdr by real path. A failed cwd check closes the tab without sending the brief. New
agent names use a readable topic stem plus repository-identity and random hexadecimal
suffixes, while staying within Herdr's 32-character naming grammar. Lane never writes
Git author name, email, signing, or other identity configuration.

Before any Herdr call, dispatch also requires the configured registry and its sidecar
directory to resolve inside the canonical checkout without symlinks, remain untracked,
be covered by `.gitignore`, and have a writable sidecar directory. Existing external
registries remain readable by the board but cannot receive automated records. File
briefs retain their resolved absolute source path; their goal is the first ATX
Markdown heading outside fenced code, otherwise the first nonempty prose line. Inline
prompts use their first nonempty line, and empty dispatch uses the topic. Goals are
limited to 200 Unicode code points; full prompt text is never copied into metadata.

The record is created only after successful startup, cwd verification, and prompt
delivery (or verified readiness for empty dispatch). Startup, cwd, and prompt failures
create no record. If persistence fails after delivery, dispatch exits nonzero, names
the live agent/workspace/pane, says whether the brief was already sent, and does not
prompt again or close the working agent.

## Foreground review

```sh
lane review <topic> --round N [--change <name>] [--brief <path>] \
  [--route <name>] [--timeout <seconds>]
```

`--round` is required and accepts positive safe integers. Supply `--change` for an
OpenSpec-origin lane even when the change name differs from the topic; it loads that
change's proposal, design, tasks, every delta spec, and any corresponding current
spec. `--brief` names a literal supplemental or standalone source and resolves from
the invoking directory. At least one source is required and both may be used. The
route defaults to `review`; configure that named route before use until built-in
defaults ship. `--timeout` is an end-to-end foreground deadline in whole seconds,
defaults to 1800, and accepts 1 through 7200. Duplicate, missing, empty, unknown, or
invalid options refuse before dispatch.

Review locates `lane/<topic>` through Git worktree metadata from any checkout of the
same repository and verifies its branch and canonical common-directory identity. It
captures the full HEAD, configured base HEAD and merge base, requires a completely
clean target, and passes source text as literal data. A matching `.lane/gate.json` is
disclosed as inherited evidence. A missing, malformed, or mismatched gate is reported
as unavailable at this HEAD and review continues; the command never runs prepare,
check, validation, or a framework executable and never turns a gate into a verdict.

The installed [review template](REVIEW_TEMPLATE.md) overrides generic engineering
instructions with a review-only role. The reviewer may write exactly the designated
canonical-checkout private file:

```text
.lane/reviews/<topic>/<head7>-r<N>.md
```

That path must be gitignored, untracked, absent, and free of symlink escapes. The
corresponding `docs/reviews/<topic>/<head7>-r<N>.md` path must be absent, untracked,
trackable, and not ignored; the same command creates the public record after the
unchanged-lane check. Matching abbreviations tied to another full SHA refuse as
ambiguous. The CLI never overwrites, stages, commits, resets, cleans, fixes, retries,
or selects another round.

The reviewer cannot write anywhere in the lane worktree, including ignored scratch,
cache, dependency, or build paths. Test and mutation copies belong in cleaned system
temporary directories. The only repository write it may make is the required private
record. Without an unambiguous supplemental `Review run budget`, the budget is zero
build/test/prepare/install/check commands. An authorized budget names exact commands
and a finite count for each command and witness. Every authorized build or test waits
for a clear machine-load probe and runs alone; the CLI passes the budget but executes
none of it.

The private record is valid UTF-8 with LF line endings only, at most 1 MiB, ends
with `<!-- lane-review-complete -->`, and has exactly `**PASS**`, `**NEEDS-WORK**`,
or `**FAIL**` as its first nonempty line. Leading and trailing blank-line runs around
the whole record and each section are ignored symmetrically. It uses `Schema:
lane-review/v1`, the captured full SHA/topic/round/review ID/base, and the unique
ordered sections Findings, Re-executed, Non-claims, Unverified, Private identifiers,
and Analysis. Findings are `None` or `[Major]`, `[Moderate]`, or `[Minor]` bullets
with a repository-relative positive `file:line`, the structural ASCII ` - ` separator,
and `Fix:`. Findings, Non-claims, and Unverified entries each occupy consecutive lines
with no blank line between them. Non-claims and Unverified are `None` or bullets.
Private identifiers is a JSON array of nonempty strings; Analysis is private and may
be empty.

Re-executed is one JSON fenced array. Every object has exactly `command`, `cwd`
(`lane` or `scratch`), integer `exit_code`, nonempty `result`, boolean `tests_pass`,
and `witness`. A witness is null or an object with exactly `kind`
(`negative-control` or `mutation`), `command`, `cwd`, integer `exit_code`, nonempty
`result`, and nonempty `observed_failure`. A tests-pass entry requires exit zero and
an observed witness. Free prose cannot claim tests passed; inherited gates are not
fresh Re-executed evidence. Re-executed command strings, including witness commands,
are machine syntax and are rendered verbatim inside the JSON fence after required path
and alias sanitization; prose fields are restricted to the plain-text rules below.

After completion, the command validates that schema and rechecks the exact HEAD,
branch, and a completely clean lane before accepting the verdict. It polls only the
selected private path with foreground timers. It does not infer completion from chat
or an agent footer, send follow-up actions, kill the reviewer, delete partial/late
evidence, or leave a watcher behind.

Only after that unchanged-lane check, the CLI constructs a public envelope from the
validated metadata, Findings, Re-executed, Non-claims, and Unverified sections. It
never copies Analysis, Private identifiers, unknown fields, or raw transcripts. The
public record preserves the verdict, full SHA, findings, evidence, and limits, adds a
Sanitization section, stays within 120 lines and 64 KiB, and is created exclusively at:

```text
docs/reviews/<topic>/<head7>-r<N>.md
```

Every projected string is NFC-normalized. Proven paths inside the reviewed repository
become repository-relative first. Other absolute POSIX, drive-letter, UNC, and
file-URL paths become `[ABS_PATH]`. Case-insensitive whole path-segment or Unicode
word-boundary matches for the current OS username/home basename, hostname/full first
label, and declared private identifiers become `[USER]`, `[HOST]`, and `[PRIVATE]`.
Matches run longest-first; equal aliases use user, then host, then private precedence.
Automatic duplicates are removed. A proper substring relationship between distinct
declared tokens refuses as ambiguous; nested automatic host aliases are safe under
the longest-first rule.

The Sanitization section records counts for absolute-path, user, host, private, and
repository-relative conversions, including zero, plus modified execution fields by
array index/name without original values. Generated placeholders are reserved;
reviewer-supplied reserved placeholders are refused in every projected field,
including protected finding locations. The checker also refuses aliases in protected
file:line or captured metadata, ambiguous paths, controls/newlines, non-ASCII residue,
residual paths/aliases, and any non-idempotent second pass. Prose fields additionally
refuse backticks, angle/square brackets, emphasis sequences, and percent/HTML/
backslash-encoded text. Command strings are exempt only from that prose markup and
encoded-text check because the JSON fence renders them verbatim. Schema tags, JSON
fences and CLI placeholders are structural. The mechanical policy cannot prove that
arbitrary prose contains no undeclared human name or secret, so the operator still
inspects before committing.

The CLI creates the public file only after sanitization and the pre-publication clean
check, without replacement, staging, or committing. It then requires the same HEAD and
branch with exactly that one new untracked file before emitting a verdict. stdout is
exactly `PASS` with exit 0 or `NEEDS-WORK`/`FAIL` with exit 1; stderr names both files.
Every preflight, dispatch, timeout, incomplete/oversized/invalid record, moved/dirty
target, unverified sanitization, exclusive-write/final-integrity failure, signal, or
pipe refusal exits exactly 2 with no verdict.

A late reviewer may still finish the private file after timeout or interruption. A
late-publication exit 2 can retain an untracked public file when a concurrent mutation
is detected after creation; it is not a successful review result. Inspect both files
and all work before deciding whether to commit or remove anything. A commit changes
HEAD and needs a fresh gate plus an explicitly selected round. To reuse the same HEAD
and round, separately authorize removal of both outputs only after ensuring the old
reviewer cannot write and restoring a clean tree; otherwise retain the evidence and
choose a fresh round. The CLI performs no cleanup or occupied-round bypass.

Round 3 or later should explicitly select an operator-configured
`review-xhigh` route for adversarial, cryptographic, or semantic work, or `review-max`
after repeated NEEDS-WORK. This is advice only: review never advances a round, changes
routes, loops, fixes, commits, promotes, or pushes.

## Model routing guidance

Operators should map stable role names to models using the vendors' own current
recommendations, then record why each mapping exists in the route's `use` field.
The table below summarizes the vendor guidance fetched on 2026-09-07; availability
and recommendations can change, so recheck the linked source when updating routes.

| Model | Vendor positioning | Example route fit |
| --- | --- | --- |
| [`gpt-6-astra`](https://learn.chatgpt.com/docs/models) | OpenAI's most capable model for complex work across code, apps, and research, with stronger judgment | Planning and unblocking |
| [`gpt-5.6-sol`](https://learn.chatgpt.com/docs/models) | Most capable GPT-5.6 model for complex coding, computer use, and research | Engineering lanes |
| [`gpt-5.6-terra`](https://learn.chatgpt.com/docs/models) | Balanced everyday work at lower cost | Mechanical or isolated changes |
| [`gpt-5.6-luna`](https://learn.chatgpt.com/docs/models) | Fast and affordable for clear, repeatable tasks such as extraction and classification | Repeatable, well-specified work |
| [`claude-opus-5`](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) | Complex agentic coding and enterprise work, including large refactors and complex systems engineering; start at its default `high` effort | Independent review |
| [`claude-sonnet-5`](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) | Speed and capability for everyday coding and agent workloads | Everyday engineering |
| [`claude-haiku-4-5`](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) | Lowest latency and price, including sub-agent tasks | Narrow or high-volume tasks |
| [`claude-fable-5-1`](https://platform.claude.com/docs/en/about-claude/models/choosing-a-model) | Highest capability for agent sessions that run for hours and multistep research | Long-running facilitator |

The OpenAI page's reasoning selector presents Low, Medium (default), High, Extra
High, Max, and Ultra. Start at Medium and raise effort when deeper planning or
analysis is needed; Ultra adds automatic subagent delegation for divisible work.
The same page lists `gpt-5.4-mini` as retired from Codex with ChatGPT sign-in on
2026-08-31 and directs those configurations to `gpt-5.6-luna`; API-key-authenticated
Codex and the OpenAI API are not affected by that retirement. Vendor recommendations
are starting points: validate route choices against the repository's real tasks,
latency needs, and budget.

## Status

```text
main 10ca91f
lane/api-change  +2/-1 vs main  /worktrees/lane-api-change  DIRTY  rebase: clean
shared files: lane/api-change × lane/docs-change: src/client.js
```

- `+N`: commits unique to the lane
- `-N`: main commits missing from the lane
- `DIRTY`: uncommitted changes
- `rebase: clean`: clean dry-run replay onto main
- `rebase: CONFLICT <files>`: manual resolution required
- `shared files`: paths changed by more than one lane

## Promotion

`lane promote <topic>`:

1. Requires clean lane and canonical worktrees.
2. Dry-runs a rebase onto current main.
3. Refuses and lists files on conflict.
4. Rebases automatically when clean.
5. Runs missing prepare steps and validation in the lane.
6. Refuses if main moved during validation.
7. Fast-forwards local main without merging or pushing remotely.

Run only one promotion at a time. For unattended callers:

```sh
/path/to/herdr-lanes/contrib/promote-safely.sh /path/to/repo api-change /tmp/api-promote.log
```

The wrapper refuses concurrent promotion and prints one `OUTCOME:` line with the real
exit status.

## Close and resume

`lane close <topic>` requires a clean lane worktree. A merged branch is deleted. An
unmerged branch is tagged as `archive/lane/<topic>` before deletion.

Only after those Git operations succeed, close writes done markers for every known
session matching the canonical repository and exact topic. Dirty refusal or archive
failure leaves completion unchanged; promotion alone never marks done. With no
registry state, close remains Git-only and creates no metadata. A post-close metadata
error exits nonzero with `lane closed; metadata update failed` and does not recreate
the already-closed lane.

```sh
lane seams
lane open resumed-task archive/lane/old-task
```

## Common failures

| Message | Action |
| --- | --- |
| `cannot read lane config ...` / `invalid lane config ...` | Fix the named selected file; lifecycle actions have not started |
| `worktree path already exists` | Choose another root/topic, or move the occupant yourself only after verifying ownership |
| `unsafe worktree path` | Move the configured base outside checkouts and remove symlink escapes; no fallback path is selected |
| `worktree path belongs to another repository` | Give the repositories distinct worktree bases |
| `session registry must be gitignored before dispatch` | Ignore both the configured path and `<registry>.d/`, or configure another repository-local ignored path |
| `partial success: ... brief was already sent` | Inspect and continue the named live agent; do not replay dispatch |
| `lane closed; metadata update failed` | Git close already succeeded; repair the local registry without recreating the lane |
| `registered worktree ... is missing` | Run `git worktree prune`, then reopen or recover the lane as appropriate |
| `repository identity mismatch` | Treat the Herdr entry as stale; reopen the correct canonical repository workspace |
| `herdr workspace: none` | Start Herdr in the canonical checkout and retry dispatch |
| `lane worktree is not clean` | Commit or stash lane changes |
| `current worktree is not clean` | Commit or stash changes before `lane check` |
| `canonical main checkout is not clean` | Commit or stash canonical changes |
| `validation failed ... nothing merged` | Fix the lane and promote again |
| `does not rebase cleanly` | Rebase manually and resolve the listed files |
| `main moved during validation` | Promote again against the new main |

## Development

`npm test` runs offline behavioral tests in temporary git repositories. Herdr-only
coverage skips when Herdr is absent.
