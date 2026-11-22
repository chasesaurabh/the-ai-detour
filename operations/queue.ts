import { MongoClient, type Collection } from "mongodb";
import { randomUUID } from "node:crypto";
import { digest } from "./policies.ts";
import * as z from "zod";
export const eventSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),
    kind: z.enum(["issue", "scheduled"]),
    issue: z.literal("TRIAGE-42"),
    dueAt: z.number().int().nonnegative(),
  })
  .strict();
export type Event = z.infer<typeof eventSchema>;
type Job = {
  _id: string;
  event: Event;
  hash: string;
  status: "queued" | "running" | "done" | "dead" | "cancelled";
  attempts: number;
  owner?: string;
  leaseUntil?: number;
  result?: unknown;
};
export class Queue {
  private jobs: Collection<Job>;
  constructor(client: MongoClient, namespace: string) {
    if (!/^[a-z][a-z0-9_]{0,40}$/.test(namespace))
      throw Error("Invalid namespace");
    this.jobs = client.db("ai_detour_ops").collection<Job>("jobs_" + namespace);
  }
  async enqueue(input: unknown) {
    const event = eventSchema.parse(input),
      hash = digest(event);
    try {
      await this.jobs.insertOne({
        _id: event.id,
        event,
        hash,
        status: "queued",
        attempts: 0,
      });
      return "inserted";
    } catch (error: any) {
      if (error.code !== 11000) throw error;
      const prior = await this.jobs.findOne({ _id: event.id });
      if (prior?.hash !== hash)
        throw Error("Duplicate event ID has different payload");
      return "duplicate";
    }
  }
  async claim(now = Date.now(), leaseMs = 6000) {
    if (leaseMs < 100 || leaseMs > 120000) throw Error("Invalid lease");
    const owner = randomUUID();
    return this.jobs.findOneAndUpdate(
      {
        $and: [
          { "event.dueAt": { $lte: now } },
          { attempts: { $lt: 3 } },
          {
            $or: [
              { status: "queued" },
              { status: "running", leaseUntil: { $lte: now } },
            ],
          },
        ],
      },
      {
        $set: { status: "running", owner, leaseUntil: now + leaseMs },
        $inc: { attempts: 1 },
      },
      { sort: { "event.dueAt": 1, _id: 1 }, returnDocument: "after" },
    );
  }
  async renew(id: string, owner: string, leaseMs = 6000) {
    const now = Date.now();
    return (
      (
        await this.jobs.updateOne(
          { _id: id, status: "running", owner, leaseUntil: { $gt: now } },
          { $set: { leaseUntil: now + leaseMs } },
        )
      ).modifiedCount === 1
    );
  }
  async finish(job: Job, result: unknown) {
    return (
      (
        await this.jobs.updateOne(
          {
            _id: job._id,
            status: "running",
            owner: job.owner,
            leaseUntil: { $gt: Date.now() },
          },
          { $set: { status: "done", result } },
        )
      ).modifiedCount === 1
    );
  }
  async cancel(id: string) {
    return (
      (
        await this.jobs.updateOne(
          { _id: id, status: { $in: ["queued", "running"] } },
          { $set: { status: "cancelled" } },
        )
      ).modifiedCount === 1
    );
  }
  async deadExpired(now = Date.now()) {
    return (
      await this.jobs.updateMany(
        { status: "running", leaseUntil: { $lte: now }, attempts: { $gte: 3 } },
        { $set: { status: "dead" } },
      )
    ).modifiedCount;
  }
  async rows() {
    return this.jobs.find({}).sort({ _id: 1 }).toArray();
  }
}
