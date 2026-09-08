import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import test from "node:test";

import { HerdrClient } from "../herdr-client.mjs";

function waitFor(predicate, timeoutMs = 1_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error("timed out waiting for condition"));
      }
    }, 5);
  });
}

class FakeSocket extends EventEmitter {
  constructor(server) {
    super();
    this.server = server;
    this.closed = false;
    queueMicrotask(() => this.emit("connect"));
  }

  setEncoding() {}

  setTimeout(ms, callback) {
    this.timeout = setTimeout(callback, ms);
  }

  write(chunk) {
    this.server(this, JSON.parse(chunk.trim()));
  }

  receive(message) {
    queueMicrotask(() => this.emit("data", `${JSON.stringify(message)}\n`));
  }

  end() {
    this.destroy();
  }

  destroy(error) {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timeout);
    if (error !== undefined) queueMicrotask(() => this.emit("error", error));
    queueMicrotask(() => this.emit("close"));
  }
}

function fakeServer(handler) {
  return () => new FakeSocket(handler);
}

test("snapshot preserves request ids and returns protocol state", async () => {
  const requests = [];
  const connect = fakeServer((socket, request) => {
    requests.push(request);
    socket.receive({
      id: request.id,
      result: {
        type: "session_snapshot",
        snapshot: { protocol: 20, version: "test", agents: [], panes: [], workspaces: [] },
      },
    });
  });

  const client = new HerdrClient({ socketPath: "fake.sock", requestTimeoutMs: 500, connect });
  const snapshot = await client.snapshot();
  assert.equal(snapshot.protocol, 20);
  assert.equal(requests[0].method, "session.snapshot");
  assert.match(requests[0].id, /^lane-board:/);
});

test("subscriptions emit events and reconnect with bounded backoff", async () => {
  const requests = [];
  let connection = 0;
  const connect = fakeServer((socket, request) => {
    requests.push(request);
    connection += 1;
    socket.receive({ id: request.id, result: { type: "subscription_started" } });
    socket.receive({
      event: "pane.agent_status_changed",
      data: { pane_id: "w1:p1", workspace_id: "w1", agent_status: connection === 1 ? "working" : "done" },
    });
    if (connection === 1) setTimeout(() => socket.destroy(), 5);
  });

  const client = new HerdrClient({ socketPath: "fake.sock", minBackoffMs: 5, maxBackoffMs: 20, connect });
  const statuses = [];
  client.on("event", (event) => statuses.push(event.data.agent_status));
  try {
    client.subscribe([{ type: "pane.agent_status_changed", pane_id: "w1:p1" }]);
    await waitFor(() => statuses.includes("done"));
    assert.deepEqual(statuses.slice(0, 2), ["working", "done"]);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].method, "events.subscribe");
    assert.notEqual(requests[0].id, requests[1].id);
    assert.deepEqual(requests[0].params.subscriptions, [
      { type: "pane.agent_status_changed", pane_id: "w1:p1" },
    ]);
  } finally {
    client.close();
  }
});

test("a subscription handshake is observable before streamed events", async () => {
  const connect = fakeServer((socket, request) => {
    socket.receive({ id: request.id, result: { type: "subscription_started" } });
  });
  const client = new HerdrClient({ socketPath: "fake.sock", connect });
  try {
    const ready = once(client, "ready");
    client.subscribe([{ type: "pane.scroll_changed", pane_id: "w1:p1" }]);
    await ready;
  } finally {
    client.close();
  }
});
