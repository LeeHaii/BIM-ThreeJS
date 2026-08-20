import { describe, expect, it } from "vitest";
import type { BuildingId, ModelManifest } from "@bim/shared";
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
      manifest: {} as ModelManifest,
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
});
