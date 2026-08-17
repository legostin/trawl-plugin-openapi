import { expect, test } from "vitest";
import { applyVars } from "./vars";

test("a known variable is substituted", () => {
  expect(applyVars("Bearer {{token}}", [{ key: "token", value: "abc" }])).toBe("Bearer abc");
});

test("an unknown variable is left visible rather than blanked", () => {
  // Silently sending "Bearer " produces a 401 that looks like a server problem.
  expect(applyVars("Bearer {{missing}}", [])).toBe("Bearer {{missing}}");
});

test("whitespace inside the braces is tolerated", () => {
  expect(applyVars("{{ token }}", [{ key: "token", value: "abc" }])).toBe("abc");
});
