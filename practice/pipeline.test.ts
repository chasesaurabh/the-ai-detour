import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { pipeline, inventory } from "./pipeline.ts";
import { hash } from "./context.ts";
test("local candidate review binds identity, evidence, time and scope", async () => {
  const directory = mkdtempSync(join(tmpdir(), "detour-pipeline-test-")),
    workspace = join(directory, "workspace"),
    id = "test_" + randomUUID().replaceAll("-", "");
  mkdirSync(workspace);
  writeFileSync(join(workspace, "candidate.ts"), "export const answer = 42;\n");
  const report = { total: 8, passed: 8, results: [] },
    candidateHash = hash(inventory(workspace)),
    packet = { candidateHash, verificationHash: hash(report) };
  writeFileSync(join(directory, "independent.json"), JSON.stringify(report));
  writeFileSync(join(directory, "review-packet.json"), JSON.stringify(packet));
  const client = await new MongoClient("mongodb://127.0.0.1:27128", {
      serverSelectionTimeoutMS: 5000,
    }).connect(),
    jobs = client.db("ai_detour_pipeline").collection("jobs");
  const job = {
    _id: id,
    version: 1,
    directory,
    stage: "awaiting_review",
    candidateHash,
    packetHash: hash(packet),
    agentStarts: 1,
    history: [],
  };
  const decision = {
      approved: true,
      scope: "accept-local-candidate",
      candidateHash,
      packetHash: hash(packet),
      expiresAt: Date.now() + 3600000,
    },
    file = join(directory, "decision.json");
  const decide = async (value: unknown) => {
    writeFileSync(file, JSON.stringify(value));
    return pipeline("decision", id, file);
  };
  try {
    await jobs.insertOne(job as any);
    assert.equal((await pipeline("start", id, directory)).agentStarts, 1);
    await assert.rejects(
      pipeline("start", id, join(tmpdir(), "different-detour-directory")),
      /conflicts/,
    );
    await assert.rejects(
      decide({ ...decision, expiresAt: 0 }),
      /Decision does not/,
    );
    await assert.rejects(
      decide({ ...decision, scope: "deploy" }),
      /Decision does not/,
    );
    await assert.rejects(
      decide({ ...decision, packetHash: "wrong" }),
      /Decision does not/,
    );
    const source = readFileSync(join(workspace, "candidate.ts"));
    writeFileSync(join(workspace, "candidate.ts"), "changed");
    await assert.rejects(decide(decision), /Candidate changed/);
    writeFileSync(join(workspace, "candidate.ts"), source);
    writeFileSync(
      join(directory, "independent.json"),
      JSON.stringify({ ...report, passed: 0 }),
    );
    await assert.rejects(decide(decision), /Verification evidence changed/);
    writeFileSync(join(directory, "independent.json"), JSON.stringify(report));
    assert.equal(
      (await decide({ ...decision, approved: false })).stage,
      "rejected",
    );
    assert.equal((await pipeline("resume", id)).stage, "rejected");
  } finally {
    await jobs.deleteOne({ _id: id } as any);
    await client
      .db("ai_detour_pipeline")
      .collection("locks")
      .deleteOne({ _id: id } as any);
    await client.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("detour-pipeline-test-"));
    rmSync(directory, { recursive: true, force: true });
  }
});
