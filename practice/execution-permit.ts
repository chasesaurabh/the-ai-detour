import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inventory } from "./pipeline.ts";
import { hash } from "./context.ts";

export type ExecutionPermit = {
  version: 1;
  approved: true;
  scope: "execute-local-candidate-checks";
  job: string;
  candidateHash: string;
  expiresAt: number;
};

export function validateExecutionPermit(
  input: unknown,
  job: string,
  candidateHash: string,
  now = Date.now(),
): ExecutionPermit {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("Invalid local execution permit");
  const permit = input as Record<string, unknown>;
  if (
    Object.keys(permit).sort().join(",") !==
      "approved,candidateHash,expiresAt,job,scope,version" ||
    permit.version !== 1 ||
    permit.approved !== true ||
    permit.scope !== "execute-local-candidate-checks" ||
    permit.job !== job ||
    permit.candidateHash !== candidateHash ||
    !Number.isSafeInteger(permit.expiresAt) ||
    (permit.expiresAt as number) <= now
  )
    throw Error(
      "Execution permit does not cover this job/candidate/action/time",
    );
  return permit as ExecutionPermit;
}

export function prepareExecutionPermit(directory: string, output: string) {
  const root = resolve(directory);
  const state = JSON.parse(readFileSync(join(root, "state.json"), "utf8"));
  if (state.stage !== "candidate_ready" || typeof state._id !== "string")
    throw Error("A saved candidate_ready state is required");
  const candidateHash = hash(inventory(join(root, "workspace")));
  if (candidateHash !== state.candidateHash)
    throw Error("Candidate changed; do not authorize a stale source inventory");
  const permit: ExecutionPermit = {
    version: 1,
    approved: true,
    scope: "execute-local-candidate-checks",
    job: state._id,
    candidateHash,
    expiresAt: Date.now() + 3600000,
  };
  writeFileSync(resolve(output), JSON.stringify(permit, null, 2), {
    flag: "wx",
  });
  return permit;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [directory, output] = process.argv.slice(2);
  if (!directory || !output || process.argv.length !== 4)
    throw Error("npm run pipeline:permit -- <run-directory> <new-permit-file>");
  prepareExecutionPermit(directory, output);
  console.log(
    "Local execution permit created for one candidate. This authorizes ordinary host execution of tests and the verifier; it is not a sandbox or final acceptance. Submit only after reviewing candidate source, new tests, scripts, lockfiles and the installed environment.",
  );
}
