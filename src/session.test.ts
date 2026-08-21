import { expect, test } from "vitest";
import { Aggregates, windowFilter } from "./session";
import type { FlowSample } from "./flow";
import type { Match } from "./match";
import type { Endpoint, Spec } from "./model";

const spec: Spec = {
  id: "s",
  source: { kind: "text", ref: "pasted" },
  title: "s",
  version: "1",
  servers: [],
  hosts: ["h"],
  endpoints: [],
  fetchedAt: 0,
  raw: "",
};

const endpoint: Endpoint = {
  method: "GET",
  pathTemplate: "/users/{id}",
  tags: [],
  params: [],
  responses: {},
  security: [],
};

const match: Match = { spec, endpoint, pathParams: {}, alsoMatched: [] };

const sample = (patch: Partial<FlowSample> = {}): FlowSample => ({
  id: 1,
  ts: 10,
  method: "GET",
  host: "h",
  path: "/users/7",
  query: [],
  status: 200,
  hasBodies: true,
  ...patch,
});

test("a matched call is counted against its endpoint", () => {
  const agg = new Aggregates();
  agg.record(sample(), match, { violations: [], notes: [] });
  agg.record(sample({ id: 2 }), match, { violations: [], notes: [] });
  expect(agg.forEndpoint("s", "GET /users/{id}")).toMatchObject({ calls: 2, violations: 0 });
});

test("violations are counted separately from calls", () => {
  const agg = new Aggregates();
  agg.record(sample(), match, {
    violations: [{ where: "response.body", pointer: "/id", expected: "string", actual: "number" }],
    notes: [],
  });
  expect(agg.forEndpoint("s", "GET /users/{id}")).toMatchObject({ calls: 1, violations: 1 });
});

test("an unmatched call on a bound host is tallied as undocumented", () => {
  const agg = new Aggregates();
  agg.record(sample({ path: "/users/7/resend", method: "POST" }), null, {
    violations: [],
    notes: [],
  });
  expect(agg.undocumented()).toEqual([
    { method: "POST", host: "h", path: "/users/7/resend", count: 1 },
  ]);
});

test("repeated undocumented calls collapse into one row", () => {
  const agg = new Aggregates();
  for (let i = 0; i < 3; i += 1) {
    agg.record(sample({ id: i, path: "/ghost" }), null, { violations: [], notes: [] });
  }
  expect(agg.undocumented()).toHaveLength(1);
  expect(agg.undocumented()[0].count).toBe(3);
});

test("the undocumented tally is capped rather than grown without bound", () => {
  // A scanner hitting random paths must not turn into unbounded memory.
  const agg = new Aggregates();
  for (let i = 0; i < 500; i += 1) {
    agg.record(sample({ id: i, path: `/p${i}` }), null, { violations: [], notes: [] });
  }
  expect(agg.undocumented().length).toBeLessThanOrEqual(200);
  expect(agg.droppedUndocumented()).toBeGreaterThan(0);
});

test("reset clears everything", () => {
  const agg = new Aggregates();
  agg.record(sample(), match, { violations: [], notes: [] });
  agg.reset();
  expect(agg.forEndpoint("s", "GET /users/{id}")).toMatchObject({ calls: 0 });
  expect(agg.undocumented()).toEqual([]);
});

test("the capture window asks for flows since the capture started", () => {
  expect(windowFilter("capture", { captureStartedAt: 500, projectId: "p" })).toEqual({
    projectId: "p",
    startTs: 500,
  });
});

test("the project window asks for everything in the project", () => {
  expect(windowFilter("project", { captureStartedAt: 500, projectId: "p" })).toEqual({
    projectId: "p",
  });
});

test("the filter window defers to the host's current traffic filter", () => {
  expect(
    windowFilter("filter", { captureStartedAt: 500, projectId: "p", hostFilter: { method: "GET" } }),
  ).toEqual({ method: "GET" });
});

test("call moments are kept for the sparkline, newest last", () => {
  const agg = new Aggregates();
  agg.record(sample({ id: 1, ts: 10 }), match, { violations: [], notes: [] });
  agg.record(sample({ id: 2, ts: 30 }), match, { violations: [], notes: [] });
  expect(agg.forEndpoint("s", "GET /users/{id}").moments).toEqual([10, 30]);
});

test("the moment buffer is bounded — a busy endpoint must not grow forever", () => {
  const agg = new Aggregates();
  for (let i = 0; i < 200; i += 1) {
    agg.record(sample({ id: i, ts: i }), match, { violations: [], notes: [] });
  }
  const moments = agg.forEndpoint("s", "GET /users/{id}").moments;
  expect(moments.length).toBeLessThanOrEqual(40);
  expect(moments[moments.length - 1]).toBe(199);
});

test("an endpoint that was never called reports no moments", () => {
  expect(new Aggregates().forEndpoint("s", "GET /nope").moments).toEqual([]);
});

test("one flow is one call, however many events the host sends about it", () => {
  // The host fires flow:added and then flow:updated for the same request;
  // counting both turns every call into two and fills the history with twins.
  const agg = new Aggregates();
  agg.record(sample({ id: 7, ts: 10 }), match, { violations: [], notes: [] });
  agg.record(sample({ id: 7, ts: 10 }), match, { violations: [], notes: [] });
  const stats = agg.forEndpoint("s", "GET /users/{id}");
  expect(stats.calls).toBe(1);
  expect(stats.moments).toEqual([10]);
});

test("a revision that finds a violation marks the call without counting it twice", () => {
  // The response arrives on the second event, and only then can it break the
  // schema — the endpoint must go from clean to broken without gaining a call.
  const agg = new Aggregates();
  agg.record(sample({ id: 7 }), match, { violations: [], notes: [] });
  agg.record(sample({ id: 7 }), match, {
    violations: [{ where: "response.body", pointer: "/id", expected: "string", actual: "number" }],
    notes: [],
  });
  expect(agg.forEndpoint("s", "GET /users/{id}")).toMatchObject({ calls: 1, violations: 1 });
});

test("an undocumented path is tallied once per flow", () => {
  const agg = new Aggregates();
  agg.record(sample({ id: 9, path: "/ghost" }), null, { violations: [], notes: [] });
  agg.record(sample({ id: 9, path: "/ghost" }), null, { violations: [], notes: [] });
  expect(agg.undocumented()[0].count).toBe(1);
});
