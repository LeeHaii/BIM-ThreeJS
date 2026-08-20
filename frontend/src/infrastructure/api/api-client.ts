import {
  buildingDetailSchema,
  buildingSummarySchema,
  occupancyViewSchema,
  pageSchema,
  sceneManifestV2Schema,
  unitSummarySchema,
} from "@bim/shared";
import type {
  BuildingDetail,
  BuildingId,
  BuildingSummary,
  OccupancyView,
  Page,
  SceneManifestV2,
  UnitId,
  UnitSummary,
} from "@bim/shared";
import type { z } from "zod";

export class ApiClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly actorId: string,
  ) {}

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    signal: AbortSignal,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      signal,
      headers: {
        "X-Actor-Id": this.actorId,
        "X-Correlation-Id": crypto.randomUUID(),
      },
      credentials: "omit",
      cache: "no-store",
    });
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

  public listBuildings(signal: AbortSignal): Promise<Page<BuildingSummary>> {
    return this.request(
      "/buildings",
      pageSchema(buildingSummarySchema),
      signal,
    );
  }

  public getBuilding(
    buildingId: BuildingId,
    signal: AbortSignal,
  ): Promise<BuildingDetail> {
    return this.request(
      `/buildings/${buildingId}`,
      buildingDetailSchema,
      signal,
    );
  }

  public getActiveSceneManifest(
    buildingId: BuildingId,
    signal: AbortSignal,
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
    signal: AbortSignal,
  ): Promise<Page<UnitSummary>> {
    const parameters = new URLSearchParams({ q: query, pageSize: "50" });
    return this.request(
      `/buildings/${buildingId}/units?${parameters.toString()}`,
      pageSchema(unitSummarySchema),
      signal,
    );
  }

  public getOccupancies(
    buildingId: BuildingId,
    unitId: UnitId,
    signal: AbortSignal,
  ): Promise<readonly OccupancyView[]> {
    return this.request(
      `/buildings/${buildingId}/units/${unitId}/occupancies`,
      occupancyViewSchema.array(),
      signal,
    );
  }
}
