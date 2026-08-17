import type { FlowSample } from "./flow";
import type { Endpoint, Spec } from "./model";

export interface Match {
  spec: Spec;
  endpoint: Endpoint;
  pathParams: Record<string, string>;
  /** Ids of other specs whose endpoint also matched. */
  alsoMatched: string[];
}

const segments = (path: string) => path.split("/").filter((s) => s.length > 0);

/** Path prefixes the traffic carries but the templates do not, longest first.
 *  `""` is always last so a spec whose servers are wrong still has a chance. */
export function basePaths(spec: Spec): string[] {
  const paths = new Set<string>();
  for (const server of spec.servers) {
    let path = "";
    try {
      path = new URL(server).pathname;
    } catch {
      path = server.startsWith("/") ? server : "";
    }
    path = path.replace(/\/+$/, "");
    if (path && path !== "/") paths.add(path);
  }
  return [...paths].sort((a, b) => b.length - a.length).concat("");
}

export function matchPath(template: string, path: string): Record<string, string> | null {
  const t = segments(template);
  const p = segments(path);
  if (t.length !== p.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < t.length; i += 1) {
    const seg = t[i];
    if (seg.startsWith("{") && seg.endsWith("}")) {
      params[seg.slice(1, -1)] = decodeURIComponent(p[i]);
    } else if (seg !== p[i]) {
      return null;
    }
  }
  return params;
}

/** Literal segments beat parameters: `/users/me` must win over `/users/{id}`. */
export function specificity(template: string): number {
  return segments(template).filter((s) => !s.startsWith("{")).length;
}

function matchInSpec(spec: Spec, sample: FlowSample): Match | null {
  if (!spec.hosts.includes(sample.host)) return null;
  let best: { endpoint: Endpoint; pathParams: Record<string, string>; score: number } | null = null;
  for (const base of basePaths(spec)) {
    if (base && !sample.path.startsWith(base)) continue;
    const rest = base ? sample.path.slice(base.length) || "/" : sample.path;
    for (const endpoint of spec.endpoints) {
      if (endpoint.method !== sample.method) continue;
      const pathParams = matchPath(endpoint.pathTemplate, rest);
      if (!pathParams) continue;
      const score = specificity(endpoint.pathTemplate) * 100 + base.length;
      if (!best || score > best.score) best = { endpoint, pathParams, score };
    }
  }
  return best
    ? { spec, endpoint: best.endpoint, pathParams: best.pathParams, alsoMatched: [] }
    : null;
}

/** First match wins; the rest are reported so an ambiguity is visible. */
export function matchFlow(specs: Spec[], sample: FlowSample): Match | null {
  const hits = specs.map((s) => matchInSpec(s, sample)).filter((m): m is Match => m !== null);
  if (hits.length === 0) return null;
  return { ...hits[0], alsoMatched: hits.slice(1).map((m) => m.spec.id) };
}
