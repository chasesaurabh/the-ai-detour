import { initial, advance } from "../workflow/engine.ts";
import { localModel } from "../workflow/model.ts";
import { executeTool } from "../workflow/tools.ts";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
const roles = {
  contract:
    "Focus on whether the proposed diagnosis respects the written requirement and equality boundary.",
  implementation:
    "Focus on the mechanism in the code and whether it explains the observed failures.",
  verification:
    "Focus on what the probes establish and what additional verification is needed before accepting a patch.",
};
const [role, folder] = process.argv.slice(2);
if (!role || !(role in roles) || !folder) throw Error("Invalid role/output");
const dir = resolve(folder);
mkdirSync(dir);
const state = initial(process.env.DETOUR_MODEL ?? "detour-qwen3-4b");
state.messages[1]!.content += " " + roles[role as keyof typeof roles];
const started = Date.now();
await advance(
  state,
  localModel(
    process.env.DETOUR_MODEL_URL ??
      "http://127.0.0.1:18084/v1/chat/completions",
    state.model,
  ),
  async (name, args) => executeTool(name, args),
  (s) => writeFileSync(join(dir, "state.json"), JSON.stringify(s, null, 2)),
);
writeFileSync(
  join(dir, "review.json"),
  JSON.stringify(
    {
      role,
      elapsedMs: Date.now() - started,
      fingerprint: state.fingerprint,
      status: state.status,
      steps: state.steps,
      final: state.final,
    },
    null,
    2,
  ),
);
if (state.status !== "awaiting_review") process.exitCode = 1;
