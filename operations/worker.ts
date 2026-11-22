import { MongoClient } from "mongodb";
import { Queue } from "./queue.ts";
import { initial, advance } from "../workflow/engine.ts";
import { localModel } from "../workflow/model.ts";
import { executeTool } from "../workflow/tools.ts";
import { writeFileSync } from "node:fs";
const [namespace, secondsText, output] = process.argv.slice(2),
  seconds = Number(secondsText);
if (
  !namespace ||
  !output ||
  !Number.isInteger(seconds) ||
  seconds < 1 ||
  seconds > 300
)
  throw Error(
    "npm run worker -- <namespace> <seconds 1..300> <new-output.json>",
  );
const client = await new MongoClient("mongodb://127.0.0.1:27128", {
  serverSelectionTimeoutMS: 5000,
}).connect();
const queue = new Queue(client, namespace),
  start = Date.now(),
  deadline = start + seconds * 1000,
  records: unknown[] = [];
const stop = new AbortController();
process.once("SIGINT", () => stop.abort("Operator cancelled"));
try {
  while (Date.now() < deadline && !stop.signal.aborted) {
    await queue.deadExpired();
    const job = await queue.claim();
    if (!job) {
      await new Promise((r) => setTimeout(r, 250));
      continue;
    }
    const leaseAbort = new AbortController();
    let lost = false;
    const heartbeat = setInterval(() => {
      void queue
        .renew(job._id, job.owner!)
        .then((ok) => {
          if (!ok) {
            lost = true;
            leaseAbort.abort("Lease lost");
          }
        })
        .catch(() => {
          lost = true;
          leaseAbort.abort("Lease heartbeat failed");
        });
    }, 1500);
    try {
      const model = localModel(
        process.env.DETOUR_MODEL_URL ??
          "http://127.0.0.1:18084/v1/chat/completions",
        process.env.DETOUR_MODEL ?? "detour-qwen3-4b",
      );
      const signal = AbortSignal.any([
        stop.signal,
        leaseAbort.signal,
        AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      ]);
      const state = initial(process.env.DETOUR_MODEL ?? "detour-qwen3-4b");
      await advance(
        state,
        (messages, requestSignal) =>
          model(messages, AbortSignal.any([signal, requestSignal])),
        async (name, args) => {
          signal.throwIfAborted();
          return executeTool(name, args);
        },
        () => {},
      );
      const committed =
        !lost &&
        (await queue.finish(job, {
          status: state.status,
          steps: state.steps,
          final: state.final,
          evidence: state.evidence,
        }));
      records.push({
        id: job._id,
        attempt: job.attempts,
        status: state.status,
        committed,
        lost,
      });
    } catch (error) {
      records.push({ id: job._id, error: String(error), lost });
    } finally {
      clearInterval(heartbeat);
    }
  }
} finally {
  writeFileSync(
    output,
    JSON.stringify(
      {
        startedAt: new Date(start).toISOString(),
        endedAt: new Date().toISOString(),
        observationSeconds: (Date.now() - start) / 1000,
        records,
        rows: await queue.rows(),
      },
      null,
      2,
    ),
    { flag: "wx" },
  );
  await client.close();
}
