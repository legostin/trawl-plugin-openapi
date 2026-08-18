import { exampleFor } from "./example";
import type { FlowSample } from "./flow";
import { basePaths, matchPath } from "./match";
import type { Endpoint, Spec } from "./model";

export interface OpenPayload {
  method: string;
  url: string;
  rawBody?: string;
  /** The HTTP Client takes objects, not tuples. */
  headers: { key: string; value: string }[];
}

/** The origin to send to: an absolute server if the spec has one, otherwise
 *  the host the user bound, otherwise a placeholder that cannot be mistaken
 *  for a working URL. */
function origin(spec: Spec): { origin: string; base: string } {
  for (const server of spec.servers) {
    try {
      const url = new URL(server);
      return { origin: url.origin, base: url.pathname.replace(/\/+$/, "") };
    } catch {
      // Relative server ("/api/v3") — the host has to come from the binding.
    }
  }
  const base = basePaths(spec).find((p) => p.length > 0) ?? "";
  return { origin: `https://${spec.hosts[0] ?? "HOST-NOT-SET"}`, base };
}

/** Path values taken from a real call beat generated ones: `/pet/0` 404s,
 *  while the id that actually appeared in traffic usually works. */
function pathValuesFromLastCall(
  spec: Spec,
  endpoint: Endpoint,
  last: FlowSample | undefined,
): Record<string, string> {
  if (!last) return {};
  for (const base of basePaths(spec)) {
    if (base && !last.path.startsWith(base)) continue;
    const rest = base ? last.path.slice(base.length) || "/" : last.path;
    const params = matchPath(endpoint.pathTemplate, rest);
    if (params) return params;
  }
  return {};
}

export function buildRequest(spec: Spec, endpoint: Endpoint, lastCall?: FlowSample): OpenPayload {
  const { origin: root, base } = origin(spec);
  const known = pathValuesFromLastCall(spec, endpoint, lastCall);

  const path = endpoint.pathTemplate.replace(/\{([^}]+)\}/g, (_whole, name: string) => {
    if (known[name] !== undefined) return known[name];
    const param = endpoint.params.find((p) => p.in === "path" && p.name === name);
    const value = exampleFor(param?.schema);
    return encodeURIComponent(String(value ?? "0"));
  });

  const query = endpoint.params
    .filter((p) => p.in === "query" && p.required)
    .map(
      (p) =>
        `${encodeURIComponent(p.name)}=${encodeURIComponent(String(exampleFor(p.schema) ?? ""))}`,
    )
    .join("&");

  const headers: { key: string; value: string }[] = [];
  const body = endpoint.requestBody?.schema ? exampleFor(endpoint.requestBody.schema) : undefined;
  if (body !== undefined && body !== null) {
    headers.push({
      key: "content-type",
      value: endpoint.requestBody?.contentTypes[0] ?? "application/json",
    });
  }
  for (const p of endpoint.params.filter((p) => p.in === "header" && p.required)) {
    headers.push({ key: p.name, value: String(exampleFor(p.schema) ?? "") });
  }
  if (endpoint.security.length > 0) {
    headers.push({ key: "authorization", value: "Bearer {{token}}" });
  }

  return {
    method: endpoint.method,
    url: `${root}${base}${path}${query ? `?${query}` : ""}`,
    rawBody: body !== undefined && body !== null ? JSON.stringify(body, null, 2) : undefined,
    headers,
  };
}
