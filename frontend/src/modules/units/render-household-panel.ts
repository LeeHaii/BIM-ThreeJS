import type { OccupancyView, UnitId, UnitSummary } from "@bim/shared";
import type { AppState } from "../../app/app-state.js";

const UNIT_ICONS = {
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  emptyUnits: `<svg class="panel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><polyline points="9 18 15 12 9 6"/></svg>`,
};

interface Column<T> {
  readonly label: string;
  readonly value: (item: T) => string;
}

const unitColumns: readonly Column<UnitSummary>[] = [
  { label: "Apartment / Space", value: (unit) => unit.displayName },
  { label: "Address", value: (unit) => unit.address ?? "—" },
  {
    label: "Area",
    value: (unit) =>
      unit.area === undefined ? "—" : `${unit.area.toFixed(1)} m²`,
  },
  { label: "Owner", value: (unit) => unit.owner ?? "—" },
  { label: "Certificate No.", value: (unit) => unit.certificateNumber ?? "—" },
  { label: "Ownership Term", value: (unit) => unit.ownershipTerm ?? "—" },
];

const residentColumns: readonly Column<OccupancyView>[] = [
  { label: "Full Name", value: (item) => item.displayName ?? "Restricted" },
  { label: "Citizen ID", value: (item) => item.citizenId ?? "Restricted" },
  { label: "Date of Birth", value: (item) => item.dateOfBirth ?? "Restricted" },
  { label: "Phone", value: (item) => item.phone ?? "Restricted" },
  { label: "Email", value: (item) => item.email ?? "Restricted" },
  { label: "Gender", value: (item) => item.gender ?? "Restricted" },
  { label: "Relationship", value: (item) => item.relationshipType },
  { label: "Residence Type", value: (item) => item.residenceType ?? "—" },
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
      button.innerHTML = `<span>Select</span> ${UNIT_ICONS.chevronRight}`;
      button.addEventListener("click", () => action(item));
      actionCell.append(button);
      itemRow.append(actionCell);
    }
    columns.forEach((column) => {
      const cell = document.createElement("td");
      const val = column.value(item);
      if (val === "Restricted") {
        const badge = document.createElement("span");
        badge.style.cssText =
          "font-size:10px; color:#64748b; background:#f1f5f9; padding:2px 6px; border-radius:3px; font-weight:500; letter-spacing:0.04em;";
        badge.textContent = "RESTRICTED";
        cell.append(badge);
      } else {
        cell.textContent = val;
      }
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
  eyebrow.className = "panel-eyebrow";
  eyebrow.textContent = "Operations";
  const title = document.createElement("h2");
  title.textContent = "Apartments & Managed Spaces";
  heading.append(eyebrow, title);
  container.append(heading);

  if (state.units.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "panel-empty";
    empty.innerHTML = `
      ${UNIT_ICONS.emptyUnits}
      <div>
        <strong style="color: var(--text-secondary); display: block; margin-bottom: 4px; font-weight: 500;">
          ${state.units.status === "loading" ? "Loading Managed Spaces…" : "No Spaces Found"}
        </strong>
        <span>${state.units.status === "loading" ? "Fetching live space registry from building dataset…" : "No managed apartments or commercial units configured for this building."}</span>
      </div>
    `;
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
  residentTitle.textContent = `Resident Records · Unit ${selected.code}`;
  const privacy = document.createElement("span");
  privacy.className = "privacy-badge";
  privacy.innerHTML = `${UNIT_ICONS.shield} <span>Authorized Fields Only · Zero-Cache</span>`;
  residentHeading.append(residentTitle, privacy);
  container.append(residentHeading);

  if (state.occupancies.status === "loading") {
    const loading = document.createElement("div");
    loading.className = "panel-empty";
    loading.textContent = "Loading authorized resident records…";
    container.append(loading);
    return;
  }

  if (state.occupancies.items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "panel-empty";
    empty.textContent = "No current resident records or access is restricted.";
    container.append(empty);
    return;
  }

  container.append(
    table(state.occupancies.items, residentColumns, undefined, () => false),
  );
}
