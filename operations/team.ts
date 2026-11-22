import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { fingerprint } from "../workflow/tools.ts";
const [mode, folder] = process.argv.slice(2);
if (!["sequential", "parallel"].includes(mode ?? "") || !folder)
  throw Error("npm run team -- sequential|parallel <new-directory>");
const dir = resolve(folder);
mkdirSync(dir);
const roles = ["contract", "implementation", "verification"],
  started = Date.now();
function run(role: string) {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(new URL("./team-worker.ts", import.meta.url)),
        role,
        join(dir, role),
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let errors = "";
    child.stderr.on("data", (data) => (errors += data));
    child.on("error", (error) => resolve({ role, error: String(error) }));
    child.on("close", (code) => resolve({ role, code, errors }));
  });
}
const outcomes: unknown[] = [];
if (mode === "parallel") outcomes.push(...(await Promise.all(roles.map(run))));
else for (const role of roles) outcomes.push(await run(role));
const results = roles.map((role) => {
  try {
    return JSON.parse(readFileSync(join(dir, role, "review.json"), "utf8"));
  } catch {
    return { role, status: "missing" };
  }
});
const structurallyReady = results.every(
  (r) => r.status === "awaiting_review" && r.fingerprint === fingerprint,
);
writeFileSync(
  join(dir, "integration.json"),
  JSON.stringify(
    {
      mode,
      elapsedMs: Date.now() - started,
      outcomes,
      results,
      structurallyReady,
      verdict:
        "Human semantic review required; agreement is not proof. Artifact directories are isolated, not OS sandboxes.",
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ mode, structurallyReady }));
