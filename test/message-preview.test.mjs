import assert from "node:assert/strict";
import test from "node:test";

const NEGATIVE_CONTROL = process.env.LANE_TEST_NEGATIVE_CONTROL === "1";

function negativeControl(name) {
  if (NEGATIVE_CONTROL) assert.fail(`deliberately broken expectation: ${name}`);
}

async function previewApi() {
  return import("../board/message-preview.mjs");
}

const CODEX_RESPONSE = [
  "\u001b[32m• The parser now keeps the useful answer.\u001b[0m",
  "  It preserves wrapped lines and Unicode: café ✓.",
  "",
  "  A second paragraph remains part of the message.",
  "",
  "────────────────────────────────────────",
  "",
  "› Ask Codex to do anything",
  "",
  "  model-name high · example/repository · task",
].join("\n");

const CLAUDE_RESPONSE = [
  "❯ Explain the change",
  "",
  "⏺ Read(src/example.js)",
  "  ⎿  tool output only",
  "",
  "✻ Thinking…",
  "",
  "⏺ The change is complete and keeps the public boundary.",
  "  Wrapped detail remains attached, including naïve Unicode ✓.",
  "",
  "  The final paragraph is still substantive.",
  "",
  "────────────────────────────────────────",
  "❯ ",
  "────────────────────────────────────────",
  "  ? for shortcuts",
].join("\n");

test("Codex preview extracts the last multiline assistant block before footer chrome", async () => {
  const { extractAssistantPreview } = await previewApi();
  const preview = extractAssistantPreview({ kind: "codex", text: CODEX_RESPONSE });
  assert.deepEqual(preview, {
    text: [
      "The parser now keeps the useful answer.",
      "It preserves wrapped lines and Unicode: café ✓.",
      "",
      "A second paragraph remains part of the message.",
    ].join("\n"),
    source: "assistant-preview",
    available: true,
    rawExcerpt: null,
  });
  negativeControl("Codex substantive preview");
});

test("Claude preview ignores echoed prompts and tools and preserves the final response", async () => {
  const { extractAssistantPreview } = await previewApi();
  const preview = extractAssistantPreview({ kind: "claude", text: CLAUDE_RESPONSE });
  assert.deepEqual(preview, {
    text: [
      "The change is complete and keeps the public boundary.",
      "Wrapped detail remains attached, including naïve Unicode ✓.",
      "",
      "The final paragraph is still substantive.",
    ].join("\n"),
    source: "assistant-preview",
    available: true,
    rawExcerpt: null,
  });
  negativeControl("Claude substantive preview");
});

test("status candidates and trailing terminal chrome never become assistant messages", async () => {
  const { extractAssistantPreview } = await previewApi();
  const cases = [
    ["codex", [
      "• The earlier answer remains visible.",
      "  Its second line remains attached.",
      "",
      "• Working (1m 23s • esc to interrupt)",
    ].join("\n"), "The earlier answer remains visible.\nIts second line remains attached."],
    ["codex", "• Useful answer.\n  ? for shortcuts", "Useful answer."],
    ["claude", "⏺ Useful answer.\n  12% context left", "Useful answer."],
    ["claude", "⏺ Useful answer.\n  1,024 tokens · $0.01", "Useful answer."],
    ["codex", [
      "• Useful answer.",
      "Would you like to run the following command?",
      "  1. Yes, proceed",
      "  2. No, and tell Codex what to do differently",
    ].join("\n"), "Useful answer."],
    ["claude", [
      "⏺ Useful answer.",
      "╭────────────────────────────╮",
      "│ ❯ Type another request     │",
      "╰────────────────────────────╯",
    ].join("\n"), "Useful answer."],
  ];
  for (const [kind, text, expected] of cases) {
    const preview = extractAssistantPreview({ kind, text });
    assert.equal(preview.text, expected, `${kind}: ${JSON.stringify(text)}`);
    assert.equal(preview.source, "assistant-preview");
  }
  for (const [kind, text] of [
    ["codex", "• Working (2m 04s • esc to interrupt)"],
    ["claude", "⏺ ✻ Working… esc to interrupt"],
  ]) {
    assert.equal(extractAssistantPreview({ kind, text }).available, false);
  }
  negativeControl("status and trailing chrome rejection");
});

