import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const HERE = dirname(fileURLToPath(import.meta.url));
const LANE = resolve(HERE, "..", "lane.mjs");
const GIT = execFileSync("/bin/sh", ["-c", "command -v git"], { encoding: "utf8" }).trim();
const HEAD = execFileSync("/bin/sh", ["-c", "command -v head"], { encoding: "utf8" }).trim();
const HAS_HERDR = spawnSync("/bin/sh", ["-c", "command -v herdr"], { stdio: "ignore" }).status === 0;
const NEGATIVE_CONTROL = process.env.LANE_TEST_NEGATIVE_CONTROL === "1";

function negativeControl(name) {
  if (NEGATIVE_CONTROL) assert.fail(`deliberately broken expectation: ${name}`);
}

function git(cwd, args, options = {}) {
  const output = execFileSync(GIT, ["-C", cwd, ...args], {
    encoding: "utf8",
    ...options,
  });
  return typeof output === "string" ? output.trim() : "";
}

function makeFixture(config = { main: "main", validate: "true" }, { repoParts = ["repo"] } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "herdr-lanes-test-")));
  const repo = join(root, ...repoParts);
  const worktrees = join(root, "worktrees");
  const configPath = join(root, "lane.json");
  const bin = join(root, "bin");
  mkdirSync(repo, { recursive: true });
  mkdirSync(bin);
  symlinkSync(GIT, join(bin, "git"));
  symlinkSync(HEAD, join(bin, "head"));
  execFileSync(GIT, ["init", "-b", "main", repo], { stdio: "ignore" });
  git(repo, ["config", "user.name", "Lane Tests"]);
  git(repo, ["config", "user.email", "lane-tests@example.invalid"]);
  writeFileSync(join(repo, "shared.txt"), "base\n");
  git(repo, ["add", "shared.txt"]);
  git(repo, ["commit", "-m", "initial"], { stdio: "ignore" });

  const fixture = {
    root,
    repo,
    worktrees,
    configPath,
    bin,
    env: {
      ...process.env,
      PATH: bin,
      LANE_CONFIG: configPath,
      LANE_WORKTREE_ROOT: worktrees,
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
  writeConfig(fixture, config);
  return fixture;
}

function writeConfig(fixture, config) {
  writeFileSync(fixture.configPath, `${JSON.stringify(config, null, 2)}\n`);
}

function lane(fixture, args, options = {}) {
  return spawnSync(process.execPath, [LANE, ...args], {
    cwd: options.cwd ?? fixture.repo,
    env: options.env ?? fixture.env,
    encoding: "utf8",
  });
}

function discoveredEnv(fixture, overrides = {}) {
  const env = { ...fixture.env };
  delete env.LANE_CONFIG;
  delete env.LANE_WORKTREE_ROOT;
  return { ...env, ...overrides };
}

function configRows(output) {
  return new Map(output.trim().split("\n").map((line) => {
    const [key, value, source] = line.split("\t");
    return [key, { value: JSON.parse(value), source }];
  }));
}

function lanePath(fixture, topic) {
  return join(fixture.worktrees, `lane-${topic}`);
}

function openLane(fixture, topic, base) {
  const run = lane(fixture, ["open", topic, ...(base === undefined ? [] : [base])]);
  assert.equal(run.status, 0, run.stderr);
  return lanePath(fixture, topic);
}

function commitFile(cwd, file, content, message) {
  writeFileSync(join(cwd, file), content);
  git(cwd, ["add", file]);
  git(cwd, ["commit", "-m", message], { stdio: "ignore" });
}

function refExists(repo, ref) {
  return spawnSync(GIT, ["-C", repo, "rev-parse", "--verify", "--quiet", ref]).status === 0;
}

function ignoreLaneState(fixture) {
  writeFileSync(join(fixture.repo, ".gitignore"), ".lane/\n.ready.marker\n");
  git(fixture.repo, ["add", ".gitignore"]);
  git(fixture.repo, ["commit", "-m", "ignore lane state"], { stdio: "ignore" });
}

function writeExecutable(fixture, name, body) {
  const path = join(fixture.bin, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

function repositoryIdentity(repo) {
  return realpathSync(git(repo, ["rev-parse", "--path-format=absolute", "--git-common-dir"]));
}

function identityDigest(root, repo, topic, length = 8) {
  return createHash("sha256").update(`${root}\0${repo}\0${topic}`).digest("hex").slice(0, length);
}

function writeFakeHerdr(fixture, options = {}) {
  const executable = join(fixture.bin, "herdr");
  const log = join(fixture.root, "herdr.jsonl");
  const state = join(fixture.root, "herdr-state.json");
  const source = `#!${process.execPath}
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
const log = process.env.FAKE_HERDR_LOG;
const statePath = process.env.FAKE_HERDR_STATE;
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
appendFileSync(log, JSON.stringify(args) + "\\n");
const save = () => writeFileSync(statePath, JSON.stringify(state));
const result = (id, value) => process.stdout.write(JSON.stringify({ id, result: value }) + "\\n");
const workspace = (id, label, path, linked, repoKey = process.env.FAKE_HERDR_REPO_KEY) => ({
  active_tab_id: id + ":t1", agent_status: "idle", focused: false, label,
  number: 1, pane_count: 1, tab_count: 1, workspace_id: id,
  worktree: {
    checkout_path: path, is_linked_worktree: linked, repo_key: repoKey,
    repo_name: process.env.FAKE_HERDR_REPO_NAME, repo_root: process.env.FAKE_HERDR_REPO_ROOT,
  },
});
if (args[0] === "workspace" && args[1] === "list") {
  const workspaces = [workspace("w-parent", "repository", process.env.FAKE_HERDR_REPO_ROOT, false)];
  if (process.env.FAKE_HERDR_CALLER_PATH) {
    workspaces.push(workspace("w-caller", "caller-lane", process.env.FAKE_HERDR_CALLER_PATH, true));
  }
  if (state.opened) {
    workspaces.push(workspace("w-lane", state.label, process.env.FAKE_HERDR_LANE_PATH, true));
  }
  if (process.env.FAKE_HERDR_STALE_ID) {
    workspaces.push(workspace(
      process.env.FAKE_HERDR_STALE_ID,
      process.env.FAKE_HERDR_STALE_LABEL || "stale-label",
      process.env.FAKE_HERDR_LANE_PATH,
      true,
      process.env.FAKE_HERDR_FOREIGN_REPO_KEY,
    ));
  }
  workspaces.push(...JSON.parse(process.env.FAKE_HERDR_EXTRA_WORKSPACES || "[]"));
  result("cli:workspace:list", { type: "workspace_list", workspaces });
} else if (args[0] === "worktree" && args[1] === "list") {
  const openId = state.opened ? "w-lane" : process.env.FAKE_HERDR_STALE_ID;
  const worktrees = [{
    branch: "main", is_bare: false, is_detached: false, is_linked_worktree: false,
    is_prunable: false, label: "repository", open_workspace_id: "w-parent",
    path: process.env.FAKE_HERDR_REPO_ROOT,
  }];
  if (process.env.FAKE_HERDR_LANE_PATH) worktrees.push({
    branch: process.env.FAKE_HERDR_LANE_BRANCH, is_bare: false, is_detached: false,
    is_linked_worktree: true, is_prunable: false, label: state.label || "lane",
    ...(openId ? { open_workspace_id: openId } : {}), path: process.env.FAKE_HERDR_LANE_PATH,
  });
  result("cli:worktree:list", {
    source: {
      repo_key: process.env.FAKE_HERDR_REPO_KEY,
      repo_name: process.env.FAKE_HERDR_REPO_NAME,
      repo_root: process.env.FAKE_HERDR_REPO_ROOT,
      source_checkout_path: process.env.FAKE_HERDR_REPO_ROOT,
      source_workspace_id: "w-parent",
    },
    type: "worktree_list", worktrees,
  });
} else if (args[0] === "worktree" && args[1] === "create") {
  process.exit(1);
} else if (args[0] === "worktree" && args[1] === "open") {
  if (process.env.FAKE_HERDR_NO_REPAIR !== "1") {
    state.opened = true;
    state.label = args[args.indexOf("--label") + 1];
    save();
  }
  result("cli:worktree:open", { type: "worktree_open", workspace_id: "w-lane" });
} else if (args[0] === "worktree" && args[1] === "remove") {
  result("cli:worktree:remove", { type: "worktree_remove", workspace_id: args[3] });
} else if (args[0] === "tab" && args[1] === "create") {
  result("cli:tab:create", {
    type: "tab_create", tab: { tab_id: "w-lane:t2", workspace_id: "w-lane" },
    root_pane: { pane_id: "w-lane:p2", tab_id: "w-lane:t2", workspace_id: "w-lane" },
  });
} else if (args[0] === "pane" && args[1] === "get") {
  result("cli:pane:get", { type: "pane_get", pane: {
    pane_id: "w-lane:p2", foreground_cwd: process.env.FAKE_HERDR_LANE_PATH,
  } });
} else if (args[0] === "agent" && args[1] === "start") {
  state.agent = args[2];
  save();
  result("cli:agent:start", { type: "agent_start", name: state.agent, pane_id: "w-lane:p2" });
} else if (args[0] === "agent" && args[1] === "list") {
  result("cli:agent:list", { type: "agent_list", agents: state.agent ? [{
    agent_status: "idle", cwd: process.env.FAKE_HERDR_LANE_PATH, name: state.agent,
    pane_id: "w-lane:p2", workspace_id: "w-lane",
  }] : [] });
} else if (args[0] === "agent" && args[1] === "read") {
  process.stdout.write("");
} else if (args[0] === "agent" && args[1] === "prompt") {
  result("cli:agent:prompt", { type: "agent_prompt", name: args[2] });
} else if (args[0] === "tab" && args[1] === "close") {
  result("cli:tab:close", { type: "tab_close", tab_id: args[2] });
} else {
  process.stderr.write("unsupported fake Herdr command: " + args.join(" ") + "\\n");
  process.exit(2);
}
`;
  writeFileSync(executable, source);
  chmodSync(executable, 0o755);
  Object.assign(fixture.env, {
    FAKE_HERDR_LOG: log,
    FAKE_HERDR_STATE: state,
    FAKE_HERDR_REPO_KEY: repositoryIdentity(fixture.repo),
    FAKE_HERDR_REPO_NAME: options.repoName ?? fixture.repo.split("/").at(-1),
    FAKE_HERDR_REPO_ROOT: fixture.repo,
    FAKE_HERDR_LANE_PATH: options.lanePath,
    FAKE_HERDR_LANE_BRANCH: options.branch,
    FAKE_HERDR_CALLER_PATH: options.callerPath,
    FAKE_HERDR_EXTRA_WORKSPACES: JSON.stringify(options.extraWorkspaces ?? []),
    FAKE_HERDR_STALE_ID: options.staleId,
    FAKE_HERDR_STALE_LABEL: options.staleLabel,
    FAKE_HERDR_FOREIGN_REPO_KEY: options.foreignRepoKey,
    FAKE_HERDR_NO_REPAIR: options.noRepair ? "1" : undefined,
  });
  for (const [key, value] of Object.entries(fixture.env)) {
    if (value === undefined) delete fixture.env[key];
  }
  return {
    log,
    calls() {
      if (!existsSync(log)) return [];
      return readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
    },
  };
}

test("open creates a lane and refuses duplicate, invalid, and unresolved inputs", () => {
  const fixture = makeFixture();
  try {
    const opened = lane(fixture, ["open", "alpha-topic"]);
    assert.equal(opened.status, 0, opened.stderr);
    assert.match(opened.stdout, /lane open: lane\/alpha-topic/);
    assert.ok(existsSync(lanePath(fixture, "alpha-topic")));
    assert.ok(refExists(fixture.repo, "refs/heads/lane/alpha-topic"));

    const duplicate = lane(fixture, ["open", "alpha-topic"]);
    assert.equal(duplicate.status, 1);
    assert.match(duplicate.stderr, /already exists/);

    const invalid = lane(fixture, ["open", "Bad_Name"]);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /short kebab-case/);

    const unresolved = lane(fixture, ["open", "missing-base", "does-not-exist"]);
    assert.equal(unresolved.status, 1);
    assert.match(unresolved.stderr, /base ref does not resolve/);
    negativeControl("open guards");
  } finally {
    fixture.cleanup();
  }
});

test("status reports distance, dirtiness, and files shared by lanes", () => {
  const fixture = makeFixture();
  try {
    const alpha = openLane(fixture, "alpha-topic");
    const beta = openLane(fixture, "beta-topic");
    commitFile(alpha, "shared.txt", "alpha\n", "alpha change");
    commitFile(beta, "shared.txt", "beta\n", "beta change");
    commitFile(fixture.repo, "main-only.txt", "main\n", "move main");
    appendFileSync(join(alpha, "dirty.txt"), "uncommitted\n");

    const run = lane(fixture, ["status"]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /lane\/alpha-topic\s+\+1\/-1 vs main.*DIRTY/);
    assert.match(run.stdout, /lane\/beta-topic\s+\+1\/-1 vs main/);
    assert.match(run.stdout, /shared files: lane\/alpha-topic × lane\/beta-topic: shared\.txt/);
    negativeControl("status reporting");
  } finally {
    fixture.cleanup();
  }
});

test("promote refuses a dirty lane worktree", () => {
  const fixture = makeFixture();
  try {
    const path = openLane(fixture, "dirty-topic");
    writeFileSync(join(path, "dirty.txt"), "dirty\n");
    const before = git(fixture.repo, ["rev-parse", "main"]);
    const run = lane(fixture, ["promote", "dirty-topic"]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /lane worktree is not clean/);
    assert.equal(git(fixture.repo, ["rev-parse", "main"]), before);
    negativeControl("dirty promotion refusal");
  } finally {
    fixture.cleanup();
  }
});

test("promote leaves main unchanged when validation fails", () => {
  const fixture = makeFixture({ main: "main", validate: "false" });
  try {
    const path = openLane(fixture, "red-topic");
    commitFile(path, "lane.txt", "lane\n", "lane change");
    const before = git(fixture.repo, ["rev-parse", "main"]);
    const run = lane(fixture, ["promote", "red-topic"]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /validation failed \(exit 1\); nothing merged/);
    assert.equal(git(fixture.repo, ["rev-parse", "main"]), before);
    negativeControl("validation gate");
  } finally {
    fixture.cleanup();
  }
});

test("promote rebases a clean lane behind main and fast-forwards", () => {
  const fixture = makeFixture();
  try {
    const path = openLane(fixture, "green-topic");
    commitFile(path, "lane.txt", "lane\n", "lane change");
    commitFile(fixture.repo, "main.txt", "main\n", "main change");
    const before = git(fixture.repo, ["rev-parse", "main"]);

    const run = lane(fixture, ["promote", "green-topic"]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /rebased lane\/green-topic onto main/);
    assert.match(run.stdout, /promoted lane\/green-topic/);
    assert.notEqual(git(fixture.repo, ["rev-parse", "main"]), before);
    assert.equal(
      git(fixture.repo, ["rev-parse", "main"]),
      git(fixture.repo, ["rev-parse", "lane/green-topic"]),
    );
    assert.equal(readFileSync(join(fixture.repo, "lane.txt"), "utf8"), "lane\n");
    negativeControl("rebase and fast-forward");
  } finally {
    fixture.cleanup();
  }
});

test("promote accepts a gitignored lane board registry in the canonical checkout", () => {
  const fixture = makeFixture({ main: "main", validate: "true", registry: ".lane/sessions.json" });
  try {
    writeFileSync(
      join(fixture.repo, ".gitignore"),
      readFileSync(resolve(HERE, "..", ".gitignore"), "utf8"),
    );
    git(fixture.repo, ["add", ".gitignore"]);
    git(fixture.repo, ["commit", "-m", "add ignore rules"], { stdio: "ignore" });
    const path = openLane(fixture, "board-registry");
    commitFile(path, "lane.txt", "lane\n", "lane change");
    mkdirSync(join(fixture.repo, ".lane"));
    writeFileSync(join(fixture.repo, ".lane", "sessions.json"), "[]\n");

    const run = lane(fixture, ["promote", "board-registry"]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /promoted lane\/board-registry/);
    negativeControl("gitignored board registry promotion");
  } finally {
    fixture.cleanup();
  }
});

test("promote refuses a conflicting rebase and names the file", () => {
  const fixture = makeFixture();
  try {
    const path = openLane(fixture, "conflict-topic");
    commitFile(path, "shared.txt", "lane\n", "lane conflict");
    commitFile(fixture.repo, "shared.txt", "main\n", "main conflict");
    const before = git(fixture.repo, ["rev-parse", "main"]);

    const run = lane(fixture, ["promote", "conflict-topic"]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /does not rebase cleanly; conflicts in: shared\.txt/);
    assert.equal(git(fixture.repo, ["rev-parse", "main"]), before);
    negativeControl("conflicting rebase refusal");
  } finally {
    fixture.cleanup();
  }
});

test("promote refuses when main moves during validation", () => {
  const fixture = makeFixture();
  try {
    const path = openLane(fixture, "moving-main");
    commitFile(path, "lane.txt", "lane\n", "lane change");
    writeConfig(fixture, {
      main: "main",
      validate: `git -C '${fixture.repo}' commit --allow-empty -m validation-moved-main`,
    });
    const laneHead = git(fixture.repo, ["rev-parse", "lane/moving-main"]);

    const run = lane(fixture, ["promote", "moving-main"]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /main moved during validation; re-run promote/);
    assert.notEqual(git(fixture.repo, ["rev-parse", "main"]), laneHead);
    negativeControl("main movement guard");
  } finally {
    fixture.cleanup();
  }
});

test("close deletes a merged branch", () => {
  const fixture = makeFixture();
  try {
    const path = openLane(fixture, "merged-topic");
    commitFile(path, "lane.txt", "lane\n", "lane change");
    assert.equal(lane(fixture, ["promote", "merged-topic"]).status, 0);

    const run = lane(fixture, ["close", "merged-topic"]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /deleted merged branch lane\/merged-topic/);
    assert.ok(!existsSync(path));
    assert.ok(!refExists(fixture.repo, "refs/heads/lane/merged-topic"));
    negativeControl("merged close");
  } finally {
    fixture.cleanup();
  }
});

test("close archive-tags an unmerged branch", () => {
  const fixture = makeFixture();
  try {
    const path = openLane(fixture, "unmerged-topic");
    commitFile(path, "lane.txt", "lane\n", "lane change");
    const laneHead = git(fixture.repo, ["rev-parse", "lane/unmerged-topic"]);

    const run = lane(fixture, ["close", "unmerged-topic"]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /archived unmerged lane as tag archive\/lane\/unmerged-topic/);
    assert.ok(!refExists(fixture.repo, "refs/heads/lane/unmerged-topic"));
    assert.equal(git(fixture.repo, ["rev-parse", "archive/lane/unmerged-topic"]), laneHead);
    negativeControl("unmerged archive");
  } finally {
    fixture.cleanup();
  }
});

test("close refuses a dirty worktree", () => {
  const fixture = makeFixture();
  try {
    const path = openLane(fixture, "dirty-close");
    writeFileSync(join(path, "dirty.txt"), "dirty\n");
    const run = lane(fixture, ["close", "dirty-close"]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /lane worktree is not clean/);
    assert.ok(existsSync(path));
    assert.ok(refExists(fixture.repo, "refs/heads/lane/dirty-close"));
    negativeControl("dirty close refusal");
  } finally {
    fixture.cleanup();
  }
});

test("rebase-check exits zero when clean and one with files on conflict", () => {
  const fixture = makeFixture();
  try {
    const clean = openLane(fixture, "clean-check");
    const conflict = openLane(fixture, "conflict-check");
    commitFile(clean, "clean.txt", "clean\n", "clean lane");
    commitFile(conflict, "shared.txt", "lane\n", "conflicting lane");
    commitFile(fixture.repo, "shared.txt", "main\n", "conflicting main");

    const cleanRun = lane(fixture, ["rebase-check", "clean-check"]);
    assert.equal(cleanRun.status, 0, cleanRun.stderr);
    assert.match(cleanRun.stdout, /clean$/m);
    const conflictRun = lane(fixture, ["rebase-check", "conflict-check"]);
    assert.equal(conflictRun.status, 1);
    assert.match(conflictRun.stdout, /CONFLICT shared\.txt/);
    negativeControl("rebase-check exits");
  } finally {
    fixture.cleanup();
  }
});

test("prepare runs needed steps and skips steps whose unless path exists", () => {
  const fixture = makeFixture();
  try {
    const path = openLane(fixture, "prepare-topic");
    writeFileSync(join(path, "already.marker"), "present\n");
    writeConfig(fixture, {
      main: "main",
      validate: "true",
      prepare: [
        { unless: "ready.marker", run: "printf 'ran\\n' >> prepare.log; printf 'ready\\n' > ready.marker" },
        { unless: "already.marker", run: "printf 'unexpected\\n' >> skipped.log" },
      ],
    });

    const first = lane(fixture, ["prepare", "prepare-topic"]);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(readFileSync(join(path, "prepare.log"), "utf8"), "ran\n");
    assert.ok(!existsSync(join(path, "skipped.log")));
    const second = lane(fixture, ["prepare", "prepare-topic"]);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(readFileSync(join(path, "prepare.log"), "utf8"), "ran\n");
    negativeControl("prepare unless guards");
  } finally {
    fixture.cleanup();
  }
});

test("check records configured validation against the current HEAD", () => {
  const fixture = makeFixture({ main: "main", validate: "gate-pass configured" });
  try {
    ignoreLaneState(fixture);
    writeExecutable(fixture, "gate-pass", "exit 0");
    const path = openLane(fixture, "checked-topic");
    const head = git(path, ["rev-parse", "HEAD"]);

    const run = spawnSync(process.execPath, [LANE, "check"], {
      cwd: path,
      env: fixture.env,
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, new RegExp(`^GATE ${head} exit=0 \\(\\d+(?:\\.\\d+)?s\\)\\n$`));
    const gate = JSON.parse(readFileSync(join(path, ".lane", "gate.json"), "utf8"));
    assert.equal(gate.head, head);
    assert.equal(gate.branch, "lane/checked-topic");
    assert.equal(gate.command, "gate-pass configured");
    assert.equal(gate.exit_code, 0);
    assert.equal(gate.signal, null);
    assert.equal(new Date(gate.started_at).toISOString(), gate.started_at);
    assert.equal(new Date(gate.finished_at).toISOString(), gate.finished_at);
    assert.ok(Date.parse(gate.finished_at) >= Date.parse(gate.started_at));
    assert.equal(typeof gate.duration_s, "number");
    assert.ok(gate.duration_s >= 0);
    negativeControl("check configured validation record");
  } finally {
    fixture.cleanup();
  }
});

test("check honors LANE_VALIDATE and --cmd precedence and returns a failed gate exit", () => {
  const fixture = makeFixture({ main: "main", validate: "gate-configured" });
  try {
    ignoreLaneState(fixture);
    writeExecutable(fixture, "gate-configured", "exit 2");
    writeExecutable(fixture, "gate-environment", "exit 0");
    writeExecutable(fixture, "gate-override", "exit 7");

    fixture.env.LANE_VALIDATE = "gate-environment";
    const environment = lane(fixture, ["check"]);
    assert.equal(environment.status, 0, environment.stderr);
    assert.equal(
      JSON.parse(readFileSync(join(fixture.repo, ".lane", "gate.json"), "utf8")).command,
      "gate-environment",
    );

    const command = "gate-override --record-verbatim";
    const override = lane(fixture, ["check", "--cmd", command]);
    assert.equal(override.status, 7, override.stderr);
    assert.match(override.stdout, /GATE [0-9a-f]{40} exit=7/);
    const gate = JSON.parse(readFileSync(join(fixture.repo, ".lane", "gate.json"), "utf8"));
    assert.equal(gate.command, command);
    assert.equal(gate.exit_code, 7);
    negativeControl("check validation precedence and failed exit");
  } finally {
    fixture.cleanup();
  }
});

test("check defaults to npm test and refuses a dirty current worktree", () => {
  const fixture = makeFixture({ main: "main" });
  try {
    ignoreLaneState(fixture);
    writeExecutable(fixture, "npm", "[ \"$1\" = test ] || exit 9\nexit 0");
    const clean = lane(fixture, ["check"]);
    assert.equal(clean.status, 0, clean.stderr);
    const gatePath = join(fixture.repo, ".lane", "gate.json");
    const gate = JSON.parse(readFileSync(gatePath, "utf8"));
    assert.equal(gate.command, "npm test");

    const previous = readFileSync(gatePath, "utf8");
    writeFileSync(join(fixture.repo, "dirty.txt"), "dirty\n");
    const dirty = lane(fixture, ["check"]);
    assert.equal(dirty.status, 1);
    assert.match(dirty.stderr, /current worktree is not clean/);
    assert.equal(readFileSync(gatePath, "utf8"), previous);
    negativeControl("check default and dirty refusal");
  } finally {
    fixture.cleanup();
  }
});

test("check runs configured prepare steps before validation", () => {
  const fixture = makeFixture({
    main: "main",
    validate: "gate-needs-prepare",
    prepare: [{ unless: ".ready.marker", run: ": > .ready.marker" }],
  });
  try {
    ignoreLaneState(fixture);
    writeExecutable(fixture, "gate-needs-prepare", "[ -f .ready.marker ] || exit 6\nexit 0");

    const run = lane(fixture, ["check"]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /preparing .*: : > \.ready\.marker/);
    assert.ok(existsSync(join(fixture.repo, ".ready.marker")));
    assert.equal(
      JSON.parse(readFileSync(join(fixture.repo, ".lane", "gate.json"), "utf8")).exit_code,
      0,
    );
    negativeControl("check prepare parity");
  } finally {
    fixture.cleanup();
  }
});

test("check records signal termination using the shell exit convention", () => {
  const fixture = makeFixture();
  try {
    ignoreLaneState(fixture);
    const run = lane(fixture, ["check", "--cmd", "kill -9 $$"]);
    assert.equal(run.status, 137, run.stderr);
    assert.match(run.stdout, /GATE [0-9a-f]{40} exit=137/);
    const gate = JSON.parse(readFileSync(join(fixture.repo, ".lane", "gate.json"), "utf8"));
    assert.equal(gate.exit_code, 137);
    assert.equal(gate.signal, "SIGKILL");
    negativeControl("check signal gate");
  } finally {
    fixture.cleanup();
  }
});

test("check refuses a detached HEAD without replacing an existing gate", () => {
  const fixture = makeFixture();
  try {
    ignoreLaneState(fixture);
    mkdirSync(join(fixture.repo, ".lane"));
    const gatePath = join(fixture.repo, ".lane", "gate.json");
    writeFileSync(gatePath, "existing gate\n");
    git(fixture.repo, ["switch", "--detach"]);

    const run = lane(fixture, ["check"]);
    assert.equal(run.status, 1);
    assert.equal(run.stderr, "lane: current checkout is detached; check requires a branch\n");
    assert.equal(readFileSync(gatePath, "utf8"), "existing gate\n");
    negativeControl("check detached HEAD refusal");
  } finally {
    fixture.cleanup();
  }
});

test("check rejects unknown options and missing or empty --cmd values", () => {
  const fixture = makeFixture();
  try {
    const unknown = lane(fixture, ["check", "--unknown"]);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /unknown option: --unknown/);

    const missing = lane(fixture, ["check", "--cmd"]);
    assert.equal(missing.status, 1);
    assert.equal(missing.stderr, "lane: usage: lane check [--cmd <validate command>]\n");

    const empty = lane(fixture, ["check", "--cmd", ""]);
    assert.equal(empty.status, 1);
    assert.equal(empty.stderr, "lane: usage: lane check [--cmd <validate command>]\n");
    negativeControl("check argument refusals");
  } finally {
    fixture.cleanup();
  }
});

test("routes prints configured routes with resolved dispatch defaults", () => {
  const fixture = makeFixture({
    main: "main",
    validate: "true",
    dispatch: {
      kind: "claude",
      model: "default-model",
      args: ["--default-flag"],
    },
    routes: {
      review: { kind: "reviewer" },
      engineer: {
        kind: "codex",
        model: "engineer-model",
        args: ["--profile", "implementation"],
        use: "Complex implementation lanes",
      },
    },
  });
  try {
    const run = lane(fixture, ["routes"]);
    assert.equal(run.status, 0, run.stderr);
    assert.equal(
      run.stdout,
      "engineer\tkind=codex\tmodel=engineer-model\targs=[\"--profile\",\"implementation\"]\tuse=Complex implementation lanes\n" +
        "review\tkind=reviewer\tmodel=default-model\targs=[\"--default-flag\"]\tuse=(none)\n",
    );

    writeConfig(fixture, { main: "main", validate: "true" });
    const empty = lane(fixture, ["routes"]);
    assert.equal(empty.status, 1);
    assert.match(empty.stderr, /lane: no routes configured/);
    negativeControl("routes output");
  } finally {
    fixture.cleanup();
  }
});

test("config layers the nearest parent and canonical repository with attributed replacement semantics", () => {
  const fixture = makeFixture(undefined, { repoParts: ["home", "projects", "team", "repo"] });
  try {
    const home = join(fixture.root, "home");
    const grandparent = join(home, "projects");
    const parent = join(grandparent, "team");
    const parentConfig = join(parent, ".lane.json");
    const repoConfig = join(fixture.repo, ".lane.json");
    const shouldNotRun = join(fixture.root, "config-command-ran");
    writeFileSync(join(home, ".lane.json"), `${JSON.stringify({ main: "home-main" })}\n`);
    writeFileSync(join(grandparent, ".lane.json"), `${JSON.stringify({
      main: "grandparent-main",
      seams_doc: "grandparent-seams.md",
    })}\n`);
    writeFileSync(parentConfig, `${JSON.stringify({
      main: "parent-main",
      registry: "parent-sessions.json",
      worktree_root: "parent-trees",
      prepare: [{ unless: "parent.marker", run: `touch '${shouldNotRun}'` }],
      dispatch: { kind: "claude", env: ["PARENT=1"], args: ["--parent"] },
      routes: {
        engineer: { kind: "claude", env: ["PARENT_ROUTE=1"] },
        reviewer: { kind: "claude", model: "review-model", args: ["--review"] },
      },
    }, null, 2)}\n`);
    writeFileSync(repoConfig, `${JSON.stringify({
      main: "main",
      validate: `touch '${shouldNotRun}'`,
      worktree_root: "../repo-trees",
      prepare: [{ unless: "repo.marker", run: `touch '${shouldNotRun}'` }],
      dispatch: { kind: "codex", env: ["REPO=1"], args: ["--repo"] },
      routes: {
        engineer: { kind: "codex", model: "engineer-model", args: ["--engineer"] },
      },
    }, null, 2)}\n`);

    const run = lane(fixture, ["config"], {
      env: discoveredEnv(fixture, { HOME: home }),
    });
    assert.equal(run.status, 0, run.stderr);
    const rows = configRows(run.stdout);
    assert.deepEqual(rows.get("main"), { value: "main", source: repoConfig });
    assert.deepEqual(rows.get("registry"), { value: "parent-sessions.json", source: parentConfig });
    assert.deepEqual(rows.get("seams_doc"), { value: null, source: "default" });
    assert.deepEqual(rows.get("prepare"), {
      value: [{ unless: "repo.marker", run: `touch '${shouldNotRun}'` }],
      source: repoConfig,
    });
    assert.deepEqual(rows.get("dispatch"), {
      value: { kind: "codex", env: ["REPO=1"], args: ["--repo"] },
      source: repoConfig,
    });
    assert.deepEqual(rows.get("routes.engineer"), {
      value: { kind: "codex", model: "engineer-model", args: ["--engineer"] },
      source: repoConfig,
    });
    assert.deepEqual(rows.get("routes.reviewer"), {
      value: { kind: "claude", model: "review-model", args: ["--review"] },
      source: parentConfig,
    });
    assert.deepEqual(rows.get("worktree_root"), {
      value: join(dirname(fixture.repo), "repo-trees", "repo"),
      source: repoConfig,
    });
    assert.ok(!existsSync(shouldNotRun));
    const opened = lane(fixture, ["open", "repository-root-lane"], {
      env: discoveredEnv(fixture, { HOME: home }),
    });
    assert.equal(opened.status, 0, opened.stderr);
    assert.ok(existsSync(join(dirname(fixture.repo), "repo-trees", "repo", "lane-repository-root-lane")));
    negativeControl("layered config attribution and replacement");
  } finally {
    fixture.cleanup();
  }
});

test("config escapes route names so every TSV record remains one line with three fields", () => {
  const fixture = makeFixture({
    routes: {
      "review\tline\nnext\\path": { kind: "claude" },
    },
  });
  try {
    const run = lane(fixture, ["config"]);
    assert.equal(run.status, 0, run.stderr);
    const routeRows = run.stdout.trim().split("\n").filter((line) => line.startsWith("routes."));
    assert.deepEqual(routeRows, [
      `routes.review\\tline\\nnext\\\\path\t{"kind":"claude"}\t${fixture.configPath}`,
    ]);
    negativeControl("config TSV route-key escaping");
  } finally {
    fixture.cleanup();
  }
});

test("worktree roots honor parent-relative, parent-default, legacy, and caller-relative environment precedence", () => {
  const cases = [
    {
      name: "parent-relative",
      parent: { worktree_root: "shared-trees" },
      expected(fixture) { return join(fixture.root, "home", "projects", "shared-trees", "repo"); },
    },
    {
      name: "parent-default",
      parent: { validate: "true" },
      expected(fixture) { return join(fixture.root, "home", "projects", ".worktrees", "repo"); },
    },
    {
      name: "legacy-default",
      expected(fixture) { return join(fixture.root, "home", ".herdr", "worktrees", "repo"); },
    },
  ];
  for (const item of cases) {
    const fixture = makeFixture(undefined, { repoParts: ["home", "projects", "repo"] });
    try {
      const home = join(fixture.root, "home");
      const parent = join(home, "projects");
      if (item.parent !== undefined) {
        writeFileSync(join(parent, ".lane.json"), `${JSON.stringify(item.parent)}\n`);
      }
      const env = discoveredEnv(fixture, { HOME: home });
      const explained = lane(fixture, ["config"], { env });
      assert.equal(explained.status, 0, explained.stderr);
      assert.deepEqual(configRows(explained.stdout).get("worktree_root"), {
        value: item.expected(fixture),
        source: item.parent === undefined ? "default" : join(parent, ".lane.json"),
      });
      const run = lane(fixture, ["open", `${item.name}-lane`], { env });
      assert.equal(run.status, 0, run.stderr);
      assert.ok(existsSync(join(item.expected(fixture), `lane-${item.name}-lane`)));
    } finally {
      fixture.cleanup();
    }
  }

  const fixture = makeFixture();
  try {
    const caller = join(fixture.repo, "caller");
    mkdirSync(caller);
    const env = discoveredEnv(fixture, { LANE_WORKTREE_ROOT: "environment-trees" });
    const explained = lane(fixture, ["config"], { cwd: caller, env });
    assert.equal(explained.status, 0, explained.stderr);
    assert.deepEqual(configRows(explained.stdout).get("worktree_root"), {
      value: join(caller, "environment-trees"),
      source: "env",
    });
    const run = lane(fixture, ["open", "environment-lane"], { cwd: caller, env });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /unsafe worktree path.*canonical checkout/);
    assert.ok(!existsSync(join(caller, "environment-trees", "lane-environment-lane")));
    assert.ok(!existsSync(join(caller, "environment-trees", "repo")));
    negativeControl("worktree root precedence matrix");
  } finally {
    fixture.cleanup();
  }
});

test("home is a configuration discovery boundary", () => {
  const fixture = makeFixture(undefined, { repoParts: ["home", "repo"] });
  try {
    const home = join(fixture.root, "home");
    writeFileSync(join(home, ".lane.json"), `${JSON.stringify({
      main: "must-not-cross-home",
      worktree_root: "must-not-use",
    })}\n`);
    const run = lane(fixture, ["config"], { env: discoveredEnv(fixture, { HOME: home }) });
    assert.equal(run.status, 0, run.stderr);
    const rows = configRows(run.stdout);
    assert.deepEqual(rows.get("main"), { value: "main", source: "default" });
    assert.deepEqual(rows.get("worktree_root"), {
      value: join(home, ".herdr", "worktrees", "repo"),
      source: "default",
    });
    negativeControl("home discovery boundary");
  } finally {
    fixture.cleanup();
  }
});

test("LANE_CONFIG selects one caller-relative file and bypasses discovered layers", () => {
  const fixture = makeFixture();
  try {
    const caller = join(fixture.repo, "caller");
    const home = join(fixture.root, "home");
    mkdirSync(caller);
    mkdirSync(home);
    const parentConfig = join(fixture.root, ".lane.json");
    const repoConfig = join(fixture.repo, ".lane.json");
    const selected = join(caller, "selected.json");
    writeFileSync(parentConfig, `${JSON.stringify({ main: "parent-main", validate: "parent" })}\n`);
    writeFileSync(repoConfig, `${JSON.stringify({ main: "repo-main", validate: "repo" })}\n`);
    writeFileSync(selected, `${JSON.stringify({ validate: "selected", worktree_root: "selected-trees" })}\n`);
    const env = discoveredEnv(fixture, { HOME: home, LANE_CONFIG: "selected.json" });
    const run = lane(fixture, ["config"], { cwd: caller, env });
    assert.equal(run.status, 0, run.stderr);
    const rows = configRows(run.stdout);
    assert.deepEqual(rows.get("main"), { value: "main", source: "default" });
    assert.deepEqual(rows.get("validate"), { value: "selected", source: selected });
    assert.deepEqual(rows.get("worktree_root"), {
      value: join(caller, "selected-trees", "repo"),
      source: selected,
    });
    const validateOverride = lane(fixture, ["config"], {
      cwd: caller,
      env: { ...env, LANE_VALIDATE: "environment-validate" },
    });
    assert.equal(validateOverride.status, 0, validateOverride.stderr);
    assert.deepEqual(configRows(validateOverride.stdout).get("validate"), {
      value: "environment-validate",
      source: "env",
    });
    writeFileSync(selected, `${JSON.stringify({ validate: "selected" })}\n`);
    const legacyRoot = lane(fixture, ["config"], { cwd: caller, env });
    assert.equal(legacyRoot.status, 0, legacyRoot.stderr);
    const worktreeRoot = configRows(legacyRoot.stdout).get("worktree_root");
    assert.equal(worktreeRoot.value, join(home, ".herdr", "worktrees", "repo"));
    assert.equal(worktreeRoot.source, "default");
    negativeControl("explicit config bypass");
  } finally {
    fixture.cleanup();
  }
});

test("linked invocations use canonical repository config for explanation, check, and promote", () => {
  const fixture = makeFixture();
  try {
    ignoreLaneState(fixture);
    writeExecutable(fixture, "canonical-check", "exit 0");
    const linked = join(fixture.root, "linked");
    git(fixture.repo, ["worktree", "add", "-b", "lane/linked-config", linked], { stdio: "ignore" });
    const canonicalConfig = join(fixture.repo, ".lane.json");
    writeFileSync(canonicalConfig, `${JSON.stringify({ validate: "canonical-check", worktree_root: "canonical-trees" })}\n`);
    git(fixture.repo, ["add", ".lane.json"]);
    git(fixture.repo, ["commit", "-m", "add canonical config"], { stdio: "ignore" });

    const run = lane(fixture, ["config"], { cwd: linked, env: discoveredEnv(fixture) });
    assert.equal(run.status, 0, run.stderr);
    const rows = configRows(run.stdout);
    assert.deepEqual(rows.get("validate"), { value: "canonical-check", source: canonicalConfig });
    assert.deepEqual(rows.get("worktree_root"), {
      value: join(fixture.repo, "canonical-trees", "repo"),
      source: canonicalConfig,
    });
    const check = lane(fixture, ["check"], { cwd: linked, env: discoveredEnv(fixture) });
    assert.equal(check.status, 0, check.stderr);
    const promote = lane(fixture, ["promote", "linked-config"], { env: discoveredEnv(fixture) });
    assert.equal(promote.status, 0, promote.stderr);
    negativeControl("canonical config from linked worktree");
  } finally {
    fixture.cleanup();
  }
});

test("bare repositories with only linked worktrees allow reads and refuse mutations clearly", () => {
  const fixture = makeFixture();
  try {
    const bare = join(fixture.root, "repository.git");
    const linked = join(fixture.root, "linked-checkout");
    execFileSync(GIT, ["clone", "--bare", fixture.repo, bare], { stdio: "ignore" });
    execFileSync(GIT, ["--git-dir", bare, "worktree", "add", linked, "main"], { stdio: "ignore" });
    const linkedFixture = { ...fixture, repo: linked };

    const explained = lane(linkedFixture, ["config"]);
    assert.equal(explained.status, 0, explained.stderr);
    assert.deepEqual(configRows(explained.stdout).get("main"), { value: "main", source: fixture.configPath });
    const listed = lane(linkedFixture, ["status"]);
    assert.equal(listed.status, 0, listed.stderr);
    assert.match(listed.stdout, /no open lanes/);

    const opened = lane(linkedFixture, ["open", "needs-primary"]);
    assert.equal(opened.status, 1);
    assert.match(opened.stderr, /cannot resolve canonical non-linked checkout.*open requires a canonical checkout/);
    assert.ok(!refExists(linked, "refs/heads/lane/needs-primary"));
    negativeControl("bare linked reads and mutation refusal");
  } finally {
    fixture.cleanup();
  }
});

test("same-named repositories in equal-labeled roots keep distinct paths, labels, agents, and git identities", () => {
  const fixtures = [
    makeFixture(undefined, { repoParts: ["development-a", "same-root", "same-repo"] }),
    makeFixture(undefined, { repoParts: ["development-b", "same-root", "same-repo"] }),
  ];
  try {
    const records = [];
    for (const [index, fixture] of fixtures.entries()) {
      const rootIdentity = realpathSync(join(fixture.root, `development-${index === 0 ? "a" : "b"}`, "same-root"));
      writeFileSync(join(rootIdentity, ".lane.json"), `${JSON.stringify({ validate: "true" })}\n`);
      fixture.env = discoveredEnv(fixture, { HOME: join(fixture.root, `development-${index === 0 ? "a" : "b"}`) });
      const path = join(rootIdentity, ".worktrees", "same-repo", "lane-shared-topic");
      const identity = repositoryIdentity(fixture.repo);
      const readableLabel = "same-root/same-repo:lane-shared-topic";
      const fake = writeFakeHerdr(fixture, {
        lanePath: path,
        branch: "lane/shared-topic",
        extraWorkspaces: [{
          active_tab_id: "w-foreign:t1",
          agent_status: "idle",
          focused: false,
          label: readableLabel,
          number: 8,
          pane_count: 1,
          tab_count: 1,
          workspace_id: "w-foreign",
          worktree: {
            checkout_path: "/foreign/worktree",
            is_linked_worktree: true,
            repo_key: "/foreign/repository.git",
            repo_name: "same-repo",
            repo_root: "/foreign/same-repo",
          },
        }],
      });
      git(fixture.repo, ["config", "user.name", `Lane Identity ${index + 1}`]);
      git(fixture.repo, ["config", "user.email", `identity-${index + 1}@example.invalid`]);
      const before = git(fixture.repo, ["config", "--local", "--list"]);
      const opened = lane(fixture, ["open", "shared-topic"]);
      assert.equal(opened.status, 0, opened.stderr);
      assert.ok(existsSync(path));
      assert.match(opened.stdout, new RegExp(`repository identity: ${identity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      assert.match(opened.stdout, new RegExp(`root identity: ${rootIdentity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
      const dispatched = lane(fixture, ["dispatch", "shared-topic", "implement the task"]);
      assert.equal(dispatched.status, 0, dispatched.stderr);
      const calls = fake.calls();
      const create = calls.find((args) => args[0] === "worktree" && args[1] === "create");
      const label = create[create.indexOf("--label") + 1];
      const start = calls.find((args) => args[0] === "agent" && args[1] === "start");
      const agent = start[2];
      const firstAgentList = calls.findIndex((args) => args[0] === "agent" && args[1] === "list");
      const firstAgentStart = calls.findIndex((args) => args[0] === "agent" && args[1] === "start");
      assert.ok(firstAgentList >= 0 && firstAgentList < firstAgentStart);
      assert.match(label, /^same-root\/same-repo:lane-shared-topic~[0-9a-f]{8}$/);
      assert.ok(label.endsWith(identityDigest(rootIdentity, identity, "shared-topic")));
      assert.match(agent, /^[a-z][a-z0-9_-]{0,31}$/);
      assert.ok(agent.includes(identityDigest(rootIdentity, identity, "shared-topic", 6)));
      assert.equal(git(fixture.repo, ["config", "--local", "--list"]), before);
      assert.equal(git(path, ["config", "user.name"]), `Lane Identity ${index + 1}`);
      records.push({ agent, identity, label, path });
    }
    assert.notEqual(records[0].path, records[1].path);
    assert.notEqual(records[0].identity, records[1].identity);
    assert.notEqual(records[0].label, records[1].label);
    assert.notEqual(records[0].agent, records[1].agent);
    negativeControl("root/repository identity labels and agent names");
  } finally {
    for (const fixture of fixtures) fixture.cleanup();
  }
});

test("long Unicode workspace labels retain graphemes and fragments within 64 code points", () => {
  const accent = "e\u0301";
  const family = "👨‍👩‍👧‍👦";
  const fixtures = ["a", "b"].map((suffix) => makeFixture(undefined, {
    repoParts: [`${accent.repeat(12)}-root-${suffix}`, `${family.repeat(3)}-repository-${suffix}`],
  }));
  try {
    const labels = [];
    for (const [index, fixture] of fixtures.entries()) {
      const rootIdentity = realpathSync(dirname(fixture.repo));
      writeFileSync(join(rootIdentity, ".lane.json"), `${JSON.stringify({ validate: "true" })}\n`);
      fixture.env = discoveredEnv(fixture, { HOME: fixture.root });
      const topic = `${"common-prefix-".repeat(4)}${index === 0 ? "a" : "b"}`;
      const path = join(rootIdentity, ".worktrees", fixture.repo.split("/").at(-1), `lane-${topic}`);
      const fake = writeFakeHerdr(fixture, { lanePath: path, branch: `lane/${topic}` });
      const opened = lane(fixture, ["open", topic]);
      assert.equal(opened.status, 0, opened.stderr);
      const create = fake.calls().find((args) => args[0] === "worktree" && args[1] === "create");
      const label = create[create.indexOf("--label") + 1];
      assert.ok([...label].length <= 64, `${[...label].length} code points: ${label}`);
      assert.match(label, new RegExp(`^(?:${accent})+…/`));
      assert.ok(label.includes(`${family}${family}…:lane-common-prefix-`));
      assert.match(label, /~[0-9a-f]{8,}$/);
      assert.ok(label.endsWith(identityDigest(rootIdentity, repositoryIdentity(fixture.repo), topic)));
      labels.push(label);
    }
    assert.notEqual(labels[0], labels[1]);
    negativeControl("bounded grapheme-safe identity labels");
  } finally {
    for (const fixture of fixtures) fixture.cleanup();
  }
});

test("open refuses symlink escapes and destinations inside repository checkouts before mutation", () => {
  const fixtures = [];
  try {
    const escaped = makeFixture();
    fixtures.push(escaped);
    const selectedBase = join(escaped.root, "selected-base");
    const outside = join(escaped.root, "outside-base");
    mkdirSync(selectedBase);
    mkdirSync(outside);
    symlinkSync(outside, join(selectedBase, "repo"));
    writeConfig(escaped, { main: "main", validate: "true", worktree_root: selectedBase });
    delete escaped.env.LANE_WORKTREE_ROOT;
    const escape = lane(escaped, ["open", "symlink-escape"]);
    assert.equal(escape.status, 1);
    assert.match(escape.stderr, /unsafe worktree path.*outside selected base/);
    assert.ok(!existsSync(join(outside, "lane-symlink-escape")));
    assert.ok(!refExists(escaped.repo, "refs/heads/lane/symlink-escape"));

    const canonical = makeFixture();
    fixtures.push(canonical);
    canonical.env.LANE_WORKTREE_ROOT = join(canonical.repo, "nested-worktrees");
    const descendant = lane(canonical, ["open", "checkout-descendant"]);
    assert.equal(descendant.status, 1);
    assert.match(descendant.stderr, /unsafe worktree path.*canonical checkout/);
    assert.ok(!refExists(canonical.repo, "refs/heads/lane/checkout-descendant"));

    const registered = makeFixture();
    fixtures.push(registered);
    const host = openLane(registered, "registered-host");
    registered.env.LANE_WORKTREE_ROOT = join(host, "nested-worktrees");
    const nested = lane(registered, ["open", "registered-descendant"]);
    assert.equal(nested.status, 1);
    assert.match(nested.stderr, /unsafe worktree path.*registered checkout/);
    assert.ok(!refExists(registered.repo, "refs/heads/lane/registered-descendant"));

    const foreign = makeFixture();
    fixtures.push(foreign);
    const other = join(foreign.root, "other-repository");
    execFileSync(GIT, ["init", "-b", "main", other], { stdio: "ignore" });
    foreign.env.LANE_WORKTREE_ROOT = join(other, "nested-worktrees");
    const otherRepo = lane(foreign, ["open", "foreign-descendant"]);
    assert.equal(otherRepo.status, 1);
    assert.match(otherRepo.stderr, /unsafe worktree path.*another repository/);
    assert.ok(!refExists(foreign.repo, "refs/heads/lane/foreign-descendant"));
    negativeControl("realpath and checkout descendant guards");
  } finally {
    for (const fixture of fixtures) fixture.cleanup();
  }
});

test("registered paths are rejected when their on-disk repository identity changes", () => {
  const fixture = makeFixture();
  try {
    const path = openLane(fixture, "swapped-owner");
    const original = `${path}-original`;
    execFileSync("mv", [path, original]);
    const foreign = join(fixture.root, "foreign-checkout");
    execFileSync(GIT, ["init", "-b", "main", foreign], { stdio: "ignore" });
    symlinkSync(foreign, path);
    const run = lane(fixture, ["status"]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /registered worktree .* does not belong to canonical git common directory/);
    negativeControl("registered worktree ownership verification");
  } finally {
    fixture.cleanup();
  }
});

test("a missing registered worktree names git worktree prune", () => {
  const fixture = makeFixture();
  try {
    const path = openLane(fixture, "missing-registration");
    renameSync(path, `${path}-moved`);
    const run = lane(fixture, ["status"]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /registered worktree .* is missing; run git worktree prune/);
    assert.doesNotMatch(run.stderr, /does not belong to canonical git common directory/);
    negativeControl("missing registered worktree guidance");
  } finally {
    fixture.cleanup();
  }
});

test("stale Herdr checkout metadata is not used for dispatch or close", () => {
  const dispatchFixture = makeFixture();
  const closeFixture = makeFixture();
  try {
    const dispatchPath = openLane(dispatchFixture, "stale-dispatch");
    const dispatchFake = writeFakeHerdr(dispatchFixture, {
      lanePath: dispatchPath,
      branch: "lane/stale-dispatch",
      staleId: "w-stale",
      staleLabel: "root/repo:lane-stale-dispatch",
      foreignRepoKey: join(dispatchFixture.root, "foreign.git"),
      noRepair: true,
    });
    const dispatched = lane(dispatchFixture, ["dispatch", "stale-dispatch", "do not send"]);
    assert.equal(dispatched.status, 1);
    assert.match(dispatched.stderr, /Herdr workspace w-stale.*repository identity mismatch/);
    assert.ok(!dispatchFake.calls().some((args) => args[0] === "tab" && args[1] === "create"));

    const closePath = openLane(closeFixture, "stale-close");
    const closeFake = writeFakeHerdr(closeFixture, {
      lanePath: closePath,
      branch: "lane/stale-close",
      staleId: "w-stale",
      staleLabel: "root/repo:lane-stale-close",
      foreignRepoKey: join(closeFixture.root, "foreign.git"),
      noRepair: true,
    });
    const closed = lane(closeFixture, ["close", "stale-close"]);
    assert.equal(closed.status, 0, closed.stderr);
    assert.equal(
      closed.stderr,
      `lane: note: Herdr metadata for ${closePath} does not match this repository; removed the worktree with git only\n`,
    );
    assert.ok(!closeFake.calls().some((args) => args[0] === "worktree" && args[1] === "remove"));
    assert.ok(!existsSync(closePath));
    negativeControl("stale Herdr path identity refusal");
  } finally {
    dispatchFixture.cleanup();
    closeFixture.cleanup();
  }
});

test("linked invocation creates labeled children under the canonical repository workspace", () => {
  const fixture = makeFixture(undefined, { repoParts: ["repo", "repo"] });
  try {
    const caller = join(fixture.root, "caller-lane");
    git(fixture.repo, ["worktree", "add", "-b", "lane/caller", caller], { stdio: "ignore" });
    const path = lanePath(fixture, "child-topic");
    const fake = writeFakeHerdr(fixture, {
      callerPath: caller,
      lanePath: path,
      branch: "lane/child-topic",
    });
    const opened = lane(fixture, ["open", "child-topic"], { cwd: caller });
    assert.equal(opened.status, 0, opened.stderr);
    const controls = fake.calls().filter((args) => args[0] === "worktree" && ["create", "open"].includes(args[1]));
    assert.ok(controls.length >= 2);
    for (const args of controls) {
      assert.equal(args[args.indexOf("--workspace") + 1], "w-parent");
      assert.notEqual(args[args.indexOf("--workspace") + 1], "w-caller");
      assert.equal(args[args.indexOf("--label") + 1], "repo/repo:lane-child-topic");
    }
    assert.equal(
      fake.calls().filter((args) => args[0] === "workspace" && args[1] === "list").length,
      2,
    );
    negativeControl("canonical Herdr parent and labeled child");
  } finally {
    fixture.cleanup();
  }
});

test("a repository with a separate git directory retains its canonical checkout identity", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "herdr-lanes-separate-test-")));
  const repo = join(root, "working", "repository");
  const gitDirectory = join(root, "metadata", "repository.git");
  const bin = join(root, "bin");
  const configPath = join(root, "lane.json");
  const worktrees = join(root, "worktrees");
  mkdirSync(dirname(repo), { recursive: true });
  mkdirSync(dirname(gitDirectory), { recursive: true });
  mkdirSync(bin);
  symlinkSync(GIT, join(bin, "git"));
  symlinkSync(HEAD, join(bin, "head"));
  execFileSync(GIT, ["init", "-b", "main", "--separate-git-dir", gitDirectory, repo], { stdio: "ignore" });
  git(repo, ["config", "user.name", "Lane Tests"]);
  git(repo, ["config", "user.email", "lane-tests@example.invalid"]);
  writeFileSync(join(repo, "shared.txt"), "base\n");
  git(repo, ["add", "shared.txt"]);
  git(repo, ["commit", "-m", "initial"], { stdio: "ignore" });
  writeFileSync(configPath, `${JSON.stringify({ main: "main", validate: "true" })}\n`);
  const fixture = {
    root, repo, bin, configPath, worktrees,
    env: { ...process.env, PATH: bin, LANE_CONFIG: configPath, LANE_WORKTREE_ROOT: worktrees },
  };
  try {
    const opened = lane(fixture, ["open", "separate-directory"]);
    assert.equal(opened.status, 0, opened.stderr);
    assert.match(opened.stdout, new RegExp(`canonical checkout: ${repo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(opened.stdout, new RegExp(`repository identity: ${realpathSync(gitDirectory).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.ok(existsSync(join(worktrees, "lane-separate-directory")));
    negativeControl("separate git directory canonical checkout");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("selected malformed, unreadable, and wrongly typed config files fail before mutation", () => {
  const fixtures = [];
  try {
    const malformed = makeFixture();
    fixtures.push(malformed);
    const malformedPath = join(malformed.repo, ".lane.json");
    writeFileSync(malformedPath, "{ malformed\n");
    const malformedRun = lane(malformed, ["open", "malformed-config"], { env: discoveredEnv(malformed) });
    assert.equal(malformedRun.status, 1);
    assert.match(malformedRun.stderr, new RegExp(`invalid lane config .*${malformedPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.ok(!refExists(malformed.repo, "refs/heads/lane/malformed-config"));

    const typed = makeFixture();
    fixtures.push(typed);
    const typedPath = join(typed.repo, ".lane.json");
    writeFileSync(typedPath, `${JSON.stringify({ prepare: "npm ci" })}\n`);
    const typedRun = lane(typed, ["open", "typed-config"], { env: discoveredEnv(typed) });
    assert.equal(typedRun.status, 1);
    assert.match(typedRun.stderr, /invalid lane config .*prepare must be an array/);
    assert.ok(!refExists(typed.repo, "refs/heads/lane/typed-config"));

    const unreadable = makeFixture();
    fixtures.push(unreadable);
    const directory = join(unreadable.repo, "config-directory");
    mkdirSync(directory);
    const unreadableRun = lane(unreadable, ["open", "unreadable-config"], {
      env: discoveredEnv(unreadable, { LANE_CONFIG: directory }),
    });
    assert.equal(unreadableRun.status, 1);
    assert.match(unreadableRun.stderr, /cannot read lane config/);
    assert.ok(!refExists(unreadable.repo, "refs/heads/lane/unreadable-config"));

    const missing = makeFixture();
    fixtures.push(missing);
    const missingPath = join(missing.repo, "missing.json");
    const missingRun = lane(missing, ["config"], {
      env: discoveredEnv(missing, { LANE_CONFIG: missingPath }),
    });
    assert.equal(missingRun.status, 1);
    assert.match(missingRun.stderr, /cannot read lane config/);
    negativeControl("invalid selected config refusal");
  } finally {
    for (const fixture of fixtures) fixture.cleanup();
  }
});

test("open refuses ordinary and foreign-worktree destinations without creating branches", () => {
  const fixture = makeFixture();
  try {
    const ordinaryPath = lanePath(fixture, "occupied-directory");
    mkdirSync(ordinaryPath, { recursive: true });
    const sentinel = join(ordinaryPath, "keep.txt");
    writeFileSync(sentinel, "preserve\n");
    const ordinary = lane(fixture, ["open", "occupied-directory"]);
    assert.equal(ordinary.status, 1);
    assert.match(ordinary.stderr, /worktree path already exists/);
    assert.equal(readFileSync(sentinel, "utf8"), "preserve\n");
    assert.ok(!refExists(fixture.repo, "refs/heads/lane/occupied-directory"));

    writeConfig(fixture, {
      main: "main",
      validate: "true",
      worktree_root: join(fixture.root, "shared-base"),
    });
    delete fixture.env.LANE_WORKTREE_ROOT;
    const foreignRepo = join(fixture.root, "foreign-repo");
    const foreignPath = join(fixture.root, "shared-base", "repo", "lane-foreign-worktree");
    execFileSync(GIT, ["init", "-b", "main", foreignRepo], { stdio: "ignore" });
    git(foreignRepo, ["config", "user.name", "Lane Tests"]);
    git(foreignRepo, ["config", "user.email", "lane-tests@example.invalid"]);
    writeFileSync(join(foreignRepo, "foreign.txt"), "foreign\n");
    git(foreignRepo, ["add", "foreign.txt"]);
    git(foreignRepo, ["commit", "-m", "foreign initial"], { stdio: "ignore" });
    git(foreignRepo, ["worktree", "add", "-b", "foreign-lane", foreignPath], { stdio: "ignore" });
    const foreignHead = git(foreignPath, ["rev-parse", "HEAD"]);
    const foreign = lane(fixture, ["open", "foreign-worktree"]);
    assert.equal(foreign.status, 1);
    assert.match(foreign.stderr, new RegExp(`worktree path belongs to another repository: ${foreignPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.match(foreign.stderr, /choose distinct worktree bases/);
    assert.equal(git(foreignPath, ["rev-parse", "HEAD"]), foreignHead);
    assert.ok(!refExists(fixture.repo, "refs/heads/lane/foreign-worktree"));
    negativeControl("occupied foreign path refusal");
  } finally {
    fixture.cleanup();
  }
});

test("registered legacy lane paths remain authoritative after worktree_root changes", () => {
  const fixture = makeFixture();
  try {
    ignoreLaneState(fixture);
    const originalPath = openLane(fixture, "legacy-location");
    writeConfig(fixture, { main: "main", validate: "true", worktree_root: join(fixture.root, "new-root") });
    delete fixture.env.LANE_WORKTREE_ROOT;

    const status = lane(fixture, ["status"]);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, new RegExp(originalPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    const dispatch = lane(fixture, ["dispatch", "legacy-location"]);
    assert.equal(dispatch.status, 1);
    assert.match(dispatch.stderr, /herdr is unavailable/);
    assert.doesNotMatch(dispatch.stderr, /has no worktree/);
    const check = lane(fixture, ["check", "--cmd", "true"], { cwd: originalPath });
    assert.equal(check.status, 0, check.stderr);
    commitFile(originalPath, "lane.txt", "lane\n", "legacy lane change");
    const promote = lane(fixture, ["promote", "legacy-location"]);
    assert.equal(promote.status, 0, promote.stderr);
    const close = lane(fixture, ["close", "legacy-location"]);
    assert.equal(close.status, 0, close.stderr);
    assert.ok(!existsSync(originalPath));
    negativeControl("registered legacy paths remain authoritative");
  } finally {
    fixture.cleanup();
  }
});

test("board --once renders a plain registered-session table without Herdr", () => {
  const fixture = makeFixture({ main: "main", validate: "true", registry: ".lane/sessions.json" });
  try {
    mkdirSync(join(fixture.repo, ".lane"));
    writeFileSync(join(fixture.repo, ".lane", "sessions.json"), `${JSON.stringify([{
      name: "offline-agent",
      workspace: "lane-offline",
      lane: "offline",
      role: "reviewer",
      report: "reports/offline.md",
      deadline: null,
      done: false,
    }], null, 2)}\n`);
    fixture.env.HERDR_SOCKET_PATH = join(fixture.root, "missing.sock");
    const run = lane(fixture, ["board", "--once"]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /NAME\s+ROLE\s+LANE\s+STATUS\s+PANE/);
    assert.match(run.stdout, /offline-agent\s+reviewer\s+offline\s+offline/);
    assert.match(run.stdout, /load .* workers/);
    negativeControl("plain lane board");
  } finally {
    fixture.cleanup();
  }
});

test("board --once names the missing registry path", () => {
  const fixture = makeFixture();
  try {
    fixture.env.HERDR_SOCKET_PATH = join(fixture.root, "missing.sock");
    const run = lane(fixture, ["board", "--once"]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /registry not found: .*\.lane\/sessions\.json/);
    negativeControl("missing board registry hint");
  } finally {
    fixture.cleanup();
  }
});

test("board uses inherited canonical registry configuration from a linked worktree", () => {
  const fixture = makeFixture(undefined, { repoParts: ["projects", "repo"] });
  try {
    writeFileSync(join(fixture.root, "projects", ".lane.json"), `${JSON.stringify({
      registry: ".lane/inherited-sessions.json",
    })}\n`);
    const registryDirectory = join(fixture.repo, ".lane");
    mkdirSync(registryDirectory);
    writeFileSync(join(registryDirectory, "inherited-sessions.json"), `${JSON.stringify([{
      name: "inherited-agent",
      workspace: "inherited-workspace",
      lane: "linked-board",
      role: "engineer",
      report: "reports/inherited.md",
      deadline: null,
      done: false,
    }])}\n`);
    const linked = join(fixture.root, "linked-board");
    git(fixture.repo, ["worktree", "add", "-b", "lane/linked-board", linked], { stdio: "ignore" });
    const env = discoveredEnv(fixture, { HERDR_SOCKET_PATH: join(fixture.root, "missing.sock") });
    const run = lane(fixture, ["board", "--once"], { cwd: linked, env });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /inherited-agent\s+engineer\s+linked-board\s+offline/);
    negativeControl("board canonical inherited config");
  } finally {
    fixture.cleanup();
  }
});

test("interactive board rejects non-TTY input with a concise --once hint", () => {
  const fixture = makeFixture();
  try {
    const run = lane(fixture, ["board"]);
    assert.equal(run.status, 1);
    assert.equal(
      run.stderr,
      "lane: interactive board requires a TTY; use `lane board --once`\n",
    );
    assert.equal(run.stdout, "");
    negativeControl("non-TTY board failure");
  } finally {
    fixture.cleanup();
  }
});

test("dispatch rejects an unknown route before checking Herdr", () => {
  const fixture = makeFixture({
    main: "main",
    validate: "true",
    routes: {
      unblock: { kind: "claude", model: "planner-model" },
      engineer: { kind: "codex", model: "engineer-model" },
      review: { kind: "claude", model: "review-model" },
    },
  });
  try {
    openLane(fixture, "alpha");
    const run = lane(fixture, ["dispatch", "alpha", "--route", "missing"]);
    assert.equal(run.status, 1);
    assert.match(
      run.stderr,
      /lane: unknown route: missing \(configured: engineer, review, unblock\)/,
    );
    assert.doesNotMatch(run.stderr, /herdr is unavailable/);

    writeConfig(fixture, { main: "main", validate: "true" });
    const noneConfigured = lane(fixture, ["dispatch", "alpha", "--route", "missing"]);
    assert.equal(noneConfigured.status, 1);
    assert.match(
      noneConfigured.stderr,
      /lane: unknown route: missing \(none configured\)/,
    );
    assert.doesNotMatch(noneConfigured.stderr, /herdr is unavailable/);
    negativeControl("unknown dispatch route");
  } finally {
    fixture.cleanup();
  }
});

test("usage exits one with no command and with an unknown command", () => {
  const fixture = makeFixture();
  try {
    const missing = lane(fixture, []);
    assert.equal(missing.status, 1);
    assert.match(missing.stdout, /^usage:/);
    assert.match(missing.stdout, /check \[--cmd <validate command>\]/);
    assert.match(
      missing.stdout,
      /  check \[--cmd <validate command>\]\n                   validate this clean worktree/,
    );
    assert.match(missing.stdout, /  config           print resolved configuration as key, JSON value, and source/);
    const unknown = lane(fixture, ["not-a-command"]);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stdout, /^usage:/);
    const readme = readFileSync(resolve(HERE, "..", "README.md"), "utf8");
    assert.match(readme, /\| `lane config` \| Print resolved configuration values and sources \|/);
    negativeControl("usage exits");
  } finally {
    fixture.cleanup();
  }
});

test("status exits quietly when a downstream reader closes stdout", () => {
  const fixture = makeFixture();
  try {
    for (const topic of ["pipe-one", "pipe-two", "pipe-three", "pipe-four", "pipe-five"]) {
      git(fixture.repo, ["branch", `lane/${topic}`]);
    }
    const command = `"${process.execPath}" "${LANE}" status | head -n 1`;
    const run = spawnSync("/bin/bash", ["-o", "pipefail", "-c", command], {
      cwd: fixture.repo,
      env: fixture.env,
      encoding: "utf8",
    });
    assert.equal(run.status, 0, run.stderr);
    assert.doesNotMatch(run.stderr, /EPIPE/);
    assert.match(run.stdout, /^main [0-9a-f]{7}\n$/);
    negativeControl("EPIPE handling");
  } finally {
    fixture.cleanup();
  }
});

test("verify-agent mismatch control is optional when herdr is absent", {
  skip: HAS_HERDR ? false : "herdr is absent; herdr-dependent tests are skipped",
}, () => {
  const fixture = makeFixture();
  try {
    const run = spawnSync(process.execPath, [LANE, "verify-agent", "missing-agent", "/wrong/path"], {
      cwd: fixture.repo,
      env: { ...fixture.env, PATH: process.env.PATH },
      encoding: "utf8",
    });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /MISMATCH/);
    negativeControl("herdr cwd guard");
  } finally {
    fixture.cleanup();
  }
});
