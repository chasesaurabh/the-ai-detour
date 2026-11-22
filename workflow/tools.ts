import { createHash } from 'node:crypto';
import * as z from 'zod';

// Synthetic incident and deliberately faulty implementation. No production data.
export const artifacts = {
  issue: { revision: 'issue-v1', text: 'TRIAGE-42: An open ticket due at 2026-11-21T09:30:00-05:00 appears overdue at 2026-11-21T14:00:00Z. Investigate whether the overdue comparison is wrong. Produce a diagnosis with evidence and a proposed next step. Do not change code or close the ticket.' },
  contract: { revision: 'contract-v1', text: 'Overdue means due instant strictly earlier than evaluation instant. Equivalent instants and future instants must be excluded. Input strings have explicit timezone offsets. Preserve stored strings; compare instants. This diagnostic exercise is read-only.' },
  implementation: { revision: 'candidate-v1', text: 'export function isOverdue(due: string, now: string) { return due < now; }' },
};
export const fingerprint = createHash('sha256').update(JSON.stringify(artifacts) + isOverdue.toString()).digest('hex');
export const readSchema = z.object({ key: z.enum(['issue', 'contract', 'implementation']) }).strict();
export const probeSchema = z.object({ scenario: z.enum(['offsets', 'boundary']) }).strict();
export const resultSchema = z.object({ id: z.string(), revision: z.string(), sha256: z.string(), retrievedAt: z.string(), data: z.unknown() }).strict();
export type Evidence = z.infer<typeof resultSchema>;
export type ToolName = 'read_context' | 'run_probe';
export const toolGuide = 'read_context args {"key":"issue"|"contract"|"implementation"}; run_probe args {"scenario":"offsets"|"boundary"}. Both are read-only and return evidence IDs. No other tools exist.';
export function describeTools() { return [{name:'read_context',description:'Read one synthetic incident artifact',inputSchema:z.toJSONSchema(readSchema)}, {name:'run_probe',description:'Run a fixed comparison probe against the seeded candidate',inputSchema:z.toJSONSchema(probeSchema)}]; }
export function executeTool(name: string, args: unknown): Evidence {
  let id: string, revision: string, data: unknown;
  if (name === 'read_context') {
    const { key } = readSchema.parse(args);
    id = key; revision = artifacts[key].revision; data = artifacts[key].text;
  } else if (name === 'run_probe') {
    const { scenario } = probeSchema.parse(args);
    const cases = scenario === 'offsets' ? [
      { due: '2026-11-21T09:30:00-05:00', now: '2026-11-21T14:00:00Z', expected: false },
      { due: '2026-11-21T15:00:00+02:00', now: '2026-11-21T14:00:00Z', expected: true },
    ] : [{ due: '2026-11-21T09:00:00-05:00', now: '2026-11-21T14:00:00Z', expected: false }];
    id = 'probe-' + scenario; revision = 'candidate-v1';
    data = cases.map(c => ({ ...c, actual: isOverdue(c.due, c.now), dueInstant: new Date(c.due).toISOString(), passes: isOverdue(c.due, c.now) === c.expected }));
  } else throw new Error('Tool is not allowed');
  return { id, revision, sha256: createHash('sha256').update(JSON.stringify(data)).digest('hex'), retrievedAt: new Date().toISOString(), data };
}
// Deliberately seeded defect; kept separate from the working application's Store.
export function isOverdue(due: string, now: string) { return due < now; }
