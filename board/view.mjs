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
  ["LAST MESSAGE", "output", 28],
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

function gateCell(gate = {}) {
  if (gate.state === "stale") return { gate: "STALE" };
  if ((gate.state === "pass" || gate.state === "fail") &&
      Number.isInteger(gate.exit_code) && typeof gate.head === "string") {
    return {
      gate: `exit=${gate.exit_code} @${gate.head.slice(0, 7)}`,
      gateColor: gate.state === "pass" ? "green" : "red",
    };
  }
  return { gate: "-" };
}

function reportCell(report = {}) {
  if (typeof report.mtime !== "string") return "-";
  const mtime = report.mtime.slice(5, 16).replace("T", " ");
  return report.verdict === null || report.verdict === undefined
    ? mtime
    : `${report.verdict}@${mtime}`;
}

function messageCell(message = {}) {
  if (message.source === "assistant-preview" && typeof message.text === "string") {
    return message.text.split("\n").find((line) => line.trim() !== "") ?? "message unavailable";
  }
  if (typeof message.raw_excerpt?.text === "string") {
    const excerpt = message.raw_excerpt.text.split("\n").find((line) => line.trim() !== "") ?? "";
    return `message unavailable; pane output: ${excerpt}`;
  }
  return message.source === "unavailable" ? "message unavailable" : "-";
}

export function rowsFromBoardDocument(document, { preferTopic = false } = {}) {
  return (document.rows ?? []).map((row) => {
    const status = row.status ?? "offline";
    return {
      name: row.name ?? "(unnamed)",
      role: row.role ?? "-",
      lane: preferTopic ? row.topic ?? row.branch ?? "-" : row.branch ?? "-",
      status,
      pane: status === "offline" ? "-" : row.pane_id ?? "-",
      git: Number.isInteger(row.git?.ahead)
        ? `+${row.git.ahead}${row.git.dirty ? " DIRTY" : ""}`
        : "-",
      ...gateCell(row.gate),
      report: reportCell(row.report),
      deadline: row.done ? "done" : row.overdue ? "OVERDUE" : row.deadline?.slice(0, 10) ?? "-",
      tripwire: row.tripwire ?? "-",
      output: messageCell(row.last_message),
      done: row.done ? "yes" : "no",
      sessionId: row.row_id,
    };
  });
}

export function stateFromBoardDocument(document) {
  const freeMemory = Number.isFinite(document.host?.free_memory_bytes)
    ? `${(document.host.free_memory_bytes / (1024 ** 3)).toFixed(1)} GiB`
    : "-";
  return {
    rows: rowsFromBoardDocument(document),
    stats: {
      load: document.host?.load_1m ?? 0,
      freeMemory,
      workers: document.host?.workers ?? {},
    },
    connection: document.coverage?.herdr === "connected" ? "Herdr connected" : "offline",
    coverage: document.coverage ?? {},
    errors: document.errors ?? [],
  };
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
        text: cells.join(" ").trimEnd(), rowIndex, gateStart, gateText, gateColor: row.gateColor,
      };
    });
    return [{ text: header }, { text: separator }, ...body];
  }

  const usable = Math.max(40, width - 2);
  const columns = [
    ["NAME", "name", 16], ["ROLE", "role", 8], ["LANE", "lane", 12],
    ["STATUS", "status", 8], ["PANE", "pane", 8], ["GIT", "git", 9], ["DONE", "done", 4],
  ];
  const header = columns.map(([title, , columnWidth]) => pad(title, columnWidth)).join(" ").trimEnd();
  const entries = [{ text: header }, { text: "-".repeat(Math.min(usable, header.length)) }];
  rows.forEach((row, rowIndex) => {
    entries.push({
      text: columns.map(([, key, columnWidth]) => pad(row[key], columnWidth)).join(" ").trimEnd(), rowIndex,
    });
    const gateText = truncate(row.gate, usable - 5);
    entries.push({ text: `gate ${gateText}`, rowIndex, gateStart: 5, gateText, gateColor: row.gateColor });
    entries.push({ text: `report ${truncate(row.report, usable - 7)}`, rowIndex });
    const deadline = truncate(row.deadline, 12);
    entries.push({ text: `deadline ${deadline} | tripwire ${truncate(row.tripwire, usable - 33)}`, rowIndex });
    entries.push({ text: `message ${truncate(row.output, usable - 8)}`, rowIndex });
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

export function renderPlainBoard(rows, stats, {
  connection = "offline",
  missingRegistry,
  registryErrors = [],
  messageErrors = [],
  observationErrors = [],
} = {}) {
  const registryNotice = missingRegistry === undefined ? [] : [`registry not found: ${missingRegistry}`];
  return [
    `lane board (${connection})`,
    ...registryNotice,
    ...registryErrors.map((error) => `registry error: ${error}`),
    ...messageErrors.map((error) => `message notice: ${error}`),
    ...observationErrors.map((error) => `${error.source} error: ${error.message}`),
    ...tableLines(rows),
    footerLine(stats),
  ].join("\n") + "\n";
}

export function interactiveMessage(state, message) {
  if (message) return message;
  if (state.errors?.length > 0) {
    const error = state.errors[0];
    return typeof error === "string" ? `registry error: ${error}` : `${error.source}: ${error.message}`;
  }
  if (state.exists === false) return `registry not found: ${state.path}`;
  if (state.coverage?.registry === "missing") return "session registry is missing";
  return "↑/↓ select · Enter/a focus · d done · r refresh · q quit";
}
