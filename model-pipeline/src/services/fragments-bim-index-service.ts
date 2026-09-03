import { createHash } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { SingleThreadedFragmentsModel } from "@thatopen/fragments";

export const BIM_INDEX_SCHEMA_VERSION = "1.0" as const;
export const BIM_INDEX_EXTRACTOR_VERSION =
  "@bim/model-pipeline@0.1.0+fragments-3.4.7" as const;

export interface FragmentsBimIndexRequest {
  readonly inputPath: string;
  readonly outputPath: string;
}

export interface FragmentsBimIndexReport {
  readonly schemaVersion: typeof BIM_INDEX_SCHEMA_VERSION;
  readonly extractorVersion: typeof BIM_INDEX_EXTRACTOR_VERSION;
  readonly inputPath: string;
  readonly outputPath: string;
  readonly sourceHash: string;
  readonly elementCount: number;
}

interface BimIndexRow {
  readonly modelLocalId: number;
  readonly globalId?: string | undefined;
  readonly category: string;
  readonly title: string;
  readonly box?:
    | {
        readonly min: readonly [number, number, number];
        readonly max: readonly [number, number, number];
      }
    | undefined;
  readonly rawData: Readonly<Record<string, unknown>>;
}

interface ModelMesh {
  readonly positions?: Float32Array;
  readonly transform?: { readonly elements?: ArrayLike<number> };
}

function computeElementBox(
  meshes: readonly ModelMesh[] | undefined,
):
  | {
      readonly min: readonly [number, number, number];
      readonly max: readonly [number, number, number];
    }
  | undefined {
  if (!meshes || meshes.length === 0) return undefined;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let hasPoints = false;
  for (const mesh of meshes) {
    const pos = mesh.positions;
    if (!pos || pos.length === 0) continue;
    const e = mesh.transform?.elements;
    for (let p = 0; p < pos.length; p += 3) {
      const lx = pos[p];
      const ly = pos[p + 1];
      const lz = pos[p + 2];
      if (lx === undefined || ly === undefined || lz === undefined) continue;
      let x = lx;
      let y = ly;
      let z = lz;
      if (e) {
        const e0 = e[0] ?? 0;
        const e1 = e[1] ?? 0;
        const e2 = e[2] ?? 0;
        const e4 = e[4] ?? 0;
        const e5 = e[5] ?? 0;
        const e6 = e[6] ?? 0;
        const e8 = e[8] ?? 0;
        const e9 = e[9] ?? 0;
        const e10 = e[10] ?? 0;
        const e12 = e[12] ?? 0;
        const e13 = e[13] ?? 0;
        const e14 = e[14] ?? 0;
        x = e0 * lx + e4 * ly + e8 * lz + e12;
        y = e1 * lx + e5 * ly + e9 * lz + e13;
        z = e2 * lx + e6 * ly + e10 * lz + e14;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
      hasPoints = true;
    }
  }
  if (!hasPoints) return undefined;
  return {
    min: [
      Number(minX.toFixed(4)),
      Number(minY.toFixed(4)),
      Number(minZ.toFixed(4)),
    ],
    max: [
      Number(maxX.toFixed(4)),
      Number(maxY.toFixed(4)),
      Number(maxZ.toFixed(4)),
    ],
  };
}

function scalar(value: unknown): string | number | boolean | null | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "object" && "value" in value) {
    return scalar((value as { readonly value: unknown }).value);
  }
  return undefined;
}

function stringValue(
  item: Readonly<Record<string, unknown>>,
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = scalar(item[key]);
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return undefined;
}

function categoryName(raw: string | undefined): string {
  if (raw === undefined) return "Uncategorized";
  const trimmed = raw.trim();
  if (trimmed.toUpperCase().startsWith("IFC")) {
    return `Ifc${trimmed.slice(3)}`;
  }
  return trimmed.length > 0 ? trimmed : "Uncategorized";
}

export function summarizeBimItem(
  rawData: Readonly<Record<string, unknown>>,
  fallbackLocalId: number,
  box?: {
    readonly min: readonly [number, number, number];
    readonly max: readonly [number, number, number];
  },
): BimIndexRow {
  const storedLocalId = scalar(rawData["_localId"]);
  const modelLocalId =
    typeof storedLocalId === "number" ? storedLocalId : fallbackLocalId;
  const category = categoryName(stringValue(rawData, "_category", "category"));
  const globalId = stringValue(rawData, "_guid", "GlobalId");
  const title =
    stringValue(rawData, "Name", "LongName", "ObjectType") ??
    `${category} (${String(modelLocalId)})`;
  return {
    modelLocalId,
    ...(globalId === undefined ? {} : { globalId }),
    category,
    title,
    ...(box === undefined ? {} : { box }),
    rawData,
  };
}

function cleanItemData(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  depth = 0,
): unknown {
  if (depth > 5) return undefined;
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) {
    const list: unknown[] = [];
    for (const item of value) {
      const cleaned = cleanItemData(item, seen, depth + 1);
      if (cleaned !== undefined) list.push(cleaned);
    }
    return list;
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (
      key === "ObjectTypeOf" ||
      key === "DefinesOccurrence" ||
      key === "RelatedObjects" ||
      key === "RelatedElements"
    ) {
      continue;
    }
    const cleaned = cleanItemData(val, seen, depth + 1);
    if (cleaned !== undefined) result[key] = cleaned;
  }
  return result;
}

export async function extractFragmentsBimIndex(
  request: FragmentsBimIndexRequest,
): Promise<FragmentsBimIndexReport> {
  const inputPath = resolve(request.inputPath);
  const outputPath = resolve(request.outputPath);
  const bytes = new Uint8Array(await readFile(inputPath));
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const model = new SingleThreadedFragmentsModel("bim-index", bytes);
  const output = await open(outputPath, "w");
  let elementCount = 0;

  try {
    const localIds = model.getLocalIds();
    const batchSize = 250;
    for (let offset = 0; offset < localIds.length; offset += batchSize) {
      const batch = localIds.slice(offset, offset + batchSize);
      let geometries: ModelMesh[][] = [];
      try {
        geometries = model.getItemsGeometry(batch) as unknown as ModelMesh[][];
      } catch {
        geometries = [];
      }
      const itemData = model.getItemsData(batch, {
        attributesDefault: true,
        relations: {
          IsDefinedBy: { attributes: true, relations: true },
          IsTypedBy: { attributes: true, relations: true },
          HasAssociations: { attributes: true, relations: true },
          ContainedInStructure: { attributes: true, relations: true },
          HasAssignments: { attributes: true, relations: true },
          DefinesType: { attributes: true, relations: true },
        },
      });
      const lines: string[] = [];
      itemData.forEach((item, index) => {
        const fallbackLocalId = batch[index];
        if (fallbackLocalId === undefined) return;
        const sanitized = (cleanItemData(item) ?? {}) as Readonly<
          Record<string, unknown>
        >;
        const box = computeElementBox(geometries[index]);
        const row = summarizeBimItem(sanitized, fallbackLocalId, box);
        lines.push(`${JSON.stringify(row)}\n`);
        elementCount += 1;
      });
      await output.write(lines.join(""));
    }
  } finally {
    await output.close();
    model.dispose();
  }

  return {
    schemaVersion: BIM_INDEX_SCHEMA_VERSION,
    extractorVersion: BIM_INDEX_EXTRACTOR_VERSION,
    inputPath: request.inputPath.replaceAll("\\", "/"),
    outputPath: request.outputPath.replaceAll("\\", "/"),
    sourceHash,
    elementCount,
  };
}
