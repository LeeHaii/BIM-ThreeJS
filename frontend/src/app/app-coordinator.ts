import type { BuildingId, UnitId } from "@bim/shared";
import type { ApiClient } from "../infrastructure/api/api-client.js";
import type { AppStore } from "./app-store.js";

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return error instanceof Error
    ? error.message
    : "An unexpected error occurred";
}

export class AppCoordinator {
  private buildingController: AbortController | undefined;
  private unitsController: AbortController | undefined;
  private occupanciesController: AbortController | undefined;

  public constructor(
    private readonly store: AppStore,
    private readonly api: ApiClient,
  ) {}

  public async start(): Promise<void> {
    const controller = new AbortController();
    this.store.dispatch({ type: "CATALOG_LOADING" });
    const page = await this.api.listBuildings(controller.signal);
    this.store.dispatch({ type: "CATALOG_READY", buildings: page.items });
    const first = page.items[0];
    if (first !== undefined) await this.openBuilding(first.id);
  }

  public async openBuilding(buildingId: BuildingId): Promise<void> {
    this.buildingController?.abort();
    this.unitsController?.abort();
    this.occupanciesController?.abort();
    const controller = new AbortController();
    this.buildingController = controller;
    const generation = this.store.getState().generation + 1;
    this.store.dispatch({ type: "OPEN_BUILDING", buildingId, generation });
    try {
      const [detail, manifest, units] = await Promise.all([
        this.api.getBuilding(buildingId, controller.signal),
        this.api.getActiveManifest(buildingId, controller.signal),
        this.api.searchUnits(buildingId, "", controller.signal),
      ]);
      this.store.dispatch({
        type: "BUILDING_READY",
        generation,
        detail,
        manifest,
        units: units.items,
      });
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message)
        this.store.dispatch({ type: "BUILDING_FAILED", generation, message });
    }
  }

  public async searchUnits(query: string): Promise<void> {
    const state = this.store.getState();
    const buildingId = state.building.selectedId;
    if (buildingId === undefined || state.building.status !== "ready") return;
    this.unitsController?.abort();
    const controller = new AbortController();
    this.unitsController = controller;
    const generation = state.generation;
    this.store.dispatch({ type: "UNITS_LOADING", generation, query });
    try {
      const page = await this.api.searchUnits(
        buildingId,
        query,
        controller.signal,
      );
      this.store.dispatch({
        type: "UNITS_READY",
        generation,
        query,
        units: page.items,
      });
    } catch (error: unknown) {
      if (errorMessage(error)) {
        this.store.dispatch({
          type: "UNITS_READY",
          generation,
          query,
          units: [],
        });
      }
    }
  }

  public async selectUnit(unitId: UnitId): Promise<void> {
    const state = this.store.getState();
    const buildingId = state.building.selectedId;
    if (buildingId === undefined) return;
    this.occupanciesController?.abort();
    const controller = new AbortController();
    this.occupanciesController = controller;
    const generation = state.generation;
    this.store.dispatch({ type: "SELECT_UNIT", generation, unitId });
    try {
      const items = await this.api.getOccupancies(
        buildingId,
        unitId,
        controller.signal,
      );
      this.store.dispatch({ type: "OCCUPANCIES_READY", generation, items });
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message)
        this.store.dispatch({
          type: "OCCUPANCIES_FAILED",
          generation,
          message,
        });
    }
  }

  public dispose(): void {
    this.buildingController?.abort();
    this.unitsController?.abort();
    this.occupanciesController?.abort();
  }
}
