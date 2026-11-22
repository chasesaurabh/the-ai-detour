# Fixed engineering-decision evaluation

Observed November 21–22, 2026. These are six synthetic decision cases repeated three times, not a general coding benchmark. See operations/evaluation.ts for the executable protocol and scoring rule. The same revised action definitions, case order, temperature zero, thinking disabled and 900-token response limit were used for all three configurations.

| Model | Passed | Completed responses |
|---|---:|---:|
| Qwen3-0.6B | 0/18 | 18/18 |
| Qwen3-4B | 15/18 | 15/18 |
| Qwen3-32B | 18/18 | 18/18 |

The score requires the exact action, the required evidence ID and no unobserved IDs. It does not automatically score explanation correctness. Repeats are not independent tasks. The small model returned responses but violated action/citation requirements. The 4B failures were incomplete responses on all three offset cases; missing raw response/usage/timing fields must not be treated as zeros. The large model passed this protocol, not every engineering task.

Runtime: vLLM 0.30.0, maximum context 8192, maximum active sequences 1, eager execution. Exact model revisions are pinned in workflow/model-runtime.mjs and operations/model-runtime.mjs. Recorded host GPU: NVIDIA RTX PRO 6000 Blackwell, 96 GB. GPU allocation fractions differ by model size. First-request timings include startup-related effects; these records are not a controlled latency ranking or cost study. No electricity or human-effort measurements were collected.

protocol.json contains the frozen version-2 task contract and its hash. results.json preserves all eighteen attempts for each model. An earlier development pilot improved action definitions and is excluded from these comparison totals. The code was formatted for readability after the runs; the protocol JSON identity was rechecked. Local records contain synthetic content only.