test("ordinary answer verbs need corroborating evidence before they count as tool calls", async () => {
  const { extractAssistantPreview } = await previewApi();
  for (const word of ["Added", "Updated", "Applied", "Opened", "Read", "Found"]) {
    const preview = extractAssistantPreview({
      kind: "codex",
      text: `• Previous response.\n\n• ${word} safeguards around the public boundary.`,
    });
    assert.equal(preview.text, `${word} safeguards around the public boundary.`);
  }
  for (const word of ["Read", "Search", "Save", "Edit"]) {
    const preview = extractAssistantPreview({
      kind: "claude",
      text: `⏺ Previous response.\n\n⏺ ${word} results are now summarized clearly.`,
    });
    assert.equal(preview.text, `${word} results are now summarized clearly.`);
  }
  assert.equal(extractAssistantPreview({
    kind: "codex",
    text: "• Earlier response.\n\n• Ran npm test\n  └ All tests passed",
  }).text, "Earlier response.");
  assert.equal(extractAssistantPreview({
    kind: "claude",
    text: "⏺ Earlier response.\n\n⏺ Read(src/example.mjs)\n  ⎿ 42 lines",
  }).text, "Earlier response.");
  negativeControl("corroborated tool classification");
});

test("indented quotes and bullets remain inside the assistant response", async () => {
  const { extractAssistantPreview } = await previewApi();
  assert.equal(extractAssistantPreview({
    kind: "codex",
    text: [
      "• The answer includes a nested list:",
      "  • first item",
      "  • second item",
      "",
      "› Ask Codex to do anything",
    ].join("\n"),
  }).text, "The answer includes a nested list:\n• first item\n• second item");
  assert.equal(extractAssistantPreview({
    kind: "claude",
    text: [
      "⏺ The answer quotes the important line:",
      "  > preserve this quoted text",
      "  and this explanation.",
      "",
      "❯ ",
    ].join("\n"),
  }).text, "The answer quotes the important line:\n> preserve this quoted text\nand this explanation.");
  negativeControl("indented response markers");
});

test("tool-only, footer-only, and unknown formats stay unavailable with labeled raw output", async () => {
  const { extractAssistantPreview, refreshMessagePreviews } = await previewApi();
  for (const [kind, text] of [
    ["codex", "• Ran npm test\n  └ 2 tests passed\n\n› Ask Codex to do anything\nmodel-name high · example"],
    ["claude", "⏺ Bash(npm test)\n  ⎿ 2 tests passed\n\n❯ \n? for shortcuts"],
    ["codex", "────────────────────────\n› Ask Codex to do anything\nmodel-name high · example"],
    ["claude", "────────────────────────\n❯ \n? for shortcuts"],
    ["codex", "shell$ printf 'done'\ndone"],
  ]) {
    const preview = extractAssistantPreview({ kind, text });
    assert.equal(preview.text, null);
    assert.equal(preview.source, "unavailable");
    assert.equal(preview.available, false);
    assert.equal(preview.rawExcerpt?.source, "pane-output");
    assert.ok(preview.rawExcerpt?.text.length > 0);
  }
  let unsupportedReads = 0;
  const unsupportedRuntime = new Map();
  await refreshMessagePreviews({
    registry: [{ name: "preview-agent", workspace: "workspace-1" }],
    snapshot: {
      agents: [{
        agent: "other-agent",
        name: "preview-agent",
        pane_id: "pane-1",
        workspace_id: "workspace-1",
      }],
      workspaces: [{ workspace_id: "workspace-1", label: "workspace-1" }],
    },
    runtime: unsupportedRuntime,
    client: { async readPane() { unsupportedReads += 1; } },
  });
  assert.equal(unsupportedReads, 0);
  assert.equal(unsupportedRuntime.size, 0);
  negativeControl("unavailable raw pane fallback");
});

