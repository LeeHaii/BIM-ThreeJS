// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import type { HouseholdStorey } from "@bim/shared";
import { initialState } from "../src/app/app-state.js";
import { renderHouseholdPanel } from "../src/modules/units/render-household-panel.js";

const storey: HouseholdStorey = {
  code: "L07",
  label: "Floor 07",
  unitCount: 2,
  boundUnitCount: 1,
  units: [
    {
      id: "a1111111-1111-4111-8111-111111111701" as never,
      buildingId: "11111111-1111-4111-8111-111111111111" as never,
      code: "A-0701",
      displayName: "Apartment 0701",
      unitType: "apartment",
      storeyCode: "L07",
      status: "active",
      area: 82.5,
      owner: "Resident Owner",
      layerId: "layer-ifc-fragments",
      modelLocalIds: [114970],
      globalIds: ["ifc-global-id"],
    },
    {
      id: "a1111111-1111-4111-8111-111111111702" as never,
      buildingId: "11111111-1111-4111-8111-111111111111" as never,
      code: "A-0702",
      displayName: "Apartment 0702",
      unitType: "apartment",
      storeyCode: "L07",
      status: "active",
      modelLocalIds: [],
      globalIds: [],
    },
  ],
};

describe("renderHouseholdPanel", () => {
  it("groups units by floor and exposes floor selection", () => {
    const container = document.createElement("div");
    const selectStorey = vi.fn();
    renderHouseholdPanel(
      container,
      {
        ...initialState,
        mode: "units",
        units: {
          ...initialState.units,
          status: "ready",
          items: storey.units,
          storeys: [storey],
          bindingCoverage: 0.5,
        },
      },
      selectStorey,
      vi.fn(),
      vi.fn(),
    );

    expect(container.textContent).toContain("Households by floor");
    expect(container.textContent).toContain("50% 3D mapped");
    const floorButton = container.querySelector<HTMLButtonElement>(".floor-card");
    floorButton?.click();
    expect(selectStorey).toHaveBeenCalledWith(storey);
  });

  it("shows section controls and apartment data for a selected floor", () => {
    const container = document.createElement("div");
    const selectUnit = vi.fn();
    const setCutRatio = vi.fn();
    renderHouseholdPanel(
      container,
      {
        ...initialState,
        mode: "units",
        units: {
          ...initialState.units,
          status: "ready",
          items: storey.units,
          storeys: [storey],
          selectedStoreyCode: storey.code,
          selectedId: storey.units[0]?.id,
          bindingCoverage: 0.5,
        },
        occupancies: {
          status: "ready",
          items: [
            {
              relationshipType: "owner",
              displayName: "Resident Owner",
              startsAt: "2026-01-01T00:00:00Z",
            },
          ],
        },
      },
      vi.fn(),
      selectUnit,
      setCutRatio,
    );

    expect(container.textContent).toContain("Floor 07 apartments");
    expect(container.textContent).toContain("82.5 m²");
    expect(container.textContent).toContain("Resident Records · Unit A-0701");
    expect(container.textContent).toContain("Resident Owner");

    const unitButtons = container.querySelectorAll<HTMLButtonElement>(".unit-card");
    unitButtons[1]?.click();
    expect(selectUnit).toHaveBeenCalledWith(storey.units[1]?.id);

    const cutButtons = container.querySelectorAll<HTMLButtonElement>(
      ".cut-height-control button",
    );
    cutButtons[0]?.click();
    expect(setCutRatio).toHaveBeenCalledWith(0.2);
  });

  it("shows household management only when the building capability allows it", () => {
    const container = document.createElement("div");
    const openEditor = vi.fn();
    renderHouseholdPanel(
      container,
      {
        ...initialState,
        mode: "units",
        units: {
          ...initialState.units,
          status: "ready",
          items: storey.units,
          storeys: [storey],
          selectedStoreyCode: storey.code,
          selectedId: storey.units[0]?.id,
        },
      },
      vi.fn(),
      vi.fn(),
      vi.fn(),
      { canManage: true, openEditor },
    );

    const manage = container.querySelector<HTMLButtonElement>(
      ".unit-manage-button",
    );
    manage?.click();
    expect(openEditor).toHaveBeenCalledWith(storey.units[0], manage);

    renderHouseholdPanel(
      container,
      {
        ...initialState,
        mode: "units",
        units: {
          ...initialState.units,
          status: "ready",
          items: storey.units,
          storeys: [storey],
          selectedStoreyCode: storey.code,
          selectedId: storey.units[0]?.id,
        },
      },
      vi.fn(),
      vi.fn(),
      vi.fn(),
      { canManage: false, openEditor },
    );
    expect(container.querySelector(".unit-manage-button")).toBeNull();
  });
});
