import { expect, test } from "vitest";
import { swagger2ToOpenApi } from "./swagger2";
import { parseSpec } from "./parse";
import { endpointKey } from "./model";

const V2 = {
  swagger: "2.0",
  info: { title: "Legacy API", version: "1.4" },
  host: "api.legacy.test",
  basePath: "/v1",
  schemes: ["https"],
  consumes: ["application/json"],
  produces: ["application/json"],
  definitions: {
    User: { type: "object", properties: { id: { type: "string" } } },
  },
  paths: {
    "/users/{id}": {
      get: {
        parameters: [{ name: "id", in: "path", required: true, type: "string" }],
        responses: { "200": { schema: { $ref: "#/definitions/User" } } },
      },
      post: {
        parameters: [
          { name: "body", in: "body", required: true, schema: { $ref: "#/definitions/User" } },
        ],
        responses: { "201": {} },
      },
    },
  },
};

test("host, basePath and scheme become a server URL", () => {
  const doc = swagger2ToOpenApi(V2);
  expect(doc.servers).toEqual([{ url: "https://api.legacy.test/v1" }]);
});

test("definitions move to components/schemas so $refs still resolve", () => {
  const r = parseSpec(JSON.stringify(V2));
  if (!r.ok) throw new Error(r.error);
  const get = r.doc.endpoints.find((e) => e.method === "GET");
  expect(get?.responses["200"].schema?.properties?.id.type).toBe("string");
});

test("a non-body parameter keeps its type as a schema", () => {
  const r = parseSpec(JSON.stringify(V2));
  if (!r.ok) throw new Error(r.error);
  const id = r.doc.endpoints[0].params.find((p) => p.name === "id");
  expect(id?.schema?.type).toBe("string");
});

test("the body parameter becomes requestBody with the operation's consumes", () => {
  const r = parseSpec(JSON.stringify(V2));
  if (!r.ok) throw new Error(r.error);
  const post = r.doc.endpoints.find((e) => e.method === "POST");
  expect(post?.requestBody?.contentTypes).toEqual(["application/json"]);
  expect(post?.requestBody?.schema?.properties?.id.type).toBe("string");
  expect(post?.params.some((p) => p.name === "body")).toBe(false);
});

test("responses carry the produces content type", () => {
  const r = parseSpec(JSON.stringify(V2));
  if (!r.ok) throw new Error(r.error);
  const get = r.doc.endpoints.find((e) => e.method === "GET");
  expect(get?.responses["200"].contentTypes).toEqual(["application/json"]);
});

test("parsing reports the title from a 2.0 document", () => {
  const r = parseSpec(JSON.stringify(V2));
  if (!r.ok) throw new Error(r.error);
  expect(r.doc.title).toBe("Legacy API");
  expect(r.doc.endpoints.map(endpointKey).sort()).toEqual([
    "GET /users/{id}",
    "POST /users/{id}",
  ]);
});
