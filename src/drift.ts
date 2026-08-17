import type { Schema } from "./model";

const MAX_PATHS = 200;
const MAX_DEPTH = 12;

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Every field path the schema describes. Array items collapse to `[]` so a
 *  list of 500 objects is one path, not five hundred. */
export function schemaPaths(schema: Schema | undefined, prefix = "", depth = 0): Set<string> {
  const out = new Set<string>();
  if (!schema || depth > MAX_DEPTH || schema.incomplete || schema.circular) return out;

  for (const branch of [...(schema.oneOf ?? []), ...(schema.anyOf ?? [])]) {
    for (const p of schemaPaths(branch, prefix, depth + 1)) out.add(p);
  }
  for (const [name, child] of Object.entries(schema.properties ?? {})) {
    const path = `${prefix}/${name}`;
    out.add(path);
    for (const p of schemaPaths(child, path, depth + 1)) out.add(p);
  }
  if (schema.items) {
    const path = `${prefix}[]`;
    out.add(path);
    for (const p of schemaPaths(schema.items, path, depth + 1)) out.add(p);
  }
  return out;
}

/** Every field path present in an actual body, arrays collapsed the same way. */
export function valuePaths(value: unknown, prefix = "", depth = 0): Set<string> {
  const out = new Set<string>();
  if (depth > MAX_DEPTH) return out;
  if (Array.isArray(value)) {
    if (value.length > 0) {
      const path = `${prefix}[]`;
      out.add(path);
      // Items of one array share a shape; sampling the first few is enough and
      // keeps a 10k-element response cheap.
      for (const item of value.slice(0, 5)) {
        for (const p of valuePaths(item, path, depth + 1)) out.add(p);
      }
    }
    return out;
  }
  if (!isPlainObject(value)) return out;
  for (const [name, child] of Object.entries(value)) {
    const path = `${prefix}/${name}`;
    out.add(path);
    for (const p of valuePaths(child, path, depth + 1)) out.add(p);
  }
  return out;
}

export interface DriftReport {
  /** Arrived, but the schema never mentions it. */
  undocumented: string[];
  /** Described, but never once arrived. */
  neverSeen: string[];
  samples: number;
  dropped: number;
}

interface Entry {
  documented: Set<string>;
  seen: Set<string>;
  undocumented: Set<string>;
  samples: number;
  dropped: number;
}

/** What the spec promises versus what the wire actually carries, accumulated
 *  across every live response for an endpoint. */
export class Drift {
  private entries = new Map<string, Entry>();

  record(key: string, schema: Schema | undefined, value: unknown): void {
    // An unresolved schema documents nothing, so every field would look like
    // drift. Skipping is the honest answer.
    if (!schema || schema.incomplete || schema.circular) return;

    const entry = this.entries.get(key) ?? {
      documented: schemaPaths(schema),
      seen: new Set<string>(),
      undocumented: new Set<string>(),
      samples: 0,
      dropped: 0,
    };
    entry.samples += 1;

    for (const path of valuePaths(value)) {
      entry.seen.add(path);
      if (entry.documented.has(path)) continue;
      if (entry.undocumented.size < MAX_PATHS) entry.undocumented.add(path);
      else entry.dropped += 1;
    }
    this.entries.set(key, entry);
  }

  report(key: string): DriftReport | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    return {
      undocumented: [...entry.undocumented].sort(),
      neverSeen: [...entry.documented].filter((p) => !entry.seen.has(p)).sort(),
      samples: entry.samples,
      dropped: entry.dropped,
    };
  }

  keys(): string[] {
    return [...this.entries.keys()];
  }

  reset(): void {
    this.entries.clear();
  }
}
