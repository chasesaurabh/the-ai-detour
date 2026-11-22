import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  selectContext,
  resolveRequirement,
  detectRepeatedAction,
  type Source,
} from "./context.ts";
import { sign, verifyEnvelope } from "./intake.ts";
import { retryRead, RetryableReadError } from "../operations/policies.ts";
test("context budget includes the empty JSON array overhead", () => {
  assert.throws(() => selectContext([], 1, 1000), /Invalid byte budget/);
  const empty = selectContext([], 2, 1000);
  assert.equal(empty.bytes, 2);
  assert.equal(empty.bytes, Buffer.byteLength(JSON.stringify(empty.selected)));
  const optional: Source = { id: "optional", version: "1", authority: "discussion", text: "x", required: false, priority: 1, retrievedAt: 1000, maxAgeMs: 1000 };
  const omitted = selectContext([optional], 2, 1000);
  assert.equal(omitted.bytes, 2);
  assert.deepEqual(omitted.omitted, ["optional"]);
});
test("context retains mandatory evidence, records omissions, and rejects stale/duplicate sources", () => {
  const now = 100000,
    base = {
      version: "1",
      authority: "requirement" as const,
      retrievedAt: now,
      maxAgeMs: 1000,
      priority: 1,
    };
  const sources: Source[] = [
    { ...base, id: "issue", text: "Strict instant comparison", required: true },
    { ...base, id: "discussion", text: "x".repeat(500), required: false },
  ];
  const plan = selectContext(sources, 350, now);
  assert.deepEqual(
    plan.selected.map((s) => s.id),
    ["issue"],
  );
  assert.deepEqual(plan.omitted, ["discussion"]);
  assert.equal(plan.bytes, Buffer.byteLength(JSON.stringify(plan.selected)));
  assert.throws(() => selectContext(sources, 30, now), /Required/);
  assert.throws(() => selectContext(sources, 2000, now + 1001), /Stale/);
  assert.throws(
    () => selectContext([sources[0], sources[0]], 2000, now),
    /Duplicate/,
  );
});
test("context conflicts require a decision; equal repeats distinguish changed source versions", () => {
  assert.equal(
    resolveRequirement([
      { source: "issue", value: "strict", rank: 2 },
      { source: "design", value: "inclusive", rank: 2 },
    ]).status,
    "needs_decision",
  );
  assert.equal(
    resolveRequirement([
      { source: "issue", value: "strict", rank: 2 },
      { source: "comment", value: "inclusive", rank: 1 },
    ]).value,
    "strict",
  );
  const a = { tool: "probe", args: { id: "boundary" }, sourceVersion: "1" };
  assert.equal(detectRepeatedAction([a, a], a), true);
  assert.equal(
    detectRepeatedAction([a, a], { ...a, sourceVersion: "2" }),
    false,
  );
});
test("signed intake checks exact bytes, age, schema and selected object", () => {
  const now = 1800000000000,
    key = "public-local-fixture-key",
    body = Buffer.from(
      JSON.stringify({ id: "evt_demo", issue: "TRIAGE-42", version: 1 }),
    ),
    sig = sign(body, now, key);
  assert.equal(verifyEnvelope(body, String(now), sig, key, now).version, 1);
  assert.throws(
    () =>
      verifyEnvelope(
        Buffer.concat([body, Buffer.from(" ")]),
        String(now),
        sig,
        key,
        now,
      ),
    /Signature/,
  );
  assert.throws(
    () => verifyEnvelope(body, String(now), sig, key, now + 60001),
    /freshness/,
  );
  const extra = Buffer.from(
    JSON.stringify({ id: "evt_demo", issue: "TRIAGE-99", version: 1 }),
  );
  assert.throws(
    () => verifyEnvelope(extra, String(now), sign(extra, now, key), key, now),
    /selected/,
  );
});
test("actual local HTTP retries two 503s, refuses retry on 401, and respects cancellation", async () => {
  let transient = 0,
    denied = 0;
  const server = createServer((req, res) => {
    if (req.url === "/transient") {
      transient++;
      res
        .writeHead(transient < 3 ? 503 : 200)
        .end(transient < 3 ? "busy" : "ready");
    } else {
      denied++;
      res.writeHead(401).end("denied");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  if (!address || typeof address === "string") throw Error("No port");
  const base = "http://127.0.0.1:" + address.port;
  async function read(route: string, signal: AbortSignal) {
    const r = await fetch(base + route, { signal });
    if (r.status === 503) throw new RetryableReadError("503");
    if (!r.ok) throw Error("HTTP " + r.status);
    return r.text();
  }
  try {
    const signal = AbortSignal.timeout(5000);
    assert.equal(
      await retryRead(() => read("/transient", signal), signal),
      "ready",
    );
    assert.equal(transient, 3);
    await assert.rejects(
      retryRead(() => read("/denied", signal), signal),
      /401/,
    );
    assert.equal(denied, 1);
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(
      retryRead(() => read("/denied", cancelled.signal), cancelled.signal),
    );
    assert.equal(denied, 1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
