import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { IfcImporter } from "@thatopen/fragments";
import { extractIfcUnitBindings } from "./ifc-unit-binding-service.js";
import { extractFragmentsBimIndex } from "./fragments-bim-index-service.js";

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
  readonly unitBindings: {
    readonly outputPath: string;
    readonly bindingCount: number;
    readonly storeyCount: number;
    readonly scannedElementCount: number;
  };
  readonly bimIndex: {
    readonly outputPath: string;
    readonly elementCount: number;
    readonly sourceHash: string;
  };
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
  const unitBindingIndex = await extractIfcUnitBindings({
    inputPath,
    wasmDirectory,
  });
  const unitBindingOutputPath = `${outputPath}.unit-bindings.json`;
  await writeFile(
    unitBindingOutputPath,
    `${JSON.stringify(unitBindingIndex, null, 2)}\n`,
  );
  const bimIndexOutputPath = `${outputPath}.bim-index.ndjson`;
  const bimIndex = await extractFragmentsBimIndex({
    inputPath: outputPath,
    outputPath: bimIndexOutputPath,
  });
  return {
    schemaVersion: "1.0",
    inputPath: request.inputPath.replaceAll("\\", "/"),
    outputPath: request.outputPath.replaceAll("\\", "/"),
    byteSize: fragments.byteLength,
    sha256: createHash("sha256").update(fragments).digest("hex"),
    converter: "@thatopen/fragments@3.4.7",
    webIfc: "0.0.77",
    unitBindings: {
      outputPath: unitBindingOutputPath.replaceAll("\\", "/"),
      bindingCount: unitBindingIndex.bindings.length,
      storeyCount: unitBindingIndex.storeys.length,
      scannedElementCount: unitBindingIndex.scannedElementCount,
    },
    bimIndex: {
      outputPath: bimIndexOutputPath.replaceAll("\\", "/"),
      elementCount: bimIndex.elementCount,
      sourceHash: bimIndex.sourceHash,
    },
  };
}
