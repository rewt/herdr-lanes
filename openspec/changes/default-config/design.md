# Design: Ship overridable built-in routes and generic templates

## Shipped configuration and routing

Ship defaults/lane.json with the tool and resolve it relative to the real installed
lane.mjs, including a symlinked launcher. No network, generated home file, install
hook or mutable machine registry. Validate the shipped file like selected config;
missing/malformed package data is an installation error, never an empty fallback.

The following is the normative route table. Effort variants keep the named model;
use notes are descriptive and do not trigger scheduling or escalation.

| Route | Kind | Model | Effort | Shipped use note |
| --- | --- | --- | --- | --- |
| engineer | codex | gpt-5.6-sol | high | Implementation work with repository context and verification. |
| engineer-xhigh | codex | gpt-5.6-sol | xhigh | Complex implementation needing additional reasoning. |
| engineer-max | codex | gpt-5.6-sol | max | Difficult implementation with an explicitly increased reasoning budget. |
| chore | codex | gpt-5.6-terra | medium | Small, mechanical or well-bounded maintenance. |
| unblock | codex | gpt-6-astra | xhigh | Diagnose an unclear approach and resolve implementation blockers. |
| review | claude | opus | agent default | Independent review of implementation and evidence. |
| review-xhigh | claude | opus | xhigh | Adversarial, cryptographic or subtle semantics review. |
| review-max | codex | gpt-6-astra | max | Explicit escalation after repeated NEEDS-WORK reviews. |

Represent effort through the existing route args array, not a new lane effort key.
Codex routes use ["-c", "model_reasoning_effort=\"<effort>\""] and their model field;
review-xhigh uses ["--effort", "xhigh"]. review uses args: [] so the agent chooses
its default effort and cannot inherit Codex arguments. Every shipped route has
explicit kind, model, args, env: [] and use. Do not embed permission-bypass flags,
credentials, endpoints, author settings, account IDs, working paths or private notes.

Shipped dispatch is a complete copy of the shipped engineer kind/model/args/env
(without use). Thus a configuration-free dispatch and --route engineer select the
same profile. Preserve existing independent dispatch/route override semantics:
overriding an engineer route alone does not silently rewrite a separately resolved
dispatch object. The example documents how to override both when identical behavior
is wanted. No hidden alias or circular dispatch-to-route resolution is introduced.

Use public identifiers exactly as specified. The opus alias intentionally follows
the installed agent's alias resolution; record that compatibility choice. The tool
does not guarantee that agents are installed, authenticated or entitled to a model.
Unavailable models/unsupported effort flags fail through ordinary dispatch handling;
never substitute a cheaper/newer model, lower effort, or retry another route.

