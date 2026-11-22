import { MongoClient, type Collection } from "mongodb";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  lstatSync,
  realpathSync,
  existsSync,
} from "node:fs";
import { resolve, join, dirname, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { boundedProcess } from "../agent/process.ts";
import { hash } from "./context.ts";
import { validateExecutionPermit } from "./execution-permit.ts";
const codeRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
type Stage =
  | "preparing"
  | "ready"
  | "implementing"
  | "candidate_ready"
  | "verifying"
  | "awaiting_review"
  | "accepted"
  | "rejected"
  | "failed";
type Job = {
  _id: string;
  version: 1;
  directory: string;
  stage: Stage;
  contractHash?: string;
  candidateHash?: string;
  packetHash?: string;
  executionPermitHash?: string;
  executionAuthorizedAt?: string;
  error?: string;
  agentStarts: number;
  history: { stage: Stage; at: string }[];
};
export function inventory(folder: string, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of readdirSync(folder).sort()) {
    if (["node_modules", "dist", ".git"].includes(name)) continue;
    const p = join(folder, name),
      key = prefix + name,
      s = lstatSync(p);
    if (s.isSymbolicLink()) throw Error("Symlink in candidate");
    if (s.isDirectory()) Object.assign(result, inventory(p, key + "/"));
    else result[key] = hash(readFileSync(p).toString("base64"));
  }
  return result;
}
function checkLocation(target: string) {
  const parent = realpathSync(dirname(resolve(target))),
    dir = join(parent, resolve(target).split(/[\\/]/).at(-1)!);
  const rel = relative(codeRoot, dir);
  if (!(rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel)))
    throw Error("Run directory must be outside companion");
  return dir;
}
export async function pipeline(
  mode: string,
  id: string,
  argument?: string,
  stopAfter = "candidate",
) {
  if (!/^[a-z][a-z0-9_]{0,50}$/.test(id)) throw Error("Invalid job ID");
  const client = await new MongoClient("mongodb://127.0.0.1:27128", {
    serverSelectionTimeoutMS: 5000,
  }).connect();
  const db = client.db("ai_detour_pipeline"),
    jobs = db.collection<Job>("jobs"),
    locks = db.collection<{ _id: string; owner: string }>("locks"),
    owner = randomUUID();
  let locked = false;
  try {
    if (mode === "status") {
      const job = await jobs.findOne({ _id: id });
      if (!job) throw Error("Unknown job");
      return job;
    }
    await locks.insertOne({ _id: id, owner });
    locked = true;
    let job = await jobs.findOne({ _id: id });
    if (mode === "start") {
      if (!argument) throw Error("New run directory required");
      const directory = checkLocation(argument);
      if (job) {
        if (job.directory !== directory)
          throw Error("Job identity conflicts with another directory");
        return job;
      }
      mkdirSync(directory);
      job = {
        _id: id,
        version: 1,
        directory,
        stage: "preparing",
        agentStarts: 0,
        history: [{ stage: "preparing", at: new Date().toISOString() }],
      };
      await jobs.insertOne(job);
    }
    if (!job) throw Error("Unknown job");
    if (job.version !== 1) throw Error("Unsupported job version");
    const dir = job.directory,
      workspace = join(dir, "workspace");
    const save = async (stage: Stage, extra: Partial<Job> = {}) => {
      const previous = job!.stage;
      const entry = { stage, at: new Date().toISOString() };
      const result = await jobs.updateOne(
        { _id: id, stage: previous },
        { $set: { ...extra, stage }, $push: { history: entry } },
      );
      if (result.modifiedCount !== 1) throw Error("Lost state transition");
      job = { ...job!, ...extra, stage, history: [...job!.history, entry] };
      writeFileSync(join(dir, "state.json"), JSON.stringify(job, null, 2));
    };
    const command = async (
      label: string,
      args: string[],
      cwd = codeRoot,
      milliseconds = 120000,
    ) => {
      let stdout = "",
        stderr = "";
      const result = await boundedProcess(process.execPath, args, {
        cwd,
        milliseconds,
        onStdout: (s) => (stdout = (stdout + s).slice(-1000000)),
        onStderr: (s) => (stderr = (stderr + s).slice(-1000000)),
      });
      writeFileSync(join(dir, label + ".stdout.txt"), stdout, { flag: "wx" });
      writeFileSync(join(dir, label + ".stderr.txt"), stderr, { flag: "wx" });
      if (result.code !== 0 || result.timedOut)
        throw Error(label + " failed: " + JSON.stringify(result));
    };
    const npm = process.env.npm_execpath;
    if (!npm) throw Error("Run through the named npm script");
    const contract = () =>
      hash({
        issue: readFileSync(join(workspace, "ISSUE.md"), "utf8"),
        design: readFileSync(join(workspace, "DESIGN.md"), "utf8"),
      });
    if (mode === "decision") {
      if (job.stage !== "awaiting_review" || !argument)
        throw Error("A pending review and decision file are required");
      const decision = JSON.parse(readFileSync(argument, "utf8"));
      if (
        !decision ||
        typeof decision.approved !== "boolean" ||
        decision.scope !== "accept-local-candidate" ||
        decision.packetHash !== job.packetHash ||
        decision.candidateHash !== job.candidateHash ||
        !Number.isSafeInteger(decision.expiresAt) ||
        decision.expiresAt <= Date.now()
      )
        throw Error("Decision does not cover current packet/candidate/time");
      if (hash(inventory(workspace)) !== job.candidateHash)
        throw Error("Candidate changed after verification");
      const packet = JSON.parse(
        readFileSync(join(dir, "review-packet.json"), "utf8"),
      );
      if (hash(packet) !== job.packetHash) throw Error("Review packet changed");
      if (
        hash(
          JSON.parse(readFileSync(join(dir, "independent.json"), "utf8")),
        ) !== packet.verificationHash
      )
        throw Error("Verification evidence changed");
      await save(decision.approved ? "accepted" : "rejected");
      return job;
    }
    if (!["start", "resume"].includes(mode))
      throw Error("Use start, resume, status or decision");
    if (["accepted", "rejected", "awaiting_review"].includes(job.stage))
      return job;
    if (
      ["failed", "preparing", "verifying"].includes(job.stage) &&
      mode === "resume"
    )
      throw Error(
        "Interrupted or failed stage requires explicit inspection; no automatic replay",
      );
    // Validation is outside the execution catch: a rejected permit must not
    // convert an intact candidate into a failed verification attempt.
    let executionPermit: ReturnType<typeof validateExecutionPermit> | undefined;
    if (mode === "resume" && job.stage === "candidate_ready") {
      if (!argument) return job;
      if (hash(inventory(workspace)) !== job.candidateHash)
        throw Error("Candidate changed before local execution authorization");
      executionPermit = validateExecutionPermit(
        JSON.parse(readFileSync(argument, "utf8")),
        id,
        job.candidateHash!,
      );
    }
    try {
      if (job.stage === "preparing") {
        await command("prepare", [
          join(codeRoot, "labs/03-queue-overview/prepare.mjs"),
          workspace,
        ]);
        await command("install", [npm, "ci"], workspace);
        await command("baseline", [npm, "test"], workspace);
        await save("ready", { contractHash: contract() });
      }
      if (job.stage === "ready") {
        await save("implementing", { agentStarts: job.agentStarts + 1 });
        await command(
          "agent",
          [
            join(codeRoot, "agent/run-task.ts"),
            workspace,
            join(dir, "agent-run"),
          ],
          codeRoot,
          12 * 60000,
        );
      }
      if (job.stage === "implementing") {
        const summaryPath = join(dir, "agent-run/run-summary.json");
        if (!existsSync(summaryPath))
          throw Error(
            "Agent outcome uncertain; inspect process and retained workspace before any rerun",
          );
        const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
        if (
          summary.agentExitCode !== 0 ||
          summary.timedOut ||
          summary.violations.length
        )
          throw Error("Agent outcome failed its boundary");
        if (contract() !== job.contractHash)
          throw Error("Input contract changed");
        await save("candidate_ready", {
          candidateHash: hash(inventory(workspace)),
        });
      }
      // No start invocation may silently promote sandboxed implementation into
      // ordinary host execution, even if a caller supplies an old stop option.
      if (mode === "start" || !executionPermit) return job;
      if (job.stage === "candidate_ready") {
        if (hash(inventory(workspace)) !== job.candidateHash)
          throw Error("Candidate changed before independent verification");
        validateExecutionPermit(executionPermit, id, job.candidateHash!);
        await save("verifying", {
          executionPermitHash: hash(executionPermit),
          executionAuthorizedAt: new Date().toISOString(),
        });
        await command("final-tests", [npm, "test"], workspace);
        await command("independent", [
          join(codeRoot, "agent/verify-capstone.ts"),
          workspace,
          join(dir, "independent.json"),
        ]);
        const report = JSON.parse(
          readFileSync(join(dir, "independent.json"), "utf8"),
        );
        if (report.total !== 8 || report.passed !== 8)
          throw Error("Independent contract incomplete");
        if (hash(inventory(workspace)) !== job.candidateHash)
          throw Error("Candidate changed during verification");
        const packet = {
          job: id,
          contractHash: job.contractHash,
          candidateHash: job.candidateHash,
          verificationHash: hash(report),
          agentStarts: job.agentStarts,
          checks: report.results,
          scope:
            "Local candidate review; browser visual review and any external release are separate",
          next: "Inspect candidate, API evidence and browser behavior before making a decision",
        };
        writeFileSync(
          join(dir, "review-packet.json"),
          JSON.stringify(packet, null, 2),
          { flag: "wx" },
        );
        await save("awaiting_review", { packetHash: hash(packet) });
      }
      return job;
    } catch (error) {
      await save("failed", { error: String(error) });
      throw error;
    }
  } finally {
    if (locked) await locks.deleteOne({ _id: id, owner });
    await client.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [mode, id, arg, stop] = process.argv.slice(2);
  if (!mode || !id)
    throw Error(
      "npm run pipeline -- start <id> <new-directory> [candidate] | resume <id> [local-execution-permit.json] | status <id> | decision <id> <file>",
    );
  const result = await pipeline(mode, id, arg, stop);
  console.log(JSON.stringify(result, null, 2));
}
