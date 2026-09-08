import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { freemem, loadavg } from "node:os";
import { basename, dirname, isAbsolute, resolve } from "node:path";

import { HerdrClient } from "./herdr-client.mjs";

const TABLE_COLUMNS = [
  ["NAME", "name", 20],
  ["ROLE", "role", 10],
  ["LANE", "lane", 18],
  ["STATUS", "status", 8],
  ["PANE", "pane", 9],
  ["GIT", "git", 10],
  ["REPORT", "report", 20],
  ["DEADLINE", "deadline", 12],
  ["TRIPWIRE", "tripwire", 14],
  ["LAST OUTPUT", "output", 28],
  ["DONE", "done", 4],
];

function truncate(value, width) {
  const text = `${value ?? "-"}`.replaceAll(/\s+/gu, " ").trim() || "-";
  return text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1))}…`;
}

function pad(value, width) {
  return truncate(value, width).padEnd(width);
}

function registryPathFor(repoRoot, config = {}) {
  const configured = config.registry ?? ".lane/sessions.json";
  return isAbsolute(configured) ? configured : resolve(repoRoot, configured);
}

export function loadRegistry(repoRoot, config = {}) {
  const path = registryPathFor(repoRoot, config);
  if (!existsSync(path)) return { path, sessions: [], exists: false };
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed)) throw new Error(`lane board registry must be a JSON array: ${path}`);
  for (const [index, session] of parsed.entries()) {
    for (const key of ["name", "workspace", "lane", "role", "report"]) {
      if (typeof session?.[key] !== "string" || session[key] === "") {
        throw new Error(`lane board registry entry ${index} needs a non-empty ${key}`);
      }
    }
    if (session.tripwires !== undefined && !Array.isArray(session.tripwires)) {
      throw new Error(`lane board registry entry ${index} tripwires must be an array`);
    }
    if ((session.deadline !== null && typeof session.deadline !== "string") || typeof session.done !== "boolean") {
      throw new Error(`lane board registry entry ${index} needs deadline (string or null) and done (boolean)`);
    }
    if ((session.tripwires ?? []).some((pattern) => typeof pattern !== "string" || pattern === "")) {
      throw new Error(`lane board registry entry ${index} tripwires must contain non-empty strings`);
    }
  }
  return { path, sessions: parsed, exists: true };
}

export function parseVerdict(text) {
  const matches = [...text.matchAll(/\*\*(PASS|NEEDS-WORK|FAIL)\*\*/gu)];
  return matches.at(-1)?.[1] ?? "-";
}

function workspaceFor(session, snapshot) {
  return snapshot?.workspaces?.find(
    (workspace) => workspace.workspace_id === session.workspace || workspace.label === session.workspace,
  );
}

function agentFor(session, workspace, snapshot) {
  const agent = snapshot?.agents?.find((candidate) => candidate.name === session.name);
  return workspace === undefined || agent?.workspace_id === workspace.workspace_id ? agent : undefined;
}

function paneIdFor(session, snapshot) {
  const workspace = workspaceFor(session, snapshot);
  return agentFor(session, workspace, snapshot)?.pane_id;
}

export function buildSubscriptions(registry, snapshot) {
  const subscriptions = [];
  for (const session of registry) {
    const paneId = paneIdFor(session, snapshot);
    if (paneId === undefined) continue;
    subscriptions.push({ type: "pane.agent_status_changed", pane_id: paneId });
    subscriptions.push({
      type: "pane.output_matched",
      pane_id: paneId,
      source: "recent_unwrapped",
      lines: 1,
      strip_ansi: true,
      match: { type: "regex", value: ".+" },
    });
    for (const pattern of session.tripwires ?? []) {
      subscriptions.push({
        type: "pane.output_matched",
        pane_id: paneId,
        source: "recent_unwrapped",
        lines: 20,
        strip_ansi: true,
        match: { type: "substring", value: pattern },
      });
    }
  }
  return subscriptions;
}

export function applyHerdrEvent(snapshot, runtime, registry, event) {
  const data = event.data ?? {};
  if (event.event === "pane.agent_status_changed") {
    const agent = snapshot?.agents?.find((candidate) => candidate.pane_id === data.pane_id);
    if (agent !== undefined) agent.agent_status = data.agent_status;
    return;
  }
  if (event.event !== "pane.output_matched") return;
  const previous = runtime.get(data.pane_id) ?? {};
  const readText = data.read?.text ?? "";
  const lastOutput = data.matched_line
    ?? readText.split("\n").map((line) => line.trim()).filter(Boolean).at(-1)
    ?? previous.lastOutput;
  const session = registry.find((candidate) => paneIdFor(candidate, snapshot) === data.pane_id);
  const tripwire = (session?.tripwires ?? []).find(
    (pattern) => `${data.matched_line ?? readText}`.includes(pattern),
  ) ?? previous.tripwire;
  runtime.set(data.pane_id, { lastOutput, tripwire });
}

export function joinBoardRows({
  registry,
  snapshot,
  gitStates = new Map(),
  reportStates = new Map(),
  runtime = new Map(),
  now = new Date(),
}) {
  return registry.map((session) => {
    const workspace = workspaceFor(session, snapshot);
    const agent = agentFor(session, workspace, snapshot);
    const live = runtime.get(agent?.pane_id) ?? {};
    const git = gitStates.get(session.lane) ?? {};
    const report = reportStates.get(session.report) ?? {};
    let deadline = "-";
    if (session.done) deadline = "done";
    else if (session.deadline) {
      const date = new Date(session.deadline);
      deadline = Number.isNaN(date.valueOf()) ? "invalid" : date < now ? "OVERDUE" : session.deadline.slice(0, 10);
    }
    return {
      name: session.name,
      role: session.role,
      lane: session.lane,
      status: agent?.agent_status ?? "offline",
      pane: agent?.pane_id ?? "-",
      git: git.ahead === undefined ? "-" : `+${git.ahead}${git.dirty ? " DIRTY" : ""}`,
      report: report.verdict === undefined
        ? "-"
        : report.verdict === "-" ? report.mtime : `${report.verdict}@${report.mtime}`,
      deadline,
      tripwire: live.tripwire ?? "-",
      output: live.lastOutput ?? "-",
      done: session.done ? "yes" : "no",
      workspace: workspace?.workspace_id,
      checkoutPath: workspace?.worktree?.checkout_path,
    };
  });
}

function gitOutput(cwd, args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
}

function worktrees(repoRoot) {
  const output = gitOutput(repoRoot, ["worktree", "list", "--porcelain"]);
  if (output === undefined) return [];
  return output.split("\n\n").map((entry) => {
    const lines = entry.split("\n");
    return {
      path: lines.find((line) => line.startsWith("worktree "))?.slice(9),
      branch: lines.find((line) => line.startsWith("branch refs/heads/"))?.slice(18),
    };
  });
}

export function collectGitStates(repoRoot, main, registry, snapshot) {
  const states = new Map();
  const trees = worktrees(repoRoot);
  for (const session of registry) {
    const branch = session.lane.startsWith("lane/") ? session.lane : `lane/${session.lane}`;
    const checkout = trees.find((tree) => tree.branch === branch)?.path;
    const counts = gitOutput(repoRoot, ["rev-list", "--left-right", "--count", `${branch}...${main}`]);
    if (counts === undefined) continue;
    const [ahead] = counts.split(/\s+/u).map(Number);
    const dirty = checkout === undefined ? false : (gitOutput(checkout, ["status", "--porcelain=v1"]) ?? "") !== "";
    states.set(session.lane, { ahead, dirty, checkout });
  }
  return states;
}

export function collectReportStates(repoRoot, registry) {
  const states = new Map();
  for (const session of registry) {
    const path = isAbsolute(session.report) ? session.report : resolve(repoRoot, session.report);
    try {
      const text = readFileSync(path, "utf8");
      const mtime = statSync(path).mtime.toISOString().slice(5, 16).replace("T", " ");
      states.set(session.report, { verdict: parseVerdict(text), mtime });
    } catch {
      // A missing report is normal while the session is working.
    }
  }
  return states;
}

export function systemStats() {
  const command = spawnSync("ps", ["-Ao", "command="], { encoding: "utf8" }).stdout ?? "";
  return {
    load: loadavg()[0],
    freeMemory: `${(freemem() / (1024 ** 3)).toFixed(1)} GiB`,
    workers: countWorkers(command),
  };
}

export function countWorkers(command) {
  const workers = { vitest: 0, cargo: 0, go: 0, rustc: 0 };
  for (const line of command.split("\n")) {
    const argv = line.trim().split(/\s+/u);
    const executable = basename(argv[0] ?? "");
    const candidates = [executable];
    if (/^(?:node(?:js)?|python(?:\d+(?:\.\d+)?)?|ruby|perl|php|bash|sh|zsh|deno|bun)$/u.test(executable)) {
      candidates.push(basename(argv[1] ?? ""));
    }
    const worker = candidates
      .map((candidate) => candidate.replace(/\.(?:[cm]?js|py|rb)$/u, ""))
      .find((candidate) => Object.hasOwn(workers, candidate));
    if (worker !== undefined) workers[worker] += 1;
  }
  return workers;
}

export function tableLineEntries(rows, { width = Number.POSITIVE_INFINITY } = {}) {
  if (width >= 150) {
    const header = TABLE_COLUMNS.map(([title, , columnWidth]) => pad(title, columnWidth)).join(" ").trimEnd();
    const separator = TABLE_COLUMNS.map(([, , columnWidth]) => "-".repeat(columnWidth)).join(" ");
    const body = rows.map((row, rowIndex) => ({
      text: TABLE_COLUMNS.map(([, key, columnWidth]) => pad(row[key], columnWidth)).join(" ").trimEnd(),
      rowIndex,
    }));
    return [{ text: header }, { text: separator }, ...body];
  }

  const usable = Math.max(40, width - 2);
  const columns = [
    ["NAME", "name", 16],
    ["ROLE", "role", 8],
    ["LANE", "lane", 12],
    ["STATUS", "status", 8],
    ["PANE", "pane", 8],
    ["GIT", "git", 9],
    ["DONE", "done", 4],
  ];
  const header = columns.map(([title, , columnWidth]) => pad(title, columnWidth)).join(" ").trimEnd();
  const separator = "-".repeat(Math.min(usable, header.length));
  const entries = [{ text: header }, { text: separator }];
  rows.forEach((row, rowIndex) => {
    entries.push({
      text: columns.map(([, key, columnWidth]) => pad(row[key], columnWidth)).join(" ").trimEnd(),
      rowIndex,
    });
    entries.push({ text: `report ${truncate(row.report, usable - 7)}`, rowIndex });
    const deadline = truncate(row.deadline, 12);
    entries.push({
      text: `deadline ${deadline} | tripwire ${truncate(row.tripwire, usable - 33)}`,
      rowIndex,
    });
    entries.push({ text: `output ${truncate(row.output, usable - 7)}`, rowIndex });
  });
  return entries;
}

export function tableLines(rows, options) {
  return tableLineEntries(rows, options).map((entry) => entry.text);
}

export function footerLine(stats) {
  const load = Number(stats.load ?? 0).toFixed(2);
  const workers = stats.workers ?? {};
  return `load ${load} | free ${stats.freeMemory} | workers vitest=${workers.vitest ?? 0} cargo=${workers.cargo ?? 0} go=${workers.go ?? 0} rustc=${workers.rustc ?? 0}`;
}

export function renderPlainBoard(rows, stats, { connection = "offline", missingRegistry } = {}) {
  const registryNotice = missingRegistry === undefined ? [] : [`registry not found: ${missingRegistry}`];
  return [
    `lane board (${connection})`,
    ...registryNotice,
    ...tableLines(rows),
    footerLine(stats),
  ].join("\n") + "\n";
}

export function interactiveMessage(state, message) {
  if (message) return message;
  if (state.exists === false) return `registry not found: ${state.path}`;
  return "↑/↓ select · a attach command · d done · r refresh · q quit";
}

export function markSessionDone(registryPath, name) {
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));
  if (!Array.isArray(registry)) {
    throw new Error(`lane board registry must be a JSON array: ${registryPath}`);
  }
  const session = registry.find((candidate) => candidate.name === name);
  if (session === undefined) throw new Error(`session not found in registry: ${name}`);
  session.done = true;
  mkdirSync(dirname(registryPath), { recursive: true });
  const temporary = `${registryPath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`);
  renameSync(temporary, registryPath);
}

export async function collectBoardState({ repoRoot, config = {}, client, runtime = new Map(), now = new Date() }) {
  const loaded = loadRegistry(repoRoot, config);
  let snapshot = { protocol: undefined, version: undefined, agents: [], panes: [], workspaces: [] };
  let connection = "offline";
  try {
    snapshot = await client.snapshot();
    connection = `Herdr ${snapshot.version ?? "?"} / protocol ${snapshot.protocol ?? "?"}`;
  } catch {
    // Git and report state remain useful when Herdr is unavailable.
  }
  const gitStates = collectGitStates(repoRoot, config.main ?? "main", loaded.sessions, snapshot);
  const reportStates = collectReportStates(repoRoot, loaded.sessions);
  return {
    ...loaded,
    snapshot,
    rows: joinBoardRows({
      registry: loaded.sessions,
      snapshot,
      gitStates,
      reportStates,
      runtime,
      now,
    }),
    gitStates,
    reportStates,
    stats: systemStats(),
    connection,
    runtime,
  };
}

export async function runOnce({ repoRoot, config = {} }) {
  const client = new HerdrClient({ requestTimeoutMs: 500 });
  try {
    const state = await collectBoardState({ repoRoot, config, client });
    process.stdout.write(renderPlainBoard(state.rows, state.stats, {
      connection: state.connection,
      missingRegistry: state.exists ? undefined : state.path,
    }));
  } finally {
    client.close();
  }
}
