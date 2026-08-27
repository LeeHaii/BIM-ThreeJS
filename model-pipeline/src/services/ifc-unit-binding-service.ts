import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  IFCBUILDINGELEMENTPROXY,
  IFCRELDEFINESBYPROPERTIES,
  IFCSLAB,
  IFCSPACE,
  IfcAPI,
} from "web-ifc";

type IfcValue = {
  readonly value?: unknown;
  readonly _representationValue?: unknown;
};

type IfcHandle = { readonly value?: unknown };

type IfcRecord = Record<string, unknown> & {
  readonly expressID?: number;
  readonly type?: number;
};

export interface IfcUnitBindingSeed {
  readonly apartmentCode: string;
  readonly storeyCode: string;
  readonly expressId: number;
  readonly globalId?: string | undefined;
  readonly category: string;
  readonly area?: number | undefined;
}

export interface IfcUnitBindingIndex {
  readonly schemaVersion: "1.0";
  readonly sourceHash: string;
  readonly scannedElementCount: number;
  readonly bindings: readonly IfcUnitBindingSeed[];
  readonly storeys: readonly {
    readonly storeyCode: string;
    readonly apartmentCount: number;
    readonly elementCount: number;
  }[];
  readonly warnings: readonly string[];
}

export interface IfcUnitBindingRequest {
  readonly inputPath: string;
  readonly wasmDirectory?: string;
}

const apartmentKeys = new Set([
  "apartment",
  "apartmentcode",
  "apartmentname",
  "apartmentno",
  "apartmentnumber",
  "canho",
  "macanho",
  "unit",
  "unitcode",
  "unitname",
  "unitno",
]);

const storeyKeys = new Set([
  "floor",
  "level",
  "livingfloor",
  "storey",
  "tang",
  "tangso",
]);

const areaKeys = new Set([
  "area",
  "grossarea",
  "grossfloorarea",
  "netarea",
  "netfloorarea",
  "usablearea",
]);

function normalizedKey(value: string): string {
  return value.trim().toLowerCase().replaceAll(/[^a-z0-9]/g, "");
}

function scalar(value: unknown): string | number | boolean | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (value === null || typeof value !== "object") return undefined;
  const wrapped = value as IfcValue;
  return scalar(wrapped.value ?? wrapped._representationValue);
}

function handleId(value: unknown): number | undefined {
  if (value === null || typeof value !== "object") return undefined;
  const raw = (value as IfcHandle).value;
  return typeof raw === "number" ? raw : undefined;
}

function handleIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const id = handleId(item);
    return id === undefined ? [] : [id];
  });
}

function text(value: unknown): string | undefined {
  const raw = scalar(value);
  if (raw === undefined) return undefined;
  const result = String(raw).trim();
  return result.length === 0 ? undefined : result;
}

