import type { FlowSample } from "./flow";
import type { Match } from "./match";
import type { FlowQuery } from "./trawl";
import type { ValidationResult } from "./validate";
import { endpointKey } from "./model";

export type SessionWindow = "capture" | "project" | "filter";

export interface WindowContext {
  /** When the proxy last started; the default window begins here. */
  captureStartedAt: number;
  projectId?: string;
  /** The host's traffic filter, used by the "filter" window. */
  hostFilter?: FlowQuery;
}

export function windowFilter(window: SessionWindow, ctx: WindowContext): FlowQuery {
  if (window === "filter") return { ...(ctx.hostFilter ?? {}) };
  const base: FlowQuery = ctx.projectId ? { projectId: ctx.projectId } : {};
  return window === "capture" ? { ...base, startTs: ctx.captureStartedAt } : base;
}

/** How many moments back the sparkline reads. Bounded on purpose: a busy
 *  endpoint would otherwise grow this list without end. */
const MOMENT_CAP = 40;

export interface EndpointStats {
  calls: number;
  violations: number;
  lastTs?: number;
  /** Timestamps of the most recent calls, oldest first. */
  moments: number[];
}

export interface UndocumentedRow {
  method: string;
  host: string;
  path: string;
  count: number;
}

const UNDOCUMENTED_CAP = 200;
const EMPTY: EndpointStats = { calls: 0, violations: 0, moments: [] };

/** Per-endpoint counters plus the tally of calls nothing documents. */
export class Aggregates {
  private stats = new Map<string, EndpointStats>();
  private unknown = new Map<string, UndocumentedRow>();
  private dropped = 0;

  record(sample: FlowSample, match: Match | null, result: ValidationResult): void {
    if (!match) {
      const key = `${sample.method} ${sample.host}${sample.path}`;
      const row = this.unknown.get(key);
      if (row) {
        row.count += 1;
      } else if (this.unknown.size < UNDOCUMENTED_CAP) {
        this.unknown.set(key, {
          method: sample.method,
          host: sample.host,
          path: sample.path,
          count: 1,
        });
      } else {
        this.dropped += 1;
      }
      return;
    }
    const key = `${match.spec.id} ${endpointKey(match.endpoint)}`;
    const current = this.stats.get(key) ?? { calls: 0, violations: 0, moments: [] };
    current.calls += 1;
    if (result.violations.length > 0) current.violations += 1;
    current.lastTs = Math.max(current.lastTs ?? 0, sample.ts);
    current.moments.push(sample.ts);
    if (current.moments.length > MOMENT_CAP) current.moments.shift();
    this.stats.set(key, current);
  }

  forEndpoint(specId: string, key: string): EndpointStats {
    return this.stats.get(`${specId} ${key}`) ?? EMPTY;
  }

  undocumented(): UndocumentedRow[] {
    return [...this.unknown.values()].sort((a, b) => b.count - a.count);
  }

  /** How many distinct undocumented paths were dropped at the cap. */
  droppedUndocumented(): number {
    return this.dropped;
  }

  totals(): { calls: number; violations: number; endpoints: number } {
    let calls = 0;
    let violations = 0;
    for (const s of this.stats.values()) {
      calls += s.calls;
      violations += s.violations;
    }
    return { calls, violations, endpoints: this.stats.size };
  }

  reset(): void {
    this.stats.clear();
    this.unknown.clear();
    this.dropped = 0;
  }
}
