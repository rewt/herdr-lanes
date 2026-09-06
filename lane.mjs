#!/usr/bin/env node
// herdr-lanes — concurrent R&D lanes for AI coding agents: a thin layer over
// git worktrees, herdr-aware. One topic, one lane/<topic> branch, one worktree.
//
// Lifecycle: open -> (dispatch) -> work -> promote -> close.
//
// Promotion is always the same move: clean worktree, branch rebased onto the
// current main branch, deterministic validation green, then a fast-forward-only
// merge into local main. No merge commits, no push, no policy gates —
// deterministic tests decide acceptance and git truth decides everything
// else. Configuration lives in <repo>/.lane.json (see README).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

// The repository is whichever checkout the command runs in (any worktree of it).
const REPO = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    process.stderr.write("lane: not inside a git repository\n");
    process.exit(1);
  }
})();
// The checkout this script runs from may itself be a lane worktree; herdr
// worktree actions must be addressed to the repository root's workspace.
const REPO_ROOT = (() => {
  try {
    const common = execFileSync("git", ["-C", REPO, "rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
    return resolve(common, "..");
  } catch {
    return REPO;
  }
})();
// Repository-owned configuration: <repo>/.lane.json (or $LANE_CONFIG). Every
// key is optional.
//   main      integration branch (default "main")
//   validate  shell command that must exit 0 before a fast-forward
//             (default "npm test"; $LANE_VALIDATE overrides at run time)
//   prepare   shell commands run in a fresh worktree before validation —
//             a worktree carries no gitignored state (no node_modules, no
//             built dist), so validation fails there for environmental
//             reasons that look like real failures. Each entry is
//             {"unless": "<path that proves the step is done>", "run": "<cmd>"}.
//   dispatch  {"kind", "model", "env": ["K=V"], "args": [...]} — the
//             operator-owned mapping from "dispatch a session" to a concrete
//             herdr agent kind and model; flags override the file, and --arg
//             REPLACES args, so repeat every model flag when you pass one.
//   seams_doc path of a topic map for kept unfinished work, shown by `seams`
const CONFIG = (() => {
  const file = process.env.LANE_CONFIG ?? join(REPO, ".lane.json");
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
})();
const MAIN = CONFIG.main ?? "main";
const LANE_PREFIX = "lane/";
const WORKTREE_ROOT = process.env.LANE_WORKTREE_ROOT
  ?? join(homedir(), ".herdr", "worktrees", REPO_ROOT.split("/").filter((x) => x !== "").pop());
const DEFAULT_VALIDATE = CONFIG.validate ?? "npm test";

function fail(message) {
  process.stderr.write(`lane: ${message}\n`);
  process.exit(1);
}

function git(args, options = {}) {
  return execFileSync("git", ["-C", options.cwd ?? REPO, ...args], {
    encoding: "utf8",
  }).trim();
}

function tryGit(args, options = {}) {
  try {
    return git(args, options);
  } catch {
    return undefined;
  }
}

function laneBranch(topic) {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/u.test(topic)) {
    fail(`topic must be short kebab-case, got: ${topic}`);
  }
  return `${LANE_PREFIX}${topic}`;
}

function branchExists(branch) {
  return tryGit(["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]) !== undefined;
}

function worktreeFor(branch) {
  const entries = git(["worktree", "list", "--porcelain"]).split("\n\n");
  for (const entry of entries) {
    if (entry.includes(`branch refs/heads/${branch}`)) {
      const line = entry.split("\n").find((l) => l.startsWith("worktree "));
      if (line !== undefined) return line.slice("worktree ".length);
    }
  }
  return undefined;
}

// herdr helpers. Every herdr CLI call prints one JSON document; a failure is a
// missing server, a refusal, or malformed output, and callers decide whether
// that is fatal.
function herdrJson(args) {
  const run = spawnSync("herdr", args, { encoding: "utf8" });
  if (run.status !== 0) return undefined;
  try {
    const parsed = JSON.parse(run.stdout);
    return parsed.error === undefined ? parsed.result : undefined;
  } catch {
    return undefined;
  }
}

function parentWorkspaceId() {
  const listed = herdrJson(["workspace", "list"]);
  return listed?.workspaces.find(
    (w) => w.worktree?.repo_root === REPO_ROOT && w.worktree?.is_linked_worktree === false,
  )?.workspace_id;
}

function openWorkspaceIdFor(path) {
  const listed = herdrJson(["worktree", "list", "--cwd", REPO]);
  if (listed === undefined) return undefined;
  return listed.worktrees.find((w) => w.path === path)?.open_workspace_id;
}

// herdr refuses `worktree create`/`open` when the CLI runs inside a linked
// worktree ("New and open worktree actions start from the repo parent
// workspace"), so a lane opened from another lane gets a git worktree and no
// herdr workspace. Repair that by opening from the parent workspace explicitly.
function ensureHerdrWorkspace(path) {
  let id = openWorkspaceIdFor(path);
  if (id !== undefined) return id;
  const parent = parentWorkspaceId();
  if (parent === undefined) return undefined;
  herdrJson(["worktree", "open", "--workspace", parent, "--path", path, "--no-focus"]);
  return openWorkspaceIdFor(path);
}

function agentRecord(agentName) {
  const listed = herdrJson(["agent", "list"]);
  return listed?.agents?.find((a) => a.name === agentName);
}

function agentOnPane(pane) {
  const listed = herdrJson(["agent", "list"]);
  return listed?.agents?.find((a) => a.pane_id === pane);
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// `herdr agent start` inherits whatever directory the pane's shell is in at
// that instant; started during shell init the agent lands in the wrong
// directory and runs its brief there. Refuse to prompt unless herdr reports
// the agent's cwd as the lane worktree.
function verifyAgentCwd(agentName, path) {
  const record = agentRecord(agentName);
  if (record === undefined) return { ok: false, cwd: undefined };
  return { ok: record.cwd === path, cwd: record.cwd };
}

// Dry-run a rebase of `branch` onto `against` with merge-tree (no worktree
// touched). Conflicts are returned by file so the implementer sees them.
function rebaseCheck(branch, against = MAIN) {
  const [ahead, behind] = git(["rev-list", "--left-right", "--count", `${branch}...${against}`]).split("\t");
  if (ahead === "0") return { ahead, behind, clean: true, conflicts: [] };
  const run = spawnSync("git", ["-C", REPO, "merge-tree", "--write-tree", against, branch], { encoding: "utf8" });
  const conflicts = `${run.stdout}${run.stderr}`
    .split("\n")
    .filter((l) => l.startsWith("CONFLICT"))
    .map((l) => l.replace(/^CONFLICT \([^)]*\):\s*/, "").replace(/^Merge conflict in\s*/, ""));
  return { ahead, behind, clean: run.status === 0 && conflicts.length === 0, conflicts };
}

function changedFiles(branch) {
  return git(["diff", "--name-only", `${MAIN}...${branch}`]).split("\n").filter((f) => f !== "");
}

function requireClean(path, what) {
  if (git(["status", "--porcelain=v1"], { cwd: path }) !== "") {
    fail(`${what} is not clean (${path}); commit or stash first`);
  }
}

function open(topic, base = MAIN) {
  const branch = laneBranch(topic);
  if (branchExists(branch)) fail(`branch ${branch} already exists; use status/promote/close`);
  if (tryGit(["rev-parse", "--verify", "--quiet", `${base}^{commit}`]) === undefined) {
    fail(`base ref does not resolve: ${base}`);
  }
  const path = join(WORKTREE_ROOT, `lane-${topic}`);
  if (existsSync(path)) fail(`worktree path already exists: ${path}`);
  const parent = parentWorkspaceId();
  const herdr = spawnSync(
    "herdr",
    [
      "worktree", "create",
      ...(parent === undefined ? ["--cwd", REPO_ROOT] : ["--workspace", parent]),
      "--branch", branch, "--base", base, "--path", path,
    ],
    { encoding: "utf8" },
  );
  if (herdr.status !== 0 || !existsSync(path)) {
    git(["worktree", "add", "-b", branch, path, base]);
    process.stdout.write("(herdr refused or is unavailable; created via git worktree)\n");
  }
  const workspaceId = ensureHerdrWorkspace(path);
  process.stdout.write(`lane open: ${branch}\n  worktree: ${path}\n  base: ${git(["rev-parse", "--short", base])} (${base})\n`);
  process.stdout.write(
    workspaceId === undefined
      ? "  herdr workspace: none (herdr unavailable); dispatch will retry the repair\n"
      : `  herdr workspace: ${workspaceId}\n`,
  );
  if (base !== MAIN) {
    process.stdout.write(`Resumed from a non-${MAIN} base: rebase onto ${MAIN} before promoting (promote enforces it).\n`);
  }
  process.stdout.write("Sessions started in the worktree see the repository's own agent instructions (AGENTS.md / CLAUDE.md) as any checkout would.\n");
}

function status() {
  const mainHead = git(["rev-parse", MAIN]);
  process.stdout.write(`${MAIN} ${mainHead.slice(0, 7)}\n`);
  const branches = git(["for-each-ref", "--format=%(refname:short)", `refs/heads/${LANE_PREFIX}`])
    .split("\n")
    .filter((b) => b !== "");
  if (branches.length === 0) {
    process.stdout.write("no open lanes\n");
    return;
  }
  for (const branch of branches) {
    const [ahead, behind] = git(["rev-list", "--left-right", "--count", `${branch}...${MAIN}`])
      .split("\t");
    const path = worktreeFor(branch);
    const dirty = path !== undefined && git(["status", "--porcelain=v1"], { cwd: path }) !== "";
    const check = rebaseCheck(branch);
    const rebase = ahead === "0" ? "" : behind === "0" ? "  rebase: current" : check.clean ? "  rebase: clean" : `  rebase: CONFLICT ${check.conflicts.join(",")}`;
    process.stdout.write(
      `${branch}  +${ahead}/-${behind} vs ${MAIN}  ${path ?? "(no worktree)"}${dirty ? "  DIRTY" : ""}${rebase}\n`,
    );
  }
  // Two lanes editing the same file will collide at promotion; say so now.
  const files = new Map(branches.map((b) => [b, new Set(changedFiles(b))]));
  for (let i = 0; i < branches.length; i += 1) {
    for (let j = i + 1; j < branches.length; j += 1) {
      const shared = [...files.get(branches[i])].filter((f) => files.get(branches[j]).has(f));
      if (shared.length > 0) process.stdout.write(`shared files: ${branches[i]} × ${branches[j]}: ${shared.join(", ")}\n`);
    }
  }
}

function seams(pattern) {
  let rx;
  if (pattern !== undefined) {
    try {
      rx = new RegExp(pattern, "iu");
    } catch {
      fail(`invalid pattern: ${pattern}`);
    }
  }
  const section = (title, refs) => {
    const rows = refs
      .split("\n")
      .filter((line) => line !== "" && (rx === undefined || rx.test(line)));
    if (rows.length === 0) return;
    process.stdout.write(`${title}\n`);
    for (const row of rows) process.stdout.write(`  ${row}\n`);
  };
  section(
    "kept seams (unmerged branches):",
    git(["branch", "--no-merged", MAIN,
      "--format=%(refname:short)\t%(objectname:short)\t%(contents:subject)"]),
  );
  section(
    "archive tags (retired iterations):",
    git(["for-each-ref", "refs/tags/archive",
      "--format=%(refname:short)\t%(objectname:short)\t%(contents:subject)"]),
  );
  process.stdout.write(
    (CONFIG.seams_doc !== undefined ? `\nContext and topic map: ${CONFIG.seams_doc}\n` : "\n") +
      "Resume one: lane open <topic> <ref>\n" +
      `Inherited work is unverified until its tests run green on current ${MAIN}.\n`,
  );
}

// Dispatch a visible agent session into the lane's herdr workspace: a new
// tab in that workspace, an interactive agent (any herdr kind) started in
// its pane, and the brief submitted as the first prompt. The session shows
// in the herdr console (watch: `herdr agent read lane-<topic>`; attach to
// steer). Rule inheritance: codex reads AGENTS.md natively; claude reads
// CLAUDE.md (a one-line `@AGENTS.md` import keeps them one file); brief other
// kinds to read the repository's instructions.
function dispatch(topic, promptText, options = {}) {
  const branch = laneBranch(topic);
  const path = worktreeFor(branch);
  if (path === undefined) fail(`lane ${branch} has no worktree; open it first`);
  if (herdrJson(["workspace", "list"]) === undefined) fail("herdr is unavailable; dispatch requires the herdr server");
  const workspaceId = ensureHerdrWorkspace(path);
  if (workspaceId === undefined) {
    fail(`herdr shows no open workspace for ${path} and could not open one from the ${REPO_ROOT} workspace`);
  }
  const tabArgs = ["tab", "create", "--workspace", workspaceId, "--label", `agent:${topic}`];
  const tabDefaults = CONFIG.dispatch ?? {};
  for (const pair of [...(tabDefaults.env ?? []), ...(options.env ?? [])]) tabArgs.push("--env", pair);
  const created = JSON.parse(execFileSync("herdr", tabArgs, { encoding: "utf8" }));
  const pane = created.result.root_pane.pane_id;
  const tabId = created.result.tab.tab_id;
  let paneCwd;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    paneCwd = herdrJson(["pane", "get", pane])?.pane?.foreground_cwd;
    if (paneCwd === path) break;
    sleepMs(500);
  }
  if (paneCwd !== path) {
    spawnSync("herdr", ["tab", "close", tabId], { encoding: "utf8" });
    fail(`pane ${pane} shell never reached ${path} (last cwd: ${paneCwd}); tab closed, nothing started`);
  }
  // Unique per dispatch (a failed start can leave a name registered), and
  // capped: herdr agent names are limited to 32 characters.
  // herdr caps agent names at 32 chars: stem(22) + "-HHMMSS"(7) + "-N"(2) = 31.
  const stem = `lane-${topic}`.slice(0, 22);
  let agentName = `${stem}-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
  // Dispatch is model-agnostic: the tier policy is the operator's, and the
  // operator-owned tier->agent mapping lives in .lane.json "dispatch". Flags
  // override the file; extra agent-CLI arguments pass through verbatim via
  // --arg. No config: kind falls back to claude, no model argument sent.
  const defaults = CONFIG.dispatch ?? {};
  const kind = options.kind ?? defaults.kind ?? "claude";
  const model = options.model ?? defaults.model;
  const agentArgs = [];
  if (model !== undefined) agentArgs.push("--model", model);
  // options.args is always an array (possibly empty): fall back to the defaults only when no --arg was given.
  agentArgs.push(...((options.args && options.args.length > 0) ? options.args : (defaults.args ?? [])));
  const startArgsFor = (name) => {
    const args = ["agent", "start", name, "--kind", kind, "--pane", pane];
    if (agentArgs.length > 0) args.push("--", ...agentArgs);
    return args;
  };
  // The pane's shell needs a moment before it can host an agent; retry
  // instead of dying, and close the orphaned tab if the start never lands.
  let started = false;
  let lastError = "";
  for (let attempt = 0; attempt < 20 && !started; attempt += 1) {
    // A failed start can leave the name registered, and a start that herdr
    // reports as failed can still have launched the agent in the pane: use a
    // fresh name per attempt and adopt whatever is already running there.
    if (attempt > 0) agentName = `${stem}-${new Date().toISOString().slice(11, 19).replace(/:/g, "")}-${attempt}`;
    const run = spawnSync("herdr", startArgsFor(agentName), { encoding: "utf8" });
    if (run.status === 0 && !`${run.stdout}${run.stderr}`.includes('"error"')) {
      started = true;
      break;
    }
    lastError = `${run.stdout}${run.stderr}`.trim();
    const running = agentOnPane(pane);
    if (running !== undefined) {
      agentName = running.name;
      started = true;
      break;
    }
    sleepMs(500);
  }
  if (!started) {
    spawnSync("herdr", ["tab", "close", tabId], { encoding: "utf8" });
    fail(`agent start never succeeded (tab ${tabId} closed); last error: ${lastError}`);
  }
  // codex asks to trust a directory it has not seen; accept the preselected
  // "Yes, continue" — the directory is this repository's own worktree.
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const visible = spawnSync("herdr", ["agent", "read", agentName, "--source", "visible"], { encoding: "utf8" }).stdout ?? "";
    const status = agentRecord(agentName)?.agent_status;
    if (visible.includes("Do you trust the contents of this directory")) {
      spawnSync("herdr", ["agent", "send-keys", agentName, "Enter"], { encoding: "utf8" });
    } else if (status === "idle" || status === "done" || status === "working") {
      break;
    }
    sleepMs(1000);
  }
  const cwdCheck = verifyAgentCwd(agentName, path);
  if (!cwdCheck.ok) {
    spawnSync("herdr", ["tab", "close", tabId], { encoding: "utf8" });
    fail(`agent '${agentName}' is running in '${cwdCheck.cwd}', not the lane worktree ${path}; tab closed, brief NOT sent`);
  }
  if (promptText !== undefined && promptText.trim() !== "") {
    execFileSync("herdr", ["agent", "prompt", agentName, promptText], { stdio: "inherit" });
  }
  process.stdout.write(
    `dispatched '${agentName}' in herdr workspace ${workspaceId} (pane ${pane})\n` +
      `  watch:  herdr agent read ${agentName}\n` +
      `  steer:  herdr agent attach ${agentName}\n`,
  );
}

// A fresh worktree carries no gitignored state: no `node_modules`, no built
// `dist`. Validation then fails for environmental reasons that look like real
// failures — the classic symptom is many test FILES failing to load while every
// assertion that ran passed ("Failed to resolve entry for package ..."). The
// repository says what "prepared" means in .lane.json "prepare": each step is
// skipped when its `unless` path already exists, so this is cheap to call
// unconditionally.
function prepareWorktree(path, { quiet = false } = {}) {
  const say = (m) => { if (!quiet) process.stdout.write(m); };
  for (const step of CONFIG.prepare ?? []) {
    if (step.unless !== undefined && existsSync(join(path, step.unless))) continue;
    say(`preparing ${path}: ${step.run}\n`);
    const run = spawnSync(step.run, { cwd: path, shell: true, stdio: "inherit" });
    if (run.status !== 0) fail(`prepare step failed (${step.run}); cannot validate this worktree`);
  }
}

function promote(topic) {
  const branch = laneBranch(topic);
  if (!branchExists(branch)) fail(`no such lane branch: ${branch}`);
  const path = worktreeFor(branch);
  if (path === undefined) fail(`lane ${branch} has no worktree; open one before promoting`);
  requireClean(path, "lane worktree");
  requireClean(REPO, `canonical ${MAIN} checkout`);
  let mainHead = git(["rev-parse", MAIN]);
  if (git(["merge-base", MAIN, branch]) !== mainHead) {
    // A promotion elsewhere moved main. Rebasing is mechanical when the dry
    // run is clean, and the gate below validates the rebased tree; conflicts
    // go back to the implementer with the file list.
    const check = rebaseCheck(branch);
    if (!check.clean) fail(`lane is behind ${MAIN} and does not rebase cleanly; conflicts in: ${check.conflicts.join(", ")}`);
    const before = git(["rev-parse", "--short", branch]);
    git(["rebase", MAIN], { cwd: path });
    process.stdout.write(`rebased ${branch} onto ${MAIN} (${before} -> ${git(["rev-parse", "--short", branch])}, clean replay)\n`);
    mainHead = git(["rev-parse", MAIN]);
  }
  prepareWorktree(path);
  const validate = process.env.LANE_VALIDATE ?? DEFAULT_VALIDATE;
  process.stdout.write(`validating in ${path}: ${validate}\n`);
  const run = spawnSync(validate, { cwd: path, shell: true, stdio: "inherit" });
  if (run.status !== 0) fail(`validation failed (exit ${run.status}); nothing merged`);
  if (git(["rev-parse", MAIN]) !== mainHead) {
    fail(`${MAIN} moved during validation; re-run promote`);
  }
  git(["merge", "--ff-only", branch]);
  process.stdout.write(
    `promoted ${branch}: ${MAIN} ${mainHead.slice(0, 7)} -> ${git(["rev-parse", "--short", MAIN])} (fast-forward)\n`,
  );
  process.stdout.write("No push performed. Close the lane with: lane close " + topic + "\n");
}

function close(topic) {
  const branch = laneBranch(topic);
  if (!branchExists(branch)) fail(`no such lane branch: ${branch}`);
  const path = worktreeFor(branch);
  if (path !== undefined) {
    requireClean(path, "lane worktree");
    // Prefer herdr-native removal so the console workspace retires with the
    // worktree; a git-only removal leaves a ghost workspace behind.
    let removed = false;
    try {
      const listed = JSON.parse(
        execFileSync("herdr", ["worktree", "list", "--cwd", REPO], { encoding: "utf8" }),
      );
      const workspaceId = listed.result.worktrees.find((w) => w.path === path)?.open_workspace_id;
      if (workspaceId !== undefined) {
        const run = spawnSync("herdr", ["worktree", "remove", "--workspace", workspaceId], {
          encoding: "utf8",
        });
        removed = run.status === 0 && !existsSync(path);
      }
    } catch {
      // herdr unavailable; fall back to git below
    }
    if (!removed) git(["worktree", "remove", path]);
    process.stdout.write(`removed worktree ${path}\n`);
  }
  const merged = tryGit(["merge-base", "--is-ancestor", branch, MAIN]) !== undefined;
  if (merged) {
    // `-d` judges "merged" against THIS worktree's HEAD, which may be behind
    // the main branch; the ancestor check above already proved it contains the lane.
    git(["branch", "-D", branch]);
    process.stdout.write(`deleted merged branch ${branch}\n`);
  } else {
    const tag = `archive/${branch}`;
    git(["tag", tag, branch]);
    git(["branch", "-D", branch]);
    process.stdout.write(`archived unmerged lane as tag ${tag}, then deleted branch\n`);
  }
}

const [command, topic, ...rest] = process.argv.slice(2);
switch (command) {
  case "open":
    if (topic === undefined) fail("usage: lane.mjs open <topic> [base-ref]");
    open(topic, rest[0]);
    break;
  case "status":
    status();
    break;
  case "seams":
    seams(topic);
    break;
  case "dispatch": {
    if (topic === undefined) {
      fail("usage: lane.mjs dispatch <topic> [--kind <agent>] [--model <m>] [--env K=V ...] [--arg <raw> ...] [@brief-file | prompt text]");
    }
    const options = { env: [], args: [] };
    const positional = [];
    for (let i = 0; i < rest.length; i += 1) {
      if (rest[i] === "--model") options.model = rest[(i += 1)];
      else if (rest[i] === "--kind") options.kind = rest[(i += 1)];
      else if (rest[i] === "--env") options.env.push(rest[(i += 1)]);
      else if (rest[i] === "--arg") options.args.push(rest[(i += 1)]);
      else positional.push(rest[i]);
    }
    let promptText;
    if (positional.length > 0) {
      promptText = positional[0].startsWith("@")
        ? readFileSync(positional[0].slice(1), "utf8")
        : positional.join(" ");
    }
    dispatch(topic, promptText, options);
    break;
  }
  case "rebase-check": {
    // Control for the promote auto-rebase: exit 0 iff <topic> rebases cleanly
    // onto --against (default main); prints the conflicting files otherwise.
    if (topic === undefined) fail("usage: lane.mjs rebase-check <topic> [--against <ref>]");
    const against = rest[0] === "--against" ? rest[1] : MAIN;
    const check = rebaseCheck(laneBranch(topic), against);
    process.stdout.write(`${laneBranch(topic)} vs ${against}: +${check.ahead}/-${check.behind} ${check.clean ? "clean" : `CONFLICT ${check.conflicts.join(",")}`}\n`);
    process.exit(check.clean ? 0 : 1);
  }
  case "verify-agent": {
    // Control for the dispatch cwd guard: exit 0 iff herdr reports the agent's
    // cwd as <path>. `verify-agent <name> /wrong/path` must exit 1.
    const [agentName, expectedPath] = [topic, rest[0]];
    if (agentName === undefined || expectedPath === undefined) fail("usage: lane.mjs verify-agent <agent-name> <worktree-path>");
    const check = verifyAgentCwd(agentName, resolve(expectedPath));
    process.stdout.write(`${check.ok ? "ok" : "MISMATCH"}: agent ${agentName} cwd=${check.cwd} expected=${resolve(expectedPath)}\n`);
    process.exit(check.ok ? 0 : 1);
  }
  case "prepare": {
    if (topic === undefined) fail("usage: lane.mjs prepare <topic>");
    const branch = laneBranch(topic);
    const path = worktreeFor(branch);
    if (path === undefined) fail(`lane ${branch} has no worktree`);
    prepareWorktree(path);
    process.stdout.write(`lane ready: ${path}\n`);
    break;
  }
  case "promote":
    if (topic === undefined) fail("usage: lane.mjs promote <topic>");
    promote(topic);
    break;
  case "close":
    if (topic === undefined) fail("usage: lane.mjs close <topic>");
    close(topic);
    break;
  default:
    process.stdout.write(
      "usage: lane <open|status|seams|dispatch|prepare|rebase-check|verify-agent|promote|close> [topic] [base-ref]\n" +
        `  open <topic> [base]  cut lane/<topic> into a herdr worktree; base defaults to\n` +
        `                       ${MAIN} — pass a kept branch or archive/* tag to resume it\n` +
        "  seams [pattern]  list kept unfinished work (branches + archive tags)\n" +
        "  dispatch <topic> [--kind <agent>] [--model <m>] [@brief-file | prompt]\n" +
        "                   start a visible agent session (any herdr kind) in the\n" +
        "                   lane's workspace; defaults in .lane.json \"dispatch\"\n" +
        "  prepare <topic>  run .lane.json prepare steps in the lane worktree; a\n" +
        "                   fresh worktree carries no gitignored state, and validation\n" +
        "                   then fails for environmental reasons that look real\n" +
        `  status           list open lanes vs ${MAIN}\n` +
        `  promote <topic>  validate then fast-forward ${MAIN} (clean + rebased + green only)\n` +
        "  close <topic>    remove worktree; delete merged branch or archive-tag unmerged\n",
    );
    process.exit(command === undefined ? 0 : 1);
}
