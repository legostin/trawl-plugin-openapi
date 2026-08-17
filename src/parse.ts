import { load } from "js-yaml";
import type { BodySpec, Endpoint, Param, ParamIn, SpecDoc } from "./model";
import { resolveSchema } from "./refs";
import { swagger2ToOpenApi } from "./swagger2";

export type ParseResult = { ok: true; doc: SpecDoc } | { ok: false; error: string };

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"];

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);

/** JSON first (cheap and strict), then YAML — a YAML parser accepts JSON too,
 *  but its error messages are worse for what is usually a JSON document. */
function loadDocument(text: string): Dict | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) {
    try {
      const doc: unknown = JSON.parse(trimmed);
      return isDict(doc) ? doc : null;
    } catch {
      return null;
    }
  }
  try {
    const doc = load(trimmed);
    return isDict(doc) ? doc : null;
  } catch {
    return null;
  }
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function contentOf(container: unknown, root: Dict): BodySpec {
  const content = isDict(container) ? container.content : undefined;
  if (!isDict(content)) return { contentTypes: [] };
  const contentTypes = Object.keys(content);
  const first = content[contentTypes[0]];
  const media = isDict(first) ? first : {};
  return {
    contentTypes,
    schema: resolveSchema(media.schema, root),
    example: media.example,
  };
}

function paramsOf(raw: unknown, root: Dict): Param[] {
  if (!Array.isArray(raw)) return [];
  const out: Param[] = [];
  for (const item of raw) {
    if (!isDict(item)) continue;
    // A parameter can itself be a $ref into components/parameters.
    const p = typeof item.$ref === "string" ? resolveSchema(item, root) : item;
    if (!isDict(p)) continue;
    const where = str(p.in);
    if (!["path", "query", "header", "cookie"].includes(where)) continue;
    out.push({
      name: str(p.name),
      in: where as ParamIn,
      required: p.required === true || where === "path",
      schema: resolveSchema(p.schema, root),
    });
  }
  return out;
}

/** Operation parameters win over path-level ones with the same name+location. */
function mergeParams(pathLevel: Param[], operation: Param[]): Param[] {
  const key = (p: Param) => `${p.in}:${p.name}`;
  const merged = new Map(pathLevel.map((p) => [key(p), p]));
  for (const p of operation) merged.set(key(p), p);
  return [...merged.values()];
}

function securityOf(op: Dict, root: Dict): string[] {
  const raw = Array.isArray(op.security) ? op.security : root.security;
  if (!Array.isArray(raw)) return [];
  const names = new Set<string>();
  for (const entry of raw) {
    if (isDict(entry)) Object.keys(entry).forEach((n) => names.add(n));
  }
  return [...names];
}

function endpointsOf(root: Dict): Endpoint[] {
  const paths = isDict(root.paths) ? root.paths : {};
  const out: Endpoint[] = [];
  for (const [pathTemplate, pathItemRaw] of Object.entries(paths)) {
    if (!isDict(pathItemRaw)) continue;
    const pathLevel = paramsOf(pathItemRaw.parameters, root);
    for (const method of METHODS) {
      const op = pathItemRaw[method];
      if (!isDict(op)) continue;
      const responses: Record<string, BodySpec> = {};
      if (isDict(op.responses)) {
        for (const [status, body] of Object.entries(op.responses)) {
          responses[status] = contentOf(body, root);
        }
      }
      out.push({
        method: method.toUpperCase(),
        pathTemplate,
        operationId: typeof op.operationId === "string" ? op.operationId : undefined,
        tags: Array.isArray(op.tags) ? op.tags.filter((t): t is string => typeof t === "string") : [],
        summary: typeof op.summary === "string" ? op.summary : undefined,
        params: mergeParams(pathLevel, paramsOf(op.parameters, root)),
        requestBody: isDict(op.requestBody) ? contentOf(op.requestBody, root) : undefined,
        responses,
        security: securityOf(op, root),
      });
    }
  }
  return out;
}

function serversOf(root: Dict): string[] {
  if (!Array.isArray(root.servers)) return [];
  return root.servers.map((s) => (isDict(s) ? str(s.url) : "")).filter((url) => url.length > 0);
}

export function parseSpec(text: string): ParseResult {
  const root = loadDocument(text);
  if (!root) return { ok: false, error: "This is not a JSON or YAML document." };

  if (typeof root.openapi !== "string" && typeof root.swagger !== "string") {
    return {
      ok: false,
      error: "No `openapi` or `swagger` version field — this does not look like an API spec.",
    };
  }
  if (typeof root.swagger === "string" && !root.swagger.startsWith("2.")) {
    return { ok: false, error: `Swagger ${root.swagger} is not supported.` };
  }

  const doc = typeof root.swagger === "string" ? swagger2ToOpenApi(root) : root;
  const info = isDict(doc.info) ? doc.info : {};
  return {
    ok: true,
    doc: {
      title: str(info.title, "Untitled API"),
      version: str(info.version, ""),
      servers: serversOf(doc),
      endpoints: endpointsOf(doc),
    },
  };
}
