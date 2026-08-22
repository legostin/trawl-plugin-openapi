import { expect, test } from "vitest";
import { describeScreen } from "./screenContext";
import type { Endpoint, Spec } from "./model";
import type { Engine } from "./engine";

const endpoint: Endpoint = {
  method: "GET",
  pathTemplate: "/pet/{petId}",
  tags: [],
  params: [],
  responses: {},
  security: [],
};

const spec: Spec = {
  id: "s1",
  source: { kind: "text", ref: "pasted" },
  title: "Petstore",
  version: "1.0",
  servers: [],
  hosts: ["petstore3.swagger.io"],
  endpoints: [endpoint],
  fetchedAt: 0,
  raw: "",
};

const engine = (calls: number, violations: number, undocumented: string[] = []) =>
  ({
    window: "capture",
    aggregates: {
      forEndpoint: () => ({ calls, violations, moments: [] }),
      totals: () => ({ calls, violations, endpoints: 1 }),
    },
    drift: { report: () => (undocumented.length ? { undocumented, neverSeen: [], samples: 1, dropped: 0 } : null) },
  }) as unknown as Engine;

test("the open endpoint is named, with what the traffic did to it", () => {
  const out = describeScreen(engine(12, 3), spec, endpoint, "browse");
  expect(out).toContain("GET /pet/{petId}");
  expect(out).toContain("12 calls");
  expect(out).toContain("3 with violations");
});

test("a spec bound to nothing says so — it explains every empty count", () => {
  const out = describeScreen(engine(0, 0), { ...spec, hosts: [] }, endpoint, "browse");
  expect(out).toContain("not bound to any host");
});

test("browsing without a selection is not silence", () => {
  expect(describeScreen(engine(0, 0), spec, null, "coverage")).toContain("no endpoint selected");
});

test("drift is mentioned only when there is some", () => {
  expect(describeScreen(engine(1, 0), spec, endpoint, "browse")).not.toContain("undocumented");
  expect(describeScreen(engine(1, 0, ["/referrer"]), spec, endpoint, "browse")).toContain(
    "1 undocumented fields",
  );
});

test("with no spec there is nothing to describe but the fact", () => {
  expect(describeScreen(engine(0, 0), null, null, "browse")).toBe("no spec loaded");
});

test("it stays short enough to sit beside the user's question", () => {
  // The host clips at 600; going over means losing the tail that matters.
  expect(describeScreen(engine(99, 9, ["/a", "/b"]), spec, endpoint, "browse")!.length).toBeLessThan(
    300,
  );
});
