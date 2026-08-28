import type {
  AdminOccupancy,
  BuildingId,
  CreateOccupancyInput,
  UnitId,
  UnitSummary,
  UpdateOccupancyInput,
  UpdateUnitInput,
} from "@bim/shared";
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

  public async start(initialBuildingId?: BuildingId): Promise<void> {
    const controller = new AbortController();
    this.store.dispatch({ type: "CATALOG_LOADING" });
    const page = await this.api.listBuildings(controller.signal);
    this.store.dispatch({ type: "CATALOG_READY", buildings: page.items });
    const requested = page.items.find(
      (building) => building.id === initialBuildingId,
    );
    const initial = requested ?? page.items[0];
    if (initial !== undefined) await this.openBuilding(initial.id);
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
      const [detail, manifest, householdIndex] = await Promise.all([
        this.api.getBuilding(buildingId, controller.signal),
        this.api.getActiveSceneManifest(buildingId, controller.signal),
        this.api.getHouseholdIndex(buildingId, controller.signal),
      ]);
      this.store.dispatch({
        type: "BUILDING_READY",
        generation,
        detail,
        manifest,
        householdIndex,
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
      this.store.dispatch({
        type: "OCCUPANCIES_READY",
        generation,
        unitId,
        items,
      });
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message)
        this.store.dispatch({
          type: "OCCUPANCIES_FAILED",
          generation,
          unitId,
          message,
        });
    }
  }

  public getAdminOccupancies(
    unitId: UnitId,
    signal?: AbortSignal,
  ): Promise<readonly AdminOccupancy[]> {
    const buildingId = this.requireCurrentBuilding();
    return this.api.getAdminOccupancies(buildingId, unitId, signal);
  }

  public async updateUnit(
    unitId: UnitId,
    payload: UpdateUnitInput,
    signal?: AbortSignal,
  ): Promise<UnitSummary> {
    const state = this.store.getState();
    const buildingId = this.requireCurrentBuilding();
    const generation = state.generation;
    const unit = await this.api.updateUnit(buildingId, unitId, payload, signal);
    this.store.dispatch({
      type: "HOUSEHOLD_UNIT_UPDATED",
      generation,
      unit,
    });
    return unit;
  }

  public createOccupancy(
    unitId: UnitId,
    payload: CreateOccupancyInput,
    signal?: AbortSignal,
  ): Promise<AdminOccupancy> {
    return this.api.createOccupancy(
      this.requireCurrentBuilding(),
      unitId,
      payload,
      signal,
    );
  }

  public updateOccupancy(
    occupancyId: string,
    payload: UpdateOccupancyInput,
    signal?: AbortSignal,
  ): Promise<AdminOccupancy> {
    return this.api.updateOccupancy(
      this.requireCurrentBuilding(),
      occupancyId,
      payload,
      signal,
    );
  }

  public deleteOccupancy(
    occupancyId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    return this.api
      .deleteOccupancy(
        this.requireCurrentBuilding(),
        occupancyId,
        signal,
      )
      .then(() => undefined);
  }

  public async refreshOccupancies(unitId: UnitId): Promise<void> {
    const state = this.store.getState();
    if (state.units.selectedId !== unitId) return;
    this.occupanciesController?.abort();
    const controller = new AbortController();
    this.occupanciesController = controller;
    const buildingId = this.requireCurrentBuilding();
    const generation = state.generation;
    try {
      const items = await this.api.getOccupancies(
        buildingId,
        unitId,
        controller.signal,
      );
      this.store.dispatch({
        type: "OCCUPANCIES_READY",
        generation,
        unitId,
        items,
      });
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message) {
        this.store.dispatch({
          type: "OCCUPANCIES_FAILED",
          generation,
          unitId,
          message,
        });
      }
    }
  }

  private requireCurrentBuilding(): BuildingId {
    const buildingId = this.store.getState().building.selectedId;
    if (buildingId === undefined) {
      throw new Error("No building is currently selected");
    }
    return buildingId;
  }

  public dispose(): void {
    this.buildingController?.abort();
    this.unitsController?.abort();
    this.occupanciesController?.abort();
  }
}
