#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, render, useApp, useInput } from "ink";

import {
  applyHerdrEvent,
  buildSubscriptions,
  collectBoardState,
  footerLine,
  joinBoardRows,
  markSessionDone,
  tableLineEntries,
} from "./board.mjs";
import { HerdrClient } from "./herdr-client.mjs";

function BoardApp({ repoRoot, config }) {
  const { exit } = useApp();
  const clientRef = useRef();
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
      next.gitStates = next.gitStates ?? new Map();
      next.reportStates = next.reportStates ?? new Map();
      setState(next);
      installSubscriptions(next);
      setSelected((current) => Math.min(current, Math.max(0, next.rows.length - 1)));
      setMessage("");
    } catch (error) {
      setMessage(error.message);
    }
  }, [config, installSubscriptions, repoRoot]);

  useEffect(() => {
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
      clearInterval(tick);
      client.close();
    };
  }, []);

  useInput((input, key) => {
    if (input === "q" || key.escape) {
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
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">lane board · {state.connection}</Text>
      {lines.map((line, index) => {
        const active = line.rowIndex === selected;
        return <Text key={`${index}:${line.text}`} color={active ? "yellow" : undefined}>{active ? "> " : "  "}{line.text}</Text>;
      })}
      <Text dimColor>{footerLine(state.stats)}</Text>
      <Text>{message || "↑/↓ select · a attach command · d done · r refresh · q quit"}</Text>
    </Box>
  );
}

const args = process.argv.slice(2);
const repoIndex = args.indexOf("--repo");
const repoRoot = resolve(repoIndex >= 0 ? args[repoIndex + 1] : process.env.LANE_BOARD_REPO ?? process.cwd());
const configPath = process.env.LANE_CONFIG ?? resolve(repoRoot, ".lane.json");
let config = {};
try {
  config = JSON.parse(readFileSync(configPath, "utf8"));
} catch {
  // Every lane configuration key is optional.
}

render(<BoardApp repoRoot={repoRoot} config={config} />);
