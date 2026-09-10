const MAX_PANE_LINES = 200;
const MAX_PANE_BYTES = 16 * 1024;
const MAX_RAW_EXCERPT_CODE_POINTS = 500;
const SUPPORTED_AGENT_KINDS = new Set(["codex", "claude"]);

const ANSI_SEQUENCE = /\u001b(?:\][^\u0007]*(?:\u0007|\u001b\\)|\[[0-?]*[ -/]*[@-~]|[@-_])/gu;
const CONTROL_CHARACTER = /[\u0000-\u0008\u000b\u000c\u000e-\u001a\u001c-\u001f\u007f]/gu;
const DIVIDER = /^\s*[─━═╌╍┄┅┈┉-]{6,}\s*$/u;

function cleanPaneText(text) {
  return `${text ?? ""}`
    .replaceAll(ANSI_SEQUENCE, "")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .replaceAll(CONTROL_CHARACTER, "");
}

function trimBlock(lines) {
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop();
  return lines.join("\n").trimEnd();
}

function continuation(line) {
  return line.startsWith("  ") ? line.slice(2) : line;
}

function codexBoundary(line) {
  return /^\s*•\s+/u.test(line)
    || /^\s*›(?:\s|$)/u.test(line)
    || DIVIDER.test(line)
    || /^\s*(?:Working|Worked)\s+\([^)]*\)/u.test(line)
    || /^\s*[^\s]+(?:\s+[^·\n]+)?\s+·\s+.*(?:context left|\/[^\n]*)$/u.test(line);
}

function codexToolLabel(text) {
  return /^(?:Ran|Explored|Waited|Searched|Read|Listed|Viewed|Called|Edited|Added|Deleted|Updated|Applied|Opened|Found)\b/iu.test(text);
}

function claudeBoundary(line) {
  return /^\s*(?:⏺|●)\s+/u.test(line)
    || /^\s*(?:❯|›|>)\s*/u.test(line)
    || DIVIDER.test(line)
    || /^\s*(?:\?|⏵⏵)\s+/u.test(line)
    || /^\s*[✻✽✶✳·]\s+/u.test(line);
}

function claudeToolLabel(text) {
  return /^(?:Read|Write|Edit|Update|Bash|Glob|Grep|Search|Task|WebFetch|WebSearch|Skill|TodoWrite|AskUserQuestion|NotebookEdit|EnterPlanMode|ExitPlanMode|Save|Fetch|mcp__[^\s(]+)\b/iu.test(text);
}

function extractBlocks(lines, { start, isTool, boundary }) {
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(start);
    if (match === null || isTool(match[1])) continue;
    const block = [match[1].trimEnd()];
    for (index += 1; index < lines.length && !boundary(lines[index]); index += 1) {
      block.push(continuation(lines[index]).trimEnd());
    }
    index -= 1;
    const text = trimBlock(block);
    if (/\p{L}|\p{N}/u.test(text)) blocks.push(text);
  }
  return blocks;
}

function rawExcerpt(text) {
  const normalized = cleanPaneText(text).trim();
  if (normalized === "") return null;
  const codePoints = [...normalized];
  const bounded = codePoints.length > MAX_RAW_EXCERPT_CODE_POINTS
    ? `…${codePoints.slice(-(MAX_RAW_EXCERPT_CODE_POINTS - 1)).join("")}`
    : normalized;
  return { text: bounded, source: "pane-output" };
}

export function extractAssistantPreview({ kind, text }) {
  const cleaned = cleanPaneText(text);
  const lines = cleaned.split("\n");
  let blocks = [];
  if (kind === "codex") {
    blocks = extractBlocks(lines, {
      start: /^\s*•\s+(.+)$/u,
      isTool: codexToolLabel,
      boundary: codexBoundary,
    });
  } else if (kind === "claude") {
    blocks = extractBlocks(lines, {
      start: /^\s*(?:⏺|●)\s+(.+)$/u,
      isTool: claudeToolLabel,
      boundary: claudeBoundary,
    });
  }
  const assistantText = blocks.at(-1);
  if (assistantText !== undefined) {
    return {
      text: assistantText,
      source: "assistant-preview",
      available: true,
      rawExcerpt: null,
    };
  }
  return {
    text: null,
    source: "unavailable",
    available: false,
    rawExcerpt: rawExcerpt(cleaned),
  };
}

export function supportsMessagePreview(kind) {
  return SUPPORTED_AGENT_KINDS.has(kind);
}

function boundedUtf8Suffix(text, maximumBytes = MAX_PANE_BYTES) {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length <= maximumBytes) return { text, truncated: false };
  let start = bytes.length - maximumBytes;
  while (start < bytes.length && (bytes[start] & 0xc0) === 0x80) start += 1;
  return { text: bytes.subarray(start).toString("utf8"), truncated: true };
}