Read-only CLI help confirmed -c/--config and -m/--model for Codex, and --model opus
and --effort xhigh for Claude. The official [Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference)
documents model_reasoning_effort; its fetched value list stops at xhigh, whereas
the [GPT-5.6 Sol model page](https://developers.openai.com/api/docs/models/gpt-5.6-sol)
includes max. Preserve the requested max routes, verify actual installed-client
argument support during engineering, and record minimum-client limits rather than
claiming the generic reference establishes all model/client combinations. Offline
tests verify exact argument delivery; they do not prove account/model availability.

## Layering and compatibility

The resolved order, lowest first, is:

1. Built-in configuration (source label exactly built-in).
2. Nearest eligible parent .lane.json, under the roots-config search boundary.
3. Canonical repository .lane.json.
4. Existing supported environment overrides and explicit command flags.

With LANE_CONFIG, keep built-ins and replace steps 2/3 with that one explicit file.
An explicit missing/malformed file still errors. The tool's defaults directory is
never an inherited development root and never activates a root .worktrees path.
Keep the prior default main, validate and registry values and no automatic prepare
steps. Leave worktree_root absent: roots-config's configured-parent, environment
and legacy placement semantics remain unchanged. Introduce no personal path in the
data file. Built-ins remain present even with no selected config files or an empty
repository/parent object; they never cause lane config/routes to call Herdr.

Merge top-level fields shallowly and routes by name; higher layers replace a whole
same-named route, retaining unrelated routes. Preserve dispatch/prepare/env/args
replacement across files and the existing dispatch-time env/arg precedence. Do not
deep-merge a partial route with its built-in counterpart and accidentally carry a
vendor's arguments into another agent. Document that custom routes inherit missing
fields from the resolved dispatch defaults as before; a route changing agent kind
should supply its complete model/args/env profile (including args: [] when needed).
An empty routes object adds no overrides; it does not erase all built-in routes.
No route-deletion/tombstone syntax is introduced in this lane.

lane config must identify every built-in leaf/resolved route with source built-in;
overridden rows retain their actual defining file/env source. Existing deterministic
TSV/JSON-encoded value format remains; derived sources must explain the winning
input, not attribute a file override to built-in. A config-free lane routes now
succeeds with eight sorted routes instead of reporting none configured. A
config-free dispatch now uses the engineer profile instead of the previous generic
agent fallback. Document both deliberate behavior changes and update their tests.

## Template resolution

Package docs/BRIEF_TEMPLATE.md and docs/REVIEW_TEMPLATE.md with the tool. A reusable
built-ins-only resolver looks first for the respective docs/<name> in the consuming
command's target repository worktree, then in the real tool installation. For
review that means the reviewed lane; for a future idea brief before lane creation
it means the canonical target checkout. It must not use unrelated invocation-cwd
or parent-root templates. No .lane.json or OpenSpec install is required.

Only an absent repository template falls back. A present unreadable, malformed or
symlink-escaping template fails clearly rather than silently substituting defaults.
Follow canonical ancestry checks; a linked checkout remains part of its repository.
The built-in/template paths are installation paths, never paths to a personal repo.
Use the conventional filenames without adding configurable template keys.

Expose derived template.brief and template.review rows in lane config, marked as
inspection-only values (not accepted configuration keys), with source built-in for
packaged files or the actual repository file for overrides. This makes deployment
and precedence inspectable without rendering a brief or dispatching an agent.
Validate required placeholders/sections on rendering, using review-cli's schema.
A custom review template can add context but cannot remove the CLI-enforced
role/run/output envelope, mandatory schema/witnesses or private-only write rule;
reject an incompatible override. The CLI appends the authoritative protocol envelope
so repository prose cannot silently replace it. No template text is executed.

Wire review-cli to this resolver now. BRIEF_TEMPLATE is available to manual callers
and inspected by lane config; future idea-cli must consume the same resolver when
it exists, not add another selection rule. Do not implement lane new here or add an
idea-cli dependency. Packaging tests use a copied tool tree and external target
repositories, so successful lookup cannot depend on the checkout used to develop it.

## Contract and documentation

A5 in the guide is a prerequisite, applied only in this implementation lane after
operator approval. It permits public vendor/model defaults within the existing
configurable, agent-agnostic CLI; all personal/organization-specific defaults stay
forbidden. No approval is needed to finish this proposal. The record schema and
review controls are not overridable route policy.

Update README's configure step to make .lane.json optional for shipped routes,
keep the one copyable install/open/dispatch/promote path, and retain instructions
for repository validation/preparation and ignoring .lane/. Document all eight
roles/use notes, where templates come from and how to override them. Explain exact
precedence/whole-route replacement, inspection-only template rows, effort encoding,
the dispatch compatibility change and model/client limits in REFERENCE and usage.
Change .lane.json.example to a small complete route override (including model/args)
plus an optional dispatch override, with generic values and explanation in README;
do not duplicate the entire shipped table in the example.

No agent or UI package is installed and no review is launched by reading config.
Keep tool dependencies, promotion validation and the no-retry boundary unchanged.
