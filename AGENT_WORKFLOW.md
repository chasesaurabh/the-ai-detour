# Earlier bug-fix exercise

For the autonomy-first feature workflow, start with [agent/README.md](agent/README.md). This document preserves the smaller diagnostic exercise.

Start with README.md. Install the locked dependencies, start local MongoDB, then use `npm run lab:prepare -- ../detour-first-task` to create an exercise workspace. The companion root contains a solution; direct the agent to the separate exercise instead.

Run `npm ci` and `npm test` in the exercise yourself first. Its eighteen checks intentionally include eight failures. The six original checks pass; the twelve acceptance checks identify the incomplete behavior. A connection error or compiler error is a setup problem, not the expected defect.

Use a coding assistant with access to read/edit this exercise and execute the local tests. Check its active directory and permissions. If it is read-only, use its normal workspace controls to decide whether to enable editing. Do not disable safeguards simply because a command was refused. No publishing rights, production data or unrelated project access is needed.

Give it this assignment:

> Read README.md and ASSIGNMENT.md. Reproduce the reported behavior and complete the bounded correction. Preserve existing checks. Work only in this exercise, with its installed tools and local MongoDB. Report the changed files, exact checks and outcomes, and any limitation affecting acceptance. If an edit or command is blocked, say so explicitly.

Keep a before-copy or version-control checkpoint. After the agent finishes, inspect every changed source, test and configuration file. Run `npm run test:baseline` and `npm run test:acceptance` yourself. Check that tests were not weakened and that the change preserves stored values and the CLI contract. A successful command exit or an agent's final message alone does not establish that the task is complete.

Do not commit credentials, generated dependencies or build output. The example application needs no model API key. A hosted coding assistant can still transmit code/context to its provider; use synthetic exercises and follow your organization's policies for real work.
