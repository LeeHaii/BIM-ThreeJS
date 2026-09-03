import type { PropertyGroup, SceneManifestV2 } from "@bim/shared";
import type { AppState } from "../../app/app-state.js";
import type { BimElementSummary } from "../viewer-runtime/viewer-port.js";

const BIM_ICONS = {
  element: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
  inspectPrompt: `<svg class="panel-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m10 15 5-3-5-3v6Z"/></svg>`,
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
  chevronDown: `<svg class="group-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  copy: `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  groupIdentity: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  groupPset: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  groupSpatial: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  groupMaterial: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`,
  groupDimensions: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.3 8.7 8.7 21.3a2.4 2.4 0 0 1-3.4 0L2.7 18.7a2.4 2.4 0 0 1 0-3.4L15.3 2.7a2.4 2.4 0 0 1 3.4 0l2.6 2.6a2.4 2.4 0 0 1 0 3.4Z"/><path d="m14.5 3.5 6 6"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/></svg>`,
  groupType: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>`,
};

let currentFilterQuery = "";
let catalogFilterQuery = "";
const collapsedGroupKeys = new Set<string>();
const expandedCategoryKeys = new Set<string>();
const visibleCategoryCounts = new Map<string, number>();
let activeSceneVersionId: string | undefined;
let activeSelectionKey: string | undefined;

function resetPanelStateForScene(sceneVersionId: string | undefined): void {
  if (sceneVersionId === activeSceneVersionId) return;
  activeSceneVersionId = sceneVersionId;
  currentFilterQuery = "";
  catalogFilterQuery = "";
  collapsedGroupKeys.clear();
  expandedCategoryKeys.clear();
  visibleCategoryCounts.clear();
  activeSelectionKey = undefined;
}

function getGroupIcon(groupKey: string): string {
  const k = groupKey.toLowerCase();
  if (k.includes("identity") || k.includes("attribute"))
    return BIM_ICONS.groupIdentity;
  if (k.includes("spatial") || k.includes("location") || k.includes("storey"))
    return BIM_ICONS.groupSpatial;
  if (k.includes("material")) return BIM_ICONS.groupMaterial;
  if (k.includes("dimension") || k.includes("quantit") || k.includes("qto"))
    return BIM_ICONS.groupDimensions;
  if (k.includes("type")) return BIM_ICONS.groupType;
  return BIM_ICONS.groupPset;
}

function coordCard(axis: "X" | "Y" | "Z", value: number): HTMLDivElement {
  const card = document.createElement("div");
  card.className = "coord-card";
  card.dataset.axis = axis;
  const label = document.createElement("span");
  label.className = "coord-axis";
  label.textContent = axis;
  const val = document.createElement("span");
  val.className = "coord-value";
  val.textContent = value.toFixed(3);
  card.append(label, val);
  return card;
}

function formatPropertyValue(value: string | number | boolean | null): {
  html: string;
  isPill: boolean;
  copyableText: string;
} {
  if (value === null) {
    return { html: "—", isPill: false, copyableText: "" };
  }
  if (typeof value === "boolean") {
    const cls = value ? "bim-val-bool true" : "bim-val-bool false";
    const text = value ? "True" : "False";
    return {
      html: `<span class="${cls}">${text}</span>`,
      isPill: true,
      copyableText: text,
    };
  }
  if (typeof value === "number") {
    const formatted = Number.isInteger(value)
      ? String(value)
      : value.toFixed(3).replace(/\.?0+$/, "");
    return {
      html: `<span class="bim-val-num font-mono">${formatted}</span>`,
      isPill: true,
      copyableText: String(value),
    };
  }
  const str = value;
  if (
    str.length > 20 &&
    (/^[0-9a-fA-F-]{36}$/.test(str) || /^[0-9a-zA-Z_$]{22}$/.test(str))
  ) {
    return {
      html: `<span class="bim-val-guid font-mono" title="${escapeAttr(str)}">${escapeHtml(str)}</span>`,
      isPill: true,
      copyableText: str,
    };
  }
  return {
    html: escapeHtml(str),
    isPill: false,
    copyableText: str,
  };
}

function escapeHtml(str: string): string {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(str: string): string {
  return str.replaceAll('"', "&quot;");
}

function renderBimCatalog(
  container: HTMLElement,
  state: AppState,
  onSelectElement: ((element: BimElementSummary) => void) | undefined,
): void {
  const section = document.createElement("section");
  section.className = "bim-catalog";
  section.setAttribute("aria-labelledby", "bim-catalog-heading");

  const header = document.createElement("div");
  header.className = "bim-catalog-header";
  const title = document.createElement("h3");
  title.id = "bim-catalog-heading";
  title.textContent = "Model elements";
  const count = document.createElement("span");
  count.className = "bim-catalog-count font-mono";
  count.textContent = String(state.bimCatalog.items.length);
  header.append(title, count);
  section.append(header);

  const searchBox = document.createElement("div");
  searchBox.className = "bim-search-box bim-catalog-search";
  searchBox.innerHTML = `
    ${BIM_ICONS.search}
    <input type="search" class="bim-search-input bim-catalog-search-input" placeholder="Search categories or elements..." aria-label="Search BIM elements" value="${escapeAttr(catalogFilterQuery)}" />
    ${catalogFilterQuery.length > 0 ? '<button type="button" class="btn-clear-search bim-catalog-clear" aria-label="Clear element search">&times;</button>' : ""}
  `;
  searchBox
    .querySelector<HTMLInputElement>(".bim-catalog-search-input")
    ?.addEventListener("input", (event) => {
      catalogFilterQuery = (event.target as HTMLInputElement).value;
      renderBimPanel(container, state, onSelectElement);
      const nextInput = container.querySelector<HTMLInputElement>(
        ".bim-catalog-search-input",
      );
      nextInput?.focus();
      nextInput?.setSelectionRange(
        catalogFilterQuery.length,
        catalogFilterQuery.length,
      );
    });
  searchBox
    .querySelector<HTMLButtonElement>(".bim-catalog-clear")
    ?.addEventListener("click", () => {
      catalogFilterQuery = "";
      renderBimPanel(container, state, onSelectElement);
    });
  section.append(searchBox);

  if (state.bimCatalog.status === "loading") {
    const progress = document.createElement("div");
    progress.className = "bim-catalog-status";
    progress.setAttribute("role", "status");
    const progressText =
      state.bimCatalog.total > 0
        ? `${String(state.bimCatalog.processed)} of ${String(state.bimCatalog.total)} elements`
        : "Reading model categories...";
    progress.innerHTML = `<span class="bim-loading-spinner" aria-hidden="true"></span><span>${progressText}</span>`;
    section.append(progress);
    container.append(section);
    return;
  }

  if (state.bimCatalog.status === "error") {
    const error = document.createElement("p");
    error.className = "bim-catalog-message";
    error.textContent =
      state.bimCatalog.error ?? "The model structure could not be loaded.";
    section.append(error);
    container.append(section);
    return;
  }

  const query = catalogFilterQuery.trim().toLowerCase();
  const grouped = new Map<string, BimElementSummary[]>();
  for (const item of state.bimCatalog.items) {
    const localId = item.ref.modelLocalId;
    const matches =
      query.length === 0 ||
      item.category.toLowerCase().includes(query) ||
      item.title.toLowerCase().includes(query) ||
      (localId !== undefined && String(localId).includes(query)) ||
      item.ref.globalId?.toLowerCase().includes(query) === true;
    if (!matches) continue;
    const entries = grouped.get(item.category) ?? [];
    entries.push(item);
    grouped.set(item.category, entries);
  }

  if (state.bimCatalog.status === "ready" && grouped.size === 0) {
    const empty = document.createElement("p");
    empty.className = "bim-catalog-message";
    empty.textContent =
      state.bimCatalog.items.length === 0
        ? "No BIM elements were found in this scene."
        : `No elements match “${catalogFilterQuery}”.`;
    section.append(empty);
    container.append(section);
    return;
  }

  const groups = document.createElement("div");
  groups.className = "bim-category-list";
  const selectionKey =
    state.bimSelection === undefined
      ? undefined
      : `${state.bimSelection.layerId}:${String(state.bimSelection.ref.modelLocalId)}`;
  if (selectionKey !== activeSelectionKey) {
    activeSelectionKey = selectionKey;
    const selectedItem = state.bimCatalog.items.find(
      (item) =>
        item.layerId === state.bimSelection?.layerId &&
        item.ref.modelLocalId === state.bimSelection.ref.modelLocalId,
    );
    if (selectedItem !== undefined) {
      expandedCategoryKeys.add(selectedItem.category);
    }
  }
  let groupIndex = 0;
  const sortedGroups = [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right, undefined, { sensitivity: "base" }),
  );
  for (const [category, items] of sortedGroups) {
    const isExpanded = query.length > 0 || expandedCategoryKeys.has(category);
    const group = document.createElement("div");
    group.className = `bim-category-group ${isExpanded ? "expanded" : "collapsed"}`;
    const bodyId = `bim-category-${String(groupIndex++)}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "bim-category-header";
    button.setAttribute("aria-expanded", String(isExpanded));
    button.setAttribute("aria-controls", bodyId);
    button.innerHTML = `
      <span class="bim-category-title">${escapeHtml(category)}</span>
      <span class="bim-category-summary"><span class="bim-group-badge">${String(items.length)}</span>${BIM_ICONS.chevronDown}</span>
    `;
    button.addEventListener("click", () => {
      const nextExpanded = button.getAttribute("aria-expanded") !== "true";
      if (!nextExpanded) {
        expandedCategoryKeys.delete(category);
      } else {
        expandedCategoryKeys.add(category);
      }
      button.setAttribute("aria-expanded", String(nextExpanded));
      group.classList.toggle("expanded", nextExpanded);
      group.classList.toggle("collapsed", !nextExpanded);
      body.hidden = !nextExpanded;
      if (nextExpanded && body.childElementCount === 0) renderElementRows();
    });
    group.append(button);

    const body = document.createElement("div");
    body.id = bodyId;
    body.className = "bim-element-list";
    body.hidden = !isExpanded;
    const renderElementRows = (): void => {
      body.replaceChildren();
      const selectedIndex = items.findIndex(
        (item) =>
          item.layerId === state.bimSelection?.layerId &&
          item.ref.modelLocalId === state.bimSelection.ref.modelLocalId,
      );
      const visibleCount = Math.max(
        visibleCategoryCounts.get(category) ?? 100,
        selectedIndex + 1,
      );
      visibleCategoryCounts.set(category, visibleCount);
      for (const item of items.slice(0, visibleCount)) {
        const elementButton = document.createElement("button");
        elementButton.type = "button";
        elementButton.className = "bim-element-row";
        const isActive =
          item.layerId === state.bimSelection?.layerId &&
          item.ref.modelLocalId === state.bimSelection.ref.modelLocalId;
        if (isActive) {
          elementButton.classList.add("active");
          elementButton.setAttribute("aria-current", "true");
        }
        const localId = item.ref.modelLocalId;
        elementButton.innerHTML = `
          <span class="bim-element-row-title">${escapeHtml(item.title)}</span>
          ${localId === undefined ? "" : `<span class="bim-element-row-id font-mono">#${String(localId)}</span>`}
        `;
        elementButton.addEventListener("click", () => onSelectElement?.(item));
        body.append(elementButton);
      }
      if (visibleCount < items.length) {
        const showMore = document.createElement("button");
        showMore.type = "button";
        showMore.className = "bim-element-more";
        const nextCount = Math.min(100, items.length - visibleCount);
        showMore.textContent = `Show ${String(nextCount)} more · ${String(items.length - visibleCount)} remaining`;
        showMore.addEventListener("click", () => {
          visibleCategoryCounts.set(category, visibleCount + 100);
          renderElementRows();
          body.querySelector<HTMLButtonElement>(".bim-element-more")?.focus();
        });
        body.append(showMore);
      }
    };
    if (isExpanded) renderElementRows();
    group.append(body);
    groups.append(group);
  }
  section.append(groups);
  container.append(section);
}

export function renderBimPanel(
  container: HTMLElement,
  state: AppState,
  onSelectElement?: (element: BimElementSummary) => void,
): void {
  const selection = state.bimSelection;
  const manifest = state.model.manifest;
  const isLoading = state.bimInspection.status === "loading";
  resetPanelStateForScene(manifest?.sceneVersionId);
  container.replaceChildren();

  const heading = document.createElement("div");
  heading.className = "panel-section-heading";
  const eyebrow = document.createElement("span");
  eyebrow.className = "panel-eyebrow";
  eyebrow.textContent = "BIM Structure";
  const title = document.createElement("h2");
  title.textContent =
    selection === undefined && isLoading
      ? "Loading Element..."
      : "Browse BIM elements";
  heading.append(eyebrow, title);
  container.append(heading);
  renderBimCatalog(container, state, onSelectElement);

  // If loading without previous selection: show initial loading placeholder card
  if (selection === undefined && isLoading) {
    const loadingState = document.createElement("div");
    loadingState.className = "bim-loading-state";
    loadingState.innerHTML = `
      <div class="bim-loading-spinner"></div>
      <div class="bim-loading-text">
        <strong>Extracting IFC Metadata</strong>
        <span>Reading attributes, property sets, and spatial location...</span>
      </div>
    `;
    container.append(loadingState);
    return;
  }

  // If no selection and not loading: show empty state prompt
  if (selection === undefined) {
    const empty = document.createElement("div");
    empty.className = "panel-empty";
    empty.innerHTML = `
      ${BIM_ICONS.inspectPrompt}
      <div>
        <strong style="color: var(--text-secondary); display: block; margin-bottom: 4px; font-weight: 500;">No Element Selected</strong>
        <span>Choose an element above or click visible geometry in the 3D viewport to inspect its full metadata.</span>
      </div>
    `;
    container.append(empty);
    return;
  }

  // Render panel within a wrapper so the loading overlay can cover it seamlessly
  const panelWrapper = document.createElement("div");
  panelWrapper.className = "bim-panel-wrapper";

  // Header with Category Badge & Element Title
  const headerCard = document.createElement("div");
  headerCard.className = "bim-header-card";

  const topRow = document.createElement("div");
  topRow.className = "bim-header-top";

  const categoryBadge = document.createElement("span");
  categoryBadge.className = "bim-category-badge";
  categoryBadge.textContent = selection.category ?? "IfcProduct";
  topRow.append(categoryBadge);

  if (selection.ref.modelLocalId !== undefined) {
    const idBadge = document.createElement("span");
    idBadge.className = "bim-id-badge font-mono";
    idBadge.textContent = `#${String(selection.ref.modelLocalId)}`;
    idBadge.title = `Express ID: ${String(selection.ref.modelLocalId)}`;
    topRow.append(idBadge);
  }

  const titleEl = document.createElement("h2");
  titleEl.className = "bim-element-title";
  titleEl.textContent = selection.title;
  titleEl.title = selection.title;

  headerCard.append(topRow, titleEl);

  // Global GUID Chip if present
  const guid = selection.ref.globalId;
  if (guid !== undefined && guid.length > 0) {
    const guidRow = document.createElement("div");
    guidRow.className = "bim-guid-row";
    guidRow.innerHTML = `
      <span class="bim-guid-label">GUID:</span>
      <span class="bim-guid-val font-mono">${escapeHtml(guid)}</span>
      <button type="button" class="btn-copy-guid" title="Copy IFC GUID">
        ${BIM_ICONS.copy}
      </button>
    `;
    const copyGuidBtn =
      guidRow.querySelector<HTMLButtonElement>(".btn-copy-guid");
    copyGuidBtn?.addEventListener("click", () => {
      void navigator.clipboard.writeText(guid);
      copyGuidBtn.innerHTML = "✓";
      setTimeout(() => {
        copyGuidBtn.innerHTML = BIM_ICONS.copy;
      }, 1500);
    });
    headerCard.append(guidRow);
  }

  panelWrapper.append(headerCard);

  // Coordinates Grid
  const coordinates = document.createElement("div");
  coordinates.className = "coordinate-grid";
  const axes = ["X", "Y", "Z"] as const;
  selection.worldPosition.forEach((value, index) => {
    const axis = axes[index] ?? "X";
    coordinates.append(coordCard(axis, value));
  });
  panelWrapper.append(coordinates);

  // Build / organize groups
  const profile = activeProfile(manifest, selection.ref.modelVersionId);
  const ignored = new Set(profile?.ignoredKeys ?? []);

  let groups: PropertyGroup[] = [];
  if (selection.groups && selection.groups.length > 0) {
    groups = selection.groups
      .map((group) => {
        const filteredEntries = group.entries.filter(
          (e) => !ignored.has(e.key),
        );
        return {
          key: group.key,
          label: group.label,
          entries: filteredEntries,
        };
      })
      .filter((group) => group.entries.length > 0);
  } else {
    const fallbackEntries = selection.properties.filter(
      (e) => !ignored.has(e.key),
    );
    if (fallbackEntries.length > 0) {
      groups = [
        {
          key: "general",
          label: "Element Properties",
          entries: fallbackEntries,
        },
      ];
    }
  }

  const totalPropsCount = groups.reduce((sum, g) => sum + g.entries.length, 0);

  // Search & Toolbar Container
  const toolbar = document.createElement("div");
  toolbar.className = "bim-props-toolbar";

  const searchBox = document.createElement("div");
  searchBox.className = "bim-search-box";
  searchBox.innerHTML = `
    ${BIM_ICONS.search}
    <input type="text" class="bim-search-input" placeholder="Search ${String(totalPropsCount)} metadata & properties..." value="${escapeAttr(currentFilterQuery)}" />
    ${currentFilterQuery.length > 0 ? '<button type="button" class="btn-clear-search">&times;</button>' : ""}
  `;

  const searchInput =
    searchBox.querySelector<HTMLInputElement>(".bim-search-input");
  searchInput?.addEventListener("input", (e) => {
    currentFilterQuery = (e.target as HTMLInputElement).value;
    renderBimPanel(container, state, onSelectElement);
    const nextInput = container.querySelector<HTMLInputElement>(
      ".bim-props-toolbar .bim-search-input",
    );
    nextInput?.focus();
    nextInput?.setSelectionRange(
      currentFilterQuery.length,
      currentFilterQuery.length,
    );
  });

  searchBox
    .querySelector(".btn-clear-search")
    ?.addEventListener("click", () => {
      currentFilterQuery = "";
      renderBimPanel(container, state, onSelectElement);
    });

  const actionsRow = document.createElement("div");
  actionsRow.className = "bim-toolbar-actions";

  const countLabel = document.createElement("span");
  countLabel.className = "bim-props-count";
  countLabel.textContent = `${String(totalPropsCount)} properties in ${String(groups.length)} groups`;

  const btnToggleAll = document.createElement("button");
  btnToggleAll.type = "button";
  btnToggleAll.className = "bim-btn-toggle-all";
  const allCollapsed = groups.every((g) => collapsedGroupKeys.has(g.key));
  btnToggleAll.textContent = allCollapsed ? "Expand All" : "Collapse All";
  btnToggleAll.addEventListener("click", () => {
    if (allCollapsed) {
      collapsedGroupKeys.clear();
    } else {
      groups.forEach((g) => collapsedGroupKeys.add(g.key));
    }
    renderBimPanel(container, state, onSelectElement);
  });

  actionsRow.append(countLabel, btnToggleAll);
  toolbar.append(searchBox, actionsRow);
  panelWrapper.append(toolbar);

  // Filter groups based on search query
  const query = currentFilterQuery.trim().toLowerCase();
  const filteredGroups = groups
    .map((g) => {
      if (query.length === 0) return g;
      const groupMatches = g.label.toLowerCase().includes(query);
      const matchingEntries = g.entries.filter((entry) => {
        if (groupMatches) return true;
        const keyMatch = entry.key.toLowerCase().includes(query);
        const valMatch =
          entry.value !== null &&
          String(entry.value).toLowerCase().includes(query);
        return keyMatch || valMatch;
      });
      return {
        key: g.key,
        label: g.label,
        entries: matchingEntries,
      };
    })
    .filter((g) => g.entries.length > 0);

  if (filteredGroups.length === 0) {
    const noResults = document.createElement("div");
    noResults.className = "bim-no-results";
    noResults.innerHTML = `
      <p>No properties match "<strong>${escapeHtml(currentFilterQuery)}</strong>"</p>
      <button type="button" class="admin-btn admin-btn-secondary small btn-reset-search">Clear Search</button>
    `;
    noResults
      .querySelector(".btn-reset-search")
      ?.addEventListener("click", () => {
        currentFilterQuery = "";
        renderBimPanel(container, state, onSelectElement);
      });
    panelWrapper.append(noResults);
  } else {
    // Render Accordion Groups
    const accordionContainer = document.createElement("div");
    accordionContainer.className = "bim-accordion-container";

    for (const group of filteredGroups) {
      const isCollapsed =
        query.length === 0 && collapsedGroupKeys.has(group.key);

      const groupCard = document.createElement("div");
      groupCard.className = `bim-group-card ${isCollapsed ? "collapsed" : "expanded"}`;
      groupCard.dataset.groupKey = group.key;

      const groupHeader = document.createElement("button");
      groupHeader.type = "button";
      groupHeader.className = "bim-group-header";
      groupHeader.setAttribute("aria-expanded", String(!isCollapsed));
      groupHeader.innerHTML = `
        <div class="bim-group-title-wrapper">
          <span class="bim-group-icon">${getGroupIcon(group.key)}</span>
          <span class="bim-group-title">${escapeHtml(group.label)}</span>
          <span class="bim-group-badge">${String(group.entries.length)}</span>
        </div>
        ${BIM_ICONS.chevronDown}
      `;

      groupHeader.addEventListener("click", () => {
        if (collapsedGroupKeys.has(group.key)) {
          collapsedGroupKeys.delete(group.key);
        } else {
          collapsedGroupKeys.add(group.key);
        }
        renderBimPanel(container, state, onSelectElement);
      });

      const groupBody = document.createElement("div");
      groupBody.className = "bim-group-body";

      const dl = document.createElement("dl");
      dl.className = "property-list";

      for (const property of group.entries) {
        const rowItem = document.createElement("div");
        rowItem.className = "property-card-row";

        const keyEl = document.createElement("dt");
        const label = profile?.aliases[property.key] ?? property.key;
        keyEl.textContent = label;
        keyEl.title = property.key;

        const valObj = formatPropertyValue(property.value);
        const contentEl = document.createElement("dd");
        const copyBtnMarkup =
          valObj.copyableText.length > 0
            ? `<button type="button" class="btn-copy-prop" title="Copy value">${BIM_ICONS.copy}</button>`
            : "";
        const unitMarkup =
          property.unit !== undefined
            ? ` <span class="prop-unit">${escapeHtml(property.unit)}</span>`
            : "";

        contentEl.innerHTML = `
          <div class="prop-val-wrapper">
            <span class="prop-val-text">${valObj.html}${unitMarkup}</span>
            ${copyBtnMarkup}
          </div>
        `;

        if (valObj.copyableText.length > 0) {
          const copyPropBtn =
            contentEl.querySelector<HTMLButtonElement>(".btn-copy-prop");
          copyPropBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            void navigator.clipboard.writeText(valObj.copyableText);
            copyPropBtn.innerHTML = "✓";
            setTimeout(() => {
              copyPropBtn.innerHTML = BIM_ICONS.copy;
            }, 1200);
          });
        }

        rowItem.append(keyEl, contentEl);
        dl.append(rowItem);
      }

      groupBody.append(dl);
      groupCard.append(groupHeader, groupBody);
      accordionContainer.append(groupCard);
    }

    panelWrapper.append(accordionContainer);
  }

  // If loading a new element while an existing one is displayed, show frosted loading overlay
  if (isLoading) {
    const loadingOverlay = document.createElement("div");
    loadingOverlay.className = "bim-loading-overlay";
    loadingOverlay.innerHTML = `
      <div class="bim-loading-spinner"></div>
      <span>Loading element metadata...</span>
    `;
    panelWrapper.append(loadingOverlay);
  }

  container.append(panelWrapper);
}

function activeProfile(
  manifest: SceneManifestV2 | undefined,
  versionId: string,
): SceneManifestV2["bimProfiles"][number] | undefined {
  const profileId = manifest?.layers.find(
    (layer) => layer.bim?.modelVersionId === versionId,
  )?.bim?.propertyProfileId;
  return manifest?.bimProfiles.find((profile) => profile.id === profileId);
}
