import type {
  HouseholdStorey,
  HouseholdUnitSummary,
  OccupancyView,
  UnitId,
} from "@bim/shared";
import type { AppState } from "../../app/app-state.js";

const UNIT_ICONS = {
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  emptyUnits: `<svg class="panel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:10px;height:10px;"><polyline points="9 18 15 12 9 6"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 12 12 17 22 12"/><polyline points="2 17 12 22 22 17"/></svg>`,
  apartment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M5 21V4h14v17"/><path d="M9 8h2"/><path d="M13 8h2"/><path d="M9 12h2"/><path d="M13 12h2"/><path d="M10 21v-5h4v5"/></svg>`,
  edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>`,
  model: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></svg>`,
};

export interface HouseholdPanelManagement {
  readonly canManage: boolean;
  readonly openEditor: (
    unit: HouseholdUnitSummary,
    trigger: HTMLButtonElement,
  ) => void;
}

interface Column<T> {
  readonly label: string;
  readonly value: (item: T) => string;
}

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
  selectStorey: (storey: HouseholdStorey) => void,
  selectUnit: (unitId: UnitId) => void,
  setCutRatio: (ratio: 0.2 | 0.5) => void,
  management?: HouseholdPanelManagement,
): void {
  container.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "panel-section-heading";
  const eyebrow = document.createElement("span");
  eyebrow.className = "panel-eyebrow";
  eyebrow.textContent = "Operations";
  const title = document.createElement("h2");
  title.textContent = "Households by floor";
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

  const overview = document.createElement("div");
  overview.className = "household-overview";
  const overviewCopy = document.createElement("div");
  const overviewTitle = document.createElement("strong");
  overviewTitle.textContent = `${String(state.units.storeys.length)} residential floors`;
  const overviewHint = document.createElement("span");
  overviewHint.textContent =
    "Choose a floor to section the model and reveal apartment footprints.";
  overviewCopy.append(overviewTitle, overviewHint);
  const coverage = document.createElement("span");
  coverage.className = "binding-coverage";
  coverage.dataset.complete = String(state.units.bindingCoverage >= 0.999);
  coverage.textContent = `${String(Math.round(state.units.bindingCoverage * 100))}% 3D mapped`;
  overview.append(overviewCopy, coverage);
  container.append(overview);

  const floorSection = document.createElement("section");
  floorSection.className = "household-section";
  floorSection.setAttribute("aria-labelledby", "floor-browser-title");
  const floorHeading = document.createElement("div");
  floorHeading.className = "household-section-heading";
  const floorTitle = document.createElement("h3");
  floorTitle.id = "floor-browser-title";
  floorTitle.textContent = "Select a floor";
  const floorMeta = document.createElement("span");
  floorMeta.textContent = "Clips the model at the selected level";
  floorHeading.append(floorTitle, floorMeta);

  const floorGrid = document.createElement("div");
  floorGrid.className = "floor-grid";
  for (const storey of state.units.storeys) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "floor-card";
    button.setAttribute(
      "aria-pressed",
      String(storey.code === state.units.selectedStoreyCode),
    );
    button.setAttribute(
      "aria-label",
      `${storey.label}, ${String(storey.unitCount)} apartments, ${String(storey.boundUnitCount)} mapped in 3D`,
    );
    const icon = document.createElement("span");
    icon.className = "floor-card-icon";
    icon.innerHTML = UNIT_ICONS.layers;
    const copy = document.createElement("span");
    copy.className = "floor-card-copy";
    const label = document.createElement("strong");
    label.textContent = storey.label;
    const count = document.createElement("small");
    count.textContent = `${String(storey.boundUnitCount)}/${String(storey.unitCount)} mapped`;
    copy.append(label, count);
    button.append(icon, copy);
    button.addEventListener("click", () => selectStorey(storey));
    floorGrid.append(button);
  }
  floorSection.append(floorHeading, floorGrid);
  container.append(floorSection);

  const selectedStorey = state.units.storeys.find(
    (storey) => storey.code === state.units.selectedStoreyCode,
  );
  if (selectedStorey === undefined) {
    const guidance = document.createElement("div");
    guidance.className = "household-guidance";
    guidance.innerHTML = `${UNIT_ICONS.model}<span>Select a floor above. The viewer will create a horizontal section and tint mapped apartments red.</span>`;
    container.append(guidance);
    return;
  }

  const unitSection = document.createElement("section");
  unitSection.className = "household-section household-unit-section";
  const unitHeading = document.createElement("div");
  unitHeading.className = "household-section-heading household-unit-heading";
  const headingCopy = document.createElement("div");
  const unitTitle = document.createElement("h3");
  unitTitle.textContent = `${selectedStorey.label} apartments`;
  const unitHint = document.createElement("span");
  unitHint.textContent = "Click a card or its highlighted footprint in 3D.";
  headingCopy.append(unitTitle, unitHint);

  const cutControl = document.createElement("div");
  cutControl.className = "cut-height-control";
  cutControl.setAttribute("role", "group");
  cutControl.setAttribute("aria-label", "Floor section height");
  for (const ratio of [0.2, 0.5] as const) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${String(ratio * 100)}% cut`;
    button.setAttribute("aria-pressed", String(state.units.clipRatio === ratio));
    button.addEventListener("click", () => setCutRatio(ratio));
    cutControl.append(button);
  }
  unitHeading.append(headingCopy, cutControl);

  const unitGrid = document.createElement("div");
  unitGrid.className = "unit-card-grid";
  for (const unit of selectedStorey.units) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "unit-card";
    button.setAttribute("aria-pressed", String(unit.id === state.units.selectedId));
    const icon = document.createElement("span");
    icon.className = "unit-card-icon";
    icon.innerHTML = UNIT_ICONS.apartment;
    const copy = document.createElement("span");
    copy.className = "unit-card-copy";
    const name = document.createElement("strong");
    name.textContent = unit.code;
    const area = document.createElement("small");
    area.textContent =
      unit.area === undefined ? unit.displayName : `${unit.area.toFixed(1)} m²`;
    copy.append(name, area);
    const status = document.createElement("span");
    status.className = "unit-map-status";
    status.dataset.mapped = String(unit.modelLocalIds.length > 0);
    status.textContent = unit.modelLocalIds.length > 0 ? "3D" : "Data only";
    button.append(icon, copy, status);
    button.addEventListener("click", () => selectUnit(unit.id));
    unitGrid.append(button);
  }
  unitSection.append(unitHeading, unitGrid);
  container.append(unitSection);

  const selected = selectedStorey.units.find(
    (unit) => unit.id === state.units.selectedId,
  );
  if (selected === undefined) return;

  container.append(
    renderUnitDetails(selected, state.occupancies.items.length, management),
  );

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

function renderUnitDetails(
  unit: HouseholdUnitSummary,
  residentCount: number,
  management?: HouseholdPanelManagement,
): HTMLElement {
  const section = document.createElement("section");
  section.className = "unit-detail-card";
  const header = document.createElement("div");
  header.className = "unit-detail-header";
  const title = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.textContent = "Selected apartment";
  const name = document.createElement("h3");
  name.textContent = unit.displayName;
  title.append(eyebrow, name);
  const status = document.createElement("span");
  status.className = "unit-status-badge";
  status.textContent = unit.status;
  const actions = document.createElement("div");
  actions.className = "unit-detail-actions";
  actions.append(status);
  if (management?.canManage === true) {
    const manageButton = document.createElement("button");
    manageButton.type = "button";
    manageButton.className = "unit-manage-button";
    manageButton.innerHTML = `${UNIT_ICONS.edit}<span>Manage</span>`;
    manageButton.setAttribute(
      "aria-label",
      `Manage apartment ${unit.displayName}`,
    );
    manageButton.addEventListener("click", () =>
      management.openEditor(unit, manageButton),
    );
    actions.append(manageButton);
  }
  header.append(title, actions);

  const metrics = document.createElement("dl");
  metrics.className = "unit-metrics";
  const values: readonly [string, string][] = [
    ["Area", unit.area === undefined ? "—" : `${unit.area.toFixed(1)} m²`],
    ["Residents", String(residentCount)],
    ["Owner", unit.owner ?? "—"],
    ["Address", unit.address ?? "—"],
    ["Certificate", unit.certificateNumber ?? "—"],
    ["Ownership", unit.ownershipTerm ?? "—"],
  ];
  for (const [label, value] of values) {
    const item = document.createElement("div");
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    item.append(term, description);
    metrics.append(item);
  }
  section.append(header, metrics);
  return section;
}
