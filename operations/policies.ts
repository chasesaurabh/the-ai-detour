import { createHash } from "node:crypto";
export const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export type Report = { revision: string; passed: boolean; checks: string[] };
export function acceptReport(
  candidate: string,
  report: Report,
  required: string[],
) {
  if (report.revision !== candidate) throw Error("Stale candidate evidence");
  if (!report.passed || required.some((c) => !report.checks.includes(c)))
    throw Error("Acceptance evidence incomplete");
  return true;
}
export class RetryableReadError extends Error {}
export async function retryRead<T>(
  read: () => Promise<T>,
  signal: AbortSignal,
  onAttempt: (n: number) => void = () => {},
) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    signal.throwIfAborted();
    onAttempt(attempt);
    try {
      return await read();
    } catch (error) {
      if (!(error instanceof RetryableReadError) || attempt === 3) throw error;
      await new Promise<void>((resolve, reject) => {
        const onAbort = () => {
          clearTimeout(timer);
          reject(signal.reason);
        };
        const timer = setTimeout(() => {
          signal.removeEventListener("abort", onAbort);
          resolve();
        }, attempt * 50);
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
      });
    }
  }
  throw Error("Unreachable");
}
export function checkProposal(
  proposal: { candidate: string; scope: string },
  approval: {
    candidate: string;
    scope: string;
    expiresAt: number;
    approved: boolean;
  },
  now = Date.now(),
) {
  if (
    !approval.approved ||
    approval.candidate !== proposal.candidate ||
    approval.scope !== proposal.scope ||
    approval.expiresAt <= now
  )
    throw Error("Approval does not cover this exact candidate/action/time");
  return true;
}
