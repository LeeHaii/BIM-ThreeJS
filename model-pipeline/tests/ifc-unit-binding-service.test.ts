import { describe, expect, it } from "vitest";
import { normalizeStoreyCode } from "../src/services/ifc-unit-binding-service.js";

describe("normalizeStoreyCode", () => {
  it.each([
    ["Level: Level 7", undefined, "L07"],
    [7, undefined, "L07"],
    ["B2", undefined, "B02"],
    ["Basement 3", undefined, "B03"],
    [-1, undefined, "B01"],
    [undefined, "P3408", "L34"],
  ] as const)(
    "normalizes floor %s and apartment %s as %s",
    (floor, apartment, expected) => {
      expect(normalizeStoreyCode(floor, apartment)).toBe(expected);
    },
  );

  it("returns undefined when neither property contains a floor", () => {
    expect(normalizeStoreyCode("Roof", "Penthouse")).toBeUndefined();
  });
});
