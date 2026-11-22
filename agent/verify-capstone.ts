import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { writeFileSync, openSync, closeSync } from "node:fs";
const [candidate, output] = process.argv.slice(2);
if (!candidate || !output)
  throw Error("npm run capstone:verify -- <built-candidate> <new-report.json>");
closeSync(openSync(output, "wx"));
const client = await new MongoClient("mongodb://127.0.0.1:27128", {
    serverSelectionTimeoutMS: 5000,
  }).connect(),
  database = "detour_capstone_" + randomUUID().replaceAll("-", "");
const collection = client.db(database).collection("tickets");
await collection.insertMany([
  {
    title: "PRIVATE_CANARY_A",
    status: "open",
    priority: 1,
    dueAt: "2026-11-21T15:00:00+02:00",
  },
  {
    title: "PRIVATE_CANARY_B",
    status: "open",
    priority: 2,
    dueAt: "2026-11-21T09:00:00-05:00",
  },
  {
    title: "PRIVATE_CANARY_C",
    status: "open",
    priority: 3,
    dueAt: "2026-11-21T09:30:00-05:00",
  },
  { title: "PRIVATE_CANARY_D", status: "open", priority: 1, dueAt: null },
  {
    title: "PRIVATE_CANARY_E",
    status: "closed",
    priority: 2,
    dueAt: "2026-11-20T14:00:00Z",
  },
]);
const before = await collection.find({}).sort({ _id: 1 }).toArray(),
  results: { name: string; passed: boolean; error?: string }[] = [];
const child = spawn(
  process.execPath,
  [
    join(resolve(candidate), "dist/src/server.js"),
    "--db",
    database,
    "--port",
    "0",
  ],
  { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
);
let stderr = "";
child.stderr.on("data", (chunk) => (stderr += chunk));
try {
  const port = await new Promise<number>((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(
      () => reject(Error("Server startup timeout: " + stderr)),
      10000,
    );
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const line = buffer.split("\n")[0];
      try {
        const data = JSON.parse(line);
        if (Number.isInteger(data.port) && data.port > 0) {
          clearTimeout(timer);
          resolve(data.port);
        }
      } catch {}
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error("Server exited " + code + ": " + stderr));
    });
  });
  const base = `http://127.0.0.1:${port}`;
  async function check(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error: String(error) });
    }
  }
  const get = (suffix: string, method = "GET") =>
    fetch(base + suffix, { method, signal: AbortSignal.timeout(5000) });
  await check(
    "offset-aware counts exclude equality, closed deadlines and null dates",
    async () => {
      const response = await get("/api/summary?asOf=2026-11-21T14%3A00%3A00Z");
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        open: 4,
        closed: 1,
        overdue: 1,
        byPriority: { "1": 2, "2": 1, "3": 1 },
      });
    },
  );
  await check(
    "equivalent positive-offset evaluation produces identical counts",
    async () => {
      const response = await get(
        "/api/summary?asOf=2026-11-21T15%3A00%3A00%2B01%3A00",
      );
      assert.equal((await response.json()).overdue, 1);
    },
  );
  await check(
    "missing, repeated, unknown, naive and invalid dates rejected",
    async () => {
      for (const query of [
        "",
        "?asOf=x",
        "?asOf=2026-11-21T14:00:00",
        "?asOf=2026-02-30T14:00:00Z",
        "?asOf=2026-11-21T14:00:00Z&asOf=2026-11-21T14:00:00Z",
        "?asOf=2026-11-21T14:00:00Z&extra=yes",
      ]) {
        const r = await get("/api/summary" + query);
        assert.equal(r.status, 400, query);
        const b = await r.json();
        assert.equal(typeof b.error, "string");
        assert.ok(!("stack" in b));
      }
    },
  );
  await check("method and route boundaries", async () => {
    assert.equal((await get("/api/summary", "POST")).status, 405);
    assert.equal((await get("/", "DELETE")).status, 405);
    assert.equal((await get("/unknown")).status, 404);
  });
  await check("response omits raw ticket data", async () => {
    const text = await (
      await get("/api/summary?asOf=2026-11-21T14:00:00Z")
    ).text();
    assert.ok(!text.includes("PRIVATE_CANARY"));
    assert.ok(!text.includes("dueAt"));
    assert.ok(!text.includes("_id"));
  });
  await check("UI semantic selectors and design labels", async () => {
    const r = await get("/");
    assert.equal(r.status, 200);
    const html = await r.text();
    for (const id of [
      "as-of",
      "refresh",
      "open-count",
      "overdue-count",
      "closed-count",
      "priority-1",
      "priority-2",
      "priority-3",
      "error",
    ])
      assert.match(html, new RegExp('id=["\x27]' + id + '["\x27]'));
    assert.match(html, /Queue overview/);
    assert.ok(!html.includes("PRIVATE_CANARY"));
  });
  await check("all reads preserve records", async () =>
    assert.deepEqual(
      await collection.find({}).sort({ _id: 1 }).toArray(),
      before,
    ),
  );
  await check(
    "empty dataset returns zeros with input validation retained",
    async () => {
      await collection.deleteMany({});
      const r = await get("/api/summary?asOf=2026-11-21T14:00:00Z");
      assert.deepEqual(await r.json(), {
        open: 0,
        closed: 0,
        overdue: 0,
        byPriority: { "1": 0, "2": 0, "3": 0 },
      });
      assert.equal((await get("/api/summary?asOf=bad")).status, 400);
    },
  );
} catch (error) {
  results.push({
    name: "verifier setup or execution",
    passed: false,
    error: String(error),
  });
} finally {
  if (child.exitCode === null && child.signalCode === null) {
    const closed = new Promise<void>((resolve) =>
      child.once("close", () => resolve()),
    );
    child.kill();
    await closed;
  }
  await client.db(database).dropDatabase();
  await client.close();
  writeFileSync(
    output,
    JSON.stringify(
      {
        results,
        passed: results.filter((r) => r.passed).length,
        total: results.length,
        scope:
          "Independent API/markup contract checks; browser behavior and visual layout checked separately",
      },
      null,
      2,
    ),
  );
}
console.log(JSON.stringify(results));
if (results.some((r) => !r.passed)) process.exitCode = 1;
