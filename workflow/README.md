# Visible agent loop — dated runtime recipe

Checked November 21, 2026 (Chicago). TypeScript workflow for Chapters 4–6. All issue text and probe data are synthetic. The deliberately faulty comparison is isolated from the application's Store.

## Install and check

Use Node.js 24 or newer and the companion lockfile. The recorded model/MCP runs used Node 25.2.1; the controller and MCP tests were also checked on Node 24.11.1. From the companion root:

```text
npm ci
npm run loop:check
npm run loop:test
```

The tests use scripted model decisions for controlled failures and an actual MCP child process for transport checks. They do not need a model, database, paid API account or enterprise credentials. The model-driven commands below do need the separately running model service.

## Tested model service

- Qwen/Qwen3-4B, revision `1cfa9a7208912126459214e8b04321603b3df60c`.
- vLLM Docker image `vllm/vllm-openai:v0.30.0`.
- Windows host, Docker Linux containers with NVIDIA GPU access; recorded GPU: RTX PRO 6000 Blackwell, 96 GB. This describes the test system, not a minimum requirement.
- Context 8,192 tokens; one sequence; GPU memory fraction 0.20; eager execution. This fraction was chosen for the recorded machine. It is not a portable minimum-memory setting: on a smaller GPU it may allocate too little memory even if a different configuration would fit the model.
- Model response limit 1,000 tokens, temperature zero, Qwen thinking disabled. JSON-schema response mode plus independent local validation.
- Only loopback HTTP is accepted by this teaching adapter. It is not a generic hosted-provider client. No API secret is required or sent.

Use a machine with an already working NVIDIA-enabled Docker installation. The image is large and may be downloaded on first start. Follow the [vLLM Docker prerequisites](https://docs.vllm.ai/en/stable/deployment/docker/) for the runtime, rather than assuming Docker alone exposes a GPU.

The launcher expects a local model directory with `snapshots/<revision>/` beneath it. An existing Hugging Face Qwen3-4B cache already has this layout. Alternatively, create that layout and download the files from the [pinned model revision](https://huggingface.co/Qwen/Qwen3-4B/tree/1cfa9a7208912126459214e8b04321603b3df60c):

```text
qwen3-4b/
  snapshots/
    1cfa9a7208912126459214e8b04321603b3df60c/
      config.json
      generation_config.json
      tokenizer_config.json
      tokenizer.json
      vocab.json
      merges.txt
      model.safetensors.index.json
      model-00001-of-00003.safetensors
      model-00002-of-00003.safetensors
      model-00003-of-00003.safetensors
      LICENSE
      README.md
```

Use the file download action, not a saved HTML preview. The three weight files total roughly 8.05 GB in decimal units; allow space for the runtime image as well. Existing caches can use links into their `blobs` directory: mount the whole model cache directory, not only the snapshot. The tested run used that existing-cache route. Manual acquisition is an alternative way of supplying the same files, not a separately measured installation run.

Substitute your directory in this command (keep quotes if it contains spaces):

```text
npm run model:start -- "D:\models\qwen3-4b"
npm run model:status
```

The launcher mounts the model read-only, sets offline model loading and binds port 18084 only to 127.0.0.1. Wait for the log to report application startup complete. It does not automatically replace an existing container named `ai-detour-loop-model`. After a previous stop, restart that exact container with `docker start ai-detour-loop-model`; use `model:start` only for its first creation. Inspect configuration before reusing a container created for a different experiment.

The first model request can take longer while the server initializes output constraints. If startup or a request fails, keep the run record and inspect the model logs. Do not raise limits or switch models and describe the next attempt as the same configuration.

## Direct, connected and resumed runs

Run directories may be outside the checkout and must be new on `start`:

```text
npm run loop -- start ../diagnosis-001
npm run loop -- start ../diagnosis-mcp-001 --mcp
npm run loop -- start ../diagnosis-resume-001 --mcp --pause-after=2
npm run loop -- resume ../diagnosis-resume-001
```

Each start/resume is a separate Node process. `--pause-after` limits decisions in this process; it does not reset the total eight-request budget. A model can escalate or fail before reaching a requested pause. The persisted transport is used on resume. The endpoint defaults to `http://127.0.0.1:18084/v1/chat/completions`, with served model name `detour-qwen3-4b`; environment overrides are `DETOUR_MODEL_URL` and `DETOUR_MODEL` and must still satisfy the adapter's loopback restriction.

Read `state.json`, the corresponding `result-start.json` / `result-resume.json`, and, for MCP, `discovery-start.json` / `discovery-resume.json`. A six-decision observed run is an example, not an enforced sequence. `awaiting_review` means observed evidence passed a structural gate. Review the diagnosis against the actual probe values.

`npm run mcp:serve` is a server entry point for a stdio client. The loop starts its own server automatically. Do not write console logs to the server's standard output.

## Limits and recovery

Eight cumulative model attempts, sixty seconds per model request, two accumulated action/tool errors, bounded response sizes. The local tools have fixed operations and tiny results; this is not an arbitrary-command sandbox. Remote tools would also need explicit execution deadlines, cancellation behavior and side-effect recovery.

An in-flight checkpoint stops as `uncertain` on resume. Changed fixture fingerprints are rejected. A malformed checkpoint or increased budget is rejected by its schema. The local file is trusted state, not a signed artifact. A stale writer lock requires an operator to establish that no writer remains before removing only that lock; preserve the checkpoint and inspect in-flight state.

This example does not implement compaction, token accounting, remote credential management, transactional side effects or automatic crash recovery. Its complete scope is a bounded local read-only diagnosis and controlled fresh-process continuation. Controller tests are distinct from model-run evidence.

When done:

```text
npm run model:stop
```

This stops the dedicated model container and preserves model files and run directories. No application database is started by these commands.

## Adjusting the allocation

The historical default remains GPU fraction0.20 and context8,192. Select explicit values for your device when creating the container:

```text
npm run model:start -- <cache-directory> --gpu-memory-utilization 0.8 --max-model-len 4096 --dry-run
npm run model:config:test
```

This is an option example, not a tested minimum-memory claim. The fraction refers to total GPU memory. Dry run validates options/cache and prints arguments without running Docker. Remove `--dry-run` after reviewing available memory; successful startup still needs weights, runtime buffers and cache to fit. Existing containers keep their old settings on resume. To change settings, stop and inspect only the dedicated model container, retain its logs, remove that stopped container, then create it with the desired options. Keep model files and application volumes. The variant launcher accepts the same creation flags after its cache path. Argument tests require no GPU and do not measure a smaller GPU's inference behavior.
