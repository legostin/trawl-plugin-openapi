import { exampleFor } from "./example";
import { basePaths } from "./match";
import type { Endpoint, Spec } from "./model";

export interface MockDraft {
  name: string;
  pattern: string;
  phase: "handler";
  script: string;
}

/** Rule patterns are globs over `host + path`; a `{param}` becomes `*`. */
export function mockPattern(spec: Spec, endpoint: Endpoint): string {
  const host = spec.hosts[0] ?? "*";
  const base = basePaths(spec).find((p) => p.length > 0) ?? "";
  const path = endpoint.pathTemplate.replace(/\{[^}]+\}/g, "*");
  return `${host}${base}${path}`;
}

/**
 * A handler rule that answers instead of the server. The host's own tests
 * confirm a handler may return a literal `{ status, headers, body }` without
 * ever calling `send`, which is exactly what a mock needs.
 */
export function buildMock(spec: Spec, endpoint: Endpoint, status: number): MockDraft {
  const response = endpoint.responses[String(status)];
  const contentType = response?.contentTypes[0] ?? "application/json";
  const example = response?.schema ? exampleFor(response.schema) : undefined;
  const body = example === undefined || example === null ? "" : JSON.stringify(example, null, 2);

  const script = [
    `// Generated from the OpenAPI spec "${spec.title}".`,
    `// Answers on its own: the real server is deliberately never called.`,
    `return {`,
    `  status: ${status},`,
    `  headers: { 'content-type': '${contentType}' },`,
    body ? `  body: \`${body.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\`,` : `  body: '',`,
    `};`,
  ].join("\n");

  return {
    name: `mock ${endpoint.method} ${endpoint.pathTemplate} → ${status} (openapi)`,
    pattern: mockPattern(spec, endpoint),
    phase: "handler",
    script,
  };
}
