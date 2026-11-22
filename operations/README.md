# Evaluation and operational exercises

Run commands from the companion root on Node.js 24 or later. Install with `npm ci`; use `docker compose -p ai-detour-pilot up -d --wait` for the local MongoDB server on port 27128. Output parents must exist and report paths/directories must be new. All records and service credentials in these exercises are synthetic.

```text
npm run ops:check
npm run ops:test
npm run verify:candidates -- ../candidate-check-001.json
```

The six operational test groups use real local MongoDB where applicable, and scripted model results for deterministic failure paths. They do not contact the inference model. The candidate verifier compares three intentionally different implementations and rejects a stale revision report.

## Fixed model evaluation

Start the 4B model using workflow/README.md, then:

```text
npm run evaluate -- ../evaluation-4b-001
```

Six synthetic decision cases are repeated three times with temperature zero, a 900-token response ceiling and non-thinking mode. The score checks the next-action label and evidence IDs, not the full explanation or coding ability. Keep both protocol.json and results.json, including failures. A local model must already be ready on port 18084. Never run different model containers on this port simultaneously.

For the optional size comparison, obtain the exact Hugging Face snapshots declared in model-runtime.mjs in a local hub cache first, and supply the absolute cache path:

```text
npm run model:stop
npm run model:variant -- start small <absolute-hub-cache>
```

Set `DETOUR_MODEL=detour-qwen3-06b` in the current shell, then run evaluate with a new directory. In PowerShell use `$env:DETOUR_MODEL='detour-qwen3-06b'`. Afterward use `npm run model:variant -- stop small`. The large variant uses `start large`, `stop large` and alias `detour-qwen3-32b`. The launcher is offline and will fail if the pinned snapshot is missing; it does not download models. Large requires substantially more GPU memory. Check the runtime's health/models endpoint before evaluating. The launcher uses the same vLLM version and 8192-token context as the main runtime, with one active sequence.

Restore `DETOUR_MODEL=detour-qwen3-4b` and the Chapter 4 runtime before the following exercises. Environment variables persist within the current shell. Use `npm run model:resume` to restart the existing stopped 4B container; `model:start` creates it initially. Variants likewise use `npm run model:variant -- resume small` or `resume large` after their first creation. Stop the currently active model before restarting another on the same port.

## Persistent graph and review

```text
npm run graph -- start diagnosis_001 ../graph-start-001.json
npm run graph -- inspect diagnosis_001 ../graph-inspect-001.json
npm run graph:decision -- ../graph-start-001.json accept ../decision-001.json
npm run graph -- resume diagnosis_001 ../graph-resume-001.json ../decision-001.json
```

Inspect the diagnosis before choosing accept or reject. The helper creates a one-hour decision tied to its candidate hash; it does not authenticate a reviewer. Acceptance is local diagnosis review, not approval to change a service. Use unique thread IDs. The graph persists in ai_detour_ops with the official MongoDB checkpointer and keeps a model-request journal. A reserved request with no completed result stops for inspection; automatic replay is intentionally refused. A hard crash can leave a graph_locks entry: inspect its owner and associated process before an operator removes that specific stale lock. Do not drop the shared database to resolve one thread.

## Events and bounded worker

```text
npm run events -- events_001 ../events-001.json
npm run worker -- events_001 45 ../worker-001.json
```

Events exercises a real ephemeral loopback HTTP listener, a deliberately public synthetic bearer value, duplicate delivery and one actual timer tick. It then closes the listener. This is not a vendor webhook or persistent calendar scheduler. Use a new namespace for each session. Worker runs 1–300 seconds, renews leases and records task outcomes. Queue completion is separate from task acceptance. Each claim can use eight model requests and a job can be claimed at most three times. This queue demo is separate from the graph; do not assume its per-claim budget is a durable graph budget.

## Actual database permission boundary

```text
npm run controls:up
npm run permissions -- ../permissions-001.json
npm run controls:stop
```

A separate pinned MongoDB instance listens on loopback port 27129. The public demonstration credentials initialize synthetic databases only. The reader has read permission on triage_public; a write and a private-database read must fail. Query projection reduces returned data but does not restrict the account's authority. Do not reuse these credentials or topology for real data.

## Investigator comparison

```text
npm run team -- sequential ../team-sequential-001
npm run team -- parallel ../team-parallel-001
```

Three read-only investigators use independent artifact directories and the same fixed tools. These directories are not OS sandboxes. The integrator checks fingerprints and review state; a human must still inspect meaning. One active inference sequence means concurrent client processes may wait for one another. Do not infer a speedup from process count.

Stop the dedicated model using its named stop script when finished. `docker compose -p ai-detour-pilot stop` preserves the MongoDB volume. None of these programs sends notifications, publishes changes or deploys software.
