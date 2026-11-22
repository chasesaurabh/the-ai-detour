import { MongoClient } from "mongodb";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
// Deliberately public LOCAL demo credentials, never for a deployed service.
const admin = new MongoClient(
  "mongodb://demo_admin:local_synthetic_only@127.0.0.1:27129/admin",
  { serverSelectionTimeoutMS: 5000 },
);
const reader = new MongoClient(
  "mongodb://diagnosis_reader:local_read_only@127.0.0.1:27129/triage_public",
  { serverSelectionTimeoutMS: 5000 },
);
export async function permissionProbe() {
  await admin.connect();
  try {
    const db = admin.db("triage_public");
    try {
      await db.command({
        createUser: "diagnosis_reader",
        pwd: "local_read_only",
        roles: [{ role: "read", db: "triage_public" }],
      });
    } catch (error: any) {
      if (error.code !== 51003) throw error;
    }
    await db
      .collection("tickets")
      .updateOne(
        { _id: "TRIAGE-42" as any },
        { $set: { status: "open", title: "Synthetic deadline incident" } },
        { upsert: true },
      );
    await admin
      .db("triage_private")
      .collection("canary")
      .updateOne(
        { _id: "private" as any },
        { $set: { value: "SYNTHETIC_NOT_FOR_READER" } },
        { upsert: true },
      );
    await reader.connect();
    const rows = await reader
      .db("triage_public")
      .collection("tickets")
      .find(
        { _id: "TRIAGE-42" as any },
        { projection: { _id: 1, status: 1, title: 1 }, maxTimeMS: 1000 },
      )
      .limit(1)
      .toArray();
    assert.equal(rows.length, 1);
    let writeDenied = false,
      privateReadDenied = false;
    try {
      await reader
        .db("triage_public")
        .collection("tickets")
        .updateOne({ _id: "TRIAGE-42" as any }, { $set: { status: "closed" } });
    } catch (error: any) {
      writeDenied = error.code === 13;
    }
    try {
      await reader.db("triage_private").collection("canary").findOne({});
    } catch (error: any) {
      privateReadDenied = error.code === 13;
    }
    const unchanged =
      (await db.collection("tickets").findOne({ _id: "TRIAGE-42" as any }))
        ?.status === "open";
    assert.ok(writeDenied && privateReadDenied && unchanged);
    return {
      readCount: rows.length,
      writeDenied,
      privateReadDenied,
      unchanged,
      scope:
        "Actual MongoDB role enforcement on synthetic local databases. Whole public database is readable; projection is not field-level authorization.",
    };
  } finally {
    await reader.close();
    await admin.close();
  }
}
if (process.argv[1]?.endsWith("permissions.ts")) {
  if (!process.argv[2]) throw Error("npm run permissions -- <new-output.json>");
  const result = await permissionProbe();
  writeFileSync(process.argv[2], JSON.stringify(result, null, 2), {
    flag: "wx",
  });
  console.log(result);
}
