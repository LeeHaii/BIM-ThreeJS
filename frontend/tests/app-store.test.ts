import { describe, expect, it } from "vitest";
import type { BuildingId, SceneManifestV2 } from "@bim/shared";
import { initialState } from "../src/app/app-state.js";
import { reduceAppState } from "../src/app/app-store.js";

const ALPHA = "11111111-1111-4111-8111-111111111111" as BuildingId;
const BETA = "12222222-2222-4222-8222-222222222222" as BuildingId;

describe("application reducer", () => {
  it("ignores stale building completions after a switch", () => {
    const loadingAlpha = reduceAppState(initialState, {
      type: "OPEN_BUILDING",
      buildingId: ALPHA,
      generation: 1,
    });
    const loadingBeta = reduceAppState(loadingAlpha, {
      type: "OPEN_BUILDING",
      buildingId: BETA,
      generation: 2,
    });
    const result = reduceAppState(loadingBeta, {
      type: "BUILDING_READY",
      generation: 1,
      detail: {
        id: ALPHA,
        code: "ALPHA",
        name: "Alpha",
        timezone: "UTC",
        locale: "en",
        features: {},
      },
      manifest: {} as SceneManifestV2,
      units: [],
    });
    expect(result).toBe(loadingBeta);
    expect(result.building.selectedId).toBe(BETA);
  });

  it("clears building-scoped selection during a switch", () => {
    const dirtyState = {
      ...initialState,
      units: {
        ...initialState.units,
        selectedId: "a1111111-1111-4111-8111-111111111101" as never,
      },
    };
    const result = reduceAppState(dirtyState, {
      type: "OPEN_BUILDING",
      buildingId: BETA,
      generation: 4,
    });
    expect(result.units.selectedId).toBeUndefined();
    expect(result.occupancies.items).toEqual([]);
  });

  it("does not expose household state outside household mode", () => {
    const result = reduceAppState(initialState, {
      type: "SELECT_UNIT",
      generation: initialState.generation,
      unitId: "a1111111-1111-4111-8111-111111111101" as never,
    });
    expect(result.units.selectedId).toBeUndefined();
    expect(result.occupancies.status).toBe("idle");
  });

  it("does not retain BIM selection when leaving BIM mode", () => {
    const bimState = {
      ...initialState,
      mode: "bim" as const,
      bimSelection: {
        ref: {
          modelVersionId: "32222222-2222-4222-8222-222222222222" as never,
          modelLocalId: 42,
        },
        title: "Wall",
        worldPosition: [1, 2, 3] as const,
        properties: [],
      },
      bimInspection: { status: "ready" as const },
    };
    const result = reduceAppState(bimState, {
      type: "ENTER_MODE",
      mode: "units",
    });
    expect(result.bimSelection).toBeUndefined();
    expect(result.bimInspection.status).toBe("idle");
  });

  it("sets bimInspection to loading on BIM_ELEMENT_LOADING and ready on SELECT_BIM_ELEMENT", () => {
    const bimState = {
      ...initialState,
      mode: "bim" as const,
      generation: 1,
    };
    const loadingState = reduceAppState(bimState, {
      type: "BIM_ELEMENT_LOADING",
      generation: 1,
    });
    expect(loadingState.bimInspection.status).toBe("loading");

    const readyState = reduceAppState(loadingState, {
      type: "SELECT_BIM_ELEMENT",
      generation: 1,
      selection: {
        ref: {
          modelVersionId: "32222222-2222-4222-8222-222222222222" as never,
          modelLocalId: 1042,
        },
        title: "Wall 1042",
        worldPosition: [0, 0, 0] as const,
        properties: [],
      },
    });
    expect(readyState.bimInspection.status).toBe("ready");
    expect(readyState.bimSelection?.title).toBe("Wall 1042");
  });
});
