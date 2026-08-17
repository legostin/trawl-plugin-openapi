import { expect, test } from "vitest";
import { load } from "js-yaml";

test("yaml parsing is available to the bundle", () => {
  expect(load("openapi: 3.0.0")).toEqual({ openapi: "3.0.0" });
});
