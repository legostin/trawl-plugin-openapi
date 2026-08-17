import { expect, test } from "vitest";
import { basePaths, matchFlow, matchPath, specificity } from "./match";
import type { Endpoint, Spec } from "./model";
import type { FlowSample } from "./flow";

const ep = (method: string, pathTemplate: string): Endpoint => ({
  method,
  pathTemplate,
  tags: [],
  params: [],
  responses: {},
  security: [],
});

const spec = (id: string, hosts: string[], servers: string[], endpoints: Endpoint[]): Spec => ({
  id,
  source: { kind: "text", ref: "pasted" },
  title: id,
  version: "1",
  servers,
  hosts,
  endpoints,
  fetchedAt: 0,
  raw: "",
});

const sample = (method: string, host: string, path: string): FlowSample => ({
  id: 1,
  ts: 0,
  method,
  host,
  path,
  query: [],
  hasBodies: true,
});

test("a template matches and captures its path parameters", () => {
  expect(matchPath("/users/{id}", "/users/42")).toEqual({ id: "42" });
});

test("segment counts must agree", () => {
  expect(matchPath("/users/{id}", "/users/42/friends")).toBeNull();
  expect(matchPath("/users/{id}/friends", "/users/42")).toBeNull();
});

test("a trailing slash does not decide a match", () => {
  expect(matchPath("/users/{id}", "/users/42/")).toEqual({ id: "42" });
});

test("a literal segment outranks a parameter", () => {
  // /users/me must not be reported as /users/{id}.
  expect(specificity("/users/me")).toBeGreaterThan(specificity("/users/{id}"));
});

test("base paths come from the servers, longest first, plus the empty one", () => {
  const s = spec("s", ["api.example.com"], ["https://api.example.com/v2", "/api/v3"], []);
  expect(basePaths(s)).toEqual(["/api/v3", "/v2", ""]);
});

test("the servers' base path is stripped before matching", () => {
  // Petstore 3.0 ships servers:["/api/v3"] and templates without that prefix,
  // so without stripping, nothing in real traffic would ever match.
  const s = spec("petstore", ["petstore3.swagger.io"], ["/api/v3"], [ep("GET", "/pet/{petId}")]);
  const m = matchFlow([s], sample("GET", "petstore3.swagger.io", "/api/v3/pet/7"));
  expect(m?.endpoint.pathTemplate).toBe("/pet/{petId}");
  expect(m?.pathParams).toEqual({ petId: "7" });
});

test("a host that no spec is bound to does not match", () => {
  const s = spec("s", ["api.example.com"], [], [ep("GET", "/users")]);
  expect(matchFlow([s], sample("GET", "other.example.com", "/users"))).toBeNull();
});

test("an unbound spec matches nothing at all", () => {
  // hosts:[] is the "servers were relative, tell me the host" state.
  const s = spec("s", [], ["/api"], [ep("GET", "/users")]);
  expect(matchFlow([s], sample("GET", "api.example.com", "/api/users"))).toBeNull();
});

test("the method must agree", () => {
  const s = spec("s", ["h"], [], [ep("GET", "/users")]);
  expect(matchFlow([s], sample("POST", "h", "/users"))).toBeNull();
});

test("the most specific template wins", () => {
  const s = spec("s", ["h"], [], [ep("GET", "/users/{id}"), ep("GET", "/users/me")]);
  expect(matchFlow([s], sample("GET", "h", "/users/me"))?.endpoint.pathTemplate).toBe("/users/me");
});

test("when two specs match, one is used and the other is reported", () => {
  // A gateway fronting several services: picking silently would hide the clash.
  const a = spec("a", ["h"], [], [ep("GET", "/users")]);
  const b = spec("b", ["h"], [], [ep("GET", "/users")]);
  const m = matchFlow([a, b], sample("GET", "h", "/users"));
  expect(m?.spec.id).toBe("a");
  expect(m?.alsoMatched).toEqual(["b"]);
});
