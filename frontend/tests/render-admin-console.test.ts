// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import type {
  BuildingDetail,
  BuildingId,
  BuildingSummary,
  Page,
  UnitId,
  UnitSummary,
} from "@bim/shared";
import type { ApiClient } from "../src/infrastructure/api/api-client.js";
import { renderAdminConsole } from "../src/modules/admin-console/render-admin-console.js";

const buildingId = "11111111-1111-4111-8111-111111111111" as BuildingId;

const building: BuildingSummary = {
  id: buildingId,
  code: "TOWER-A",
  name: "Tower A",
  timezone: "Asia/Saigon",
  locale: "en",
};

const buildingDetail: BuildingDetail = {
  ...building,
  features: { households: true },
};

function makeUnits(page: number, pageSize: number): readonly UnitSummary[] {
  const start = (page - 1) * pageSize;
  return Array.from({ length: pageSize }, (_, index) => {
    const unitNumber = start + index + 1;
    return {
      id: `unit-${String(unitNumber)}` as UnitId,
      buildingId,
      code: `A-${String(unitNumber).padStart(3, "0")}`,
      displayName: `Apartment ${String(unitNumber)}`,
      unitType: "apartment",
      storeyCode: "L01",
      status: "active" as const,
    };
  });
}

describe("renderAdminConsole household pagination", () => {
  it("uses the API total and loads records beyond the first page", async () => {
    const searchUnits = vi.fn(
      (
        _id: BuildingId,
        _query: string,
        _signal?: AbortSignal,
        pagination?: { readonly page: number; readonly pageSize: number },
      ): Promise<Page<UnitSummary>> => {
        const page = pagination?.page ?? 1;
        const pageSize = pagination?.pageSize ?? 25;
        return Promise.resolve({
          items: makeUnits(page, pageSize),
          page,
          pageSize,
          total: 125,
        });
      },
    );

    const api = {
      listBuildings: vi.fn(() =>
        Promise.resolve({ items: [building], page: 1, pageSize: 25, total: 1 }),
      ),
      getBuilding: vi.fn(() => Promise.resolve(buildingDetail)),
      getActiveSceneManifest: vi.fn(() =>
        Promise.reject(new Error("No active scene")),
      ),
      searchUnits,
    } as unknown as ApiClient;

    const root = document.createElement("div");
    document.body.append(root);
    const dispose = renderAdminConsole(root, api, buildingId);

    await vi.waitFor(() => {
      expect(
        root.querySelector(".admin-tab[data-tab='households']"),
      ).not.toBeNull();
    });

    root
      .querySelector<HTMLButtonElement>(".admin-tab[data-tab='households']")
      ?.click();

    expect(root.querySelectorAll(".admin-table tbody tr")).toHaveLength(25);
    expect(root.querySelector(".admin-pagination-summary")?.textContent).toBe(
      "Showing 1–25 of 125",
    );
    expect(root.querySelector(".admin-page-status")?.textContent).toBe(
      "Page 1 of 5",
    );

    root
      .querySelector<HTMLButtonElement>(".btn-unit-page[data-page='2']")
      ?.click();

    await vi.waitFor(() => {
      expect(root.querySelector(".admin-pagination-summary")?.textContent).toBe(
        "Showing 26–50 of 125",
      );
    });

    expect(searchUnits).toHaveBeenLastCalledWith(buildingId, "", undefined, {
      page: 2,
      pageSize: 25,
    });
    expect(root.querySelector("tbody tr")?.textContent).toContain("A-026");

    dispose();
    root.remove();
  });
});
