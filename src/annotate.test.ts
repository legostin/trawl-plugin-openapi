import { expect, test } from "vitest";
import { MAX_ANNOTATED, annotate } from "./annotate";
import type { Violation } from "./model";

const v = (pointer: string, expected = "string", actual = "number"): Violation => ({
  where: "response.body",
  pointer,
  expected,
  actual,
});

const BODY = JSON.stringify({
  id: 7,
  status: "trial_v2",
  referrer: "ads",
  tags: [{ name: "a" }, { name: 2 }],
});

test("a violated field is marked on its own line", () => {
  const r = annotate(BODY, [v("/status", "one of available, pending, sold", '"trial_v2"')], []);
  const line = r.lines.find((l) => l.text.includes('"status"'));
  expect(line?.mark).toBe("violation");
  expect(line?.note).toContain("available");
});

test("lines with nothing to say carry no mark", () => {
  const r = annotate(BODY, [v("/status")], []);
  expect(r.lines.find((l) => l.text.includes('"id"'))?.mark).toBeUndefined();
});

test("a pointer into an array element finds that element's line", () => {
  const r = annotate(BODY, [v("/tags/1/name")], []);
  const marked = r.lines.filter((l) => l.mark === "violation");
  expect(marked).toHaveLength(1);
  expect(marked[0].text).toContain("2");
});

test("a field that arrives but is not documented is marked separately", () => {
  const r = annotate(BODY, [], ["/referrer"]);
  const line = r.lines.find((l) => l.text.includes('"referrer"'));
  expect(line?.mark).toBe("undocumented");
});

test("a pointer that no longer exists in the body is reported, not swallowed", () => {
  // The body may have changed since the verdict was recorded. Saying nothing
  // would look like the violation disappeared.
  const r = annotate(BODY, [v("/gone/deeply")], []);
  expect(r.unmatched).toEqual(["/gone/deeply"]);
  expect(r.lines.some((l) => l.mark === "violation")).toBe(false);
});

test("a body that is not JSON is refused with a reason", () => {
  const r = annotate("<html>nope</html>", [], []);
  expect(r.lines).toEqual([]);
  expect(r.skipped).toContain("JSON");
});

test("an oversized body is skipped rather than pretty-printed", () => {
  const big = JSON.stringify({ blob: "x".repeat(600 * 1024) });
  const r = annotate(big, [], []);
  expect(r.lines).toEqual([]);
  expect(r.skipped).toContain("large");
});

test("a long body keeps the marked lines and collapses the rest", () => {
  // A 5000-line response must not be printed in full to show two problems.
  const wide: Record<string, unknown> = {};
  for (let i = 0; i < 600; i += 1) wide[`f${i}`] = i;
  const r = annotate(JSON.stringify(wide), [v("/f590")], []);
  expect(r.lines.length).toBeLessThanOrEqual(MAX_ANNOTATED);
  expect(r.lines.some((l) => l.mark === "violation")).toBe(true);
  expect(r.lines.some((l) => l.collapsed)).toBe(true);
});

test("the root pointer marks the opening line", () => {
  const r = annotate(BODY, [v("", "object", "array")], []);
  expect(r.lines[0].mark).toBe("violation");
});

import type { Schema } from "./model";

const SCHEMA: Schema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    status: { type: "string", enum: ["ok", "fail"] },
    tags: { type: "array", items: { type: "object", properties: { name: { type: "string" } } } },
    missing_one: { type: "string" },
  },
};

test("each line carries the type the spec promised for it", () => {
  const body = JSON.stringify({ id: 7, status: "ok", tags: [{ name: "a" }] });
  const r = annotate(body, [], [], SCHEMA);
  expect(r.lines.find((l) => l.text.includes('"id"'))?.expected).toBe("integer");
  expect(r.lines.find((l) => l.text.includes('"name"'))?.expected).toBe("string");
});

test("an enum is spelled out, since that is what the value is judged against", () => {
  const r = annotate(JSON.stringify({ status: "ok" }), [], [], SCHEMA);
  expect(r.lines.find((l) => l.text.includes('"status"'))?.expected).toContain("ok");
});

test("fields the spec documented but the body never had are listed separately", () => {
  // The other half of drift: showing only what arrived hides what did not.
  const r = annotate(JSON.stringify({ id: 7 }), [], [], SCHEMA);
  expect(r.missing).toContain("/missing_one");
  expect(r.missing).toContain("/status");
});

test("a field with no schema behind it simply has no annotation", () => {
  const r = annotate(JSON.stringify({ id: 7, extra: 1 }), [], [], SCHEMA);
  expect(r.lines.find((l) => l.text.includes('"extra"'))?.expected).toBeUndefined();
});

test("without a schema nothing is annotated and nothing is called missing", () => {
  const r = annotate(JSON.stringify({ id: 7 }), [], []);
  expect(r.missing).toEqual([]);
  expect(r.lines.every((l) => l.expected === undefined)).toBe(true);
});
