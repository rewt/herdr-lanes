import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
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
const INVENTORY = new URL("../board/inventory.mjs", import.meta.url);
const GIT = execFileSync("which", ["git"], { encoding: "utf8" }).trim();

function negativeControl(label) {
  if (process.env.LANE_TEST_NEGATIVE_CONTROL === "1") {
    assert.fail(`deliberate negative control: ${label}`);
  }
}

function git(cwd, args) {
  return execFileSync(GIT, ["-C", cwd, ...args], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: tmpdir(),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
    },
  }).trim();
}

function makeRepository(root, segment, { registry = ".lane/sessions.json" } = {}) {
  const developmentRoot = join(root, segment, "team");
  const repo = join(developmentRoot, "repo");
  mkdirSync(repo, { recursive: true });
  git(repo, ["init", "-b", "main"]);
  writeFileSync(join(repo, "tracked.txt"), "base\n");
  git(repo, ["add", "tracked.txt"]);
  git(repo, ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-m", "initial"]);
  writeFileSync(join(developmentRoot, ".lane.json"), `${JSON.stringify({
    main: "main",
    worktree_root: "../worktrees",
    registry,
  }, null, 2)}\n`);
  return {
    repo: realpathSync(repo),
    root: realpathSync(developmentRoot),
    repoId: realpathSync(git(repo, ["rev-parse", "--path-format=absolute", "--git-common-dir"])),
  };
}

function writeSession(repository, session, registry = ".lane/sessions.json") {
  const directory = join(repository.repo, `${registry}.d`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${session.session_id}.json`), `${JSON.stringify({
    session_id: session.session_id,
    repo_id: repository.repoId,
    root_id: repository.root,
    repo: repository.repo,
    topic: session.topic,
    name: session.name,
    workspace: session.workspace,
    pane: session.pane,
    server: session.server,
    lane: `lane/${session.topic}`,
    role: "engineer",
    brief: null,
    goal: session.goal ?? session.topic,
    report: `docs/reports/${session.topic}.md`,
    deadline: null,
    done: session.done ?? false,
    created_at: "2026-09-11T12:00:00.000Z",
    ...(session.repo_id === undefined ? {} : { repo_id: session.repo_id }),
    ...(session.repo === undefined ? {} : { repo: session.repo }),
  }, null, 2)}\n`);
}

function liveAgent({
  agent = "codex",
  name,
  status = "working",
  cwd,
  workspace,
  pane,
  terminal = `${pane}-terminal`,
  title = "Fixture agent title",
  session = `${pane}-session`,
}) {
  return {
    agent,
    agent_session: { agent, kind: "id", source: `herdr:${agent}`, value: session },
    agent_status: status,
    cwd,
    foreground_cwd: cwd,
    ...(name === undefined ? {} : { name }),
    pane_id: pane,
    revision: 1,
    state_change_seq: 1,
    tab_id: `${workspace}:t1`,
    terminal_id: terminal,
    terminal_title: title,
    terminal_title_stripped: title,
    workspace_id: workspace,
  };
}

function workspace(repository, id, checkout, linked) {
  return {
    active_tab_id: `${id}:t1`,
    focused: false,
    label: "repo",
    pane_count: 1,
    tab_count: 1,
    workspace_id: id,
    worktree: {
      checkout_path: checkout,
      is_linked_worktree: linked,
      repo_key: repository.repoId,
      repo_name: "repo",
      repo_root: repository.repo,
    },
  };
}

function snapshot(agents, workspaces) {
  return {
    protocol: 20,
    version: "fixture",
    agents,
    panes: agents.map((agent) => ({
      pane_id: agent.pane_id,
      tab_id: agent.tab_id,
      workspace_id: agent.workspace_id,
      terminal_id: agent.terminal_id,
    })),
    workspaces,
  };
}

function worktreeList(repository, entries) {
  return {
    source: {
      repo_key: repository.repoId,
      repo_name: "repo",
      repo_root: repository.repo,
      source_checkout_path: repository.repo,
      source_workspace_id: entries[0].open_workspace_id,
    },
    type: "worktree_list",
    worktrees: entries,
  };
}

test("local Herdr endpoint inventory deduplicates real paths and reports enumeration coverage", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "lane-board-endpoints-")));
  try {
    const current = join(root, "current.sock");
    const second = join(root, "second.sock");
    writeFileSync(current, "");
    symlinkSync(current, join(root, "current-alias.sock"));
    const { enumerateLocalHerdrEndpoints } = await import(INVENTORY);
    const complete = enumerateLocalHerdrEndpoints({
      currentSocketPath: current,
      listSessions: () => ({ sessions: [
        { default: true, name: "default", running: false, socket_path: join(root, "current-alias.sock") },
        { default: false, name: "second", running: true, socket_path: second },
        { default: false, name: "remote", running: true, socket_path: second, remote: true },
      ] }),
    });
    assert.equal(complete.coverage, "complete");
    assert.equal(complete.endpoints.length, 2);
    assert.equal(complete.endpoints[0].path, realpathSync(current));
    assert.ok(complete.endpoints.every((endpoint) => /^local-[0-9a-f]{12}$/u.test(endpoint.server_id)));
    assert.deepEqual(complete.errors, []);

    const fallback = enumerateLocalHerdrEndpoints({
      currentSocketPath: current,
      listSessions: () => { throw new Error("session enumeration unavailable"); },
    });
    assert.equal(fallback.coverage, "partial");
    assert.equal(fallback.endpoints.length, 1);
    assert.match(fallback.errors[0].message, /session enumeration unavailable/u);
    negativeControl("local endpoint coverage and deduplication");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("machine inventory joins canonical repositories while preserving every live agent", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "lane-board-machine-")));
  try {
    const first = makeRepository(root, "first", { registry: ".lane/anchor.json" });
    const second = makeRepository(root, "second", { registry: ".lane/other.json" });
    const firstLane = join(root, "first-lane");
    const secondLane = join(root, "second-lane");
    git(first.repo, ["worktree", "add", "-b", "lane/first-task", firstLane]);
    git(second.repo, ["worktree", "add", "-b", "lane/second-task", secondLane]);
    const firstSocket = join(root, "first.sock");
    const secondSocket = join(root, "second.sock");
    const missingSocket = join(root, "missing.sock");
    const registeredId = "11111111-1111-4111-8111-111111111111";
    writeSession(first, {
      session_id: registeredId,
      topic: "first-task",
      name: "registered-agent",
      workspace: "first-lane",
      pane: "first-pane",
      server: firstSocket,
    }, ".lane/anchor.json");
    writeSession(first, {
      session_id: "22222222-2222-4222-8222-222222222222",
      topic: "foreign-task",
      name: "same-agent",
      workspace: "first-main",
      pane: "facilitator-pane",
      server: firstSocket,
      repo_id: second.repoId,
      repo: second.repo,
    }, ".lane/anchor.json");

    const snapshots = new Map([
      [firstSocket, snapshot([
        liveAgent({ name: "registered-agent", cwd: firstLane, workspace: "first-lane", pane: "first-pane" }),
        liveAgent({ cwd: firstLane, workspace: "first-lane", pane: "unnamed-pane" }),
        liveAgent({ name: "same-agent", status: "done", cwd: first.repo, workspace: "first-main", pane: "facilitator-pane" }),
        liveAgent({ name: "outside-agent", cwd: join(root, "not-git"), workspace: "outside", pane: "outside-pane" }),
      ], [
        workspace(first, "first-main", first.repo, false),
        workspace(first, "first-lane", firstLane, true),
        { workspace_id: "outside", label: "outside" },
      ])],
      [secondSocket, snapshot([
        liveAgent({ name: "same-agent", cwd: secondLane, workspace: "second-lane", pane: "second-pane" }),
      ], [
        workspace(second, "second-main", second.repo, false),
        workspace(second, "second-lane", secondLane, true),
      ])],
    ]);
    const worktrees = new Map([
      [`${firstSocket}\0${first.repoId}`, worktreeList(first, [
        { branch: "main", is_bare: false, is_detached: false, is_linked_worktree: false, is_prunable: false, label: "repo", open_workspace_id: "first-main", path: first.repo },
        { branch: "lane/first-task", is_bare: false, is_detached: false, is_linked_worktree: true, is_prunable: false, label: "first-task", open_workspace_id: "first-lane", path: firstLane },
      ])],
      [`${secondSocket}\0${second.repoId}`, worktreeList(second, [
        { branch: "main", is_bare: false, is_detached: false, is_linked_worktree: false, is_prunable: false, label: "repo", open_workspace_id: "second-main", path: second.repo },
        { branch: "lane/second-task", is_bare: false, is_detached: false, is_linked_worktree: true, is_prunable: false, label: "second-task", open_workspace_id: "second-lane", path: secondLane },
      ])],
    ]);
    const { collectMachineBoardDocument } = await import(INVENTORY);
    const options = {
      anchor: {
        path: first.repo,
        config: { main: "main", registry: ".lane/anchor.json" },
        root_id: first.root,
        lane_base: join(root, "anchor-worktrees", "repo"),
      },
      currentSocketPath: firstSocket,
      listSessions: () => ({ sessions: [
        { default: true, name: "first", running: true, socket_path: firstSocket },
        { default: false, name: "duplicate", running: false, socket_path: firstSocket },
        { default: false, name: "second", running: true, socket_path: secondSocket },
        { default: false, name: "missing", running: true, socket_path: missingSocket },
      ] }),
      clientFactory: ({ path }) => ({
        snapshot: async () => {
          if (!snapshots.has(path)) throw new Error("fixture endpoint inaccessible");
          return snapshots.get(path);
        },
        close() {},
      }),
      listWorktrees: ({ endpoint, repository }) => worktrees.get(`${endpoint.path}\0${repository.repo_id}`),
      stats: { load: 0, freeMemoryBytes: 1024, workers: {} },
      now: new Date("2026-09-11T13:00:00.000Z"),
    };
    const machine = await collectMachineBoardDocument(options);
    assert.deepEqual(machine.scope, { kind: "machine", repo_id: null, include_history: false });
    assert.equal(machine.coverage.discovery, "partial");
    assert.equal(machine.coverage.servers.length, 3);
    assert.equal(machine.coverage.servers.filter((server) => server.available).length, 2);
    assert.equal(machine.repositories.length, 2);
    assert.ok(machine.repositories.every((repository) => /^[0-9a-f]{8}$/u.test(repository.display_suffix)));
    assert.notEqual(machine.repositories[0].display_suffix, machine.repositories[1].display_suffix);
    assert.equal(machine.rows.length, 5);
    assert.equal(machine.rows.filter((row) => row.registered).length, 1);
    assert.equal(machine.rows.filter((row) => row.name === null).length, 1);
    assert.equal(machine.rows.filter((row) => row.repo_id === null).length, 1);
    assert.equal(machine.rows.find((row) => row.row_id === registeredId).status, "working");
    const facilitator = machine.rows.find((row) => row.name === "same-agent" && row.repo_id === first.repoId);
    assert.equal(facilitator.group.kind, "facilitator");
    assert.equal(facilitator.status, "done");
    assert.equal(facilitator.goal_source, "terminal-title");
    assert.ok(machine.errors.some((error) => error.source === "herdr" && error.server_id));
    assert.ok(machine.errors.some((error) => error.source === "registry" && /foreign/u.test(error.message)));

    const filtered = await collectMachineBoardDocument({ ...options, repoFilter: first.repo });
    assert.deepEqual(filtered.scope, { kind: "repository", repo_id: first.repoId, include_history: false });
    assert.equal(filtered.repositories.length, 1);
    assert.ok(filtered.rows.every((row) => row.repo_id === first.repoId));
    assert.deepEqual(filtered.rows.map((row) => row.group.kind), ["facilitator", "lane", "lane"]);
    negativeControl("canonical machine joins and visible unregistered agents");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("history filtering distinguishes metadata completion from live Herdr done", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "lane-board-history-")));
  try {
    const repository = makeRepository(root, "history");
    const socket = join(root, "history.sock");
    const definitions = [
      ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "offline-done", "offline-pane", true],
      ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "working-after-done", "working-pane", true],
      ["cccccccc-cccc-4ccc-8ccc-cccccccccccc", "idle-done", "idle-pane", true],
      ["dddddddd-dddd-4ddd-8ddd-dddddddddddd", "herdr-done", "herdr-done-pane", false],
    ];
    for (const [sessionId, topic, pane, done] of definitions) {
      writeSession(repository, {
        session_id: sessionId,
        topic,
        name: topic,
        workspace: "history-main",
        pane,
        server: socket,
        done,
      });
    }
    writeFileSync(join(repository.repo, ".lane", "sessions.json.d", "malformed.json"), "{\n");
    const agents = [
      liveAgent({ name: "working-after-done", status: "working", cwd: repository.repo, workspace: "history-main", pane: "working-pane" }),
      liveAgent({ name: "idle-done", status: "idle", cwd: repository.repo, workspace: "history-main", pane: "idle-pane" }),
      liveAgent({ name: "herdr-done", status: "done", cwd: repository.repo, workspace: "history-main", pane: "herdr-done-pane" }),
    ];
    const liveSnapshot = snapshot(agents, [workspace(repository, "history-main", repository.repo, false)]);
    const { collectMachineBoardDocument } = await import(INVENTORY);
    const options = {
      anchor: { path: repository.repo },
      currentSocketPath: socket,
      listSessions: () => ({ sessions: [] }),
      clientFactory: () => ({ snapshot: async () => liveSnapshot, close() {} }),
      listWorktrees: () => worktreeList(repository, [{
        branch: "main", is_bare: false, is_detached: false, is_linked_worktree: false,
        is_prunable: false, label: "repo", open_workspace_id: "history-main", path: repository.repo,
      }]),
      stats: { load: 0, freeMemoryBytes: 1024, workers: {} },
    };
    const current = await collectMachineBoardDocument(options);
    assert.deepEqual(current.rows.map((row) => row.name), ["herdr-done", "working-after-done"]);
    assert.equal(current.rows.find((row) => row.name === "herdr-done").done, false);
    assert.equal(current.rows.find((row) => row.name === "working-after-done").active_after_done, true);
    assert.ok(current.errors.some((error) => error.source === "registry" && /malformed/u.test(error.message)));

    const history = await collectMachineBoardDocument({ ...options, includeHistory: true });
    assert.equal(history.rows.length, 4);
    assert.equal(history.scope.include_history, true);
    negativeControl("history filtering independent of Herdr agent status");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("board starts outside Git and supports repository filtering plus all-history syntax", () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "lane-board-outside-")));
  try {
    const outside = join(root, "outside");
    const bin = join(root, "bin");
    mkdirSync(outside);
    mkdirSync(bin);
    symlinkSync(GIT, join(bin, "git"));
    const herdr = join(bin, "herdr");
    writeFileSync(herdr, "#!/bin/sh\nif [ \"$1 $2 $3\" = \"session list --json\" ]; then\n  printf '%s\\n' '{\"sessions\":[{\"default\":true,\"name\":\"default\",\"running\":false,\"socket_path\":\"/missing/default.sock\"}]}'\n  exit 0\nfi\nexit 1\n");
    chmodSync(herdr, 0o755);
    const env = {
      PATH: bin,
      HOME: root,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      HERDR_SOCKET_PATH: join(root, "missing-current.sock"),
    };
    const machine = spawnSync(process.execPath, [LANE, "board", "--json", "--all"], {
      cwd: outside,
      env,
      encoding: "utf8",
    });
    assert.equal(machine.status, 0, machine.stderr);
    const document = JSON.parse(machine.stdout);
    assert.deepEqual(document.scope, { kind: "machine", repo_id: null, include_history: true });
    assert.equal(document.coverage.discovery, "unavailable");
    assert.deepEqual(document.rows, []);
    assert.ok(document.errors.every((error) => error.source !== "agent"));

    const explicitConfig = join(root, "lane.json");
    writeFileSync(explicitConfig, "{}\n");
    const refused = spawnSync(process.execPath, [LANE, "board", "--json"], {
      cwd: outside,
      env: { ...env, LANE_CONFIG: explicitConfig },
      encoding: "utf8",
    });
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /LANE_CONFIG.*outside.*--repo/u);

    const repository = makeRepository(root, "selected");
    const filtered = spawnSync(process.execPath, [LANE, "board", "--json", "--repo", repository.repo], {
      cwd: outside,
      env,
      encoding: "utf8",
    });
    assert.equal(filtered.status, 0, filtered.stderr);
    const selected = JSON.parse(filtered.stdout);
    assert.deepEqual(selected.scope, { kind: "repository", repo_id: repository.repoId, include_history: false });
    assert.equal(selected.repositories[0].repo_id, repository.repoId);
    negativeControl("outside-Git machine board and filter syntax");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
