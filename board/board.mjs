import { execFileSync, spawnSync } from "node:child_process";
import {
  readFileSync,
  statSync,
} from "node:fs";
import { freemem, loadavg } from "node:os";
import { basename, isAbsolute, resolve } from "node:path";

import { HerdrClient } from "./herdr-client.mjs";
import { loadRegistry, markSessionDone } from "./registry.mjs";

export { loadRegistry, markSessionDone } from "./registry.mjs";

const TABLE_COLUMNS = [
  ["NAME", "name", 20],
  ["ROLE", "role", 10],
  ["LANE", "lane", 18],
  ["STATUS", "status", 8],
  ["PANE", "pane", 9],
  ["GIT", "git", 10],
  ["GATE", "gate", 17],
  ["REPORT", "report", 20],
  ["DEADLINE", "deadline", 12],
  ["TRIPWIRE", "tripwire", 14],
  ["LAST OUTPUT", "output", 28],
  ["DONE", "done", 4],
];
const WIDE_TABLE_WIDTH = TABLE_COLUMNS.reduce((total, [, , width]) => total + width, 0)
  + TABLE_COLUMNS.length - 1;

function truncate(value, width) {
  const text = `${value ?? "-"}`.replaceAll(/\s+/gu, " ").trim() || "-";
  return text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1))}…`;
}

function pad(value, width) {
  return truncate(value, width).padEnd(width);
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
      gate: git.gate ?? "-",
      gateColor: git.gateColor,
      report: report.verdict === undefined
        ? "-"
        : report.verdict === "-" ? report.mtime : `${report.verdict}@${report.mtime}`,
      deadline,
      tripwire: live.tripwire ?? "-",
      output: live.lastOutput ?? "-",
      done: session.done ? "yes" : "no",
      sessionId: session.session_id,
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

function gateState(checkout, head) {
  if (checkout === undefined || head === undefined) return {};
  try {
    const report = JSON.parse(readFileSync(resolve(checkout, ".lane", "gate.json"), "utf8"));
    if (typeof report.head !== "string") return {};
    if (report.head !== head) return { gate: "STALE" };
    if (!Number.isInteger(report.exit_code)) return {};
    return {
      gate: `exit=${report.exit_code} @${head.slice(0, 7)}`,
      gateColor: report.exit_code === 0 ? "green" : "red",
    };
  } catch {
    return {};
  }
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
    const head = checkout === undefined ? undefined : gitOutput(checkout, ["rev-parse", "HEAD"]);
    states.set(session.lane, { ahead, dirty, checkout, head, ...gateState(checkout, head) });
  }
  return states;
}

export function collectReportStates(repoRoot, registry) {
  const states = new Map();
  const trees = worktrees(repoRoot);
  for (const session of registry) {
    const branch = session.lane.startsWith("lane/") ? session.lane : `lane/${session.lane}`;
    const checkout = trees.find((tree) => tree.branch === branch)?.path;
    const candidates = isAbsolute(session.report)
      ? [session.report]
      : [...(checkout === undefined ? [] : [resolve(checkout, session.report)]), resolve(repoRoot, session.report)];
    for (const path of candidates) {
      try {
        const text = readFileSync(path, "utf8");
        const mtime = statSync(path).mtime.toISOString().slice(5, 16).replace("T", " ");
        states.set(session.report, { verdict: parseVerdict(text), mtime });
        break;
      } catch {
        // Try the canonical checkout after the lane; a missing report is normal.
      }
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
  if (width >= WIDE_TABLE_WIDTH + 2) {
    const header = TABLE_COLUMNS.map(([title, , columnWidth]) => pad(title, columnWidth)).join(" ").trimEnd();
    const separator = TABLE_COLUMNS.map(([, , columnWidth]) => "-".repeat(columnWidth)).join(" ");
    const body = rows.map((row, rowIndex) => {
      const cells = [];
      let offset = 0;
      let gateStart;
      let gateText;
      for (const [, key, columnWidth] of TABLE_COLUMNS) {
        const cell = pad(row[key], columnWidth);
        if (key === "gate") {
          gateStart = offset;
          gateText = truncate(row.gate, columnWidth);
        }
        cells.push(cell);
        offset += cell.length + 1;
      }
      return {
        text: cells.join(" ").trimEnd(),
        rowIndex,
        gateStart,
        gateText,
        gateColor: row.gateColor,
      };
    });
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
    const gateText = truncate(row.gate, usable - 5);
    entries.push({ text: `gate ${gateText}`, rowIndex, gateStart: 5, gateText, gateColor: row.gateColor });
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

export function renderPlainBoard(rows, stats, { connection = "offline", missingRegistry, registryErrors = [] } = {}) {
  const registryNotice = missingRegistry === undefined ? [] : [`registry not found: ${missingRegistry}`];
  return [
    `lane board (${connection})`,
    ...registryNotice,
    ...registryErrors.map((error) => `registry error: ${error}`),
    ...tableLines(rows),
    footerLine(stats),
  ].join("\n") + "\n";
}

export function interactiveMessage(state, message) {
  if (message) return message;
  if (state.errors?.length > 0) return `registry error: ${state.errors[0]}`;
  if (state.exists === false) return `registry not found: ${state.path}`;
  return "↑/↓ select · a attach command · d done · r refresh · q quit";
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
      registryErrors: state.errors,
    }));
  } finally {
    client.close();
  }
}
