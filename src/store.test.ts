import { expect, test } from "vitest";
import { hostsOf } from "./store";

test("server URLs become host bindings, and unusable ones are skipped", () => {
  expect(hostsOf(["https://api.example.com/v2", "/v2", "{server}/api"])).toEqual([
    "api.example.com",
  ]);
});
