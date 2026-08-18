import { coverageRows, coverageSummary } from "./coverage";
import type { DriftReport } from "./drift";
import { basePaths, matchPath } from "./match";
import { endpointKey, type Endpoint, type Spec, type Verdict } from "./model";
import type { EndpointStats, SessionWindow, UndocumentedRow } from "./session";

/** A serialized schema beyond this is cut: an agent's context is worth more
 *  than the tail of a 4000-property object. */
export const SCHEMA_CAP = 8000;

export interface McpDeps {
  specs(): Spec[];
  window(): SessionWindow;
  stats(specId: string, key: string): EndpointStats;
  undocumented(): UndocumentedRow[];
  /** Every verdict still cached; the tools sort and filter. */
  verdicts(): Verdict[];
  drift(key: string): DriftReport | null;
}

export function listSpecs(deps: McpDeps) {
  return deps.specs().map((s) => ({
    id: s.id,
    title: s.title,
    version: s.version,
    hosts: s.hosts,
    servers: s.servers,
    endpoints: s.endpoints.length,
    source: s.source.ref,
  }));
}

export interface EndpointHit {
  specId: string;
  key: string;
  summary?: string;
  tags: string[];
}

/**
 * Two modes, told apart by the leading slash: a concrete path is matched
 * against the templates, anything else is a substring search. An agent usually
 * knows "pet" long before it knows a real id, and "pet" must not be read as
 * the literal path of `POST /pet`.
 */
export function findEndpoint(deps: McpDeps, args: { path: string; method?: string }): EndpointHit[] {
  const method = args.method?.toUpperCase();
  const hits: EndpointHit[] = [];
  const push = (spec: Spec, e: Endpoint) =>
    hits.push({ specId: spec.id, key: endpointKey(e), summary: e.summary, tags: e.tags });

  if (args.path.startsWith("/")) {
    for (const spec of deps.specs()) {
      for (const e of spec.endpoints) {
        if (method && e.method !== method) continue;
        const matched = basePaths(spec).some((base) => {
          if (base && !args.path.startsWith(base)) return false;
          const rest = base ? args.path.slice(base.length) || "/" : args.path;
          return matchPath(e.pathTemplate, rest) !== null;
        });
        if (matched) push(spec, e);
      }
    }
    if (hits.length > 0) return hits;
  }

  const needle = args.path.toLowerCase();
  for (const spec of deps.specs()) {
    for (const e of spec.endpoints) {
      if (method && e.method !== method) continue;
      if (e.pathTemplate.toLowerCase().includes(needle)) push(spec, e);
    }
  }
  return hits;
}

function cap(value: unknown): { value: unknown; truncated: boolean } {
  const json = JSON.stringify(value) ?? "";
  return json.length <= SCHEMA_CAP
    ? { value, truncated: false }
    : { value: undefined, truncated: true };
}

const TOO_BIG = "(too large — read it in the plugin)";

export function endpointSchema(deps: McpDeps, args: { specId: string; key: string }) {
  const spec = deps.specs().find((s) => s.id === args.specId);
  const endpoint = spec?.endpoints.find((e) => endpointKey(e) === args.key);
  if (!spec || !endpoint) throw new Error(`endpoint not found: ${args.key}`);

  const responses: Record<string, { contentTypes: string[]; schema?: unknown }> = {};
  let truncated = false;
  for (const [status, body] of Object.entries(endpoint.responses)) {
    const capped = cap(body.schema);
    truncated ||= capped.truncated;
    responses[status] = {
      contentTypes: body.contentTypes,
      schema: capped.truncated ? TOO_BIG : capped.value,
    };
  }
  const requestBody = endpoint.requestBody ? cap(endpoint.requestBody.schema) : undefined;
  truncated ||= requestBody?.truncated ?? false;

  return {
    specId: spec.id,
    key: args.key,
    summary: endpoint.summary,
    security: endpoint.security,
    params: endpoint.params.map((p) => ({
      name: p.name,
      in: p.in,
      required: p.required,
      type: Array.isArray(p.schema?.type) ? p.schema?.type.join(" | ") : p.schema?.type,
      enum: p.schema?.enum,
    })),
    requestBody: endpoint.requestBody
      ? {
          contentTypes: endpoint.requestBody.contentTypes,
          schema: requestBody?.truncated ? TOO_BIG : requestBody?.value,
        }
      : undefined,
    responses,
    truncated,
  };
}

export function coverage(
  deps: McpDeps,
  args: { specId?: string; onlyNeverCalled?: boolean; limit?: number },
) {
  const specs = args.specId ? deps.specs().filter((s) => s.id === args.specId) : deps.specs();
  const all = specs.flatMap((spec) =>
    coverageRows(spec, (key) => deps.stats(spec.id, key)).map((r) => ({
      specId: spec.id,
      key: r.key,
      calls: r.calls,
      violations: r.violations,
      state: r.state,
    })),
  );
  const rows = args.onlyNeverCalled ? all.filter((r) => r.calls === 0) : all;
  const summary = coverageSummary(
    specs.flatMap((spec) => coverageRows(spec, (key) => deps.stats(spec.id, key))),
  );
  return { window: deps.window(), summary, rows: rows.slice(0, args.limit ?? 100) };
}

export function violations(deps: McpDeps, args: { limit?: number }) {
  return deps
    .verdicts()
    .filter((v) => v.violations.length > 0)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, args.limit ?? 20)
    .map((v) => ({
      flowId: v.flowId,
      ts: v.ts,
      specId: v.specId,
      endpoint: v.endpointKey,
      httpStatus: v.httpStatus,
      violations: v.violations,
      notes: v.notes,
    }));
}

export function undocumented(deps: McpDeps) {
  return deps.undocumented();
}

export function drift(deps: McpDeps, args: { key: string }): DriftReport | null {
  return deps.drift(args.key);
}
