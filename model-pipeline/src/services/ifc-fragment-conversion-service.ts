import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { IfcImporter } from "@thatopen/fragments";

export interface IfcConversionRequest {
  readonly inputPath: string;
  readonly outputPath: string;
  readonly wasmDirectory?: string;
}

export interface IfcConversionReport {
  readonly schemaVersion: "1.0";
  readonly inputPath: string;
  readonly outputPath: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly converter: "@thatopen/fragments@3.4.7";
  readonly webIfc: "0.0.77";
}

export async function convertIfcToFragments(
  request: IfcConversionRequest,
): Promise<IfcConversionReport> {
  const inputPath = resolve(request.inputPath);
  const outputPath = resolve(request.outputPath);
  const wasmDirectory = resolve(
    request.wasmDirectory ?? "node_modules/web-ifc",
  );
  const bytes = new Uint8Array(await readFile(inputPath));
  const importer = new IfcImporter();
  importer.wasm.path = `${wasmDirectory.replaceAll("\\", "/")}/`;
  importer.wasm.absolute = true;
  importer.includeUniqueAttributes = true;
  importer.includeRelationNames = true;

  const fragments = await importer.process({ bytes, raw: false });
  await writeFile(outputPath, fragments);
  return {
    schemaVersion: "1.0",
    inputPath: request.inputPath.replaceAll("\\", "/"),
    outputPath: request.outputPath.replaceAll("\\", "/"),
    byteSize: fragments.byteLength,
    sha256: createHash("sha256").update(fragments).digest("hex"),
    converter: "@thatopen/fragments@3.4.7",
    webIfc: "0.0.77",
  };
}
