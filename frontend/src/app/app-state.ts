import type {
  BuildingDetail,
  BuildingId,
  BuildingSummary,
  ModelManifest,
  OccupancyView,
  UnitId,
  UnitSummary,
} from "@bim/shared";

export type LoadStatus = "idle" | "loading" | "ready" | "error";

export interface AppState {
  readonly generation: number;
  readonly catalog: {
    readonly status: LoadStatus;
    readonly buildings: readonly BuildingSummary[];
  };
  readonly building: {
    readonly selectedId: BuildingId | undefined;
    readonly detail: BuildingDetail | undefined;
    readonly status: LoadStatus;
  };
  readonly model: {
    readonly manifest: ModelManifest | undefined;
    readonly status: LoadStatus;
  };
  readonly units: {
    readonly query: string;
    readonly status: LoadStatus;
    readonly items: readonly UnitSummary[];
    readonly selectedId: UnitId | undefined;
  };
  readonly occupancies: {
    readonly status: LoadStatus;
    readonly items: readonly OccupancyView[];
  };
  readonly mode: "overview" | "bim" | "units";
  readonly error: string | undefined;
}

export const initialState: AppState = {
  generation: 0,
  catalog: { status: "idle", buildings: [] },
  building: { selectedId: undefined, detail: undefined, status: "idle" },
  model: { manifest: undefined, status: "idle" },
  units: { query: "", status: "idle", items: [], selectedId: undefined },
  occupancies: { status: "idle", items: [] },
  mode: "overview",
  error: undefined,
};
