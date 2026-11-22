# Correct the overdue report

At `2026-11-21T12:00:00Z`, a ticket due at `2026-11-21T08:00:00-06:00` is not overdue; a ticket due at `2026-11-21T13:00:00+02:00` is overdue. The current report gets these cases wrong.

Inspect the TypeScript application, reproduce the failure, make a bounded correction and report the exact verification commands and outcomes.

Acceptance criteria:

- Include only open tickets with a due timestamp strictly before the evaluation instant.
- Exclude equal instants, even when written with different offsets.
- Equivalent evaluation instants must give identical results.
- Order by due instant, then ascending ticket ID for ties.
- Reject invalid evaluation timestamps and timestamps without an explicit timezone.
- Preserve stored timestamp strings, document shape and the CLI contract.
- Preserve the original six tests and all twelve acceptance checks. Do not weaken assertions to obtain a passing result.
- Add no dependencies, unrelated features, remote actions or commits.

Run `npm run test:baseline` and `npm run test:acceptance`. MongoDB must already be running locally; see README. Timestamps support up to millisecond precision. Civil-time recurrence is outside scope.

This deliberately faulty, synthetic teaching exercise has visible acceptance tests. It is not an unseen model benchmark.
