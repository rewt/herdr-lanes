import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildSubscriptions,
  joinBoardRows,
  markSessionDone,
  parseVerdict,
  renderPlainBoard,
  tableLines,
} from "../board.mjs";

const registry = [{
  name: "api-agent",
  workspace: "lane-api",
  lane: "api",
  role: "engineer",
  report: "reports/api.md",
  deadline: "2026-09-08T10:00:00-05:00",
  done: false,
  tripwires: ["TRIPWIRE", "cargo prove"],
}];

const snapshot = {
  protocol: 20,
  version: "0.8.2",
  agents: [{
    name: "api-agent",
    workspace_id: "w1",
    pane_id: "w1:p2",
    cwd: "/tmp/lane-api",
    agent_status: "working",
  }],
  panes: [],
  workspaces: [{
    workspace_id: "w1",
    label: "lane-api",
    worktree: { checkout_path: "/tmp/lane-api" },
  }],
};

test("registered sessions join live, git, report, deadline, and tripwire state", () => {
  const rows = joinBoardRows({
    registry,
    snapshot,
    gitStates: new Map([["api", { ahead: 2, dirty: true }]]),
    reportStates: new Map([["reports/api.md", { verdict: "PASS", mtime: "09-08 09:30" }]]),
    runtime: new Map([["w1:p2", { lastOutput: "finished proof", tripwire: "TRIPWIRE" }]]),
    now: new Date("2026-09-08T16:00:00Z"),
  });
  assert.equal(rows[0].status, "working");
  assert.equal(rows[0].pane, "w1:p2");
  assert.equal(rows[0].git, "+2 DIRTY");
  assert.equal(rows[0].report, "PASS@09-08 09:30");
  assert.equal(rows[0].deadline, "OVERDUE");
  assert.equal(rows[0].tripwire, "TRIPWIRE");
  assert.equal(rows[0].output, "finished proof");
});

test("subscriptions include status, last-line, and configured output matchers", () => {
  assert.deepEqual(buildSubscriptions(registry, snapshot), [
    { type: "pane.agent_status_changed", pane_id: "w1:p2" },
    {
      type: "pane.output_matched",
      pane_id: "w1:p2",
      source: "recent_unwrapped",
      lines: 1,
      strip_ansi: true,
      match: { type: "regex", value: ".+" },
    },
    {
      type: "pane.output_matched",
      pane_id: "w1:p2",
      source: "recent_unwrapped",
      lines: 20,
      strip_ansi: true,
      match: { type: "substring", value: "TRIPWIRE" },
    },
    {
      type: "pane.output_matched",
      pane_id: "w1:p2",
      source: "recent_unwrapped",
      lines: 20,
      strip_ansi: true,
      match: { type: "substring", value: "cargo prove" },
    },
  ]);
});

test("plain rendering exposes the same board fields without ANSI", () => {
  const [row] = joinBoardRows({ registry, snapshot, now: new Date("2026-09-08T16:00:00Z") });
  const output = renderPlainBoard([row], {
    load: 1.25,
    freeMemory: "8.0 GiB",
    workers: { vitest: 1, cargo: 0, go: 2, rustc: 0 },
  });
  assert.match(output, /NAME\s+ROLE\s+LANE\s+STATUS\s+PANE/);
  assert.match(output, /api-agent\s+engineer\s+api\s+working\s+w1:p2/);
  assert.match(output, /load 1\.25.*free 8\.0 GiB.*vitest=1 cargo=0 go=2 rustc=0/);
  assert.doesNotMatch(output, /\u001b\[/);
});

test("narrow pane rendering keeps every line within the terminal width", () => {
  const [row] = joinBoardRows({ registry, snapshot, now: new Date("2026-09-08T16:00:00Z") });
  const lines = tableLines([row], { width: 80 });
  assert.ok(lines.every((line) => line.length <= 78));
  assert.match(lines.join("\n"), /report /);
  assert.match(lines.join("\n"), /deadline .*tripwire /);
  assert.match(lines.join("\n"), /output /);
});

test("report verdicts are explicit and marking done updates the registry", () => {
  assert.equal(parseVerdict("notes\n**NEEDS-WORK**: retry\n"), "NEEDS-WORK");
  assert.equal(parseVerdict("ordinary prose"), "-");

  const root = mkdtempSync(join(tmpdir(), "lane-board-registry-"));
  const registryPath = join(root, ".lane", "sessions.json");
  mkdirSync(join(root, ".lane"));
  writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  try {
    markSessionDone(registryPath, "api-agent");
    const updated = JSON.parse(readFileSync(registryPath, "utf8"));
    assert.equal(updated[0].done, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
