import type { BodySpec, Endpoint, Param, Schema, Violation, ViolationWhere } from "./model";
import type { FlowSample } from "./flow";
import type { Match } from "./match";

const typeName = (v: unknown): string => {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
};

const describe = (v: unknown): string => {
  const s = typeof v === "string" ? `"${v}"` : JSON.stringify(v);
  return s === undefined ? String(v) : s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

function typeMatches(expected: string, value: unknown): boolean {
  switch (expected) {
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number";
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array":
      return Array.isArray(value);
    case "null":
      return value === null;
    default:
      // An unknown type keyword is not a licence to invent a violation.
      return true;
  }
}

/**
 * Check `value` against `schema`, returning one violation per problem.
 *
 * Anything the plugin does not fully understand — an unresolved `$ref`, a
 * cycle, an unknown keyword, a schema with no `type` — checks nothing. The
 * cost of a false violation is a user chasing a bug that does not exist.
 */
export function validateValue(
  schema: Schema | undefined,
  value: unknown,
  where: ViolationWhere,
  pointer = "",
): Violation[] {
  if (!schema || schema.incomplete || schema.circular) return [];

  const out: Violation[] = [];
  const push = (expected: string, actual: string, at = pointer) =>
    out.push({ where, pointer: at, expected, actual });

  if (schema.oneOf || schema.anyOf) {
    const branches = schema.oneOf ?? schema.anyOf ?? [];
    const attempts = branches.map((b) => validateValue(b, value, where, pointer));
    if (attempts.some((a) => a.length === 0)) return [];
    // The closest branch is the informative one; the rest are noise.
    const best = attempts.reduce((a, b) => (b.length < a.length ? b : a), attempts[0] ?? []);
    return best.slice(0, 1);
  }

  const types =
    schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  const nullable = schema.nullable === true || types.includes("null");

  if (value === null) {
    if (!nullable && types.length > 0) push(types.join(" | "), "null");
    return out;
  }

  if (types.length > 0 && !types.some((t) => typeMatches(t, value))) {
    push(types.join(" | "), typeName(value));
    return out; // Deeper checks against the wrong type would only echo this.
  }

  if (schema.enum && !schema.enum.some((e) => e === value)) {
    push(`one of ${schema.enum.map(String).join(", ")}`, describe(value));
  }
  if (schema.const !== undefined && schema.const !== value) {
    push(describe(schema.const), describe(value));
  }

  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) =>
      out.push(...validateValue(schema.items, item, where, `${pointer}/${i}`)),
    );
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const missing = (schema.required ?? []).filter((name) => !(name in obj));
    if (missing.length > 0) push(`required: ${missing.join(", ")}`, "missing");

    for (const [name, child] of Object.entries(schema.properties ?? {})) {
      if (name in obj) out.push(...validateValue(child, obj[name], where, `${pointer}/${name}`));
    }
    if (schema.additionalProperties === false) {
      const known = new Set(Object.keys(schema.properties ?? {}));
      for (const name of Object.keys(obj)) {
        if (!known.has(name)) push("no additional properties", name, `${pointer}/${name}`);
      }
    }
  }

  return out;
}

export const MAX_BODY = 512 * 1024;

export interface ValidationResult {
  violations: Violation[];
  /** What was deliberately not checked, in words a user can read. */
  notes: string[];
}

/** Exact code, then its class ("2XX"), then "default" — the spec's own order. */
export function responseSpecFor(
  endpoint: Endpoint,
  status: number,
): { key: string; body: BodySpec } | null {
  const exact = String(status);
  const wildcard = `${Math.floor(status / 100)}XX`;
  for (const key of [exact, wildcard, wildcard.toLowerCase(), "default"]) {
    const body = endpoint.responses[key];
    if (body) return { key, body };
  }
  return null;
}

const isJson = (contentType: string | undefined): boolean =>
  contentType === undefined || contentType.includes("json");

