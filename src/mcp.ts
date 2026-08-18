import type { Engine } from "./engine";
import {
  coverage,
  drift,
  endpointSchema,
  findEndpoint,
  listSpecs,
  undocumented,
  violations,
  type McpDeps,
} from "./mcpTools";
import type { TrawlHost } from "./trawl";

const OBJECT = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object",
  properties,
  ...(required.length > 0 ? { required } : {}),
});

/** Registration must happen while the bundle initialises — that is how the
 *  host attributes a tool to this plugin. */
export function registerMcpTools(host: TrawlHost, engine: Engine): void {
  const deps: McpDeps = {
    specs: () => engine.store.list(),
    window: () => engine.window,
    stats: (specId, key) => engine.aggregates.forEndpoint(specId, key),
    undocumented: () => engine.aggregates.undocumented(),
    verdicts: () => engine.allVerdicts(),
    drift: (key) => engine.drift.report(key),
  };

  const tools = [
    {
      name: "list_specs",
      description:
        "The OpenAPI/Swagger specs loaded in Trawl: title, version, the hosts they are matched against, and how many endpoints each has.",
      inputSchema: OBJECT({}),
      handler: () => listSpecs(deps),
    },
    {
      name: "find_endpoint",
      description:
        "Find the endpoint documenting a path. Accepts a concrete path (/api/v3/pet/7) or a fragment (pet). Optional method narrows it.",
      inputSchema: OBJECT({ path: { type: "string" }, method: { type: "string" } }, ["path"]),
      handler: (args: unknown) => findEndpoint(deps, args as { path: string; method?: string }),
    },
    {
      name: "endpoint_schema",
      description:
        "Parameters, request body and documented responses of one endpoint. Use the key from find_endpoint, e.g. 'GET /pet/{petId}'.",
      inputSchema: OBJECT({ specId: { type: "string" }, key: { type: "string" } }, [
        "specId",
        "key",
      ]),
      handler: (args: unknown) => endpointSchema(deps, args as { specId: string; key: string }),
    },
    {
      name: "coverage",
      description:
        "Which endpoints were called in the current session window and which never were. Set onlyNeverCalled to list the untouched ones.",
      inputSchema: OBJECT({
        specId: { type: "string" },
        onlyNeverCalled: { type: "boolean" },
        limit: { type: "integer" },
      }),
      handler: (args: unknown) => coverage(deps, (args ?? {}) as { specId?: string }),
    },
    {
      name: "violations",
      description:
        "Captured responses that broke their documented schema, newest first, with JSON pointers to the offending fields.",
      inputSchema: OBJECT({ limit: { type: "integer" } }),
      handler: (args: unknown) => violations(deps, (args ?? {}) as { limit?: number }),
    },
    {
      name: "undocumented",
      description:
        "Paths called on a host bound to a spec that match no documented endpoint, with call counts.",
      inputSchema: OBJECT({}),
      handler: () => undocumented(deps),
    },
    {
      name: "drift",
      description:
        "For one endpoint: fields that arrive but are not described, and fields described but never seen. Measured from live responses only.",
      inputSchema: OBJECT({ key: { type: "string" } }, ["key"]),
      handler: (args: unknown) => drift(deps, args as { key: string }),
    },
  ];

  for (const tool of tools) void host.mcp.registerTool(tool);
  host.log(`openapi: ${tools.length} MCP tools registered`);
}
