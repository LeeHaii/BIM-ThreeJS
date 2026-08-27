import type {
  BuildingDetail,
  BuildingId,
  BuildingSummary,
  HouseholdStorey,
  OccupancyView,
  SceneManifestV2,
  UnitId,
  UnitSummary,
} from "@bim/shared";
import type {
  ViewerLayerState,
  ViewerPick,
} from "../modules/viewer-runtime/index.js";

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
    readonly manifest: SceneManifestV2 | undefined;
    readonly status: LoadStatus;
  };
  readonly viewer: {
    readonly status: LoadStatus;
    readonly loadedBytes: number;
    readonly totalBytes: number;
    readonly layers: readonly ViewerLayerState[];
    readonly touchNavigation: "orbit" | "vertical";
  };
  readonly bimSelection: ViewerPick | undefined;
  readonly bimInspection: {
    readonly status: LoadStatus;
  };
  readonly units: {
    readonly query: string;
    readonly status: LoadStatus;
    readonly items: readonly UnitSummary[];
    readonly storeys: readonly HouseholdStorey[];
    readonly selectedStoreyCode: string | undefined;
    readonly clipRatio: 0.2 | 0.5;
    readonly bindingCoverage: number;
    readonly selectedId: UnitId | undefined;
  };
  readonly occupancies: {
    readonly status: LoadStatus;
    readonly items: readonly OccupancyView[];
  };
  readonly environmentOpacity: number;
  readonly mode: "overview" | "bim" | "units";
  readonly error: string | undefined;
}

export const initialState: AppState = {
  generation: 0,
  catalog: { status: "idle", buildings: [] },
  building: { selectedId: undefined, detail: undefined, status: "idle" },
  model: { manifest: undefined, status: "idle" },
  viewer: {
    status: "idle",
    loadedBytes: 0,
    totalBytes: 0,
    layers: [],
    touchNavigation: "orbit",
  },
  bimSelection: undefined,
  bimInspection: { status: "idle" },
  units: {
    query: "",
    status: "idle",
    items: [],
    storeys: [],
    selectedStoreyCode: undefined,
    clipRatio: 0.5,
    bindingCoverage: 0,
    selectedId: undefined,
  },
  occupancies: { status: "idle", items: [] },
  environmentOpacity: 1.0,
  mode: "overview",
  error: undefined,
};
