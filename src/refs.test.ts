import { expect, test } from "vitest";
import { resolveSchema } from "./refs";

const ROOT = {
  components: {
    schemas: {
      User: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          friends: { type: "array", items: { $ref: "#/components/schemas/User" } },
        },
      },
      Timestamps: {
        type: "object",
        properties: { createdAt: { type: "string", format: "date-time" } },
      },
    },
  },
};

test("an internal $ref is inlined", () => {
  const s = resolveSchema({ $ref: "#/components/schemas/User" }, ROOT);
  expect(s?.type).toBe("object");
  expect(s?.properties?.id.type).toBe("string");
});

test("a $ref that points nowhere is marked incomplete, not dropped", () => {
  const s = resolveSchema({ $ref: "#/components/schemas/Ghost" }, ROOT);
  expect(s?.incomplete).toBeTruthy();
});

test("an external $ref is marked incomplete and never fetched", () => {
  const s = resolveSchema({ $ref: "./common.yaml#/User" }, ROOT);
  expect(s?.incomplete).toContain("external");
});

test("a self-referencing schema terminates and marks the cycle", () => {
  // User.friends[] is a User: without a guard this recurses forever.
  const s = resolveSchema({ $ref: "#/components/schemas/User" }, ROOT);
  const friend = s?.properties?.friends.items;
  expect(friend?.circular).toBe(true);
});

test("allOf members are merged into one object", () => {
  const s = resolveSchema(
    {
      allOf: [
        { $ref: "#/components/schemas/Timestamps" },
        { type: "object", required: ["id"], properties: { id: { type: "string" } } },
      ],
    },
    ROOT,
  );
  expect(Object.keys(s?.properties ?? {}).sort()).toEqual(["createdAt", "id"]);
  expect(s?.required).toEqual(["id"]);
});

test("oneOf branches are resolved individually", () => {
  const s = resolveSchema(
    { oneOf: [{ $ref: "#/components/schemas/User" }, { type: "string" }] },
    ROOT,
  );
  expect(s?.oneOf?.[0].properties?.id.type).toBe("string");
  expect(s?.oneOf?.[1].type).toBe("string");
});

test("a schema nested deeper than the cap is marked incomplete rather than walked", () => {
  let deep: Record<string, unknown> = { type: "string" };
  for (let i = 0; i < 60; i += 1) deep = { type: "object", properties: { next: deep } };
  const s = resolveSchema(deep, ROOT);
  let node = s;
  let seenIncomplete = false;
  while (node?.properties?.next) {
    node = node.properties.next;
    if (node.incomplete) seenIncomplete = true;
  }
  expect(seenIncomplete).toBe(true);
});
