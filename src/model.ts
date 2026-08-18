/** The JSON Schema subset this plugin understands. Anything outside it is
 *  carried through untouched and marked `incomplete` rather than guessed at. */
export interface Schema {
  type?: string | string[];
  format?: string;
  enum?: unknown[];
  const?: unknown;
  nullable?: boolean;
  required?: string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  items?: Schema;
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  example?: unknown;
  /** Why this node could not be fully resolved (external $ref, depth cap). */
  incomplete?: string;
  /** A node that points back at an ancestor. Generation stops here. */
  circular?: boolean;
}

export type ParamIn = "path" | "query" | "header" | "cookie";

export interface Param {
  name: string;
  in: ParamIn;
  required: boolean;
  schema?: Schema;
}

export interface BodySpec {
  contentTypes: string[];
  schema?: Schema;
  example?: unknown;
}

export interface Endpoint {
  method: string;
  pathTemplate: string;
  operationId?: string;
  tags: string[];
  summary?: string;
  params: Param[];
  /** Keyed by the spec's own status keys: "200", "4XX", "default". */
  responses: Record<string, BodySpec>;
  requestBody?: BodySpec;
  security: string[];
  /** Set when part of this operation could not be resolved. */
  incomplete?: string;
}

export interface SpecDoc {
  title: string;
  version: string;
  servers: string[];
  endpoints: Endpoint[];
}

export type SpecSourceKind = "url" | "file" | "text";

export interface SpecSource {
  kind: SpecSourceKind;
  /** URL, file name, or "pasted". */
  ref: string;
  headers?: [string, string][];
}

export interface SpecChange {
  /** `"GET /users/{id}"` — the endpoint that changed. */
  key: string;
  detail: string;
  /** True when an existing client could break because of this. */
  breaking: boolean;
}

export interface Spec extends SpecDoc {
  id: string;
  source: SpecSource;
  /** Hosts this spec is matched against in traffic. Editable by the user. */
  hosts: string[];
  fetchedAt: number;
  raw: string;
  /** What changed at the last refresh, kept so the Drift tab survives a restart. */
  lastDiff?: SpecChange[];
  lastDiffAt?: number;
  /** Endpoint key → the id of the mock rule created for it. */
  mocks?: Record<string, string>;
}

export type ViolationWhere =
  | "response.body"
  | "request.body"
  | "query"
  | "path"
  | "header"
  | "status"
  | "content-type";

export interface Violation {
  where: ViolationWhere;
  /** JSON pointer inside the body, or the parameter name. */
  pointer: string;
  expected: string;
  actual: string;
}

export type VerdictStatus = "ok" | "violations" | "undocumented" | "unmapped";

export interface Verdict {
  flowId: number;
  ts: number;
  specId?: string;
  /** `"GET /users/{id}"` — the matched endpoint. */
  endpointKey?: string;
  status: VerdictStatus;
  httpStatus?: number;
  violations: Violation[];
  /** What was deliberately not checked, in words the UI can show. */
  notes: string[];
  /** Other specs whose endpoint also matched; validation used `specId`. */
  alsoMatched?: string[];
}

export function endpointKey(e: Endpoint): string {
  return `${e.method} ${e.pathTemplate}`;
}

let seq = 0;
export function uid(prefix = "id"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}
