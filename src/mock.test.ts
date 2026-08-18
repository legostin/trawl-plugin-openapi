import { expect, test } from "vitest";
import { buildMock, mockPattern } from "./mock";
import type { Endpoint, Spec } from "./model";

const spec: Spec = {
  id: "s",
  source: { kind: "text", ref: "pasted" },
  title: "Petstore",
  version: "1",
  servers: ["/api/v3"],
  hosts: ["petstore3.swagger.io"],
  endpoints: [],
  fetchedAt: 0,
  raw: "",
};

const endpoint = (patch: Partial<Endpoint> = {}): Endpoint => ({
  method: "GET",
  pathTemplate: "/pet/{petId}",
  tags: [],
  params: [],
  responses: {
    "200": {
      contentTypes: ["application/json"],
      schema: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" } } },
    },
  },
  security: [],
  ...patch,
});

test("the pattern covers the host, the base path and the template's parameters", () => {
  expect(mockPattern(spec, endpoint())).toBe("petstore3.swagger.io/api/v3/pet/*");
});

test("a template with no parameters produces an exact pattern", () => {
  expect(mockPattern(spec, endpoint({ pathTemplate: "/pet/findByStatus" }))).toBe(
    "petstore3.swagger.io/api/v3/pet/findByStatus",
  );
});

test("the script returns a literal response and never calls send", () => {
  // A mock that reaches the network is not a mock.
  const draft = buildMock(spec, endpoint(), 200);
  expect(draft.phase).toBe("handler");
  expect(draft.script).toContain("return {");
  expect(draft.script).not.toContain("send(");
});

test("the body is the example generated from the response schema", () => {
  const draft = buildMock(spec, endpoint(), 200);
  const body = draft.script.match(/body: (`|')([\s\S]*?)\1/)?.[2] ?? "";
  expect(JSON.parse(body)).toEqual({ id: 0, name: "string" });
});

test("the chosen status is the one returned", () => {
  const e = endpoint({
    responses: {
      "200": { contentTypes: ["application/json"] },
      "404": { contentTypes: ["application/json"], schema: { type: "object" } },
    },
  });
  expect(buildMock(spec, e, 404).script).toContain("status: 404");
});

test("the content type of the mocked response is declared", () => {
  expect(buildMock(spec, endpoint(), 200).script).toContain("application/json");
});

test("a response with no schema still mocks, with an empty body", () => {
  const e = endpoint({ responses: { "204": { contentTypes: [] } } });
  const draft = buildMock(spec, e, 204);
  expect(draft.script).toContain("status: 204");
  expect(draft.script).toContain("body: ''");
});

test("the rule name says what it is and where it came from", () => {
  expect(buildMock(spec, endpoint(), 200).name).toBe("mock GET /pet/{petId} → 200 (openapi)");
});
