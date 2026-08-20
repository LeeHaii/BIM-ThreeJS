import type { BuildingId, ModelId, ModelVersionId, UnitId } from "./ids.js";

export interface ElementRef {
  readonly modelVersionId: ModelVersionId;
  readonly modelLocalId?: number | undefined;
  readonly globalId?: string | undefined;
}

export interface PropertyEntry {
  readonly key: string;
  readonly value: string | number | boolean | null;
  readonly unit?: string | undefined;
}

export interface PropertyGroup {
  readonly key: string;
  readonly label: string;
  readonly entries: readonly PropertyEntry[];
}

export interface CameraPose {
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly up?: readonly [number, number, number] | undefined;
  readonly fov?: number | undefined;
}

export interface BuildingSummary {
  readonly id: BuildingId;
  readonly code: string;
  readonly name: string;
  readonly timezone: string;
  readonly locale: string;
}

export interface BuildingDetail extends BuildingSummary {
  readonly features: Readonly<Record<string, boolean>>;
  readonly activeModelVersionId?: ModelVersionId | undefined;
}

export interface UnitSummary {
  readonly id: UnitId;
  readonly buildingId: BuildingId;
  readonly code: string;
  readonly displayName: string;
  readonly unitType: string;
  readonly storeyCode: string;
  readonly status: "active" | "inactive";
  readonly address?: string | undefined;
  readonly area?: number | undefined;
  readonly owner?: string | undefined;
  readonly certificateNumber?: string | undefined;
  readonly ownershipTerm?: string | undefined;
}

export interface OccupancyView {
  readonly relationshipType: string;
  readonly displayName?: string | undefined;
  readonly email?: string | undefined;
  readonly phone?: string | undefined;
  readonly citizenId?: string | undefined;
  readonly dateOfBirth?: string | undefined;
  readonly gender?: string | undefined;
  readonly residenceType?: string | undefined;
  readonly status?: string | undefined;
  readonly startsAt: string;
  readonly endsAt?: string | undefined;
}

export interface AssetReference {
  readonly assetId: string;
  readonly url: string;
  readonly contentHash: string;
  readonly byteSize: number;
}

export interface FragmentLayer {
  readonly id: string;
  readonly name: string;
  readonly purpose: string;
  readonly asset: AssetReference;
  readonly transform: readonly number[];
  readonly defaultVisible: boolean;
}

export interface NamedView {
  readonly id: string;
  readonly label: string;
  readonly camera: CameraPose;
}

export interface ModelManifest {
  readonly schemaVersion: "1.0";
  readonly buildingId: BuildingId;
  readonly modelId: ModelId;
  readonly modelVersionId: ModelVersionId;
  readonly label: string;
  readonly sourceHash: string;
  readonly defaultCamera: CameraPose;
  readonly namedViews: readonly NamedView[];
  readonly fragmentLayers: readonly FragmentLayer[];
  readonly capabilities: readonly string[];
  readonly compatibility: {
    readonly components: string;
    readonly fragments: string;
    readonly webIfc: string;
  };
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}
