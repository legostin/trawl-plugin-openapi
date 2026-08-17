import { expect, test } from "vitest";
import { fetchSpecText } from "./sources";
import type { SendRequest, SendResponse } from "./trawl";

function hostWith(res: Partial<SendResponse>, seen?: SendRequest[]) {
  return {
    http: {
      send: async (req: SendRequest) => {
        seen?.push(req);
        return {
          status: 200,
          headers: [],
          body: "",
          bodyIsText: true,
          durationMs: 1,
          error: null,
          ...res,
        } as SendResponse;
      },
    },
    projects: { active: () => ({ id: "p", name: "P", env: [{ key: "token", value: "abc" }] }) },
  };
}

test("a 200 returns the body", async () => {
  const r = await fetchSpecText(hostWith({ body: "openapi: 3.0.0" }) as never, "https://x/o.yaml", []);
  expect(r).toEqual({ ok: true, text: "openapi: 3.0.0" });
});

test("headers are sent with project variables substituted", async () => {
  const seen: SendRequest[] = [];
  await fetchSpecText(hostWith({ body: "{}" }, seen) as never, "https://x/o.json", [
    ["authorization", "Bearer {{token}}"],
  ]);
  expect(seen[0].headers).toEqual([["authorization", "Bearer abc"]]);
});

test("a transport error is reported, not thrown", async () => {
  const r = await fetchSpecText(hostWith({ error: "dns failure" }) as never, "https://x", []);
  expect(r).toEqual({ ok: false, error: "dns failure" });
});

test("a non-2xx status is reported with its code", async () => {
  // 401 on a private spec URL is the single most common first failure.
  const r = await fetchSpecText(hostWith({ status: 401, body: "no" }) as never, "https://x", []);
  expect(r.ok).toBe(false);
  if (r.ok) return;
  expect(r.error).toContain("401");
});

test("the request never goes through the capture proxy", async () => {
  // Fetching the spec must not pollute the very traffic the plugin analyses.
  let viaProxy: boolean | undefined = true;
  const host = {
    http: {
      send: async (_req: SendRequest, p?: boolean) => {
        viaProxy = p;
        return { status: 200, headers: [], body: "{}", bodyIsText: true, durationMs: 1, error: null };
      },
    },
    projects: { active: () => null },
  };
  await fetchSpecText(host as never, "https://x", []);
  expect(viaProxy).toBe(false);
});
