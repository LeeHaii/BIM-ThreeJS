import type {
  BuildingDetail,
  BuildingId,
  BuildingSummary,
  HouseholdIndex,
  OccupancyView,
  SceneManifestV2,
  UnitId,
  UnitSummary,
} from "@bim/shared";
import type {
  ViewerLayerState,
  ViewerPick,
} from "../modules/viewer-runtime/index.js";
import type { AppState } from "./app-state.js";

export type AppCommand =
  | { readonly type: "CATALOG_LOADING" }
  | {
      readonly type: "CATALOG_READY";
      readonly buildings: readonly BuildingSummary[];
    }
  | {
      readonly type: "OPEN_BUILDING";
      readonly buildingId: BuildingId;
      readonly generation: number;
    }
  | {
      readonly type: "BUILDING_READY";
      readonly generation: number;
      readonly detail: BuildingDetail;
      readonly manifest: SceneManifestV2;
      readonly householdIndex: HouseholdIndex;
    }
  | {
      readonly type: "SELECT_STOREY";
      readonly generation: number;
      readonly storeyCode: string;
    }
  | {
      readonly type: "SET_UNIT_CUT_RATIO";
      readonly cutRatio: 0.2 | 0.5;
    }
  | {
      readonly type: "BUILDING_FAILED";
      readonly generation: number;
      readonly message: string;
    }
  | {
      readonly type: "UNITS_LOADING";
      readonly generation: number;
      readonly query: string;
    }
  | {
      readonly type: "UNITS_READY";
      readonly generation: number;
      readonly query: string;
      readonly units: readonly UnitSummary[];
    }
  | {
      readonly type: "SELECT_UNIT";
      readonly generation: number;
      readonly unitId: UnitId;
    }
  | {
      readonly type: "HOUSEHOLD_UNIT_UPDATED";
      readonly generation: number;
      readonly unit: UnitSummary;
    }
  | {
      readonly type: "OCCUPANCIES_READY";
      readonly generation: number;
      readonly unitId: UnitId;
      readonly items: readonly OccupancyView[];
    }
  | {
      readonly type: "OCCUPANCIES_FAILED";
      readonly generation: number;
      readonly unitId: UnitId;
      readonly message: string;
    }
  | {
      readonly type: "VIEWER_LOADING";
      readonly generation: number;
      readonly totalBytes: number;
    }
  | {
      readonly type: "VIEWER_PROGRESS";
      readonly generation: number;
      readonly loadedBytes: number;
      readonly totalBytes: number;
      readonly layer: ViewerLayerState;
    }
  | {
      readonly type: "VIEWER_READY";
      readonly generation: number;
      readonly layers: readonly ViewerLayerState[];
    }
  | {
      readonly type: "VIEWER_FAILED";
      readonly generation: number;
      readonly message: string;
    }
  | {
      readonly type: "BIM_ELEMENT_LOADING";
      readonly generation: number;
    }
  | {
      readonly type: "SELECT_BIM_ELEMENT";
      readonly generation: number;
      readonly selection: ViewerPick;
    }
  | { readonly type: "CLEAR_BIM_SELECTION" }
  | {
      readonly type: "SET_LAYER_VISIBILITY";
      readonly layerId: string;
      readonly visible: boolean;
    }
  | {
      readonly type: "SET_TOUCH_NAVIGATION";
      readonly mode: "orbit" | "vertical";
    }
  | {
      readonly type: "SET_ENVIRONMENT_OPACITY";
      readonly opacity: number;
    }
  | { readonly type: "ENTER_MODE"; readonly mode: AppState["mode"] };

function isCurrent(state: AppState, generation: number): boolean {
  return state.generation === generation;
}

