import { expect, test } from "vitest";
import { decodeSpecs, encodeSpecs } from "./storage";
import type { Spec } from "./model";

const SPEC: Spec = {
  id: "s1",
  source: { kind: "url", ref: "https://api.example.com/openapi.json" },
  title: "T",
  version: "1",
  servers: ["https://api.example.com"],
  hosts: ["api.example.com"],
  endpoints: [],
  fetchedAt: 1_700_000_000_000,
  raw: "{}",
};

test("a round trip preserves the spec list", () => {
  expect(decodeSpecs(encodeSpecs([SPEC])).specs).toEqual([SPEC]);
});

test("nothing stored yet is an empty list, not an error", () => {
  expect(decodeSpecs(null)).toEqual({ specs: [] });
});

test("damaged data is reported rather than silently replaced", () => {
  // Overwriting the user's specs because one byte rotted is data loss.
  const r = decodeSpecs("{not json");
  expect(r.specs).toEqual([]);
  expect(r.error).toBeTruthy();
});

test("a payload from a newer format is reported, not half-read", () => {
  const r = decodeSpecs(JSON.stringify({ v: 99, specs: [] }));
  expect(r.error).toBeTruthy();
});
