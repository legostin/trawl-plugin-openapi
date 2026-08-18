import { expect, test } from "vitest";
import { parseSpec } from "./parse";
import { endpointKey } from "./model";

const MINIMAL = {
  openapi: "3.0.3",
  info: { title: "Billing API", version: "2.1.0" },
  servers: [{ url: "https://api.example.com/v2" }],
  paths: {
    "/users/{id}": {
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
      get: {
        operationId: "getUser",
        summary: "Read one user",
        tags: ["users"],
        parameters: [{ name: "expand", in: "query", schema: { type: "string" } }],
        responses: {
          "200": {
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
  },
};

test("a JSON 3.0 document yields title, version and servers", () => {
  const r = parseSpec(JSON.stringify(MINIMAL));
  if (!r.ok) throw new Error(r.error);
  expect(r.doc.title).toBe("Billing API");
  expect(r.doc.version).toBe("2.1.0");
  expect(r.doc.servers).toEqual(["https://api.example.com/v2"]);
});

test("operations become endpoints keyed by method and path", () => {
  const r = parseSpec(JSON.stringify(MINIMAL));
  if (!r.ok) throw new Error(r.error);
  expect(r.doc.endpoints.map(endpointKey)).toEqual(["GET /users/{id}"]);
  const e = r.doc.endpoints[0];
  expect(e.operationId).toBe("getUser");
  expect(e.tags).toEqual(["users"]);
  expect(e.responses["200"].contentTypes).toEqual(["application/json"]);
});

test("path-level parameters merge into every operation", () => {
  // A path-level parameter belongs to each operation under it; losing it would
  // later read as "undocumented parameter" on perfectly documented traffic.
  const r = parseSpec(JSON.stringify(MINIMAL));
  if (!r.ok) throw new Error(r.error);
  const names = r.doc.endpoints[0].params.map((p) => `${p.in}:${p.name}`);
  expect(names.sort()).toEqual(["path:id", "query:expand"]);
});

test("an operation-level parameter overrides the path-level one of the same name", () => {
  const doc = structuredClone(MINIMAL) as Record<string, any>;
  doc.paths["/users/{id}"].get.parameters.push({
    name: "id",
    in: "path",
    required: true,
    schema: { type: "integer" },
  });
  const r = parseSpec(JSON.stringify(doc));
  if (!r.ok) throw new Error(r.error);
  const id = r.doc.endpoints[0].params.find((p) => p.name === "id");
  expect(id?.schema?.type).toBe("integer");
});

test("YAML is accepted as readily as JSON", () => {
  const yaml = [
    "openapi: 3.1.0",
    "info:",
    "  title: Auth API",
    "  version: '1.0'",
    "paths:",
    "  /login:",
    "    post:",
    "      responses:",
    "        '204':",
    "          description: ok",
  ].join("\n");
  const r = parseSpec(yaml);
  if (!r.ok) throw new Error(r.error);
  expect(r.doc.title).toBe("Auth API");
  expect(r.doc.endpoints.map(endpointKey)).toEqual(["POST /login"]);
});

test("a document that is neither JSON nor YAML fails with a readable reason", () => {
  const r = parseSpec("<html><body>login page</body></html>");
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.error.toLowerCase()).toContain("not");
});

test("a document with no version marker is refused rather than guessed at", () => {
  const r = parseSpec(JSON.stringify({ info: { title: "x" }, paths: {} }));
  expect(r.ok).toBe(false);
});

test("schemas referenced from components arrive inlined on the endpoint", () => {
  const doc = {
    openapi: "3.0.0",
    info: { title: "T", version: "1" },
    components: {
      schemas: { User: { type: "object", properties: { id: { type: "string" } } } },
    },
    paths: {
      "/users": {
        get: {
          responses: {
            "200": {
              content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } },
            },
          },
        },
      },
    },
  };
  const r = parseSpec(JSON.stringify(doc));
  if (!r.ok) throw new Error(r.error);
  expect(r.doc.endpoints[0].responses["200"].schema?.properties?.id.type).toBe("string");
});

test("descriptions survive parsing — they are what a reader came for", () => {
  // The summary is a title; the description is the explanation. Dropping it
  // leaves the endpoint card saying what the operation is called and nothing
  // about what it does.
  const doc = {
    openapi: "3.0.0",
    info: { title: "T", version: "1" },
    paths: {
      "/pet/{petId}": {
        get: {
          summary: "Find pet by ID.",
          description: "Returns a single pet.",
          parameters: [
            {
              name: "petId",
              in: "path",
              required: true,
              description: "ID of pet to return",
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { name: { type: "string", description: "The pet's name" } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
  const r = parseSpec(JSON.stringify(doc));
  if (!r.ok) throw new Error(r.error);
  const e = r.doc.endpoints[0];
  expect(e.description).toBe("Returns a single pet.");
  expect(e.params[0].description).toBe("ID of pet to return");
  expect(e.responses["200"].schema?.properties?.name.description).toBe("The pet's name");
});
