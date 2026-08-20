import type {
  BuildingDetail,
  BuildingId,
  BuildingSummary,
  ModelManifest,
  OccupancyView,
  UnitId,
  UnitSummary,
} from "@bim/shared";
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
      readonly manifest: ModelManifest;
      readonly units: readonly UnitSummary[];
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
      readonly type: "OCCUPANCIES_READY";
      readonly generation: number;
      readonly items: readonly OccupancyView[];
    }
  | {
      readonly type: "OCCUPANCIES_FAILED";
      readonly generation: number;
      readonly message: string;
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
        units: {
          query: "",
          status: "loading",
          items: [],
          selectedId: undefined,
        },
        occupancies: { status: "idle", items: [] },
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
        units: {
          query: "",
          status: "ready",
          items: command.units,
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
    case "SELECT_UNIT":
      if (!isCurrent(state, command.generation)) return state;
      return {
        ...state,
        units: { ...state.units, selectedId: command.unitId },
        occupancies: { status: "loading", items: [] },
        mode: "units",
        error: undefined,
      };
    case "OCCUPANCIES_READY":
      if (!isCurrent(state, command.generation)) return state;
      return {
        ...state,
        occupancies: { status: "ready", items: command.items },
      };
    case "OCCUPANCIES_FAILED":
      if (!isCurrent(state, command.generation)) return state;
      return {
        ...state,
        occupancies: { status: "error", items: [] },
        error: command.message,
      };
    case "ENTER_MODE":
      return { ...state, mode: command.mode };
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
