import { test } from "node:test";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import { randomUUID } from "node:crypto";
import { graphSession } from "./graph.ts";
import { initial, advance } from "../workflow/engine.ts";
import { executeTool } from "../workflow/tools.ts";
import { digest } from "./policies.ts";
test("graph reuses completed journal steps and preserves explicit rejection", async () => {
  const thread = "journal_" + randomUUID().replaceAll("-", ""),
    client = await new MongoClient("mongodb://127.0.0.1:27128").connect(),
    db = client.db("ai_detour_ops");
  try {
    const actions = [
      ...["issue", "contract", "implementation"].map((key) => ({
        action: "tool",
        name: "read_context",
        args: { key },
      })),
      ...["offsets", "boundary"].map((scenario) => ({
        action: "tool",
        name: "run_probe",
        args: { scenario },
      })),
      {
        action: "finish",
        diagnosis:
          "Fixture conclusion: lexical comparison fails across offsets.",
        evidence: [
          "issue",
          "contract",
          "implementation",
          "probe-offsets",
          "probe-boundary",
        ],
        next_step: "Review a correction and run independent tests.",
      },
    ];
    const state = initial("detour-qwen3-4b");
    for (let i = 0; i < 6; i++) {
      await advance(
        state,
        async () => JSON.stringify(actions[i]),
        async (n, a) => executeTool(n, a),
        () => {},
        1,
      );
      await db
        .collection("graph_requests")
        .insertOne({
          _id: `${thread}:${i + 1}` as any,
          phase: "completed",
          result: structuredClone(state),
        });
    }
    const started = await graphSession(thread, "start");
    assert.deepEqual(started.next, ["review_gate"]);
    assert.equal(started.requests, 6);
    const resumed = await graphSession(thread, "resume", {
      approved: false,
      candidate: digest(state.final),
      scope: "accept-diagnosis",
      expiresAt: Date.now() + 60000,
    });
    assert.deepEqual(resumed.next, []);
    assert.equal((resumed as any).result.review, "rejected");
    assert.equal(resumed.requests, 6);
    await assert.rejects(
      graphSession(thread, "resume", {
        approved: true,
        candidate: digest(state.final),
        scope: "accept-diagnosis",
        expiresAt: Date.now() + 60000,
      }),
    );
  } finally {
    for (const name of ["checkpoints", "checkpoint_writes"])
      await db.collection(name).deleteMany({ thread_id: thread });
    await db
      .collection("graph_requests")
      .deleteMany({ _id: { $regex: `^${thread}:` } as any });
    await client.close();
  }
});
test("reserved uncertain step stops without issuing another model request", async () => {
  const thread = "uncertain_" + randomUUID().replaceAll("-", ""),
    client = await new MongoClient("mongodb://127.0.0.1:27128").connect(),
    db = client.db("ai_detour_ops");
  try {
    await db
      .collection("graph_requests")
      .insertOne({ _id: `${thread}:1` as any, phase: "reserved" });
    await assert.rejects(
      graphSession(thread, "start"),
      /Uncertain model request/,
    );
    assert.equal(
      await db
        .collection("graph_requests")
        .countDocuments({ _id: { $regex: `^${thread}:` } as any }),
      1,
    );
  } finally {
    for (const name of ["checkpoints", "checkpoint_writes"])
      await db.collection(name).deleteMany({ thread_id: thread });
    await db
      .collection("graph_requests")
      .deleteMany({ _id: { $regex: `^${thread}:` } as any });
    await client.close();
  }
});
