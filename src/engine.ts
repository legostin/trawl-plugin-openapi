import { sampleFromFlow, sampleFromRow, type FlowSample } from "./flow";
import { matchFlow, type Match } from "./match";
import { endpointKey, type Verdict } from "./model";
import { Aggregates, windowFilter, type SessionWindow } from "./session";
import { SpecStore } from "./store";
import type { FlowQuery, FlowRow, HostFlow, TrawlHost } from "./trawl";
import { Drift } from "./drift";
import { MAX_BODY, responseSpecFor, validateFlow } from "./validate";

const VERDICT_CAP = 2000;
const PAGE = 500;

/**
 * The plugin's live brain: created when the bundle loads, so counting starts
 * with the app rather than when the user first opens the mode.
 */
export class Engine {
  readonly store: SpecStore;
  readonly aggregates = new Aggregates();
  readonly drift = new Drift();
  window: SessionWindow = "capture";
  /** Set while history is being replayed, for the UI to show. */
  backfilling = false;

  private verdicts = new Map<number, Verdict>();
  private recentByEndpoint = new Map<string, Verdict[]>();
  private listeners = new Set<() => void>();
  private captureStartedAt = Date.now();
  private hostFilter: FlowQuery = {};
  /** Live samples keep their bodies so a window switch does not silently
   *  downgrade an already-validated flow to a body-less history row. */
  private liveSamples = new Map<number, FlowSample>();

  constructor(private host: TrawlHost) {
    this.store = new SpecStore(host);
  }

  subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private emit() {
    this.listeners.forEach((cb) => cb());
  }

  async start(): Promise<void> {
    await this.store.load();
    this.host.flows.subscribe((flow) =>
      this.ingest(sampleFromFlow(flow as HostFlow, this.host.util.bodyText)),
    );
    this.host.events.on("capture:started", () => {
      this.captureStartedAt = Date.now();
      void this.rebuild();
    });
    this.host.events.on("filter:changed", (f) => {
      this.hostFilter = (f ?? {}) as FlowQuery;
      if (this.window === "filter") void this.rebuild();
    });
    this.host.projects.onChange(() => void this.reload());
    // A spec that changed invalidates every verdict measured against it.
    this.store.subscribe(() => void this.rebuild());
    await this.rebuild();
  }

  async reload(): Promise<void> {
    await this.store.load();
    await this.rebuild();
  }

  setWindow(window: SessionWindow): void {
    this.window = window;
    void this.rebuild();
  }

  /** Replay the chosen window from history. Bodies are absent there, so those
   *  flows are counted and status-checked but never body-validated. */
  async rebuild(): Promise<void> {
    this.aggregates.reset();
    this.drift.reset();
    this.verdicts.clear();
    this.recentByEndpoint.clear();
    this.backfilling = true;
    this.emit();
    const filter = windowFilter(this.window, {
      captureStartedAt: this.captureStartedAt,
      projectId: this.host.projects.active()?.id,
      hostFilter: this.hostFilter,
    });
    for (let offset = 0; ; offset += PAGE) {
      const rows: FlowRow[] = await this.host.flows.query(filter, PAGE, offset);
      if (rows.length === 0) break;
      // A flow seen live still has its bodies; re-reading it from history would
      // drop the violations already found in it.
      for (const row of rows) {
        this.ingest(this.liveSamples.get(row.id) ?? sampleFromRow(row), false);
      }
      this.emit();
      if (rows.length < PAGE) break;
    }
    this.backfilling = false;
    this.emit();
  }

  private ingest(sample: FlowSample, notify = true): void {
    if (sample.hasBodies) {
      this.liveSamples.set(sample.id, sample);
      if (this.liveSamples.size > VERDICT_CAP) {
        const oldest = this.liveSamples.keys().next().value;
        if (oldest !== undefined) this.liveSamples.delete(oldest);
      }
    }
    const specs = this.store.list();
    const bound = specs.some((s) => s.hosts.includes(sample.host));
    const match: Match | null = bound ? matchFlow(specs, sample) : null;
    const result = match ? validateFlow(match, sample) : { violations: [], notes: [] };
    this.aggregates.record(sample, match, result);

    // Drift needs a real body, so only live samples feed it. Parsing here
    // costs one extra JSON.parse per matched response — cheap next to the
    // validation that already ran, and only for bodies small enough to check.
    if (match && sample.hasBodies && sample.responseBody && sample.status !== undefined) {
      const response = responseSpecFor(match.endpoint, sample.status);
      if (response?.body.schema && sample.responseBody.length <= MAX_BODY) {
        try {
          this.drift.record(
            endpointKey(match.endpoint),
            response.body.schema,
            JSON.parse(sample.responseBody),
          );
        } catch {
          // A body that does not parse is already reported as a violation.
        }
      }
    }

    const verdict: Verdict = {
      flowId: sample.id,
      ts: sample.ts,
      httpStatus: sample.status,
      specId: match?.spec.id,
      endpointKey: match ? endpointKey(match.endpoint) : undefined,
      status: !bound
        ? "unmapped"
        : !match
          ? "undocumented"
          : result.violations.length > 0
            ? "violations"
            : "ok",
      violations: result.violations,
      notes: result.notes,
      alsoMatched: match?.alsoMatched.length ? match.alsoMatched : undefined,
    };
    this.remember(verdict);
    if (notify) this.emit();
  }

  private remember(verdict: Verdict): void {
    this.verdicts.set(verdict.flowId, verdict);
    if (this.verdicts.size > VERDICT_CAP) {
      const oldest = this.verdicts.keys().next().value;
      if (oldest !== undefined) this.verdicts.delete(oldest);
    }
    if (!verdict.specId || !verdict.endpointKey) return;
    const key = `${verdict.specId} ${verdict.endpointKey}`;
    const list = this.recentByEndpoint.get(key) ?? [];
    list.unshift(verdict);
    this.recentByEndpoint.set(key, list.slice(0, 20));
  }

  verdictFor(flowId: number): Verdict | undefined {
    return this.verdicts.get(flowId);
  }

  recent(specId: string, key: string): Verdict[] {
    return this.recentByEndpoint.get(`${specId} ${key}`) ?? [];
  }
}

let engine: Engine | null = null;

export function startEngine(host: TrawlHost): Engine {
  engine ??= new Engine(host);
  return engine;
}

export function getEngine(): Engine | null {
  return engine;
}
