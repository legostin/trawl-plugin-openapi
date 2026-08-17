import { expect, test } from "vitest";
import { coverageRows, coverageSummary } from "./coverage";
import type { Endpoint, Spec } from "./model";
import type { EndpointStats } from "./session";

const ep = (method: string, pathTemplate: string): Endpoint => ({
  method,
  pathTemplate,
  tags: [],
  params: [],
  responses: {},
  security: [],
});

const spec = (endpoints: Endpoint[]): Spec => ({
  id: "s",
  source: { kind: "text", ref: "pasted" },
  title: "s",
  version: "1",
  servers: [],
  hosts: ["h"],
  endpoints,
  fetchedAt: 0,
  raw: "",
});

const from = (table: Record<string, EndpointStats>) => (key: string) =>
  table[key] ?? { calls: 0, violations: 0 };

test("every endpoint gets a row, called or not", () => {
  const rows = coverageRows(spec([ep("GET", "/a"), ep("GET", "/b")]), from({}));
  expect(rows.map((r) => r.key)).toEqual(["GET /a", "GET /b"]);
  expect(rows.every((r) => r.state === "never")).toBe(true);
});

test("endpoints with violations come first, then never-called, then healthy ones", () => {
  // The point of the screen is what needs attention, so that sorts to the top.
  const rows = coverageRows(
    spec([ep("GET", "/healthy"), ep("GET", "/never"), ep("GET", "/broken")]),
    from({
      "GET /healthy": { calls: 9, violations: 0 },
      "GET /broken": { calls: 2, violations: 2 },
    }),
  );
  expect(rows.map((r) => r.key)).toEqual(["GET /broken", "GET /never", "GET /healthy"]);
});

test("among equals, the busier endpoint sorts first", () => {
  const rows = coverageRows(
    spec([ep("GET", "/quiet"), ep("GET", "/busy")]),
    from({ "GET /quiet": { calls: 1, violations: 0 }, "GET /busy": { calls: 50, violations: 0 } }),
  );
  expect(rows.map((r) => r.key)).toEqual(["GET /busy", "GET /quiet"]);
});

test("the summary counts endpoints touched, not calls made", () => {
  const rows = coverageRows(
    spec([ep("GET", "/a"), ep("GET", "/b"), ep("GET", "/c"), ep("GET", "/d")]),
    from({ "GET /a": { calls: 30, violations: 0 } }),
  );
  expect(coverageSummary(rows)).toEqual({ total: 4, called: 1, percent: 25 });
});

test("an empty spec reports no coverage rather than dividing by zero", () => {
  expect(coverageSummary([])).toEqual({ total: 0, called: 0, percent: 0 });
});
