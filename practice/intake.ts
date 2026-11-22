import { createHmac, timingSafeEqual } from "node:crypto";
export function sign(body: Buffer, timestamp: number, secret: string) {
  return createHmac("sha256", secret)
    .update(String(timestamp) + ".")
    .update(body)
    .digest("hex");
}
export function verifyEnvelope(
  body: Buffer,
  timestamp: string,
  signature: string,
  secret: string,
  now = Date.now(),
) {
  if (
    body.length > 4096 ||
    !/^\d{13}$/.test(timestamp) ||
    !Number.isSafeInteger(Number(timestamp)) ||
    Math.abs(now - Number(timestamp)) > 60000
  )
    throw Error("Invalid body or freshness");
  if (
    !/^[a-f0-9]{64}$/.test(signature) ||
    !timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(sign(body, Number(timestamp), secret), "hex"),
    )
  )
    throw Error("Signature mismatch");
  const event = JSON.parse(body.toString("utf8"));
  if (
    !event ||
    typeof event !== "object" ||
    Array.isArray(event) ||
    Object.keys(event).sort().join(",") !== "id,issue,version" ||
    !/^evt_[a-z0-9_]{1,40}$/.test(event.id) ||
    event.issue !== "TRIAGE-42" ||
    !Number.isSafeInteger(event.version) ||
    event.version < 1
  )
    throw Error("Invalid selected event");
  return event as { id: string; issue: "TRIAGE-42"; version: number };
}