test("bounded reads expose truncation and keep stale previews on read errors", async () => {
  const { refreshMessagePreviews } = await previewApi();
  const session = { name: "preview-agent", workspace: "workspace-1" };
  const agent = {
    agent: "codex",
    agent_session: { agent: "codex", kind: "id", source: "herdr:codex", value: "session-1" },
    name: "preview-agent",
    pane_id: "pane-1",
    workspace_id: "workspace-1",
  };
  const snapshot = {
    agents: [agent],
    workspaces: [{ workspace_id: "workspace-1", label: "workspace-1" }],
  };
  const runtime = new Map();
  const calls = [];
  const client = {
    async readPane(paneId, options) {
      calls.push({ paneId, options });
      return {
        pane_id: paneId,
        workspace_id: "workspace-1",
        tab_id: "tab-1",
        source: "recent_unwrapped",
        format: "text",
        text: "• Ran a tool\n  └ output only\n› prompt",
        revision: 41,
        truncated: true,
      };
    },
  };
  const first = await refreshMessagePreviews({
    registry: [session], snapshot, runtime, client, now: new Date("2026-09-10T12:00:00Z"),
  });
  assert.deepEqual(calls, [{ paneId: "pane-1", options: { lines: 200, source: "recent_unwrapped" } }]);
  assert.deepEqual(first.errors, []);
  assert.equal(runtime.get("pane-1").messageSource, "unavailable");
  assert.equal(runtime.get("pane-1").messageTruncated, true);
  assert.match(runtime.get("pane-1").messageLimitation, /truncated.*no confidently bounded assistant message/iu);

  client.readPane = async () => ({
    pane_id: "pane-1",
    workspace_id: "workspace-1",
    tab_id: "tab-1",
    source: "recent_unwrapped",
    format: "text",
    text: `${"x".repeat(17_000)}\n• A bounded answer remains visible.`,
    revision: 42,
    truncated: false,
  });
  await refreshMessagePreviews({
    registry: [session], snapshot, runtime, client, now: new Date("2026-09-10T12:00:00.500Z"),
  });
  assert.equal(runtime.get("pane-1").messageText, "A bounded answer remains visible.");
  assert.equal(runtime.get("pane-1").messageTruncated, true);

  runtime.set("pane-1", {
    ...runtime.get("pane-1"),
    messageText: "Earlier useful answer",
    messageSource: "assistant-preview",
    messageAvailable: true,
    messageObservedAt: "2026-09-10T12:00:00.000Z",
  });
  client.readPane = async () => { throw new Error("read unavailable"); };
  const second = await refreshMessagePreviews({
    registry: [session], snapshot, runtime, client, now: new Date("2026-09-10T12:00:01Z"),
  });
  assert.match(second.errors[0], /pane-1: read unavailable/);
  assert.equal(runtime.get("pane-1").messageText, "Earlier useful answer");
  assert.equal(runtime.get("pane-1").messageStale, true);
  negativeControl("truncated and stale read metadata");
});

