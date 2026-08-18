import { expect, test } from "vitest";
import { exampleFor } from "./example";
import type { Schema } from "./model";

test("the spec's own example always wins", () => {
  expect(exampleFor({ type: "string", example: "sk-live-42" })).toBe("sk-live-42");
});

test("an enum takes its first member", () => {
  expect(exampleFor({ type: "string", enum: ["available", "pending"] })).toBe("available");
});

test("primitives get obviously fake values", () => {
  // A realistic-looking fake is worse: it gets mistaken for real data.
  expect(exampleFor({ type: "string" })).toBe("string");
  expect(exampleFor({ type: "integer" })).toBe(0);
  expect(exampleFor({ type: "number" })).toBe(0);
  expect(exampleFor({ type: "boolean" })).toBe(true);
});

test("a known format still produces something of that shape", () => {
  expect(exampleFor({ type: "string", format: "date-time" })).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(exampleFor({ type: "string", format: "uuid" })).toMatch(/^[0-9a-f-]{36}$/);
});

test("objects are built property by property", () => {
  const s: Schema = {
    type: "object",
    properties: { id: { type: "string" }, count: { type: "integer" } },
  };
  expect(exampleFor(s)).toEqual({ id: "string", count: 0 });
});

test("arrays contain exactly one example item", () => {
  expect(exampleFor({ type: "array", items: { type: "integer" } })).toEqual([0]);
});

test("oneOf takes its first branch", () => {
  expect(exampleFor({ oneOf: [{ type: "boolean" }, { type: "string" }] })).toBe(true);
});

test("a cycle stops instead of recursing forever", () => {
  // refs.ts marks the back-reference; example generation must respect it.
  const s: Schema = {
    type: "object",
    properties: { name: { type: "string" }, friend: { circular: true } },
  };
  expect(exampleFor(s)).toEqual({ name: "string", friend: null });
});

test("an unresolved schema yields null rather than a guess", () => {
  expect(exampleFor({ incomplete: "external $ref" })).toBeNull();
  expect(exampleFor(undefined)).toBeNull();
});

test("a schema with no type at all yields null", () => {
  expect(exampleFor({})).toBeNull();
});
