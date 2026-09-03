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
      householdIndex: {
        buildingId: ALPHA,
        coverage: 0,
        storeys: [],
      },
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
        layerId: "model-main",
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

  it("merges apartment updates without losing 3D binding metadata", () => {
    const unit = {
      id: "a1111111-1111-4111-8111-111111111701" as never,
      buildingId: ALPHA,
      code: "A-0701",
      displayName: "Apartment 0701",
      unitType: "apartment",
      storeyCode: "L07",
      status: "active" as const,
      owner: "Previous owner",
      layerId: "layer-ifc-fragments",
      modelLocalIds: [114970],
      globalIds: ["ifc-global-id"],
    };
    const state = {
      ...initialState,
      generation: 4,
      building: {
        selectedId: ALPHA,
        detail: undefined,
        status: "ready" as const,
      },
      units: {
        ...initialState.units,
        items: [unit],
        storeys: [
          {
            code: "L07",
            label: "Floor 07",
            unitCount: 1,
            boundUnitCount: 1,
            units: [unit],
          },
        ],
        selectedId: unit.id,
      },
    };

    const result = reduceAppState(state, {
      type: "HOUSEHOLD_UNIT_UPDATED",
      generation: 4,
      unit: {
        ...unit,
        displayName: "Updated apartment",
        owner: undefined,
      },
    });
    const updated = result.units.storeys[0]?.units[0];
    expect(updated?.displayName).toBe("Updated apartment");
    expect(updated?.owner).toBeUndefined();
    expect(updated?.layerId).toBe("layer-ifc-fragments");
    expect(updated?.modelLocalIds).toEqual([114970]);
    expect(updated?.globalIds).toEqual(["ifc-global-id"]);
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
        layerId: "model-main",
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

  it("tracks BIM catalog progress and ignores stale catalog completions", () => {
    const loading = reduceAppState(
      { ...initialState, generation: 3 },
      { type: "BIM_CATALOG_LOADING", generation: 3 },
    );
    const progress = reduceAppState(loading, {
      type: "BIM_CATALOG_PROGRESS",
      generation: 3,
      processed: 100,
      total: 250,
    });
    expect(progress.bimCatalog).toMatchObject({
      status: "loading",
      processed: 100,
      total: 250,
    });

    const stale = reduceAppState(progress, {
      type: "BIM_CATALOG_READY",
      generation: 2,
      items: [],
    });
    expect(stale).toBe(progress);

    const ready = reduceAppState(progress, {
      type: "BIM_CATALOG_READY",
      generation: 3,
      items: [
        {
          layerId: "model-main",
          ref: {
            modelVersionId: "32222222-2222-4222-8222-222222222222" as never,
            modelLocalId: 42,
          },
          title: "Wall",
          category: "IfcWall",
        },
      ],
    });
    expect(ready.bimCatalog.status).toBe("ready");
    expect(ready.bimCatalog.items[0]?.category).toBe("IfcWall");
  });

  it("sets environmentOpacity to 0.10 when entering BIM mode and allows updating opacity", () => {
    const bimState = reduceAppState(initialState, {
      type: "ENTER_MODE",
      mode: "bim",
    });
    expect(bimState.environmentOpacity).toBe(0.1);

    const updatedState = reduceAppState(bimState, {
      type: "SET_ENVIRONMENT_OPACITY",
      opacity: 0.35,
    });
    expect(updatedState.environmentOpacity).toBe(0.35);

    const overviewState = reduceAppState(updatedState, {
      type: "ENTER_MODE",
      mode: "overview",
    });
    expect(overviewState.environmentOpacity).toBe(1.0);

    const unitsState = reduceAppState(overviewState, {
      type: "ENTER_MODE",
      mode: "units",
    });
    expect(unitsState.environmentOpacity).toBe(0.25);
  });
});