test("pane reads are concurrency bounded and limitations distinguish timeout from unsupported reads", async () => {
  const { refreshMessagePreviews } = await previewApi();
  const registry = [];
  const agents = [];
  for (let index = 0; index < 9; index += 1) {
    registry.push({ name: `preview-agent-${index}`, workspace: "workspace-1" });
    agents.push({
      agent: "codex",
      agent_session: {
        agent: "codex", kind: "id", source: "herdr:codex", value: `session-${index}`,
      },
      name: `preview-agent-${index}`,
      pane_id: `pane-${index}`,
      workspace_id: "workspace-1",
    });
  }
  const snapshot = {
    agents,
    workspaces: [{ workspace_id: "workspace-1", label: "workspace-1" }],
  };
  const runtime = new Map();
  let active = 0;
  let maximumActive = 0;
  await refreshMessagePreviews({
    registry,
    snapshot,
    runtime,
    client: {
      async readPane(paneId) {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await new Promise((resolve) => setImmediate(resolve));
        active -= 1;
        return {
          pane_id: paneId,
          source: "recent_unwrapped",
          format: "text",
          text: "• A bounded concurrent answer.",
          revision: 1,
          truncated: false,
        };
      },
    },
  });
  assert.equal(maximumActive, 4);
  assert.equal(runtime.size, 9);

  const failureRuntime = new Map();
  await refreshMessagePreviews({
    registry: registry.slice(0, 2),
    snapshot,
    runtime: failureRuntime,
    client: {
      async readPane(paneId) {
        if (paneId === "pane-0") throw new Error("Herdr request timed out: pane.read");
        throw new Error("Herdr method_not_found: pane.read is unsupported");
      },
    },
  });
  assert.match(failureRuntime.get("pane-0").messageLimitation, /timed out/iu);
  assert.match(failureRuntime.get("pane-1").messageLimitation, /unsupported/iu);
  assert.notEqual(
    failureRuntime.get("pane-0").messageLimitation,
    failureRuntime.get("pane-1").messageLimitation,
  );
  negativeControl("bounded pane read concurrency and limitations");
});

test("fallback occupant identity survives output revisions for stale retention", async () => {
  const { refreshMessagePreviews } = await previewApi();
  const session = { name: "preview-agent", workspace: "workspace-1" };
  const agent = {
    agent: "codex",
    name: "preview-agent",
    pane_id: "pane-1",
    revision: 1,
    workspace_id: "workspace-1",
  };
  const snapshot = {
    agents: [agent],
    workspaces: [{ workspace_id: "workspace-1", label: "workspace-1" }],
  };
  const runtime = new Map();
  await refreshMessagePreviews({
    registry: [session],
    snapshot,
    runtime,
    client: { async readPane() {
      return {
        pane_id: "pane-1",
        source: "recent_unwrapped",
        format: "text",
        text: "• Earlier useful answer.",
        revision: 1,
        truncated: false,
      };
    } },
  });
  agent.revision = 2;
  await refreshMessagePreviews({
    registry: [session],
    snapshot,
    runtime,
    client: { async readPane() { throw new Error("read unavailable"); } },
  });
  assert.equal(runtime.get("pane-1").messageText, "Earlier useful answer.");
  assert.equal(runtime.get("pane-1").messageStale, true);
  negativeControl("revision-independent fallback occupant identity");
});

test("a late pane read is discarded after the agent occupant changes", async () => {
  const { refreshMessagePreviews } = await previewApi();
  let finishRead;
  const readPending = new Promise((resolve) => { finishRead = resolve; });
  const session = { name: "preview-agent", workspace: "workspace-1" };
  const agent = {
    agent: "codex",
    agent_session: { agent: "codex", kind: "id", source: "herdr:codex", value: "old-session" },
    name: "preview-agent",
    pane_id: "pane-1",
    workspace_id: "workspace-1",
  };
  const snapshot = {
    agents: [agent],
    workspaces: [{ workspace_id: "workspace-1", label: "workspace-1" }],
  };
  const runtime = new Map();
  const reading = refreshMessagePreviews({
    registry: [session],
    snapshot,
    runtime,
    client: { readPane: () => readPending },
  });
  agent.agent_session = { agent: "codex", kind: "id", source: "herdr:codex", value: "replacement-session" };
  finishRead({
    pane_id: "pane-1",
    workspace_id: "workspace-1",
    tab_id: "tab-1",
    source: "recent_unwrapped",
    format: "text",
    text: "• This belongs to the previous occupant.",
    revision: 42,
    truncated: false,
  });
  const result = await reading;
  assert.deepEqual(result.errors, []);
  assert.equal(runtime.has("pane-1"), false);
  negativeControl("replaced pane occupant discard");
});
