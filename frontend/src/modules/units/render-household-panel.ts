import type { OccupancyView, UnitId, UnitSummary } from "@bim/shared";
import type { AppState } from "../../app/app-state.js";

interface Column<T> {
  readonly label: string;
  readonly value: (item: T) => string;
}

const unitColumns: readonly Column<UnitSummary>[] = [
  { label: "Apartment / space", value: (unit) => unit.displayName },
  { label: "Address", value: (unit) => unit.address ?? "—" },
  {
    label: "Area",
    value: (unit) =>
      unit.area === undefined ? "—" : `${unit.area.toFixed(1)} m²`,
  },
  { label: "Owner", value: (unit) => unit.owner ?? "—" },
  { label: "Certificate no.", value: (unit) => unit.certificateNumber ?? "—" },
  { label: "Ownership term", value: (unit) => unit.ownershipTerm ?? "—" },
];

const residentColumns: readonly Column<OccupancyView>[] = [
  { label: "Full name", value: (item) => item.displayName ?? "Restricted" },
  { label: "Citizen ID", value: (item) => item.citizenId ?? "Restricted" },
  { label: "Date of birth", value: (item) => item.dateOfBirth ?? "Restricted" },
  { label: "Phone", value: (item) => item.phone ?? "Restricted" },
  { label: "Email", value: (item) => item.email ?? "Restricted" },
  { label: "Gender", value: (item) => item.gender ?? "Restricted" },
  { label: "Owner relationship", value: (item) => item.relationshipType },
  { label: "Residence type", value: (item) => item.residenceType ?? "—" },
  { label: "Status", value: (item) => item.status ?? "—" },
];

function table<T>(
  items: readonly T[],
  columns: readonly Column<T>[],
  action: ((item: T) => void) | undefined,
  selected: (item: T) => boolean,
): HTMLDivElement {
  const viewport = document.createElement("div");
  viewport.className = "data-table-viewport";
  const tableElement = document.createElement("table");
  tableElement.className = "data-table";
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  if (action !== undefined) {
    const actionHeader = document.createElement("th");
    actionHeader.textContent = "Action";
    headerRow.append(actionHeader);
  }
  columns.forEach((column) => {
    const cell = document.createElement("th");
    cell.textContent = column.label;
    headerRow.append(cell);
  });
  head.append(headerRow);
  const body = document.createElement("tbody");
  items.forEach((item) => {
    const itemRow = document.createElement("tr");
    itemRow.dataset.selected = String(selected(item));
    if (action !== undefined) {
      const actionCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "table-action";
      button.textContent = "View data";
      button.addEventListener("click", () => action(item));
      actionCell.append(button);
      itemRow.append(actionCell);
    }
    columns.forEach((column) => {
      const cell = document.createElement("td");
      cell.textContent = column.value(item);
      itemRow.append(cell);
    });
    body.append(itemRow);
  });
  tableElement.append(head, body);
  viewport.append(tableElement);
  return viewport;
}

export function renderHouseholdPanel(
  container: HTMLElement,
  state: AppState,
  selectUnit: (unitId: UnitId) => void,
): void {
  container.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "panel-section-heading";
  const eyebrow = document.createElement("span");
  eyebrow.textContent = "Household management";
  const title = document.createElement("h2");
  title.textContent = "Apartments and managed spaces";
  heading.append(eyebrow, title);
  container.append(heading);

  if (state.units.items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "panel-empty";
    empty.textContent =
      state.units.status === "loading"
        ? "Loading managed spaces…"
        : "No managed spaces.";
    container.append(empty);
    return;
  }
  container.append(
    table(
      state.units.items,
      unitColumns,
      (unit) => selectUnit(unit.id),
      (unit) => unit.id === state.units.selectedId,
    ),
  );

  const selected = state.units.items.find(
    (unit) => unit.id === state.units.selectedId,
  );
  if (selected === undefined) return;
  const residentHeading = document.createElement("div");
  residentHeading.className = "resident-heading";
  const residentTitle = document.createElement("h3");
  residentTitle.textContent = `Resident data · ${selected.code}`;
  const privacy = document.createElement("span");
  privacy.textContent = "Authorized fields only · not cached";
  residentHeading.append(residentTitle, privacy);
  container.append(residentHeading);
  if (state.occupancies.status === "loading") {
    const loading = document.createElement("p");
    loading.className = "panel-empty";
    loading.textContent = "Loading authorized resident fields…";
    container.append(loading);
    return;
  }
  if (state.occupancies.items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "panel-empty";
    empty.textContent = "No current resident records or access is restricted.";
    container.append(empty);
    return;
  }
  container.append(
    table(state.occupancies.items, residentColumns, undefined, () => false),
  );
}