/** Everything on the wire is a string; compare it as what the schema expects. */
function coerce(raw: string, param: Param): unknown {
  const types = param.schema?.type;
  const type = Array.isArray(types) ? types[0] : types;
  if (type === "number" || type === "integer") {
    const n = Number(raw);
    return raw.trim() !== "" && Number.isFinite(n) ? n : raw;
  }
  if (type === "boolean") {
    if (raw === "true") return true;
    if (raw === "false") return false;
  }
  return raw;
}

function validateBody(
  body: BodySpec | undefined,
  text: string | undefined,
  contentType: string | undefined,
  where: "request.body" | "response.body",
  notes: string[],
): Violation[] {
  if (!body?.schema || text === undefined) return [];
  if (text.length > MAX_BODY) {
    notes.push(`The ${where} was too large to check (${Math.round(text.length / 1024)} KB).`);
    return [];
  }
  if (!isJson(contentType)) {
    notes.push(`The ${where} is not JSON (${contentType}) — not checked against the schema.`);
    return [];
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [{ where, pointer: "", expected: "JSON", actual: "a body that does not parse" }];
  }
  return validateValue(body.schema, parsed, where);
}

function validateParams(match: Match, sample: FlowSample): Violation[] {
  const out: Violation[] = [];
  for (const param of match.endpoint.params) {
    if (param.in === "query") {
      const hits = sample.query.filter(([k]) => k === param.name);
      if (hits.length === 0) {
        if (param.required) {
          out.push({ where: "query", pointer: param.name, expected: "required", actual: "missing" });
        }
        continue;
      }
      out.push(
        ...validateValue(param.schema, coerce(hits[0][1], param), "query", param.name).map((v) => ({
          ...v,
          pointer: param.name,
        })),
      );
    } else if (param.in === "path") {
      const raw = match.pathParams[param.name];
      if (raw === undefined) continue;
      out.push(
        ...validateValue(param.schema, coerce(raw, param), "path", param.name).map((v) => ({
          ...v,
          pointer: param.name,
        })),
      );
    }
    // Header and cookie parameters are stage 3: the noise-to-signal ratio on
    // real traffic needs measuring before they are worth reporting.
  }
  return out;
}

/** Validate one captured request against the endpoint it matched. */
export function validateFlow(match: Match, sample: FlowSample): ValidationResult {
  const notes: string[] = [];
  const violations: Violation[] = [...validateParams(match, sample)];

  const statusViolation = (): Violation => ({
    where: "status",
    pointer: "",
    expected: `one of ${Object.keys(match.endpoint.responses).join(", ") || "nothing documented"}`,
    actual: String(sample.status),
  });

  if (!sample.hasBodies) {
    notes.push("Loaded from history — bodies were not captured, so only the call was counted.");
    if (sample.status !== undefined && !responseSpecFor(match.endpoint, sample.status)) {
      violations.push(statusViolation());
    }
    return { violations, notes };
  }

  violations.push(
    ...validateBody(
      match.endpoint.requestBody,
      sample.requestBody,
      sample.requestContentType,
      "request.body",
      notes,
    ),
  );

  if (sample.status === undefined) return { violations, notes };

  const response = responseSpecFor(match.endpoint, sample.status);
  if (!response) {
    violations.push(statusViolation());
    return { violations, notes };
  }

  const declared = response.body.contentTypes;
  if (
    declared.length > 0 &&
    sample.responseContentType &&
    !declared.some((c) => c.split(";")[0].trim().toLowerCase() === sample.responseContentType)
  ) {
    violations.push({
      where: "content-type",
      pointer: "",
      expected: declared.join(", "),
      actual: sample.responseContentType,
    });
  }

  violations.push(
    ...validateBody(
      response.body,
      sample.responseBody,
      sample.responseContentType,
      "response.body",
      notes,
    ),
  );

  return { violations, notes };
}
