#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, render, useApp, useInput } from "ink";

import { repoRootFromArgs } from "./args.mjs";
import {
  applyHerdrEvent,
  buildSubscriptions,
  collectBoardState,
  footerLine,
  interactiveMessage,
  joinBoardRows,
  markSessionDone,
  tableLineEntries,
} from "./board.mjs";
import { HerdrClient } from "./herdr-client.mjs";

const h = React.createElement;

function BoardApp({ repoRoot, config }) {
  const { exit } = useApp();
  const clientRef = useRef();
  const mountedRef = useRef(false);
  const subscriptionSignature = useRef("");
  const runtimeRef = useRef(new Map());
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState("loading registry and Herdr snapshot…");
  const [state, setState] = useState({
    rows: [],
    sessions: [],
    snapshot: { agents: [], workspaces: [] },
    runtime: new Map(),
    gitStates: new Map(),
    reportStates: new Map(),
    stats: { load: 0, freeMemory: "-", workers: {} },
    connection: "connecting",
  });

  const installSubscriptions = useCallback((next) => {
    if (!mountedRef.current) return;
    const subscriptions = buildSubscriptions(next.sessions, next.snapshot);
    const signature = JSON.stringify(subscriptions);
    if (signature !== subscriptionSignature.current) {
      subscriptionSignature.current = signature;
      clientRef.current.subscribe(subscriptions);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await collectBoardState({
        repoRoot,
        config,
        client: clientRef.current,
        runtime: runtimeRef.current,
      });
      if (!mountedRef.current) return;
      next.gitStates = next.gitStates ?? new Map();
      next.reportStates = next.reportStates ?? new Map();
      setState(next);
      installSubscriptions(next);
      setSelected((current) => Math.min(current, Math.max(0, next.rows.length - 1)));
      setMessage("");
    } catch (error) {
      if (mountedRef.current) setMessage(error.message);
    }
  }, [config, installSubscriptions, repoRoot]);

  useEffect(() => {
    mountedRef.current = true;
    const client = new HerdrClient();
    clientRef.current = client;

    const onEvent = (event) => {
      setState((current) => {
        const snapshot = {
          ...current.snapshot,
          agents: current.snapshot.agents.map((agent) => ({ ...agent })),
        };
        const runtime = new Map(current.runtime);
        applyHerdrEvent(snapshot, runtime, current.sessions, event);
        runtimeRef.current = runtime;
        return {
          ...current,
          snapshot,
          runtime,
          rows: joinBoardRows({
            registry: current.sessions,
            snapshot,
            gitStates: current.gitStates,
            reportStates: current.reportStates,
            runtime,
          }),
        };
      });
    };
    const onReady = () => setMessage("");
    const onDisconnected = () => setMessage("Herdr stream disconnected; reconnecting…");
    const onConnectionError = (error) => setMessage(`Herdr: ${error.message}`);
    client.on("event", onEvent);
    client.on("ready", onReady);
    client.on("disconnected", onDisconnected);
    client.on("connectionError", onConnectionError);
    void refresh();
    const tick = setInterval(() => void refresh(), 5_000);
    return () => {
      mountedRef.current = false;
      clearInterval(tick);
      client.close();
    };
  }, []);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
      mountedRef.current = false;
      clientRef.current?.close();
      exit();
    } else if (input === "r") {
      void refresh();
    } else if (key.downArrow || input === "j") {
      setSelected((current) => Math.min(current + 1, Math.max(0, state.rows.length - 1)));
    } else if (key.upArrow || input === "k") {
      setSelected((current) => Math.max(0, current - 1));
    } else if (input === "a") {
      const row = state.rows[selected];
      setMessage(row?.pane === "-" ? "selected session is offline" : `attach: herdr agent attach ${row.name}`);
    } else if (input === "d") {
      const row = state.rows[selected];
      if (row === undefined) return;
      try {
        markSessionDone(state.path, row.name);
        setMessage(`marked ${row.name} done`);
        void refresh();
      } catch (error) {
        setMessage(error.message);
      }
    }
  });

  const lines = tableLineEntries(state.rows, { width: process.stdout.columns ?? 160 });
  return h(
    Box,
    { flexDirection: "column" },
    h(Text, { bold: true, color: "cyan" }, "lane board · ", state.connection),
    ...lines.map((line, index) => {
      const active = line.rowIndex === selected;
      const gateIndex = line.gateColor === undefined ? -1 : line.text.indexOf(line.gateText);
      const content = gateIndex < 0
        ? line.text
        : [
          line.text.slice(0, gateIndex),
          h(Text, { key: "gate", color: line.gateColor }, line.gateText),
          line.text.slice(gateIndex + line.gateText.length),
        ];
      return h(
        Text,
        { key: `${index}:${line.text}`, color: active ? "yellow" : undefined },
        active ? "> " : "  ",
        content,
      );
    }),
    h(Text, { dimColor: true }, footerLine(state.stats)),
    h(Text, null, interactiveMessage(state, message)),
  );
}

if (!process.stdin.isTTY) {
  process.stderr.write("lane board: interactive mode requires a TTY; use `lane board --once`\n");
  process.exit(1);
}

const args = process.argv.slice(2);
let repoRoot;
try {
  repoRoot = repoRootFromArgs(args);
} catch (error) {
  process.stderr.write(`lane board: ${error.message}\n`);
  process.exit(1);
}
const configPath = process.env.LANE_CONFIG ?? resolve(repoRoot, ".lane.json");
let config = {};
try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch {
  // Every lane configuration key is optional.
}

render(h(BoardApp, { repoRoot, config }));
