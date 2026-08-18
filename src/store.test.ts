import { expect, test } from "vitest";
import { hostsOf } from "./store";

test("server URLs become host bindings, and unusable ones are skipped", () => {
  expect(hostsOf(["https://api.example.com/v2", "/v2", "{server}/api"])).toEqual([
    "api.example.com",
  ]);
});

import { SpecStore } from "./store";
import { encodeSpecs } from "./storage";
import type { Spec } from "./model";
import type { TrawlHost } from "./trawl";

const RAW = JSON.stringify({
  openapi: "3.0.0",
  info: { title: "T", version: "1" },
  paths: {
    "/pet": {
      get: {
        summary: "Find pets.",
        description: "Returns every pet.",
        responses: { "200": { description: "ok" } },
      },
    },
  },
});

function hostWith(stored: string | null) {
  let saved = stored;
  const host = {
    storage: {
      get: async () => saved,
      set: async (_k: string, v: string) => {
        saved = v;
      },
    },
    projects: { active: () => null },
  } as unknown as TrawlHost;
  return host;
}

/** A spec as an older plugin version would have stored it. */
const stale = (raw: string): Spec => ({
  id: "s1",
  source: { kind: "text", ref: "pasted" },
  title: "T",
  version: "1",
  servers: [],
  hosts: ["api.example.com"],
  endpoints: [
    {
      method: "GET",
      pathTemplate: "/pet",
      tags: [],
      params: [],
      responses: {},
      security: [],
    },
  ],
  fetchedAt: 5,
  raw,
});

test("a stored spec is re-parsed on load, so parser fixes reach it", () => {
  // Endpoints are a cache of whatever the parser produced when the spec was
  // added. Without re-parsing, every improvement stops at specs added earlier.
  const store = new SpecStore(hostWith(encodeSpecs([stale(RAW)])));
  return store.load().then(() => {
    const e = store.list()[0].endpoints[0];
    expect(e.description).toBe("Returns every pet.");
  });
});

test("re-parsing keeps what the user owns", () => {
  const store = new SpecStore(hostWith(encodeSpecs([stale(RAW)])));
  return store.load().then(() => {
    const s = store.list()[0];
    expect(s.id).toBe("s1");
    expect(s.hosts).toEqual(["api.example.com"]);
    expect(s.fetchedAt).toBe(5);
  });
});

test("a spec whose raw no longer parses keeps what was stored", () => {
  // Losing the user's spec because a re-parse failed would be worse than
  // showing a stale one.
  const store = new SpecStore(hostWith(encodeSpecs([stale("<not a spec>")])));
  return store.load().then(() => {
    expect(store.list()[0].endpoints).toHaveLength(1);
  });
});
