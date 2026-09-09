import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
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
    writeFileSync(join(grandparent, ".lane.json"), `${JSON.stringify({ main: "grandparent-main" })}\n`);
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
      worktree_root: "repo-trees",
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
      value: join(fixture.repo, "repo-trees", "repo"),
      source: repoConfig,
    });
    assert.ok(!existsSync(shouldNotRun));
    const opened = lane(fixture, ["open", "repository-root-lane"], {
      env: discoveredEnv(fixture, { HOME: home }),
    });
    assert.equal(opened.status, 0, opened.stderr);
    assert.ok(existsSync(join(fixture.repo, "repo-trees", "repo", "lane-repository-root-lane")));
    negativeControl("layered config attribution and replacement");
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
    assert.equal(run.status, 0, run.stderr);
    assert.ok(existsSync(join(caller, "environment-trees", "lane-environment-lane")));
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
    mkdirSync(caller);
    const parentConfig = join(fixture.root, ".lane.json");
    const repoConfig = join(fixture.repo, ".lane.json");
    const selected = join(caller, "selected.json");
    writeFileSync(parentConfig, `${JSON.stringify({ main: "parent-main", validate: "parent" })}\n`);
    writeFileSync(repoConfig, `${JSON.stringify({ main: "repo-main", validate: "repo" })}\n`);
    writeFileSync(selected, `${JSON.stringify({ validate: "selected", worktree_root: "selected-trees" })}\n`);
    const env = discoveredEnv(fixture, { LANE_CONFIG: "selected.json" });
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
    assert.match(foreign.stderr, new RegExp(`worktree path already exists: ${foreignPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
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
