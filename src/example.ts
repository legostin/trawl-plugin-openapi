import type { Schema } from "./model";

const MAX_DEPTH = 12;

/** Values that read as placeholders at a glance. A realistic-looking fake is
 *  worse than an obvious one: it gets mistaken for real data. */
const BY_FORMAT: Record<string, string> = {
  "date-time": "2026-01-01T00:00:00Z",
  date: "2026-01-01",
  uuid: "00000000-0000-4000-8000-000000000000",
  email: "user@example.com",
  uri: "https://example.com",
  hostname: "example.com",
  ipv4: "192.0.2.1",
  byte: "ZXhhbXBsZQ==",
  password: "password",
};

export function exampleFor(schema: Schema | undefined, depth = 0): unknown {
  if (!schema || schema.incomplete || schema.circular || depth > MAX_DEPTH) return null;
  if (schema.example !== undefined) return schema.example;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  const branches = schema.oneOf ?? schema.anyOf;
  if (branches && branches.length > 0) return exampleFor(branches[0], depth + 1);

  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const type = types.find((t) => t !== "null") ?? types[0];

  switch (type) {
    case "string":
      return (schema.format && BY_FORMAT[schema.format]) ?? "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return true;
    case "null":
      return null;
    case "array":
      return schema.items ? [exampleFor(schema.items, depth + 1)] : [];
    case "object": {
      const out: Record<string, unknown> = {};
      for (const [name, child] of Object.entries(schema.properties ?? {})) {
        out[name] = exampleFor(child, depth + 1);
      }
      return out;
    }
    default:
      return null;
  }
}
