import {
  StateGraph,
  StateSchema,
  START,
  END,
  interrupt,
  Command,
} from "@langchain/langgraph";
import { MongoDBSaver } from "@langchain/langgraph-checkpoint-mongodb";
import { MongoClient } from "mongodb";
import * as z from "zod";
import {
  initial,
  advance,
  checkpointSchema,
  type State,
} from "../workflow/engine.ts";
import { executeTool } from "../workflow/tools.ts";
import { localModel } from "../workflow/model.ts";
import { digest, checkProposal } from "./policies.ts";
import { randomUUID } from "node:crypto";
import { writeFileSync, readFileSync, openSync, closeSync } from "node:fs";

const schema = new StateSchema({
  run: z.custom<State>(),
  review: z.enum(["pending", "accepted", "rejected"]),
});
const approvalSchema = z
  .object({
    approved: z.boolean(),
    candidate: z.string(),
    scope: z.literal("accept-diagnosis"),
    expiresAt: z.number(),
  })
  .strict();
export async function graphSession(
  thread: string,
  mode: "start" | "resume" | "inspect",
  approval?: unknown,
) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(thread)) throw Error("Invalid thread ID");
  const client = await new MongoClient("mongodb://127.0.0.1:27128", {
    serverSelectionTimeoutMS: 5000,
  }).connect();
  const db = client.db("ai_detour_ops"),
    locks = db.collection<{ _id: string; owner: string }>("graph_locks"),
    owner = randomUUID();
  let locked = false;
  try {
    await locks.insertOne({ _id: thread, owner });
    locked = true;
    const saver = new MongoDBSaver({ client, dbName: "ai_detour_ops" });
    const setupErrors = await saver.setup();
    if (setupErrors.length) throw setupErrors[0];
    const journal = db.collection<{
      _id: string;
      phase: string;
      result?: State;
    }>("graph_requests");
    const graph = new StateGraph(schema)
      .addNode("step", async (state) => {
        const run = checkpointSchema.parse(structuredClone(state.run)),
          key = `${thread}:${run.steps + 1}`;
        const prior = await journal.findOne({ _id: key });
        if (prior?.phase === "completed" && prior.result)
          return { run: checkpointSchema.parse(prior.result) };
        if (prior)
          throw Error(
            "Uncertain model request: inspect journal; no automatic replay",
          );
        await journal.insertOne({ _id: key, phase: "reserved" });
        const endpoint =
          process.env.DETOUR_MODEL_URL ??
          "http://127.0.0.1:18084/v1/chat/completions";
        await advance(
          run,
          localModel(endpoint, run.model),
          async (name, args) => executeTool(name, args),
          () => {},
          1,
        );
        await journal.updateOne(
          { _id: key, phase: "reserved" },
          { $set: { phase: "completed", result: run } },
        );
        return { run };
      })
      .addNode("review_gate", (state) => {
        const candidate = digest(state.run.final);
        const decision = approvalSchema.parse(
          interrupt({
            candidate,
            scope: "accept-diagnosis",
            diagnosis: state.run.final,
            evidence: state.run.evidence.map((e) => e.id),
          }),
        );
        if (decision.approved)
          checkProposal({ candidate, scope: "accept-diagnosis" }, decision);
        else if (decision.candidate !== candidate)
          throw Error("Rejection targets a different candidate");
        return {
          review: decision.approved
            ? ("accepted" as const)
            : ("rejected" as const),
        };
      })
      .addEdge(START, "step")
      .addConditionalEdges(
        "step",
        (state) =>
          state.run.status === "paused"
            ? "step"
            : state.run.status === "awaiting_review"
              ? "review_gate"
              : END,
        ["step", "review_gate", END],
      )
      .addEdge("review_gate", END)
      .compile({ checkpointer: saver });
    const config = { configurable: { thread_id: thread }, recursionLimit: 20 };
    const before = await graph.getState(config);
    if (mode === "inspect") return { values: before.values, next: before.next };
    if (mode === "start" && Object.keys(before.values).length)
      throw Error("Thread exists; choose a new ID");
    if (mode === "resume" && !before.next.includes("review_gate"))
      throw Error("Thread is not waiting at review");
    const model = process.env.DETOUR_MODEL ?? "detour-qwen3-4b";
    const result = await graph.invoke(
      mode === "start"
        ? { run: initial(model), review: "pending" }
        : new Command({ resume: approvalSchema.parse(approval) }),
      config,
    );
    const after = await graph.getState(config);
    return {
      result,
      next: after.next,
      requests: await journal.countDocuments({
        _id: { $regex: `^${thread}:` },
      }),
      thread,
    };
  } finally {
    if (locked) await locks.deleteOne({ _id: thread, owner });
    await client.close();
  }
}
if (process.argv[1]?.endsWith("graph.ts")) {
  const [mode, thread, output, approvalFile] = process.argv.slice(2);
  if (
    !["start", "resume", "inspect"].includes(mode ?? "") ||
    !thread ||
    !output
  )
    throw Error(
      "npm run graph -- start|resume|inspect <thread-id> <new-output.json> [approval.json]",
    );
  closeSync(openSync(output, "wx"));
  const result = await graphSession(
    thread,
    mode as "start" | "resume" | "inspect",
    approvalFile ? JSON.parse(readFileSync(approvalFile, "utf8")) : undefined,
  );
  writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ thread, next: result.next }));
}
