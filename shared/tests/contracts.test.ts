import { describe, expect, it } from "vitest";
import { elementRefSchema, modelManifestSchema } from "../src/index.js";

describe("shared contracts", () => {
  it("rejects element references without a stable or local identity", () => {
    expect(() =>
      elementRefSchema.parse({
        modelVersionId: "44444444-4444-4444-8444-444444444444",
      }),
    ).toThrow(/requires/);
  });

  it("rejects future manifest schema versions before asset loading", () => {
    expect(() =>
      modelManifestSchema.parse({
        schemaVersion: "2.0",
        buildingId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toThrow();
  });
});
