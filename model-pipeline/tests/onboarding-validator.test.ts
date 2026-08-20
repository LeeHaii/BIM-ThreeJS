import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validateOnboardingPackage } from "../src/index.js";

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve("onboarding", name), "utf8"));
}

describe("onboarding validator", () => {
  it.each(["building-alpha.json", "building-beta.json"])(
    "accepts %s without code changes",
    async (name) => {
      expect(validateOnboardingPackage(await fixture(name))).toMatchObject({
        ready: true,
      });
    },
  );

  it("reports a precise path for invalid configuration", () => {
    const result = validateOnboardingPackage({ schemaVersion: "1.0" });
    expect(result).toMatchObject({ ready: false });
    if (!result.ready) expect(result.errors[0]?.path).toMatch(/^\$\./);
  });
});
