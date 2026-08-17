import type { Schema } from "./model";

const MAX_DEPTH = 40;

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);

/** "#/components/schemas/User" → the node, or undefined. */
function pointerTarget(ref: string, root: unknown): unknown {
  const parts = ref
    .slice(2)
    .split("/")
    .map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
  let node: unknown = root;
  for (const part of parts) {
    if (!isDict(node)) return undefined;
    node = node[part];
  }
  return node;
}

function mergeAllOf(members: Schema[]): Schema {
  const out: Schema = { type: "object", properties: {} };
  const required = new Set<string>();
  for (const m of members) {
    if (m.incomplete && !out.incomplete) out.incomplete = m.incomplete;
    for (const name of m.required ?? []) required.add(name);
    Object.assign(out.properties!, m.properties ?? {});
    if (m.additionalProperties !== undefined && out.additionalProperties === undefined) {
      out.additionalProperties = m.additionalProperties;
    }
  }
  if (required.size > 0) out.required = [...required];
  return out;
}

/**
 * Inline internal `$ref`s, merge `allOf`, and stop at cycles and at the depth
 * cap. Anything that cannot be resolved is marked `incomplete` and kept — a
 * missing check is cheaper than a violation reported against a schema the
 * plugin never actually understood.
 *
 * `seen` carries the `$ref` strings currently being expanded, which is what
 * makes `User.friends[]: User` terminate.
 */
export function resolveSchema(
  schema: unknown,
  root: unknown,
  depth = 0,
  seen: ReadonlySet<string> = new Set(),
): Schema | undefined {
  if (!isDict(schema)) return undefined;
  if (depth > MAX_DEPTH) return { incomplete: "nested deeper than the plugin follows" };

  const ref = schema.$ref;
  if (typeof ref === "string") {
    if (!ref.startsWith("#/")) {
      return { incomplete: `external $ref (${ref}) — not followed` };
    }
    if (seen.has(ref)) return { circular: true };
    const target = pointerTarget(ref, root);
    if (target === undefined) return { incomplete: `$ref not found: ${ref}` };
    return resolveSchema(target, root, depth + 1, new Set([...seen, ref]));
  }

  const out: Schema = {};
  for (const [key, value] of Object.entries(schema)) {
    switch (key) {
      case "properties": {
        if (!isDict(value)) break;
        out.properties = {};
        for (const [name, child] of Object.entries(value)) {
          const resolved = resolveSchema(child, root, depth + 1, seen);
          if (resolved) out.properties[name] = resolved;
        }
        break;
      }
      case "items":
        out.items = resolveSchema(value, root, depth + 1, seen);
        break;
      case "additionalProperties":
        out.additionalProperties =
          typeof value === "boolean" ? value : resolveSchema(value, root, depth + 1, seen);
        break;
      case "oneOf":
      case "anyOf": {
        if (!Array.isArray(value)) break;
        out[key] = value
          .map((b) => resolveSchema(b, root, depth + 1, seen))
          .filter((b): b is Schema => b !== undefined);
        break;
      }
      case "allOf":
        break; // handled below, once the rest of the node has been copied
      default:
        (out as Dict)[key] = value;
    }
  }

  if (Array.isArray(schema.allOf)) {
    const members = schema.allOf
      .map((m) => resolveSchema(m, root, depth + 1, seen))
      .filter((m): m is Schema => m !== undefined);
    return mergeAllOf([...members, out]);
  }
  return out;
}