function finiteNumber(value: unknown): number | undefined {
  const raw = scalar(value);
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return undefined;
  const parsed = Number.parseFloat(raw.replaceAll(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeStoreyCode(
  rawFloor: string | number | undefined,
  apartmentCode?: string,
): string | undefined {
  const direct = rawFloor === undefined ? undefined : String(rawFloor).trim();
  const basement =
    direct !== undefined && /^(?:b|basement)\s*0*\d+/i.test(direct);
  const floorMatch = direct?.match(/-?\d+/);
  let floor = floorMatch?.[0];
  if (floor === undefined && apartmentCode !== undefined) {
    const apartmentDigits = apartmentCode.match(/(\d{3,4})$/)?.[1];
    if (apartmentDigits !== undefined) floor = apartmentDigits.slice(0, -2);
  }
  if (floor === undefined) return undefined;
  const numeric = Number.parseInt(floor, 10);
  if (!Number.isFinite(numeric)) return undefined;
  return numeric < 0 || basement
    ? `B${String(Math.abs(numeric)).padStart(2, "0")}`
    : `L${String(numeric).padStart(2, "0")}`;
}

function propertyValue(record: IfcRecord): unknown {
  return (
    record["NominalValue"] ??
    record["AreaValue"] ??
    record["LengthValue"] ??
    record["VolumeValue"] ??
    record["CountValue"] ??
    record["Value"]
  );
}

function readDefinitionProperties(
  api: IfcAPI,
  modelId: number,
  definitionId: number,
): Map<string, unknown> {
  const properties = new Map<string, unknown>();
  const definition = api.GetLine(modelId, definitionId, false) as IfcRecord;
  const propertyIds = [
    ...handleIds(definition["HasProperties"]),
    ...handleIds(definition["Quantities"]),
  ];
  for (const propertyId of propertyIds) {
    const property = api.GetLine(modelId, propertyId, false) as IfcRecord;
    const name = text(property["Name"]);
    if (name === undefined) continue;
    properties.set(normalizedKey(name), propertyValue(property));
  }
  return properties;
}

function firstProperty(
  properties: ReadonlyMap<string, unknown>,
  names: ReadonlySet<string>,
): unknown {
  for (const name of names) {
    const value = properties.get(name);
    if (value !== undefined) return value;
  }
  return undefined;
}

export async function extractIfcUnitBindings(
  request: IfcUnitBindingRequest,
): Promise<IfcUnitBindingIndex> {
  const inputPath = resolve(request.inputPath);
  const wasmDirectory = resolve(
    request.wasmDirectory ?? "node_modules/web-ifc",
  );
  const bytes = new Uint8Array(await readFile(inputPath));
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const api = new IfcAPI();
  api.SetWasmPath(`${wasmDirectory.replaceAll("\\", "/")}/`, true);
  await api.Init();

  const bindings: IfcUnitBindingSeed[] = [];
  const warnings: string[] = [];
  const candidateIds = new Set<number>();
  const elements = new Map<number, IfcRecord>();
  const propertiesByElement = new Map<number, Map<string, unknown>>();
  let modelId: number | undefined;

  try {
    modelId = api.OpenModel(bytes);
    for (const type of [IFCSPACE, IFCSLAB, IFCBUILDINGELEMENTPROXY]) {
      const ids = api.GetLineIDsWithType(modelId, type, true);
      for (let index = 0; index < ids.size(); index++) {
        candidateIds.add(ids.get(index));
      }
    }

    for (const expressId of candidateIds) {
      elements.set(expressId, api.GetLine(modelId, expressId, false) as IfcRecord);
      propertiesByElement.set(expressId, new Map());
    }

    const relationIds = api.GetLineIDsWithType(
      modelId,
      IFCRELDEFINESBYPROPERTIES,
    );
    for (let index = 0; index < relationIds.size(); index++) {
      const relation = api.GetLine(
        modelId,
        relationIds.get(index),
        false,
      ) as IfcRecord;
      const relatedCandidates = handleIds(relation["RelatedObjects"]).filter(
        (id) => candidateIds.has(id),
      );
      if (relatedCandidates.length === 0) continue;
      const definitionId = handleId(relation["RelatingPropertyDefinition"]);
      if (definitionId === undefined) continue;
      const definitionProperties = readDefinitionProperties(
        api,
        modelId,
        definitionId,
      );
      for (const expressId of relatedCandidates) {
        const properties = propertiesByElement.get(expressId);
        if (properties === undefined) continue;
        for (const [key, value] of definitionProperties) {
          properties.set(key, value);
        }
      }
    }

    for (const [expressId, element] of elements) {
      const properties = propertiesByElement.get(expressId) ?? new Map();
      const apartmentCode = text(firstProperty(properties, apartmentKeys));
      if (apartmentCode === undefined) continue;
      const rawFloor = scalar(firstProperty(properties, storeyKeys));
      const storeyCode = normalizeStoreyCode(
        typeof rawFloor === "string" || typeof rawFloor === "number"
          ? rawFloor
          : undefined,
        apartmentCode,
      );
      if (storeyCode === undefined) {
        warnings.push(
          `Element ${String(expressId)} (${apartmentCode}) has no usable LivingFloor.`,
        );
        continue;
      }
      const globalId = text(element["GlobalId"]);
      const area = finiteNumber(firstProperty(properties, areaKeys));
      const category =
        element.type === undefined
          ? "IFCELEMENT"
          : api.GetNameFromTypeCode(element.type);
      bindings.push({
        apartmentCode,
        storeyCode,
        expressId,
        category,
        ...(globalId === undefined ? {} : { globalId }),
        ...(area === undefined ? {} : { area }),
      });
    }
  } finally {
    if (modelId !== undefined && api.IsModelOpen(modelId)) {
      api.CloseModel(modelId);
    }
    api.Dispose();
  }

  bindings.sort(
    (left, right) =>
      left.storeyCode.localeCompare(right.storeyCode, undefined, {
        numeric: true,
      }) ||
      left.apartmentCode.localeCompare(right.apartmentCode, undefined, {
        numeric: true,
      }) ||
      left.expressId - right.expressId,
  );

  const storeyMap = new Map<
    string,
    { readonly apartmentCodes: Set<string>; elementCount: number }
  >();
  for (const binding of bindings) {
    let storey = storeyMap.get(binding.storeyCode);
    if (storey === undefined) {
      storey = { apartmentCodes: new Set(), elementCount: 0 };
      storeyMap.set(binding.storeyCode, storey);
    }
    storey.apartmentCodes.add(binding.apartmentCode.toUpperCase());
    storey.elementCount += 1;
  }

  return {
    schemaVersion: "1.0",
    sourceHash,
    scannedElementCount: candidateIds.size,
    bindings,
    storeys: [...storeyMap.entries()].map(([storeyCode, value]) => ({
      storeyCode,
      apartmentCount: value.apartmentCodes.size,
      elementCount: value.elementCount,
    })),
    warnings,
  };
}
