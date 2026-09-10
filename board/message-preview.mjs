const MAX_PANE_LINES = 200;
const MAX_PANE_BYTES = 16 * 1024;
const MAX_RAW_EXCERPT_CODE_POINTS = 500;
const MAX_CONCURRENT_PANE_READS = 4;
const SUPPORTED_AGENT_KINDS = new Set(["codex", "claude"]);

const ANSI_SEQUENCE = /\u001b(?:\][^\u0007]*(?:\u0007|\u001b\\)|\[[0-?]*[ -/]*[@-~]|[@-_])/gu;
const CONTROL_CHARACTER = /[\u0000-\u0008\u000b\u000c\u000e-\u001a\u001c-\u001f\u007f]/gu;
const HORIZONTAL_DIVIDER = /^\s*[─━═╌╍┄┅┈┉-]{6,}\s*$/u;
const FRAME_LINE = /^\s*[╭╮╰╯┌┐└┘│┃─━═╌╍┄┅┈┉ ]+\s*$/u;
const FRAME_CHARACTER = /[╭╮╰╯┌┐└┘│┃─━═╌╍┄┅┈┉]/u;
const SHORTCUT_BAR = /^\s*(?:\?|esc\b|ctrl-[a-z]\b).*(?:shortcut|interrupt|toggle|submit|edit)/iu;
const CONTEXT_BAR = /^\s*(?:[\d,.]+%?\s+)?context left(?:\s|$)/iu;
const TOKEN_OR_COST_BAR = /^\s*(?:[\d,.]+[km]?\s+)?tokens?\b.*(?:\$|cost|used)/iu;
const INTERRUPT_AFFORDANCE = /\besc(?:ape)? to interrupt\b/iu;
const PROGRESS_PREFIX = /^\s*(?:[✻✽✶✳·]\s+)?(?:Working|Worked|Thinking|Running)\b/iu;
const ELAPSED_TIME = /(?:\b\d+(?:[.,]\d+)?\s*(?:ms|s|m|h|secs?|seconds?|mins?|minutes?|hours?)\b|\b\d{1,2}:\d{2}(?::\d{2})?\b)/iu;
const APPROVAL_PROMPT = /^\s*(?:Would you like to run|Do you want to (?:run|allow|approve)|Allow Codex to)\b/iu;
const RESULT_MARKER = /^\s{2,}(?:└|⎿|├)(?:\s+|$)/u;

function statusChrome(line) {
  return INTERRUPT_AFFORDANCE.test(line)
    || (PROGRESS_PREFIX.test(line) && ELAPSED_TIME.test(line));
}

function divider(line) {
  return HORIZONTAL_DIVIDER.test(line)
    || (FRAME_LINE.test(line) && FRAME_CHARACTER.test(line));
}

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
  return /^•\s+/u.test(line)
    || /^›(?:\s|$)/u.test(line)
    || divider(line)
    || RESULT_MARKER.test(line)
    || statusChrome(line)
    || SHORTCUT_BAR.test(line)
    || CONTEXT_BAR.test(line)
    || TOKEN_OR_COST_BAR.test(line)
    || APPROVAL_PROMPT.test(line)
    || /^\s*[^\s]+(?:\s+[^·\n]+)?\s+·\s+.*(?:context left|\/[^\n]*)$/u.test(line);
}

function codexToolLabel(text) {
  return /^(?:Ran|Explored|Waited|Searched|Read|Listed|Viewed|Called|Edited|Added|Deleted|Updated|Applied|Opened|Found)\b/iu.test(text);
}

function claudeBoundary(line) {
  return /^(?:⏺|●)\s+/u.test(line)
    || /^(?:❯|›|>)\s*/u.test(line)
    || divider(line)
    || /^\s*(?:\?|⏵⏵)\s+/u.test(line)
    || /^\s*[✻✽✶✳·]\s+/u.test(line)
    || RESULT_MARKER.test(line)
    || statusChrome(line)
    || SHORTCUT_BAR.test(line)
    || CONTEXT_BAR.test(line)
    || TOKEN_OR_COST_BAR.test(line);
}

