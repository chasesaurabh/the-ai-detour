import { createHash } from "node:crypto";
export type Source = {
  id: string;
  version: string;
  authority: "requirement" | "implementation" | "observation" | "discussion";
  text: string;
  required: boolean;
  priority: number;
  retrievedAt: number;
  maxAgeMs: number;
};
export const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function selectContext(
  sources: Source[],
  maximumBytes: number,
  now: number,
) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 2)
    throw Error("Invalid byte budget");
  const ids = new Set<string>();
  for (const s of sources) {
    if (ids.has(s.id)) throw Error("Duplicate source identity");
    ids.add(s.id);
    if (s.retrievedAt > now || now - s.retrievedAt > s.maxAgeMs)
      throw Error("Stale or future source: " + s.id);
  }
  const ordered = [...sources].sort(
    (a, b) =>
      Number(b.required) - Number(a.required) ||
      b.priority - a.priority ||
      a.id.localeCompare(b.id),
  );
  const selected: Source[] = [],
    omitted: string[] = [];
  let bytes = 2;
  for (const source of ordered) {
    const cost =
      Buffer.byteLength(JSON.stringify(source), "utf8") +
      (selected.length ? 1 : 0);
    if (bytes + cost <= maximumBytes) {
      selected.push(source);
      bytes += cost;
    } else if (source.required)
      throw Error("Required context exceeds budget: " + source.id);
    else omitted.push(source.id);
  }
  const manifest = selected.map((s) => ({
    id: s.id,
    version: s.version,
    sha256: hash(s.text),
    authority: s.authority,
  }));
  return { selected, omitted, bytes, manifest, identity: hash(manifest) };
}
export function resolveRequirement(
  values: { source: string; value: string; rank: number }[],
) {
  if (!values.length) throw Error("Missing requirement");
  const rank = Math.max(...values.map((v) => v.rank)),
    top = values.filter((v) => v.rank === rank);
  if (new Set(top.map((v) => v.value)).size > 1)
    return { status: "needs_decision", sources: top.map((v) => v.source) };
  return {
    status: "resolved",
    value: top[0].value,
    sources: top.map((v) => v.source),
  };
}
export function detectRepeatedAction(
  history: { tool: string; args: unknown; sourceVersion: string }[],
  next: { tool: string; args: unknown; sourceVersion: string },
  allowed = 2,
) {
  return history.filter((item) => hash(item) === hash(next)).length >= allowed;
}
