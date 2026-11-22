import { MongoClient, ObjectId, type Collection } from 'mongodb';

export const localUri = 'mongodb://127.0.0.1:27128';
interface TicketDocument {
  _id: ObjectId;
  title: string;
  status: 'open' | 'closed';
  priority: number;
  dueAt: string | null;
}
export interface Ticket {
  id: string;
  title: string;
  status: 'open' | 'closed';
  priority: number;
  dueAt: string | null;
}

/** Explicit-offset timestamps, with at most millisecond precision. */
export function instant(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new Error('Expected an ISO timestamp with an explicit timezone');
  const [, ys, mos, ds, hs, mis, ss, , zone] = match;
  const [year, month, day, hour, minute, second] = [ys, mos, ds, hs, mis, ss].map(Number) as [number, number, number, number, number, number];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offsetHour = zone === 'Z' ? 0 : Number(zone!.slice(1, 3));
  const offsetMinute = zone === 'Z' ? 0 : Number(zone!.slice(4, 6));
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]! || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) {
    throw new Error('Invalid timestamp');
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error('Invalid timestamp');
  return parsed;
}

function ticket(doc: TicketDocument): Ticket {
  const { _id, ...fields } = doc;
  return { id: _id.toHexString(), ...fields };
}

export class Store {
  private constructor(private client: MongoClient, private tickets: Collection<TicketDocument>) {}

  static async connect(database: string, uri = localUri): Promise<Store> {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(database)) throw new Error('Invalid database name');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    try {
      await client.connect();
      await client.db(database).command({ ping: 1 });
      return new Store(client, client.db(database).collection<TicketDocument>('tickets'));
    } catch (error) {
      await client.close();
      throw error;
    }
  }

  async disconnect(): Promise<void> { await this.client.close(); }

  async add(title: string, priority = 2, dueAt: string | null = null): Promise<string> {
    if (typeof title !== 'string' || !title.trim()) throw new Error('Title must not be empty');
    if (!Number.isInteger(priority) || ![1, 2, 3].includes(priority)) throw new Error('Priority must be 1, 2 or 3');
    if (dueAt !== null) instant(dueAt);
    const _id = new ObjectId();
    await this.tickets.insertOne({ _id, title: title.trim(), status: 'open', priority, dueAt });
    return _id.toHexString();
  }

  async close(id: string): Promise<void> {
    if (!/^[0-9a-f]{24}$/i.test(id)) throw new Error('Invalid ticket ID');
    const changed = await this.tickets.updateOne({ _id: new ObjectId(id) }, { $set: { status: 'closed' } });
    if (changed.matchedCount !== 1) throw new Error('Ticket does not exist');
  }

  async list(): Promise<Ticket[]> {
    return (await this.tickets.find().sort({ _id: 1 }).toArray()).map(ticket);
  }

  async overdue(asOf: string): Promise<Ticket[]> {
    const cutoff = instant(asOf);
    const rows = await this.tickets.find({ status: 'open', dueAt: { $ne: null } }).toArray();
    // The teaching application preserves the original input timestamp.
    const dated = rows.map(row => ({ due: instant(row.dueAt!), row }));
    dated.sort((a, b) => a.due - b.due || a.row._id.toHexString().localeCompare(b.row._id.toHexString()));
    return dated.filter(({ due }) => due < cutoff).map(({ row }) => ticket(row));
  }
}
