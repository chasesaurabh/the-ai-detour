# First autonomous engineering workflow

This starter orchestrates an existing Codex coding harness. It does not implement a new model/tool loop. One issue initiates investigation, edits, checks and a suggested review description. Later exercises can build on this explicit boundary.

## Tested setup

The first recorded run used Windows, Node 25.2.1, Codex CLI 0.171.0 and MongoDB 8.0.17. The 32 candidate application tests also passed on Node 24.11.1. The runner currently selects Windows MXC and is not a cross-platform launcher. Use a supported Windows device with MXC, Docker and an existing Codex login. Do not disable sandboxing if startup fails.

The pinned CLI is a development dependency. From the companion directory, run `npm ci`, then `npm run agent:status`. If not signed in, run `npm run agent:login` to start the CLI's normal login flow. Account entitlement and charges depend on your account. This does not configure an API key or promise free usage.

## Prepare and run

Start the synthetic database and create a new exercise outside this companion:

```text
docker compose -p ai-detour-pilot up -d --wait
npm run lab:search -- ../detour-search
```

In the new exercise, run `npm ci` and `npm test`. The baseline should pass 26 checks. Read `ISSUE.md`, which defines the search feature. Return to the companion and launch:

```text
npm run agent:run -- ../detour-search ../search-run-001
```

Arguments after `--` are passed to the named script. Run these scripts from the companion directory; run the exercise’s `npm ci` and `npm test` from its own directory.

Use a new output directory each time. The runner refuses an existing output directory and outputs inside the candidate. The parent must exist. Do not use a private or production repository as this exercise.

The agent receives one assignment, chooses its own steps and is limited to ten minutes. The wrapper records JSONL events, before/after source hashes, the final answer and a run summary. A clean agent exit produces `awaiting_independent_verification`, not an accepted change. Do not send extra prompts and then describe that run as having no interventions.

## Verify the result

Inspect the changed files, added tests, package scripts, lockfiles and command results **before** executing the candidate. The following commands run generated Node code with ordinary host permissions; they do not inherit the coding harness's sandbox. The same boundary applies to `capstone:verify` and `capstone:serve`. A passing file inventory or source hash does not make code safe to execute. Use this route only for the reviewed synthetic exercise in a trusted disposable environment. Use an isolated verifier for untrusted or organizational candidates, with scoped credentials and network access.

In the reviewed exercise, compile and run the checks using the installed tools:

```text
npm test
```

Then, from the companion:

```text
npm run agent:verify -- ../detour-search ../search-run-001/verification.json
```

The external verifier checks twelve groups of search requirements. It creates one uniquely named synthetic database and removes only that database afterward. It does not replace code review or prove scalability. Review the diff, documentation and unchanged-file checks before deciding to integrate. No script commits, pushes, merges or publishes the change.

## Boundaries and limitations

The invocation ignores user configuration and applies a profile extending workspace permissions, with the MXC sandbox and managed networking. Global configuration is not modified. MXC's loopback access reaches host-local services, not only the MongoDB port; this is not a port-specific network sandbox. No external proxy domains are allowlisted. Authentication/model traffic is separate from sandboxed command traffic.

The prompt restricts work to source, new tests and README. The wrapper detects protected-file changes afterward; that check is not an OS permission preventing each forbidden edit. Workspace read restrictions are not claimed. Use synthetic files and a disposable checkout.

In the recorded run, npm attempted a blocked registry request. The agent recovered by invoking the installed TypeScript compiler and Node test runner directly. That was a recovery within existing permissions, not an exception to external-network policy.

A controlled Windows timeout test verified termination of a child tree before a delayed write. This is a bounded test, not a guarantee for every process behavior. This starter is not a durable queue, a recurring scheduler or a production autonomous service. Keep all partial runs and failures. Do not represent this single task as a model ranking or a human productivity study.