export function reduceAppState(state: AppState, command: AppCommand): AppState {
  switch (command.type) {
    case "CATALOG_LOADING":
      return {
        ...state,
        catalog: { ...state.catalog, status: "loading" },
        error: undefined,
      };
    case "CATALOG_READY":
      return {
        ...state,
        catalog: { status: "ready", buildings: command.buildings },
      };
    case "OPEN_BUILDING":
      return {
        ...state,
        generation: command.generation,
        building: {
          selectedId: command.buildingId,
          detail: undefined,
          status: "loading",
        },
        model: { manifest: undefined, status: "loading" },
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
          status: "loading",
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
    case "BUILDING_READY":
      if (!isCurrent(state, command.generation)) return state;
      return {
        ...state,
        building: {
          selectedId: command.detail.id,
          detail: command.detail,
          status: "ready",
        },
        model: { manifest: command.manifest, status: "ready" },
        viewer: {
          ...state.viewer,
          touchNavigation:
            command.manifest.viewerUi.touchNavigation.defaultMode,
        },
        units: {
          query: "",
          status: "ready",
          items: command.householdIndex.storeys.flatMap(
            (storey) => storey.units,
          ),
          storeys: command.householdIndex.storeys,
          selectedStoreyCode: undefined,
          clipRatio: 0.5,
          bindingCoverage: command.householdIndex.coverage,
          selectedId: undefined,
        },
      };
    case "BUILDING_FAILED":
      if (!isCurrent(state, command.generation)) return state;
      return {
        ...state,
        building: { ...state.building, status: "error" },
        model: { ...state.model, status: "error" },
        units: { ...state.units, status: "error" },
        error: command.message,
      };
    case "UNITS_LOADING":
      if (!isCurrent(state, command.generation)) return state;
      return {
        ...state,
        units: { ...state.units, query: command.query, status: "loading" },
      };
    case "UNITS_READY":
      if (
        !isCurrent(state, command.generation) ||
        state.units.query !== command.query
      )
        return state;
      return {
        ...state,
        units: { ...state.units, status: "ready", items: command.units },
      };
    case "SELECT_STOREY":
      if (!isCurrent(state, command.generation) || state.mode !== "units") {
        return state;
      }
      return {
        ...state,
        units: {
          ...state.units,
          selectedStoreyCode: command.storeyCode,
          selectedId: undefined,
        },
        occupancies: { status: "idle", items: [] },
      };
    case "SET_UNIT_CUT_RATIO":
      return {
        ...state,
        units: { ...state.units, clipRatio: command.cutRatio },
      };
    case "SELECT_UNIT":
      if (!isCurrent(state, command.generation) || state.mode !== "units")
        return state;
      return {
        ...state,
        units: { ...state.units, selectedId: command.unitId },
        occupancies: { status: "loading", items: [] },
        error: undefined,
      };
    case "HOUSEHOLD_UNIT_UPDATED":
      if (
        !isCurrent(state, command.generation) ||
        command.unit.buildingId !== state.building.selectedId
      ) {
        return state;
      }
      return {
        ...state,
        units: {
          ...state.units,
          items: state.units.items.map((unit) =>
            unit.id === command.unit.id ? { ...unit, ...command.unit } : unit,
          ),
          storeys: state.units.storeys.map((storey) => ({
            ...storey,
            units: storey.units.map((unit) =>
              unit.id === command.unit.id
                ? { ...unit, ...command.unit }
                : unit,
            ),
          })),
        },
      };
    case "OCCUPANCIES_READY":
      if (
        !isCurrent(state, command.generation) ||
        state.units.selectedId !== command.unitId
      )
        return state;
      return {
        ...state,
        occupancies: { status: "ready", items: command.items },
      };
    case "OCCUPANCIES_FAILED":
      if (
        !isCurrent(state, command.generation) ||
        state.units.selectedId !== command.unitId
      )
        return state;
      return {
        ...state,
        occupancies: { status: "error", items: [] },
        error: command.message,
      };
    case "VIEWER_LOADING":
      if (!isCurrent(state, command.generation)) return state;
      return {
        ...state,
        viewer: {
          ...state.viewer,
          status: "loading",
          loadedBytes: 0,
          totalBytes: command.totalBytes,
          layers: [],
        },
      };
    case "VIEWER_PROGRESS":
      if (!isCurrent(state, command.generation)) return state;
      return {
        ...state,
        viewer: {
          ...state.viewer,
          loadedBytes: command.loadedBytes,
          totalBytes: command.totalBytes,
          layers: [
            ...state.viewer.layers.filter(
              (layer) => layer.id !== command.layer.id,
            ),
            command.layer,
          ],
        },
      };
    case "VIEWER_READY":
      if (!isCurrent(state, command.generation)) return state;
      return {
        ...state,
        viewer: { ...state.viewer, status: "ready", layers: command.layers },
      };
    case "VIEWER_FAILED":
      if (!isCurrent(state, command.generation)) return state;
      return {
        ...state,
        viewer: { ...state.viewer, status: "error" },
        error: command.message,
      };
    case "BIM_ELEMENT_LOADING":
      if (!isCurrent(state, command.generation) || state.mode !== "bim")
        return state;
      return { ...state, bimInspection: { status: "loading" } };
    case "SELECT_BIM_ELEMENT":
      if (!isCurrent(state, command.generation) || state.mode !== "bim")
        return state;
      return {
        ...state,
        bimSelection: command.selection,
        bimInspection: { status: "ready" },
      };
    case "CLEAR_BIM_SELECTION":
      return {
        ...state,
        bimSelection: undefined,
        bimInspection: { status: "idle" },
      };
    case "SET_LAYER_VISIBILITY":
      return {
        ...state,
        viewer: {
          ...state.viewer,
          layers: state.viewer.layers.map((layer) =>
            layer.id === command.layerId
              ? { ...layer, visible: command.visible }
              : layer,
          ),
        },
      };
    case "SET_TOUCH_NAVIGATION":
      return {
        ...state,
        viewer: { ...state.viewer, touchNavigation: command.mode },
      };
    case "SET_ENVIRONMENT_OPACITY":
      return {
        ...state,
        environmentOpacity: Math.max(0, Math.min(1, command.opacity)),
      };
    case "ENTER_MODE":
      return {
        ...state,
        mode: command.mode,
        environmentOpacity:
          command.mode === "bim"
            ? 0.10
            : command.mode === "units"
              ? 0.25
              : 1.0,
        bimSelection: command.mode === "bim" ? state.bimSelection : undefined,
        bimInspection:
          command.mode === "bim" ? state.bimInspection : { status: "idle" },
        units:
          command.mode === "units"
            ? state.units
            : {
                ...state.units,
                selectedStoreyCode: undefined,
                selectedId: undefined,
              },
        occupancies:
          command.mode === "units"
            ? state.occupancies
            : { status: "idle", items: [] },
      };
  }
}

export interface AppStore {
  getState(): AppState;
  dispatch(command: AppCommand): void;
  subscribe(listener: (state: AppState) => void): () => void;
}

export function createAppStore(seed: AppState): AppStore {
  let state = seed;
  const listeners = new Set<(state: AppState) => void>();
  return {
    getState: () => state,
    dispatch(command) {
      state = reduceAppState(state, command);
      listeners.forEach((listener) => listener(state));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
