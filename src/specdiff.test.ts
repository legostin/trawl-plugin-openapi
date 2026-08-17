import { expect, test } from "vitest";
import { diffSpecs } from "./specdiff";
import type { Endpoint, SpecDoc } from "./model";

const ep = (method: string, pathTemplate: string, patch: Partial<Endpoint> = {}): Endpoint => ({
  method,
  pathTemplate,
  tags: [],
  params: [],
  responses: {
    "200": {
      contentTypes: ["application/json"],
      schema: { type: "object", properties: { id: { type: "string" } } },
    },
  },
  security: [],
  ...patch,
});

const doc = (endpoints: Endpoint[]): SpecDoc => ({
  title: "t",
  version: "1",
  servers: [],
  endpoints,
});

test("a new endpoint is reported and is not breaking", () => {
  const d = diffSpecs(doc([ep("GET", "/a")]), doc([ep("GET", "/a"), ep("GET", "/b")]));
  expect(d).toEqual([{ key: "GET /b", detail: "endpoint added", breaking: false }]);
});

test("a removed endpoint is breaking", () => {
  const d = diffSpecs(doc([ep("GET", "/a"), ep("GET", "/b")]), doc([ep("GET", "/a")]));
  expect(d).toEqual([{ key: "GET /b", detail: "endpoint removed", breaking: true }]);
});

test("a removed response field is breaking", () => {
  const before = ep("GET", "/a", {
    responses: {
      "200": {
        contentTypes: ["application/json"],
        schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
      },
    },
  });
  const d = diffSpecs(doc([before]), doc([ep("GET", "/a")]));
  expect(d).toEqual([{ key: "GET /a", detail: "response field removed: /name", breaking: true }]);
});

test("an added response field is not breaking", () => {
  const after = ep("GET", "/a", {
    responses: {
      "200": {
        contentTypes: ["application/json"],
        schema: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
      },
    },
  });
  const d = diffSpecs(doc([ep("GET", "/a")]), doc([after]));
  expect(d).toEqual([{ key: "GET /a", detail: "response field added: /name", breaking: false }]);
});

test("a removed status code is breaking", () => {
  const before = ep("GET", "/a", {
    responses: { "200": { contentTypes: [] }, "404": { contentTypes: [] } },
  });
  const after = ep("GET", "/a", { responses: { "200": { contentTypes: [] } } });
  expect(diffSpecs(doc([before]), doc([after]))).toEqual([
    { key: "GET /a", detail: "response 404 removed", breaking: true },
  ]);
});

test("a newly required parameter is breaking", () => {
  const after = ep("GET", "/a", {
    params: [{ name: "since", in: "query", required: true }],
  });
  expect(diffSpecs(doc([ep("GET", "/a")]), doc([after]))).toEqual([
    { key: "GET /a", detail: "query parameter now required: since", breaking: true },
  ]);
});

test("two identical specs produce nothing", () => {
  expect(diffSpecs(doc([ep("GET", "/a")]), doc([ep("GET", "/a")]))).toEqual([]);
});

test("breaking changes are listed before the rest", () => {
  const before = doc([ep("GET", "/gone"), ep("GET", "/kept")]);
  const after = doc([ep("GET", "/kept"), ep("GET", "/new")]);
  expect(diffSpecs(before, after).map((c) => c.breaking)).toEqual([true, false]);
});
