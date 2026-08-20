import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { convertIfcToFragments } from "./services/ifc-fragment-conversion-service.js";
import { validateOnboardingPackage } from "./services/onboarding-validator.js";

async function main(): Promise<void> {
  const [, , command, inputPath, outputPath] = process.argv;
  if (command === "convert-ifc") {
    if (inputPath === undefined || outputPath === undefined) {
      throw new Error("Usage: convert-ifc <input.ifc> <output.frag>");
    }
    const report = await convertIfcToFragments({ inputPath, outputPath });
    await writeFile(
      `${resolve(outputPath)}.report.json`,
      `${JSON.stringify(report, null, 2)}\n`,
    );
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  if (command !== "validate-onboarding" || inputPath === undefined) {
    throw new Error(
      "Usage: validate-onboarding <package.json> | convert-ifc <input.ifc> <output.frag>",
    );
  }

  const absolutePath = resolve(inputPath);
  const input: unknown = JSON.parse(await readFile(absolutePath, "utf8"));
  const report = validateOnboardingPackage(input);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ready) process.exitCode = 1;
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Unknown pipeline error";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
