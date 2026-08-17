import { expect, test } from "vitest";
import { filterEndpoints, groupByTag } from "./tree";
import type { Endpoint } from "./model";

const e = (method: string, pathTemplate: string, tags: string[] = [], summary?: string): Endpoint => ({
  method,
  pathTemplate,
  tags,
  summary,
  params: [],
  responses: {},
  security: [],
});

test("endpoints are grouped by tag, alphabetically", () => {
  const groups = groupByTag([e("GET", "/i", ["invoices"]), e("GET", "/u", ["users"])]);
  expect(groups.map((g) => g.tag)).toEqual(["invoices", "users"]);
});

test("an endpoint with several tags appears under each", () => {
  const groups = groupByTag([e("GET", "/x", ["a", "b"])]);
  expect(groups.map((g) => g.tag)).toEqual(["a", "b"]);
  expect(groups[0].endpoints).toHaveLength(1);
});

test("untagged endpoints land in a single trailing group", () => {
  // They must stay visible: an untagged operation is still real traffic.
  const groups = groupByTag([e("GET", "/x"), e("GET", "/y", ["users"])]);
  expect(groups.map((g) => g.tag)).toEqual(["users", "Untagged"]);
  expect(groups[1].endpoints).toHaveLength(1);
});

test("within a group, endpoints are ordered by path then method", () => {
  const groups = groupByTag([
    e("POST", "/users", ["users"]),
    e("GET", "/users", ["users"]),
    e("GET", "/invoices", ["users"]),
  ]);
  expect(groups[0].endpoints.map((x) => `${x.method} ${x.pathTemplate}`)).toEqual([
    "GET /invoices",
    "GET /users",
    "POST /users",
  ]);
});

test("search matches path, method, operationId, summary and tag", () => {
  const list = [
    e("GET", "/users/{id}", ["users"], "Read one user"),
    e("POST", "/invoices", ["billing"]),
  ];
  expect(filterEndpoints(list, "invoice")).toHaveLength(1);
  expect(filterEndpoints(list, "post")).toHaveLength(1);
  expect(filterEndpoints(list, "read one")).toHaveLength(1);
  expect(filterEndpoints(list, "billing")).toHaveLength(1);
});

test("an empty query returns everything, untouched", () => {
  const list = [e("GET", "/a"), e("GET", "/b")];
  expect(filterEndpoints(list, "   ")).toEqual(list);
});
