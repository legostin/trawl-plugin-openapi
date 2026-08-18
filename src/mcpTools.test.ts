import { expect, test } from "vitest";
import {
  SCHEMA_CAP,
  coverage,
  drift,
  endpointSchema,
  findEndpoint,
  listSpecs,
  undocumented,
  violations,
  type McpDeps,
} from "./mcpTools";
import type { Endpoint, Schema, Spec, Verdict } from "./model";

const ep = (method: string, pathTemplate: string, patch: Partial<Endpoint> = {}): Endpoint => ({
  method,
  pathTemplate,
  tags: ["pet"],
  summary: `${method} a pet`,
  params: [{ name: "petId", in: "path", required: true, schema: { type: "integer" } }],
  responses: {
    "200": {
      contentTypes: ["application/json"],
      schema: { type: "object", properties: { id: { type: "integer" } } },
    },
  },
  security: [],
  ...patch,
});

const spec: Spec = {
  id: "s1",
  source: { kind: "url", ref: "https://x/openapi.json" },
  title: "Petstore",
  version: "1.0",
  servers: ["/api/v3"],
  hosts: ["petstore3.swagger.io"],
  endpoints: [ep("GET", "/pet/{petId}"), ep("POST", "/pet"), ep("DELETE", "/pet/{petId}")],
  fetchedAt: 0,
  raw: "",
};

const deps = (overrides: Partial<McpDeps> = {}): McpDeps => ({
  specs: () => [spec],
  window: () => "capture",
  stats: () => ({ calls: 0, violations: 0 }),
  undocumented: () => [],
  verdicts: () => [],
  drift: () => null,
  ...overrides,
});

test("list_specs reports what is loaded and what it is bound to", () => {
  expect(listSpecs(deps())).toEqual([
    {
      id: "s1",
      title: "Petstore",
      version: "1.0",
      hosts: ["petstore3.swagger.io"],
      servers: ["/api/v3"],
      endpoints: 3,
      source: "https://x/openapi.json",
    },
  ]);
});

test("find_endpoint matches a concrete path against templates", () => {
  const hits = findEndpoint(deps(), { path: "/api/v3/pet/7" });
  expect(hits.map((h) => h.key)).toEqual(["GET /pet/{petId}", "DELETE /pet/{petId}"]);
});

test("find_endpoint narrows by method when one is given", () => {
  expect(
    findEndpoint(deps(), { path: "/api/v3/pet/7", method: "delete" }).map((h) => h.key),
  ).toEqual(["DELETE /pet/{petId}"]);
});

test("find_endpoint also accepts a fragment of the template", () => {
  // An agent usually knows "/pet" long before it knows a real id.
  expect(findEndpoint(deps(), { path: "pet" }).length).toBe(3);
});

test("find_endpoint says so plainly when nothing matches", () => {
  expect(findEndpoint(deps(), { path: "/nowhere" })).toEqual([]);
});

test("endpoint_schema returns parameters and the response schema", () => {
  const s = endpointSchema(deps(), { specId: "s1", key: "GET /pet/{petId}" });
  expect(s.params).toEqual([
    { name: "petId", in: "path", required: true, type: "integer", enum: undefined },
  ]);
  expect(s.responses["200"].schema).toMatchObject({ type: "object" });
  expect(s.truncated).toBe(false);
});

test("endpoint_schema truncates a giant schema instead of flooding the agent", () => {
  const wide: Record<string, Schema> = {};
  for (let i = 0; i < 4000; i += 1) wide[`field${i}`] = { type: "string" };
  const big: Spec = {
    ...spec,
    endpoints: [
      ep("GET", "/big", {
        responses: {
          "200": {
            contentTypes: ["application/json"],
            schema: { type: "object", properties: wide },
          },
        },
      }),
    ],
  };
  const s = endpointSchema(deps({ specs: () => [big] }), { specId: "s1", key: "GET /big" });
  expect(s.truncated).toBe(true);
  expect(JSON.stringify(s.responses).length).toBeLessThanOrEqual(SCHEMA_CAP + 500);
});

test("endpoint_schema refuses an unknown endpoint rather than returning nothing", () => {
  expect(() => endpointSchema(deps(), { specId: "s1", key: "GET /ghost" })).toThrow(/not found/i);
});

test("coverage reports the window, the summary and the rows", () => {
  const stats = (_specId: string, key: string) =>
    key === "GET /pet/{petId}" ? { calls: 4, violations: 1 } : { calls: 0, violations: 0 };
  const c = coverage(deps({ stats }), {});
  expect(c.window).toBe("capture");
  expect(c.summary).toEqual({ total: 3, called: 1, percent: 33 });
  expect(c.rows[0]).toMatchObject({ key: "GET /pet/{petId}", calls: 4, violations: 1 });
});

test("coverage can return only what was never called", () => {
  const c = coverage(deps(), { onlyNeverCalled: true });
  expect(c.rows).toHaveLength(3);
  expect(c.rows.every((r) => r.calls === 0)).toBe(true);
});

test("violations returns the most recent ones, newest first, within the limit", () => {
  const list: Verdict[] = [1, 2, 3].map((n) => ({
    flowId: n,
    ts: n * 10,
    specId: "s1",
    endpointKey: "GET /pet/{petId}",
    status: "violations",
    httpStatus: 200,
    violations: [{ where: "response.body", pointer: "/id", expected: "integer", actual: "string" }],
    notes: [],
  }));
  const v = violations(deps({ verdicts: () => list }), { limit: 2 });
  expect(v.map((x) => x.flowId)).toEqual([3, 2]);
  expect(v[0].violations[0].pointer).toBe("/id");
});

test("violations ignores verdicts that had none", () => {
  const clean: Verdict[] = [
    { flowId: 1, ts: 1, status: "ok", violations: [], notes: [] },
    { flowId: 2, ts: 2, status: "undocumented", violations: [], notes: [] },
  ];
  expect(violations(deps({ verdicts: () => clean }), {})).toEqual([]);
});

test("undocumented passes the tally through", () => {
  const rows = [{ method: "POST", host: "h", path: "/ghost", count: 3 }];
  expect(undocumented(deps({ undocumented: () => rows }))).toEqual(rows);
});

test("drift reports both directions, or says it has no samples", () => {
  const report = { undocumented: ["/referrer"], neverSeen: ["/plan"], samples: 5, dropped: 0 };
  expect(drift(deps({ drift: () => report }), { key: "GET /pet/{petId}" })).toEqual(report);
  expect(drift(deps(), { key: "GET /pet/{petId}" })).toBeNull();
});
