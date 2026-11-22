import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { MongoClient } from "mongodb";
import { pipeline, inventory } from "./pipeline.ts";
import { hash } from "./context.ts";
import {
  validateExecutionPermit,
  prepareExecutionPermit,
} from "./execution-permit.ts";

test("local execution permit rejects wrong identity, scope, expiry and malformed fields", () => {
  const valid = {
    version: 1,
    approved: true,
    scope: "execute-local-candidate-checks",
    job: "permit_fixture",
    candidateHash: "candidate-a",
    expiresAt: 2000,
  };
  assert.equal(
    validateExecutionPermit(valid, "permit_fixture", "candidate-a", 1000).job,
    "permit_fixture",
  );
  for (const change of [
    { version: 2 },
    { approved: false },
    { scope: "accept-local-candidate" },
    { job: "other_job" },
    { candidateHash: "candidate-b" },
    { expiresAt: 1000 },
    { expiresAt: Infinity },
    { expiresAt: "2000" },
    { extra: true },
  ])
    assert.throws(() =>
      validateExecutionPermit(
        { ...valid, ...change },
        "permit_fixture",
        "candidate-a",
        1000,
      ),
    );
  for (const invalid of [null, [], "yes"])
    assert.throws(() =>
      validateExecutionPermit(invalid, "permit_fixture", "candidate-a", 1000),
    );
});

test("saved candidate cannot execute host checks before an exact local execution permit", async () => {
  const directory = mkdtempSync(join(tmpdir(), "detour-execution-test-"));
  const workspace = join(directory, "workspace");
  mkdirSync(workspace);
  // Deliberately controlled failing command: proves entry into host execution
  // without launching a model or pretending to verify the capstone contract.
  writeFileSync(
    join(workspace, "package.json"),
    JSON.stringify({
      name: "synthetic-permit-test",
      version: "1.0.0",
      private: true,
      scripts: {
        test: "node -e \"require('node:fs').writeFileSync('execution-marker.txt','executed');process.exit(23)\"",
      },
    }),
  );
  writeFileSync(
    join(workspace, "package-lock.json"),
    '{"lockfileVersion":3}\n',
  );
  const id = "permit_" + randomUUID().replaceAll("-", "");
  const candidateHash = hash(inventory(workspace));
  const job = {
    _id: id,
    version: 1,
    directory,
    stage: "candidate_ready",
    candidateHash,
    agentStarts: 1,
    history: [{ stage: "candidate_ready", at: new Date().toISOString() }],
  };
  writeFileSync(join(directory, "state.json"), JSON.stringify(job));
  const client = await new MongoClient("mongodb://127.0.0.1:27128", {
    serverSelectionTimeoutMS: 5000,
  }).connect();
  const jobs = client.db("ai_detour_pipeline").collection("jobs");
  const file = join(directory, "execution-permit.json");
  const marker = join(workspace, "execution-marker.txt");
  try {
    await jobs.insertOne(job as any);
    assert.equal(
      (await pipeline("start", id, directory)).stage,
      "candidate_ready",
    );
    assert.equal((await pipeline("resume", id)).stage, "candidate_ready");
    assert.equal(existsSync(marker), false);
    const valid = prepareExecutionPermit(directory, file);
    assert.throws(() => prepareExecutionPermit(directory, file), /EEXIST/);
    for (const change of [
      { expiresAt: 0 },
      { scope: "accept-local-candidate" },
      { candidateHash: "different" },
      { job: "different" },
    ]) {
      writeFileSync(file, JSON.stringify({ ...valid, ...change }));
      await assert.rejects(pipeline("resume", id, file), /Execution permit/);
      assert.equal(
        (await jobs.findOne({ _id: id } as any))!.stage,
        "candidate_ready",
      );
      assert.equal(existsSync(marker), false);
    }
    const lockPath = join(workspace, "package-lock.json");
    const originalLock = readFileSync(lockPath);
    writeFileSync(lockPath, '{"lockfileVersion":2}\n');
    writeFileSync(file, JSON.stringify(valid));
    await assert.rejects(pipeline("resume", id, file), /Candidate changed/);
    assert.throws(
      () =>
        prepareExecutionPermit(directory, join(directory, "stale-permit.json")),
      /Candidate changed/,
    );
    assert.equal(existsSync(marker), false);
    writeFileSync(lockPath, originalLock);
    // A matching permit permits execution. Our known command fails on purpose,
    // so the durable path must record verifying -> failed, never acceptance.
    await assert.rejects(pipeline("resume", id, file), /final-tests failed/);
    assert.equal(readFileSync(marker, "utf8"), "executed");
    const saved = (await jobs.findOne({ _id: id } as any))!;
    assert.equal(saved.stage, "failed");
    assert.deepEqual(
      saved.history.map((h: any) => h.stage),
      ["candidate_ready", "verifying", "failed"],
    );
    assert.equal(saved.executionPermitHash, hash(valid));
    assert.equal(saved.agentStarts, 1);
  } finally {
    await jobs.deleteOne({ _id: id } as any);
    await client
      .db("ai_detour_pipeline")
      .collection("locks")
      .deleteOne({ _id: id } as any);
    await client.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("detour-execution-test-"));
    rmSync(directory, { recursive: true, force: true });
  }
});
