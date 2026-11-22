import * as z from "zod";
import { performance } from "node:perf_hooks";

export async function ask<T>(
  schema: z.ZodType<T>,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  options: { signal?: AbortSignal; model?: string; endpoint?: string } = {},
) {
  const url = new URL(
    options.endpoint ??
      process.env.DETOUR_MODEL_URL ??
      "http://127.0.0.1:18084/v1/chat/completions",
  );
  if (
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search
  )
    throw Error("Loopback HTTP model endpoint required");
  const model = options.model ?? process.env.DETOUR_MODEL ?? "detour-qwen3-4b";
  const started = performance.now();
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(60000)])
      : AbortSignal.timeout(60000),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0,
      max_tokens: 900,
      chat_template_kwargs: { enable_thinking: false },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "engineering_decision",
          schema: z.toJSONSchema(schema),
        },
      },
    }),
  });
  if (!response.ok) throw Error("Model HTTP " + response.status);
  const text = await response.text();
  if (text.length > 64000) throw Error("Model envelope too large");
  const raw = JSON.parse(text),
    choice = raw.choices?.[0];
  if (
    choice?.finish_reason !== "stop" ||
    typeof choice.message?.content !== "string"
  )
    throw Error("Incomplete response");
  return {
    value: schema.parse(JSON.parse(choice.message.content)),
    elapsedMs: performance.now() - started,
    usage: raw.usage ?? null,
    servedModel: raw.model,
    raw: choice.message.content,
  };
}