function workspaceFor(session, snapshot) {
  return snapshot?.workspaces?.find(
    (workspace) => workspace.workspace_id === session.workspace || workspace.label === session.workspace,
  );
}

function agentFor(session, snapshot) {
  const workspace = workspaceFor(session, snapshot);
  const agent = snapshot?.agents?.find((candidate) => candidate.name === session.name);
  return workspace === undefined || agent?.workspace_id === workspace.workspace_id ? agent : undefined;
}

export function messageOccupantId(agent) {
  const session = agent?.agent_session;
  if (typeof session?.agent === "string" && typeof session.kind === "string"
      && typeof session.source === "string" && typeof session.value === "string") {
    return JSON.stringify([session.agent, session.kind, session.source, session.value]);
  }
  if (typeof agent?.name === "string" && typeof agent?.agent === "string") {
    return JSON.stringify([agent.agent, agent.name, agent.pane_id, agent.revision ?? null]);
  }
  return null;
}

function currentAgentForPane(snapshot, paneId) {
  return snapshot?.agents?.find((agent) => agent.pane_id === paneId);
}

function unavailableRuntime({ kind, occupant, limitation }) {
  return {
    occupantId: occupant,
    messageText: null,
    messageSource: "unavailable",
    messageKind: kind,
    messageObservedAt: null,
    messageRevision: null,
    messageTruncated: false,
    messageStale: false,
    messageAvailable: false,
    messageRawExcerpt: null,
    messageLimitation: limitation,
  };
}

export async function refreshMessagePreviews({
  registry,
  snapshot,
  runtime,
  client,
  paneIds,
  now = new Date(),
  currentSnapshot = () => snapshot,
}) {
  const selected = paneIds === undefined ? undefined : new Set(paneIds);
  const targets = new Map();
  for (const session of registry) {
    const agent = agentFor(session, snapshot);
    if (!supportsMessagePreview(agent?.agent) || typeof agent.pane_id !== "string") continue;
    if (selected !== undefined && !selected.has(agent.pane_id)) continue;
    const occupant = messageOccupantId(agent);
    if (occupant === null) continue;
    targets.set(agent.pane_id, { kind: agent.agent, occupant });
  }

  const errors = [];
  let updated = 0;
  await Promise.all([...targets].map(async ([paneId, target]) => {
    const previous = runtime.get(paneId);
    try {
      const read = await client.readPane(paneId, {
        lines: MAX_PANE_LINES,
        source: "recent_unwrapped",
      });
      if (read?.pane_id !== paneId || read.source !== "recent_unwrapped" || read.format !== "text") {
        throw new Error("unexpected Herdr pane read response");
      }
      const currentAgent = currentAgentForPane(currentSnapshot(), paneId);
      if (messageOccupantId(currentAgent) !== target.occupant) return;
      const bounded = boundedUtf8Suffix(cleanPaneText(read.text));
      const preview = extractAssistantPreview({ kind: target.kind, text: bounded.text });
      const truncated = read.truncated === true || bounded.truncated;
      runtime.set(paneId, {
        ...(previous ?? {}),
        occupantId: target.occupant,
        messageText: preview.text,
        messageSource: preview.source,
        messageKind: target.kind,
        messageObservedAt: now.toISOString(),
        messageRevision: Number.isInteger(read.revision) ? read.revision : null,
        messageTruncated: truncated,
        messageStale: false,
        messageAvailable: preview.available,
        messageRawExcerpt: preview.rawExcerpt,
        messageLimitation: truncated && !preview.available
          ? "pane output was truncated and contained no confidently bounded assistant message"
          : null,
      });
      updated += 1;
    } catch (error) {
      errors.push(`${paneId}: ${error.message}`);
      const currentAgent = currentAgentForPane(currentSnapshot(), paneId);
      if (messageOccupantId(currentAgent) !== target.occupant) return;
      if (previous?.occupantId === target.occupant) {
        runtime.set(paneId, {
          ...previous,
          messageStale: true,
          messageLimitation: "pane output read failed; retaining the previous preview",
        });
      } else {
        runtime.set(paneId, unavailableRuntime({
          kind: target.kind,
          occupant: target.occupant,
          limitation: "pane output read failed",
        }));
      }
      updated += 1;
    }
  }));
  return { errors, updated };
}

export const MESSAGE_PREVIEW_LIMITS = {
  lines: MAX_PANE_LINES,
  bytes: MAX_PANE_BYTES,
  rawExcerptCodePoints: MAX_RAW_EXCERPT_CODE_POINTS,
};
