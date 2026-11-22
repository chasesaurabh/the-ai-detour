import { readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const [directory, choice, output] = process.argv.slice(2);
if (!directory || !["accept", "reject"].includes(choice) || !output)
  throw Error(
    "npm run pipeline:review -- <run-directory> accept|reject <new-decision-file>",
  );
const state = JSON.parse(
  readFileSync(join(resolve(directory), "state.json"), "utf8"),
);
if (state.stage !== "awaiting_review") throw Error("No pending review");
const decision = {
  approved: choice === "accept",
  scope: "accept-local-candidate",
  candidateHash: state.candidateHash,
  packetHash: state.packetHash,
  expiresAt: Date.now() + 3600000,
};
writeFileSync(resolve(output), JSON.stringify(decision, null, 2), {
  flag: "wx",
});
console.log(
  "Decision file prepared. Inspect the candidate and evidence before submitting it.",
);
