import { endpointKey, type Endpoint, type Spec } from "./model";
import type { EndpointStats } from "./session";

export type CoverageState = "violations" | "called" | "never";

export interface CoverageRow {
  key: string;
  endpoint: Endpoint;
  calls: number;
  violations: number;
  state: CoverageState;
}

/** What needs attention first: broken, then untouched, then healthy. */
const RANK: Record<CoverageState, number> = { violations: 0, never: 1, called: 2 };

export function coverageRows(spec: Spec, stats: (key: string) => EndpointStats): CoverageRow[] {
  return spec.endpoints
    .map((endpoint) => {
      const key = endpointKey(endpoint);
      const { calls, violations } = stats(key);
      const state: CoverageState = violations > 0 ? "violations" : calls > 0 ? "called" : "never";
      return { key, endpoint, calls, violations, state };
    })
    .sort(
      (a, b) => RANK[a.state] - RANK[b.state] || b.calls - a.calls || a.key.localeCompare(b.key),
    );
}

export function coverageSummary(rows: CoverageRow[]): {
  total: number;
  called: number;
  percent: number;
} {
  const total = rows.length;
  const called = rows.filter((r) => r.calls > 0).length;
  return { total, called, percent: total === 0 ? 0 : Math.round((called / total) * 100) };
}
