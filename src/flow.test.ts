import { expect, test } from "vitest";
import { headerValue, sampleFromFlow, sampleFromRow } from "./flow";
import type { HostFlow, FlowRow } from "./trawl";

const bodyText = (m: unknown) => (m as { body?: string } | null)?.body ?? "";

const FLOW: HostFlow = {
  id: 7,
  timestamp: 1_700_000_000_000,
  method: "get",
  url: { scheme: "https", host: "api.example.com", port: 443, path: "/v2/users/9?expand=plan&x=1" },
  request: { headers: [["Content-Type", "application/json"]], body: '{"a":1}' },
  response: {
    status: 200,
    headers: [["content-type", "application/json; charset=utf-8"]],
    body: '{"b":2}',
  },
  state: "complete",
  error: null,
};

test("the query string is split off the path and parsed", () => {
  const s = sampleFromFlow(FLOW, bodyText);
  expect(s.path).toBe("/v2/users/9");
  expect(s.query).toEqual([
    ["expand", "plan"],
    ["x", "1"],
  ]);
});

test("the method is upper-cased so it can be compared to the spec", () => {
  expect(sampleFromFlow(FLOW, bodyText).method).toBe("GET");
});

test("content types are read case-insensitively and without their parameters", () => {
  const s = sampleFromFlow(FLOW, bodyText);
  expect(s.requestContentType).toBe("application/json");
  expect(s.responseContentType).toBe("application/json");
});

test("bodies come from the injected reader", () => {
  const s = sampleFromFlow(FLOW, bodyText);
  expect(s.requestBody).toBe('{"a":1}');
  expect(s.responseBody).toBe('{"b":2}');
  expect(s.hasBodies).toBe(true);
});

test("a flow still in flight has no status and no response body", () => {
  const s = sampleFromFlow({ ...FLOW, response: null }, bodyText);
  expect(s.status).toBeUndefined();
  expect(s.responseBody).toBeUndefined();
});

test("a history row becomes a sample that admits it has no bodies", () => {
  // FlowRow carries no headers or body, so nothing about them may be claimed.
  const row: FlowRow = {
    id: 3,
    ts: 1,
    method: "POST",
    scheme: "https",
    host: "api.example.com",
    port: 443,
    path: "/v2/users?x=1",
    status: 201,
    projectId: null,
    state: "complete",
    error: null,
  };
  const s = sampleFromRow(row);
  expect(s).toMatchObject({ method: "POST", path: "/v2/users", status: 201, hasBodies: false });
  expect(s.query).toEqual([["x", "1"]]);
  expect(s.responseBody).toBeUndefined();
});

test("header lookup ignores case", () => {
  expect(headerValue([["X-Trace-Id", "abc"]], "x-trace-id")).toBe("abc");
  expect(headerValue([], "x-trace-id")).toBeUndefined();
});
