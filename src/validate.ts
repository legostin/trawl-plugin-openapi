import type { Schema, Violation, ViolationWhere } from "./model";

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
