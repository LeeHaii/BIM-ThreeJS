// @vitest-environment happy-dom

import { describe, expect, it, vi } from "vitest";
import type {
  AdminOccupancy,
  HouseholdUnitSummary,
  UnitSummary,
} from "@bim/shared";
import {
  createHouseholdEditor,
  type HouseholdManagementPort,
} from "../src/modules/household-management/household-editor.js";

const unit: HouseholdUnitSummary = {
  id: "a1111111-1111-4111-8111-111111111701" as never,
  buildingId: "11111111-1111-4111-8111-111111111111" as never,
  code: "A-0701",
  displayName: "Apartment 0701",
  unitType: "apartment",
  storeyCode: "L07",
  status: "active",
  owner: "Resident Owner",
  layerId: "layer-ifc-fragments",
  modelLocalIds: [114970],
  globalIds: ["ifc-global-id"],
};

const resident: AdminOccupancy = {
  id: "occupancy-1",
  unitId: unit.id,
  personId: "person-1",
  relationshipType: "owner",
  displayName: "Resident Owner",
  email: "resident@example.com",
  phone: "+84000000000",
  citizenId: "ID-001",
  dateOfBirth: undefined,
  gender: undefined,
  residenceType: "permanent",
  status: "active",
  startsAt: "2026-01-01T00:00:00Z",
  endsAt: undefined,
};

function setup(overrides: Partial<HouseholdManagementPort> = {}) {
  document.body.replaceChildren();
  const root = document.createElement("div");
  const shell = document.createElement("div");
  shell.className = "operator-shell";
  const trigger = document.createElement("button");
  trigger.className = "unit-manage-button";
  shell.append(trigger);
  const host = document.createElement("div");
  host.className = "household-editor-host";
  root.append(shell, host);
  document.body.append(root);
  const getAdminOccupancies = vi.fn().mockResolvedValue([resident]);
  const port: HouseholdManagementPort = {
    getAdminOccupancies,
    updateUnit: vi.fn().mockImplementation((_id, payload) =>
      Promise.resolve({ ...unit, ...payload } as UnitSummary),
    ),
    createOccupancy: vi.fn().mockResolvedValue(resident),
    updateOccupancy: vi.fn().mockResolvedValue(resident),
    deleteOccupancy: vi.fn().mockResolvedValue(undefined),
    refreshOccupancies: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const editor = createHouseholdEditor(host, port);
  return { editor, host, port, shell, trigger, getAdminOccupancies };
}

describe("household editor", () => {
  it("opens accessibly and lazy-loads resident records only on demand", async () => {
    const { editor, host, shell, trigger, getAdminOccupancies } = setup();
    editor.open(unit, trigger);

    expect(host.querySelector("[role=dialog]")?.getAttribute("aria-modal")).toBe(
      "true",
    );
    expect(shell.inert).toBe(true);
    expect(getAdminOccupancies).not.toHaveBeenCalled();

    host
      .querySelector<HTMLButtonElement>("[data-tab=residents]")
      ?.click();
    await vi.waitFor(() => {
      expect(getAdminOccupancies).toHaveBeenCalledWith(
        unit.id,
        expect.any(AbortSignal),
      );
      expect(host.textContent).toContain("Resident Owner");
    });
  });

  it("updates operational apartment data and sends null for cleared values", async () => {
    const updateUnit = vi.fn().mockImplementation((_id, payload) =>
      Promise.resolve({ ...unit, ...payload } as UnitSummary),
    );
    const { editor, host } = setup({ updateUnit });
    editor.open(unit);
    const name = host.querySelector<HTMLInputElement>("[name=displayName]");
    const owner = host.querySelector<HTMLInputElement>("[name=owner]");
    if (name === null || owner === null) throw new Error("Apartment form missing");
    name.value = "Apartment 0701 Updated";
    owner.value = "";
    host
      .querySelector<HTMLFormElement>("[data-form=apartment]")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await vi.waitFor(() => {
      expect(updateUnit).toHaveBeenCalledWith(
        unit.id,
        expect.objectContaining({
          displayName: "Apartment 0701 Updated",
          owner: null,
        }),
        expect.any(AbortSignal),
      );
      expect(host.textContent).toContain("Apartment details saved");
    });
  });

  it("uses an in-dialog confirmation before removing a resident", async () => {
    const deleteOccupancy = vi.fn().mockResolvedValue(undefined);
    const refreshOccupancies = vi.fn().mockResolvedValue(undefined);
    const { editor, host } = setup({ deleteOccupancy, refreshOccupancies });
    editor.open(unit);
    host
      .querySelector<HTMLButtonElement>("[data-tab=residents]")
      ?.click();
    await vi.waitFor(() => expect(host.textContent).toContain("Resident Owner"));

    host
      .querySelector<HTMLButtonElement>(".household-editor-delete-resident")
      ?.click();
    expect(deleteOccupancy).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Remove Resident Owner?");

    host
      .querySelector<HTMLButtonElement>(".household-editor-confirm-delete")
      ?.click();
    await vi.waitFor(() => {
      expect(deleteOccupancy).toHaveBeenCalledWith(
        resident.id,
        expect.any(AbortSignal),
      );
      expect(refreshOccupancies).toHaveBeenCalledWith(unit.id);
    });
  });
});
