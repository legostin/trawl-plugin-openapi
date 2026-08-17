import { expect, test } from "vitest";
import { validateValue } from "./validate";
import type { Schema } from "./model";

const check = (schema: Schema, value: unknown) => validateValue(schema, value, "response.body");

test("a matching primitive passes", () => {
  expect(check({ type: "string" }, "hello")).toEqual([]);
});

test("a wrong primitive type is reported with its pointer", () => {
  const v = check({ type: "object", properties: { price: { type: "number" } } }, { price: "9.99" });
  expect(v).toHaveLength(1);
  expect(v[0]).toMatchObject({ pointer: "/price", expected: "number", actual: "string" });
});

test("an integer is a number, but a fractional number is not an integer", () => {
  expect(check({ type: "number" }, 3)).toEqual([]);
  expect(check({ type: "integer" }, 3)).toEqual([]);
  expect(check({ type: "integer" }, 3.5)).toHaveLength(1);
});

test("a missing required property is reported once, at the object", () => {
  const v = check({ type: "object", required: ["id", "name"], properties: {} }, { id: "1" });
  expect(v).toHaveLength(1);
  expect(v[0].expected).toContain("name");
});

test("a required property that is present but null still counts as present", () => {
  const s: Schema = {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", nullable: true } },
  };
  expect(check(s, { id: null })).toEqual([]);
});

test("null passes only where the schema allows it", () => {
  expect(check({ type: "string", nullable: true }, null)).toEqual([]);
  expect(check({ type: ["string", "null"] }, null)).toEqual([]);
  expect(check({ type: "string" }, null)).toHaveLength(1);
});

test("an enum mismatch names both sides", () => {
  const v = check({ type: "string", enum: ["free", "pro"] }, "trial_v2");
  expect(v[0]).toMatchObject({ expected: "one of free, pro", actual: '"trial_v2"' });
});

test("arrays validate their items", () => {
  const s: Schema = { type: "array", items: { type: "number" } };
  expect(check(s, [1, 2, 3])).toEqual([]);
  expect(check(s, [1, "2"])[0].pointer).toBe("/1");
});

test("extra properties are reported only when additionalProperties is false", () => {
  const open: Schema = { type: "object", properties: { a: { type: "string" } } };
  expect(check(open, { a: "x", b: 1 })).toEqual([]);
  const closed: Schema = { ...open, additionalProperties: false };
  expect(check(closed, { a: "x", b: 1 })[0].pointer).toBe("/b");
});

test("oneOf passes when any branch does", () => {
  const s: Schema = { oneOf: [{ type: "string" }, { type: "number" }] };
  expect(check(s, 4)).toEqual([]);
});

test("oneOf reports the closest branch when none match", () => {
  // Reporting every branch's complaints buries the real one. "Closest" is the
  // branch that complained least — here the second, with one wrong field
  // against the first branch's two.
  const s: Schema = {
    oneOf: [
      { type: "object", properties: { a: { type: "number" }, b: { type: "number" } } },
      { type: "object", properties: { a: { type: "number" }, b: { type: "string" } } },
    ],
  };
  const v = check(s, { a: "wrong", b: "text" });
  expect(v).toHaveLength(1);
  expect(v[0].pointer).toBe("/a");
});

test("an unresolved schema checks nothing", () => {
  // These are the marks refs.ts leaves behind; guessing here invents violations.
  expect(check({ incomplete: "external $ref (./common.yaml) — not followed" }, 42)).toEqual([]);
  expect(check({ circular: true }, { anything: true })).toEqual([]);
  expect(check({}, "whatever")).toEqual([]);
});

test("format is described, never enforced", () => {
  // "date-time" has too many legitimate spellings to fail traffic over.
  expect(check({ type: "string", format: "date-time" }, "not a date")).toEqual([]);
});

test("a nested object reports the full pointer path", () => {
  const s: Schema = {
    type: "object",
    properties: {
      data: { type: "object", properties: { items: { type: "array", items: { type: "number" } } } },
    },
  };
  expect(check(s, { data: { items: [1, "x"] } })[0].pointer).toBe("/data/items/1");
});
