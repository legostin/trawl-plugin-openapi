import { expect, test } from "vitest";
import { buildRequest } from "./tryit";
import type { Endpoint, Spec } from "./model";
import type { FlowSample } from "./flow";

const spec = (patch: Partial<Spec> = {}): Spec => ({
  id: "s",
  source: { kind: "text", ref: "pasted" },
  title: "Petstore",
  version: "1",
  servers: ["/api/v3"],
  hosts: ["petstore3.swagger.io"],
  endpoints: [],
  fetchedAt: 0,
  raw: "",
  ...patch,
});

const endpoint = (patch: Partial<Endpoint> = {}): Endpoint => ({
  method: "GET",
  pathTemplate: "/pet/{petId}",
  tags: [],
  params: [{ name: "petId", in: "path", required: true, schema: { type: "integer" } }],
  responses: {},
  security: [],
  ...patch,
});

test("the URL is built from the bound host and the server's base path", () => {
  expect(buildRequest(spec(), endpoint()).url).toBe("https://petstore3.swagger.io/api/v3/pet/0");
});

test("an absolute server URL is used as it stands", () => {
  const s = spec({ servers: ["https://api.example.com/v2"], hosts: ["api.example.com"] });
  expect(buildRequest(s, endpoint()).url).toBe("https://api.example.com/v2/pet/0");
});

test("path values from a real previous call beat generated ones", () => {
  // "/pet/0" 404s; the id that was actually used usually works.
  const last: FlowSample = {
    id: 1,
    ts: 0,
    method: "GET",
    host: "petstore3.swagger.io",
    path: "/api/v3/pet/9",
    query: [],
    hasBodies: false,
  };
  expect(buildRequest(spec(), endpoint(), last).url).toBe(
    "https://petstore3.swagger.io/api/v3/pet/9",
  );
});

test("required query parameters are filled in, optional ones are left out", () => {
  const e = endpoint({
    params: [
      {
        name: "status",
        in: "query",
        required: true,
        schema: { type: "string", enum: ["available"] },
      },
      { name: "page", in: "query", required: false, schema: { type: "integer" } },
    ],
    pathTemplate: "/pet/findByStatus",
  });
  const url = buildRequest(spec(), e).url;
  expect(url).toContain("?status=available");
  expect(url).not.toContain("page");
});

test("a request body is generated from the schema, as JSON", () => {
  const e = endpoint({
    method: "POST",
    pathTemplate: "/pet",
    params: [],
    requestBody: {
      contentTypes: ["application/json"],
      schema: { type: "object", properties: { name: { type: "string" } } },
    },
  });
  const r = buildRequest(spec(), e);
  expect(r.method).toBe("POST");
  expect(JSON.parse(r.rawBody ?? "")).toEqual({ name: "string" });
  expect(r.headers).toContainEqual({ key: "content-type", value: "application/json" });
});

test("a secured endpoint gets an authorization header pointing at a project variable", () => {
  // {{token}} resolves in the HTTP Client, so the secret never lands in a URL.
  const e = endpoint({ security: ["bearerAuth"] });
  expect(buildRequest(spec(), e).headers).toContainEqual({
    key: "authorization",
    value: "Bearer {{token}}",
  });
});

test("an unbound spec still produces a usable URL from its server", () => {
  const s = spec({ servers: ["https://api.example.com"], hosts: [] });
  expect(buildRequest(s, endpoint()).url).toBe("https://api.example.com/pet/0");
});

test("a spec with neither host nor absolute server falls back to a visible placeholder", () => {
  // Better an obviously wrong host than a silently malformed URL.
  const s = spec({ servers: ["/api"], hosts: [] });
  expect(buildRequest(s, endpoint()).url).toBe("https://HOST-NOT-SET/api/pet/0");
});
