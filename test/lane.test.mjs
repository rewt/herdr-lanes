import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
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

function makeFixture(config = { main: "main", validate: "true" }) {
  const root = mkdtempSync(join(tmpdir(), "herdr-lanes-test-"));
  const repo = join(root, "repo");
  const worktrees = join(root, "worktrees");
  const configPath = join(root, "lane.json");
  const bin = join(root, "bin");
  mkdirSync(repo);
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

function lane(fixture, args) {
  return spawnSync(process.execPath, [LANE, ...args], {
    cwd: fixture.repo,
    env: fixture.env,
    encoding: "utf8",
  });
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
    const unknown = lane(fixture, ["not-a-command"]);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stdout, /^usage:/);
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
