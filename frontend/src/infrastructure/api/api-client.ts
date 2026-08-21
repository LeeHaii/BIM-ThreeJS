import {
  adminOccupancySchema,
  buildingDetailSchema,
  buildingSummarySchema,
  occupancyViewSchema,
  pageSchema,
  sceneManifestV2Schema,
  unitSummarySchema,
} from "@bim/shared";
import type {
  AdminOccupancy,
  BuildingDetail,
  BuildingId,
  BuildingSummary,
  CreateBuildingInput,
  CreateOccupancyInput,
  CreateUnitInput,
  OccupancyView,
  Page,
  SceneManifestV2,
  UnitId,
  UnitSummary,
  UpdateOccupancyInput,
  UpdateUnitInput,
} from "@bim/shared";
import { z } from "zod";

export interface ActionResult {
  readonly success: boolean;
  readonly message?: string | undefined;
}

const actionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export class ApiClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly actorId: string,
  ) {}

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    signal?: AbortSignal,
    options?: RequestInit,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "X-Actor-Id": this.actorId,
      "X-Correlation-Id": crypto.randomUUID(),
      ...(options?.headers as Record<string, string> | undefined),
    };

    const init: RequestInit = {
      credentials: "omit",
      cache: "no-store",
      ...options,
      headers,
    };
    if (signal !== undefined) {
      init.signal = signal;
    }

    const response = await fetch(`${this.baseUrl}${path}`, init);

    if (!response.ok) {
      const body = (await response.json().catch(() => undefined)) as
        | { readonly message?: string }
        | undefined;
      throw new Error(
        body?.message ?? `API request failed (${String(response.status)})`,
      );
    }
    return schema.parse(await response.json());
  }

  public listBuildings(signal?: AbortSignal): Promise<Page<BuildingSummary>> {
    return this.request(
      "/buildings",
      pageSchema(buildingSummarySchema),
      signal,
    );
  }

  public getBuilding(
    buildingId: BuildingId,
    signal?: AbortSignal,
  ): Promise<BuildingDetail> {
    return this.request(
      `/buildings/${buildingId}`,
      buildingDetailSchema,
      signal,
    );
  }

  public getActiveSceneManifest(
    buildingId: BuildingId,
    signal?: AbortSignal,
  ): Promise<SceneManifestV2> {
    return this.request(
      `/buildings/${buildingId}/scenes/active/manifest`,
      sceneManifestV2Schema,
      signal,
    );
  }

  public searchUnits(
    buildingId: BuildingId,
    query: string,
    signal?: AbortSignal,
  ): Promise<Page<UnitSummary>> {
    const parameters = new URLSearchParams({ q: query, pageSize: "100" });
    return this.request(
      `/buildings/${buildingId}/units?${parameters.toString()}`,
      pageSchema(unitSummarySchema),
      signal,
    );
  }

  public getOccupancies(
    buildingId: BuildingId,
    unitId: UnitId,
    signal?: AbortSignal,
  ): Promise<readonly OccupancyView[]> {
    return this.request(
      `/buildings/${buildingId}/units/${unitId}/occupancies`,
      occupancyViewSchema.array(),
      signal,
    );
  }

  // Admin Operations
  public createBuilding(
    payload: CreateBuildingInput,
    signal?: AbortSignal,
  ): Promise<BuildingDetail> {
    return this.request(
      "/admin/buildings",
      buildingDetailSchema,
      signal,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  }

  public deleteBuilding(
    buildingId: BuildingId,
    signal?: AbortSignal,
  ): Promise<ActionResult> {
    return this.request(
      `/admin/buildings/${buildingId}`,
      actionResponseSchema,
      signal,
      { method: "DELETE" },
    );
  }

  public setupModels(
    buildingId: BuildingId,
    payload: {
      model_name: string;
      ifc_asset_url: string;
      ifc_byte_size: number;
      ifc_content_hash: string;
      env_name: string;
      env_asset_url: string;
      env_byte_size: number;
      env_content_hash: string;
    },
    signal?: AbortSignal,
  ): Promise<SceneManifestV2> {
    return this.request(
      `/admin/buildings/${buildingId}/models/setup`,
      sceneManifestV2Schema,
      signal,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  }

  public uploadModels(
    buildingId: BuildingId,
    formData: FormData,
    signal?: AbortSignal,
  ): Promise<SceneManifestV2> {
    return this.request(
      `/admin/buildings/${buildingId}/models/upload`,
      sceneManifestV2Schema,
      signal,
      {
        method: "POST",
        body: formData,
      },
    );
  }

  public createUnit(
    buildingId: BuildingId,
    payload: CreateUnitInput,
    signal?: AbortSignal,
  ): Promise<UnitSummary> {
    return this.request(
      `/admin/buildings/${buildingId}/units`,
      unitSummarySchema,
      signal,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  }

  public updateUnit(
    buildingId: BuildingId,
    unitId: UnitId,
    payload: UpdateUnitInput,
    signal?: AbortSignal,
  ): Promise<UnitSummary> {
    return this.request(
      `/admin/buildings/${buildingId}/units/${unitId}`,
      unitSummarySchema,
      signal,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  }

  public deleteUnit(
    buildingId: BuildingId,
    unitId: UnitId,
    signal?: AbortSignal,
  ): Promise<ActionResult> {
    return this.request(
      `/admin/buildings/${buildingId}/units/${unitId}`,
      actionResponseSchema,
      signal,
      { method: "DELETE" },
    );
  }

  public getAdminOccupancies(
    buildingId: BuildingId,
    unitId: UnitId,
    signal?: AbortSignal,
  ): Promise<readonly AdminOccupancy[]> {
    return this.request(
      `/admin/buildings/${buildingId}/units/${unitId}/occupancies`,
      adminOccupancySchema.array(),
      signal,
    );
  }

  public createOccupancy(
    buildingId: BuildingId,
    unitId: UnitId,
    payload: CreateOccupancyInput,
    signal?: AbortSignal,
  ): Promise<AdminOccupancy> {
    return this.request(
      `/admin/buildings/${buildingId}/units/${unitId}/occupancies`,
      adminOccupancySchema,
      signal,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  }

  public updateOccupancy(
    buildingId: BuildingId,
    occupancyId: string,
    payload: UpdateOccupancyInput,
    signal?: AbortSignal,
  ): Promise<AdminOccupancy> {
    return this.request(
      `/admin/buildings/${buildingId}/occupancies/${occupancyId}`,
      adminOccupancySchema,
      signal,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  }

  public deleteOccupancy(
    buildingId: BuildingId,
    occupancyId: string,
    signal?: AbortSignal,
  ): Promise<ActionResult> {
    return this.request(
      `/admin/buildings/${buildingId}/occupancies/${occupancyId}`,
      actionResponseSchema,
      signal,
      { method: "DELETE" },
    );
  }
}