function claudeToolLabel(text) {
  return /^(?:Read|Write|Edit|Update|Bash|Glob|Grep|Search|Task|WebFetch|WebSearch|Skill|TodoWrite|AskUserQuestion|NotebookEdit|EnterPlanMode|ExitPlanMode|Save|Fetch|mcp__[^\s(]+)\b/iu.test(text);
}

function hasToolEvidence(lines, index, text, toolLabel) {
  if (RESULT_MARKER.test(lines[index + 1] ?? "")) return true;
  return toolLabel(text) && /^[^\s(\n]+\([^\n)]*\)\s*$/u.test(text);
}

function plausibleContinuation(line) {
  return line.trim() === "" || /^\s{2,}\S/u.test(line);
}

function sentenceShaped(text) {
  const flattened = text.replace(/\s+/gu, " ").trim();
  const words = flattened.match(/\p{L}+/gu) ?? [];
  return words.length >= 3 && /[.!?…]["'”’)}\]]*$/u.test(flattened);
}

function extractBlocks(lines, { start, toolLabel, boundary }) {
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(start);
    if (match === null || boundary(match[1]) || hasToolEvidence(lines, index, match[1], toolLabel)) continue;
    const block = [match[1].trimEnd()];
    for (index += 1;
      index < lines.length && !boundary(lines[index]) && plausibleContinuation(lines[index]);
      index += 1) {
      block.push(continuation(lines[index]).trimEnd());
    }
    index -= 1;
    const text = trimBlock(block);
    if (toolLabel(match[1]) && !sentenceShaped(text)) continue;
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
      start: /^•\s+(.+)$/u,
      toolLabel: codexToolLabel,
      boundary: codexBoundary,
    });
  } else if (kind === "claude") {
    blocks = extractBlocks(lines, {
      start: /^(?:⏺|●)\s+(.+)$/u,
      toolLabel: claudeToolLabel,
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
    return JSON.stringify([agent.agent, agent.name, agent.pane_id]);
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

function readFailureLimitation(error, retained) {
  const message = `${error?.message ?? error}`;
  let limitation = "pane output read failed";
  if (/timed out/iu.test(message)) limitation = "pane output read timed out";
  else if (/(?:unsupported|method[_ -]?not[_ -]?found|unknown method|not implemented)/iu.test(message)) {
    limitation = "pane output read is unsupported";
  }
  return retained ? `${limitation}; retaining the previous preview` : limitation;
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
  const entries = [...targets];
  let nextEntry = 0;
  const refreshNext = async () => {
    while (nextEntry < entries.length) {
      const entry = entries[nextEntry];
      nextEntry += 1;
      const [paneId, target] = entry;
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
        if (messageOccupantId(currentAgent) !== target.occupant) continue;
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
        if (messageOccupantId(currentAgent) !== target.occupant) continue;
        if (previous?.occupantId === target.occupant) {
          runtime.set(paneId, {
            ...previous,
            messageStale: true,
            messageLimitation: readFailureLimitation(error, true),
          });
        } else {
          runtime.set(paneId, unavailableRuntime({
            kind: target.kind,
            occupant: target.occupant,
            limitation: readFailureLimitation(error, false),
          }));
        }
        updated += 1;
      }
    }
  };
  await Promise.all(Array.from(
    { length: Math.min(MAX_CONCURRENT_PANE_READS, entries.length) },
    () => refreshNext(),
  ));
  return { errors, updated };
}

export const MESSAGE_PREVIEW_LIMITS = {
  lines: MAX_PANE_LINES,
  bytes: MAX_PANE_BYTES,
  rawExcerptCodePoints: MAX_RAW_EXCERPT_CODE_POINTS,
  concurrentReads: MAX_CONCURRENT_PANE_READS,
};
