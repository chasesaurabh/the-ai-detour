import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { acceptReport, digest } from "./policies.ts";
const cases = [
  ["2026-11-21T09:30:00-05:00", "2026-11-21T14:00:00Z", false],
  ["2026-11-21T15:00:00+02:00", "2026-11-21T14:00:00Z", true],
  ["2026-11-21T09:00:00-05:00", "2026-11-21T14:00:00Z", false],
] as const;
export function verifyCandidates() {
  // Fixed valid timestamps only; this probe does not test general input validation.
  const candidates = {
    lexical: (a: string, b: string) => a < b,
    inclusive: (a: string, b: string) => Date.parse(a) <= Date.parse(b),
    strict: (a: string, b: string) => Date.parse(a) < Date.parse(b),
  };
  const results = Object.entries(candidates).map(([name, fn]) => ({
    name,
    revision: digest(fn.toString()),
    claim: "The implementation is complete",
    checks: cases.map(([due, now, expected]) => ({
      due,
      now,
      expected,
      actual: fn(due, now),
      pass: fn(due, now) === expected,
    })),
  }));
  assert.deepEqual(
    results.map((r) => r.checks.filter((c) => c.pass).length),
    [0, 2, 3],
  );
  let staleRejected = false;
  try {
    acceptReport(
      "new-candidate",
      {
        revision: "old-candidate",
        passed: true,
        checks: ["offset", "equality"],
      },
      ["offset", "equality"],
    );
  } catch {
    staleRejected = true;
  }
  assert.ok(staleRejected);
  return {
    results,
    staleRejected,
    scope:
      "Seeded candidate comparison, not generated patches or a model evaluation",
  };
}
if (process.argv[1]?.endsWith("verification.ts")) {
  if (!process.argv[2])
    throw Error("npm run verify:candidates -- <new-output.json>");
  const report = verifyCandidates();
  writeFileSync(process.argv[2], JSON.stringify(report, null, 2), {
    flag: "wx",
  });
  console.log(
    report.results.map((r) => ({
      name: r.name,
      passed: r.checks.filter((c) => c.pass).length,
      total: r.checks.length,
    })),
  );
}
