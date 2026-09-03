// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type { ModelVersionId } from "@bim/shared";
import { initialState } from "../src/app/app-state.js";
import { renderBimPanel } from "../src/modules/bim-inspection/render-bim-panel.js";

describe("renderBimPanel", () => {
  it("renders empty state prompt when no element is selected", () => {
    const container = document.createElement("div");
    renderBimPanel(container, initialState);

    expect(container.querySelector(".panel-eyebrow")?.textContent).toBe(
      "BIM Structure",
    );
    expect(container.querySelector(".panel-empty")?.textContent).toContain(
      "No Element Selected",
    );
  });

  it("renders rich metadata, category badge, coordinates, and property groups", () => {
    const container = document.createElement("div");
    const bimState = {
      ...initialState,
      mode: "bim" as const,
      bimSelection: {
        layerId: "model-main",
        ref: {
          modelVersionId:
            "32222222-2222-4222-8222-222222222222" as ModelVersionId,
          modelLocalId: 1042,
          globalId: "2O2_b$VQ51Ov$FTBXZ$Clay",
        },
        title: "Basic Wall: Interior - Partition (79mm)",
        category: "IfcWallStandardCase",
        worldPosition: [12.45, 3.2, -5.8] as const,
        properties: [
          { key: "LoadBearing", value: false },
          { key: "FireRating", value: "60 min" },
          { key: "Length", value: 4.5, unit: "m" },
        ],
        groups: [
          {
            key: "identity",
            label: "Attributes & Identity",
            entries: [
              { key: "GlobalId", value: "2O2_b$VQ51Ov$FTBXZ$Clay" },
              { key: "ExpressID", value: 1042 },
              { key: "Tag", value: "1042" },
            ],
          },
          {
            key: "pset_wallcommon",
            label: "Pset_WallCommon",
            entries: [
              { key: "LoadBearing", value: false },
              { key: "FireRating", value: "60 min" },
            ],
          },
          {
            key: "pset_qto_wallbasequantities",
            label: "Qto_WallBaseQuantities",
            entries: [
              { key: "Length", value: 4.5, unit: "m" },
              { key: "Height", value: 2.8, unit: "m" },
            ],
          },
        ],
      },
    };

    renderBimPanel(container, bimState);

    // Verify Header Card
    expect(container.querySelector(".bim-category-badge")?.textContent).toBe(
      "IfcWallStandardCase",
    );
    expect(container.querySelector(".bim-id-badge")?.textContent).toBe("#1042");
    expect(container.querySelector(".bim-element-title")?.textContent).toBe(
      "Basic Wall: Interior - Partition (79mm)",
    );
    expect(container.querySelector(".bim-guid-val")?.textContent).toBe(
      "2O2_b$VQ51Ov$FTBXZ$Clay",
    );

    // Verify Coordinates
    const coords = container.querySelectorAll(".coord-card");
    expect(coords).toHaveLength(3);
    expect(coords[0]?.querySelector(".coord-value")?.textContent).toBe(
      "12.450",
    );
    expect(coords[1]?.querySelector(".coord-value")?.textContent).toBe("3.200");
    expect(coords[2]?.querySelector(".coord-value")?.textContent).toBe(
      "-5.800",
    );

    // Verify Accordion Groups
    const groupCards = container.querySelectorAll(".bim-group-card");
    expect(groupCards).toHaveLength(3);

    const groupTitles = [...container.querySelectorAll(".bim-group-title")].map(
      (el) => el.textContent,
    );
    expect(groupTitles).toEqual([
      "Attributes & Identity",
      "Pset_WallCommon",
      "Qto_WallBaseQuantities",
    ]);

    // Verify Boolean Pill rendering
    const boolPill = container.querySelector(".bim-val-bool.false");
    expect(boolPill?.textContent).toBe("False");

    // Verify Unit rendering
    const unitEl = container.querySelector(".prop-unit");
    expect(unitEl?.textContent).toBe("m");
  });

  it("renders loading state placeholder when inspection starts without prior selection", () => {
    const container = document.createElement("div");
    const loadingState = {
      ...initialState,
      mode: "bim" as const,
      bimSelection: undefined,
      bimInspection: { status: "loading" as const },
    };

    renderBimPanel(container, loadingState);

    expect(container.querySelector("h2")?.textContent).toBe(
      "Loading Element...",
    );
    expect(container.querySelector(".bim-loading-spinner")).not.toBeNull();
    expect(container.querySelector(".bim-loading-text")?.textContent).toContain(
      "Extracting IFC Metadata",
    );
  });

  it("renders frosted loading overlay over existing metadata when selecting a new element", () => {
    const container = document.createElement("div");
    const loadingNewElementState = {
      ...initialState,
      mode: "bim" as const,
      bimSelection: {
        layerId: "model-main",
        ref: {
          modelVersionId:
            "32222222-2222-4222-8222-222222222222" as ModelVersionId,
          modelLocalId: 1042,
        },
        title: "Wall A",
        category: "IfcWall",
        worldPosition: [0, 0, 0] as const,
        properties: [],
        groups: [
          {
            key: "identity",
            label: "Attributes & Identity",
            entries: [{ key: "Name", value: "Wall A" }],
          },
        ],
      },
      bimInspection: { status: "loading" as const },
    };

    renderBimPanel(container, loadingNewElementState);

    // Existing data is still in DOM
    expect(container.querySelector(".bim-element-title")?.textContent).toBe(
      "Wall A",
    );
    // Frosted loading overlay is present
    const overlay = container.querySelector(".bim-loading-overlay");
    expect(overlay).not.toBeNull();
    expect(overlay?.textContent).toContain("Loading element metadata...");
    expect(overlay?.querySelector(".bim-loading-spinner")).not.toBeNull();
  });

  it("filters properties and groups via search box", () => {
    const container = document.createElement("div");
    const bimState = {
      ...initialState,
      mode: "bim" as const,
      bimSelection: {
        layerId: "model-main",
        ref: {
          modelVersionId:
            "32222222-2222-4222-8222-222222222222" as ModelVersionId,
        },
        title: "Window",
        category: "IfcWindow",
        worldPosition: [0, 0, 0] as const,
        properties: [],
        groups: [
          {
            key: "identity",
            label: "Attributes & Identity",
            entries: [{ key: "Name", value: "Double Glazed Window" }],
          },
          {
            key: "pset_windowcommon",
            label: "Pset_WindowCommon",
            entries: [
              { key: "AcousticRating", value: "35dB" },
              { key: "SecurityRating", value: "High" },
            ],
          },
        ],
      },
    };

    renderBimPanel(container, bimState);

    const searchInput = container.querySelector<HTMLInputElement>(
      ".bim-props-toolbar .bim-search-input",
    );
    expect(searchInput).not.toBeNull();

    if (searchInput) {
      searchInput.value = "Acoustic";
      searchInput.dispatchEvent(new Event("input"));

      const groups = container.querySelectorAll(".bim-group-card");
      expect(groups).toHaveLength(1);
      expect(groups[0]?.querySelector(".bim-group-title")?.textContent).toBe(
        "Pset_WindowCommon",
      );
      expect(groups[0]?.querySelector("dt")?.textContent).toBe(
        "AcousticRating",
      );
    }
  });

  it("groups model elements by category and selects an element from a dropdown", () => {
    const container = document.createElement("div");
    const modelVersionId =
      "32222222-2222-4222-8222-222222222222" as ModelVersionId;
    const wall = {
      layerId: "model-main",
      ref: { modelVersionId, modelLocalId: 42 },
      title: "Exterior wall",
      category: "IfcWall",
    };
    const onSelect = vi.fn();
    const state = {
      ...initialState,
      mode: "bim" as const,
      bimCatalog: {
        status: "ready" as const,
        processed: 3,
        total: 3,
        items: [
          wall,
          {
            layerId: "model-main",
            ref: { modelVersionId, modelLocalId: 43 },
            title: "Interior wall",
            category: "IfcWall",
          },
          {
            layerId: "model-main",
            ref: { modelVersionId, modelLocalId: 99 },
            title: "Main door",
            category: "IfcDoor",
          },
        ],
      },
    };

    renderBimPanel(container, state, onSelect);

    const categories = container.querySelectorAll(".bim-category-group");
    expect(categories).toHaveLength(2);
    expect(
      [...container.querySelectorAll(".bim-category-title")].map(
        (element) => element.textContent,
      ),
    ).toEqual(["IfcDoor", "IfcWall"]);
    const wallHeader = [...categories]
      .find(
        (category) =>
          category.querySelector(".bim-category-title")?.textContent ===
          "IfcWall",
      )
      ?.querySelector<HTMLButtonElement>(".bim-category-header");
    expect(container.querySelectorAll(".bim-element-row")).toHaveLength(0);
    expect(wallHeader?.getAttribute("aria-expanded")).toBe("false");
    wallHeader?.click();
    const wallRow = wallHeader
      ?.closest(".bim-category-group")
      ?.querySelector<HTMLButtonElement>(".bim-element-row");
    wallRow?.click();
    expect(onSelect).toHaveBeenCalledWith(wall);
  });
});
