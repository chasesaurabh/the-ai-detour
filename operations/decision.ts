import { readFileSync, writeFileSync } from "node:fs";
const [reportFile, decision, output] = process.argv.slice(2);
if (!reportFile || !output || !["accept", "reject"].includes(decision ?? ""))
  throw Error(
    "npm run graph:decision -- <review-report.json> accept|reject <new-approval.json>",
  );
const report = JSON.parse(readFileSync(reportFile, "utf8"));
if (
  !report.next?.includes("review_gate") ||
  report.result?.run?.status !== "awaiting_review"
)
  throw Error("Report is not at the review gate");
const candidate = report.result.__interrupt__?.[0]?.value?.candidate;
if (typeof candidate !== "string" || !/^[a-f0-9]{64}$/.test(candidate))
  throw Error("Missing candidate identity");
writeFileSync(
  output,
  JSON.stringify(
    {
      approved: decision === "accept",
      candidate,
      scope: "accept-diagnosis",
      expiresAt: Date.now() + 3600000,
    },
    null,
    2,
  ),
  { flag: "wx" },
);
console.log(
  "Local review decision recorded; this approves no code change or external action.",
);
