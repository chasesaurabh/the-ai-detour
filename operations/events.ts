import { createServer } from "node:http";
import { MongoClient } from "mongodb";
import { Queue } from "./queue.ts";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";

export async function eventDemo(namespace: string, output: string) {
  const client = await new MongoClient("mongodb://127.0.0.1:27128").connect(),
    queue = new Queue(client, namespace),
    observations: unknown[] = [];
  const server = createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/events") {
      res.writeHead(404).end();
      return;
    }
    if (req.headers.authorization !== "Bearer synthetic-demo-only") {
      res.writeHead(401).end();
      return;
    }
    let text = "";
    try {
      for await (const chunk of req) {
        text += chunk;
        if (text.length > 4096) throw Error("Event too large");
      }
      const outcome = await queue.enqueue(JSON.parse(text));
      res
        .writeHead(202, { "content-type": "application/json" })
        .end(JSON.stringify({ outcome }));
    } catch {
      res.writeHead(400).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("Missing address");
  const url = `http://127.0.0.1:${address.port}/events`,
    event = {
      id: "issue_event",
      kind: "issue",
      issue: "TRIAGE-42",
      dueAt: Date.now(),
    };
  try {
    const denied = await fetch(url, {
      method: "POST",
      body: JSON.stringify(event),
    });
    assert.equal(denied.status, 401);
    observations.push({ kind: "unauthorized", status: denied.status });
    for (let delivery = 1; delivery <= 2; delivery++) {
      const response = await fetch(url, {
        method: "POST",
        headers: { authorization: "Bearer synthetic-demo-only" },
        body: JSON.stringify(event),
      });
      assert.equal(response.status, 202);
      observations.push({
        kind: "delivery",
        delivery,
        response: await response.json(),
        at: new Date().toISOString(),
      });
    }
    const started = Date.now();
    await new Promise<void>((resolve, reject) => {
      const timer = setInterval(() => {
        clearInterval(timer);
        const dueAt = Date.now();
        queue
          .enqueue({
            id: "schedule_slot_1",
            kind: "scheduled",
            issue: "TRIAGE-42",
            dueAt,
          })
          .then((outcome) => {
            observations.push({
              kind: "actual_timer",
              waitMs: Date.now() - started,
              outcome,
              dueAt,
            });
            resolve();
          }, reject);
      }, 1500);
    });
    writeFileSync(
      output,
      JSON.stringify(
        { namespace, observations, rows: await queue.rows() },
        null,
        2,
      ),
      { flag: "wx" },
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await client.close();
  }
}
if (process.argv[1]?.endsWith("events.ts")) {
  if (!process.argv[2] || !process.argv[3])
    throw Error("npm run events -- <new-namespace> <new-output.json>");
  await eventDemo(process.argv[2], process.argv[3]);
}
