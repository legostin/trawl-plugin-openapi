import { expect, test } from "vitest";
import { Drift, schemaPaths, valuePaths } from "./drift";
import type { Schema } from "./model";

const USER: Schema = {
  type: "object",
  properties: {
    id: { type: "string" },
    plan: { type: "string" },
    address: { type: "object", properties: { city: { type: "string" } } },
    tags: { type: "array", items: { type: "object", properties: { name: { type: "string" } } } },
  },
};

test("schema paths name every documented field, with arrays collapsed", () => {
  expect([...schemaPaths(USER)].sort()).toEqual([
    "/address",
    "/address/city",
    "/id",
    "/plan",
    "/tags",
    "/tags[]",
    "/tags[]/name",
  ]);
});

test("value paths name every field that actually arrived, with arrays collapsed", () => {
  // Two array items must not become two different paths.
  const paths = valuePaths({ id: "1", tags: [{ name: "a" }, { name: "b" }] });
  expect([...paths].sort()).toEqual(["/id", "/tags", "/tags[]", "/tags[]/name"]);
});

test("a field that arrives but is not described is drift", () => {
  const d = new Drift();
  d.record("GET /users", USER, { id: "1", referrer: "campaign-4" });
  expect(d.report("GET /users")?.undocumented).toEqual(["/referrer"]);
});

test("a field that is described but never arrives is drift too", () => {
  const d = new Drift();
  d.record("GET /users", USER, { id: "1" });
  expect(d.report("GET /users")?.neverSeen).toContain("/plan");
});

test("a field seen even once is not reported as never seen", () => {
  const d = new Drift();
  d.record("GET /users", USER, { id: "1" });
  d.record("GET /users", USER, { id: "2", plan: "pro" });
  expect(d.report("GET /users")?.neverSeen).not.toContain("/plan");
});

test("an unresolved schema is skipped rather than making everything look undocumented", () => {
  const d = new Drift();
  d.record("GET /x", { incomplete: "external $ref" }, { anything: 1 });
  d.record("GET /y", { circular: true }, { anything: 1 });
  expect(d.report("GET /x")).toBeNull();
  expect(d.report("GET /y")).toBeNull();
});

test("a body that is not an object is not mined for fields", () => {
  const d = new Drift();
  d.record("GET /x", USER, "just a string");
  expect(d.report("GET /x")?.undocumented).toEqual([]);
});

test("the number of samples behind a report is visible", () => {
  const d = new Drift();
  d.record("GET /users", USER, { id: "1" });
  d.record("GET /users", USER, { id: "2" });
  expect(d.report("GET /users")?.samples).toBe(2);
});

test("paths are capped and the drop is admitted", () => {
  // A map-shaped response (one key per entity) would otherwise grow forever.
  const d = new Drift();
  const wide: Record<string, unknown> = {};
  for (let i = 0; i < 400; i += 1) wide[`k${i}`] = i;
  d.record("GET /wide", { type: "object", properties: {} }, wide);
  const r = d.report("GET /wide");
  expect(r?.undocumented.length).toBeLessThanOrEqual(200);
  expect(r?.dropped).toBeGreaterThan(0);
});

test("reset forgets everything", () => {
  const d = new Drift();
  d.record("GET /users", USER, { id: "1" });
  d.reset();
  expect(d.report("GET /users")).toBeNull();
});
