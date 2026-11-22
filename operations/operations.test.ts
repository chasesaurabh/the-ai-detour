import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import {
  retryRead,
  RetryableReadError,
  checkProposal,
  acceptReport,
} from "./policies.ts";
import { verifyCandidates } from "./verification.ts";
import { Queue } from "./queue.ts";
test("independent probes reject convincing incomplete candidates and stale reports", () => {
  const r = verifyCandidates();
  assert.ok(r.staleRejected);
  assert.throws(() =>
    acceptReport("r", { revision: "r", passed: true, checks: [] }, ["offset"]),
  );
});
test("retry only typed transient reads; bounded attempts and cancellation", async () => {
  let tries = 0;
  const value = await retryRead(async () => {
    if (++tries < 3) throw new RetryableReadError("controlled 503");
    return 42;
  }, new AbortController().signal);
  assert.equal(tries, 3);
  assert.equal(value, 42);
  tries = 0;
  await assert.rejects(
    retryRead(async () => {
      tries++;
      throw Error("403 permanent");
    }, new AbortController().signal),
  );
  assert.equal(tries, 1);
  tries = 0;
  await assert.rejects(
    retryRead(async () => {
      tries++;
      throw new RetryableReadError("persistent 503");
    }, new AbortController().signal),
  );
  assert.equal(tries, 3);
  const stop = new AbortController();
  stop.abort();
  await assert.rejects(
    retryRead(async () => {
      throw Error("Must not run");
    }, stop.signal),
  );
});
test("approval covers exact action and candidate, and expires", () => {
  const proposal = { candidate: "sha-a", scope: "accept-diagnosis" },
    approval = { ...proposal, approved: true, expiresAt: 200 };
  assert.ok(checkProposal(proposal, approval, 100));
  assert.throws(() =>
    checkProposal({ ...proposal, candidate: "sha-b" }, approval, 100),
  );
  assert.throws(() =>
    checkProposal({ ...proposal, scope: "publish" }, approval, 100),
  );
  assert.throws(() => checkProposal(proposal, approval, 201));
  assert.throws(() =>
    checkProposal(proposal, { ...approval, approved: false }, 100),
  );
});
test("MongoDB queue deduplicates, atomically claims, fences old owner, cancels and exhausts", async () => {
  const client = await new MongoClient("mongodb://127.0.0.1:27128").connect();
  const ns = "test_" + randomUUID().replaceAll("-", "").slice(0, 20),
    q = new Queue(client, ns);
  try {
    const event = {
      id: "event1",
      kind: "issue",
      issue: "TRIAGE-42",
      dueAt: Date.now() - 1,
    };
    assert.equal(await q.enqueue(event), "inserted");
    assert.equal(await q.enqueue(event), "duplicate");
    await assert.rejects(q.enqueue({ ...event, issue: "different" }));
    await assert.rejects(q.enqueue({ ...event, dueAt: 2 }));
    const claims = await Promise.all([q.claim(), q.claim()]);
    assert.equal(claims.filter(Boolean).length, 1);
    const first = claims.find(Boolean)!;
    const second = await q.claim(Date.now() + 7000);
    assert.ok(second);
    assert.notEqual(first.owner, second.owner);
    assert.equal(await q.finish(first, {}), false);
    assert.equal(await q.finish(second, {}), true);
    await q.enqueue({ ...event, id: "cancel" });
    const cancelled = await q.claim();
    assert.ok(cancelled);
    await q.cancel("cancel");
    assert.equal(await q.finish(cancelled, {}), false);
    await q.enqueue({ ...event, id: "exhaust" });
    await q.claim();
    await q.claim(Date.now() + 7000);
    await q.claim(Date.now() + 14000);
    assert.equal(await q.deadExpired(Date.now() + 21000), 1);
    assert.equal(
      (await q.rows()).find((r) => r._id === "exhaust")?.status,
      "dead",
    );
  } finally {
    await client
      .db("ai_detour_ops")
      .collection("jobs_" + ns)
      .drop();
    await client.close();
  }
});
