type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === "object" && v !== null && !Array.isArray(v);

const METHODS = ["get", "put", "post", "delete", "options", "head", "patch"];

/** Everything a 2.0 parameter carries that is really schema, not plumbing. */
const SCHEMA_KEYS = [
  "type",
  "format",
  "enum",
  "items",
  "default",
  "maximum",
  "minimum",
  "maxLength",
  "minLength",
  "pattern",
  "uniqueItems",
];

function serverUrl(root: Dict): string {
  const schemes = Array.isArray(root.schemes) ? root.schemes : [];
  const scheme = typeof schemes[0] === "string" ? schemes[0] : "https";
  const host = typeof root.host === "string" ? root.host : "";
  const basePath = typeof root.basePath === "string" ? root.basePath : "";
  if (!host) return "";
  return `${scheme}://${host}${basePath}`;
}

/** `#/definitions/X` → `#/components/schemas/X`, everywhere it appears. */
function retargetRefs(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(retargetRefs);
  if (!isDict(node)) return node;
  const out: Dict = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] =
      k === "$ref" && typeof v === "string"
        ? v.replace("#/definitions/", "#/components/schemas/")
        : retargetRefs(v);
  }
  return out;
}

function convertOperation(op: Dict, root: Dict): Dict {
  const consumes = Array.isArray(op.consumes) ? op.consumes : root.consumes;
  const produces = Array.isArray(op.produces) ? op.produces : root.produces;
  const contentType = (list: unknown): string =>
    Array.isArray(list) && typeof list[0] === "string" ? list[0] : "application/json";

  const params = Array.isArray(op.parameters) ? op.parameters.filter(isDict) : [];
  const body = params.find((p) => p.in === "body");
  const formData = params.filter((p) => p.in === "formData");

  const converted: Dict = { ...op };
  delete converted.consumes;
  delete converted.produces;

  converted.parameters = params
    .filter((p) => p.in !== "body" && p.in !== "formData")
    .map((p) => {
      const schema: Dict = {};
      for (const key of SCHEMA_KEYS) if (p[key] !== undefined) schema[key] = p[key];
      const out: Dict = { name: p.name, in: p.in, required: p.required === true };
      if (Object.keys(schema).length > 0) out.schema = schema;
      return out;
    });

  if (body) {
    converted.requestBody = {
      required: body.required === true,
      content: { [contentType(consumes)]: { schema: body.schema } },
    };
  } else if (formData.length > 0) {
    const properties: Dict = {};
    for (const f of formData) {
      const schema: Dict = {};
      for (const key of SCHEMA_KEYS) if (f[key] !== undefined) schema[key] = f[key];
      properties[String(f.name)] = schema;
    }
    converted.requestBody = {
      content: {
        "application/x-www-form-urlencoded": { schema: { type: "object", properties } },
      },
    };
  }

  if (isDict(op.responses)) {
    const responses: Dict = {};
    for (const [status, raw] of Object.entries(op.responses)) {
      if (!isDict(raw)) continue;
      const { schema, ...rest } = raw;
      responses[status] = schema
        ? { ...rest, content: { [contentType(produces)]: { schema } } }
        : rest;
    }
    converted.responses = responses;
  }

  return converted;
}

/** A Swagger 2.0 document reshaped into the 3.x form the parser reads. */
export function swagger2ToOpenApi(root: Dict): Dict {
  const paths: Dict = {};
  const rawPaths = isDict(root.paths) ? root.paths : {};
  for (const [path, itemRaw] of Object.entries(rawPaths)) {
    if (!isDict(itemRaw)) continue;
    const item: Dict = {};
    if (Array.isArray(itemRaw.parameters)) item.parameters = itemRaw.parameters;
    for (const method of METHODS) {
      const op = itemRaw[method];
      if (isDict(op)) item[method] = convertOperation(op, root);
    }
    paths[path] = item;
  }

  const url = serverUrl(root);
  const converted: Dict = {
    openapi: "3.0.0",
    info: root.info,
    servers: url ? [{ url }] : [],
    paths,
    components: { schemas: isDict(root.definitions) ? root.definitions : {} },
  };
  if (isDict(root.securityDefinitions)) converted.security = root.security;
  return retargetRefs(converted) as Dict;
}
