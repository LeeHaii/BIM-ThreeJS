import type { AppCoordinator } from "../app/app-coordinator.js";
import type { AppState } from "../app/app-state.js";
import type { AppStore } from "../app/app-store.js";

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  return node;
}

function requiredElement<T extends Element>(
  root: ParentNode,
  selector: string,
  elementType: { new (): T },
): T {
  const found = root.querySelector(selector);
  if (!(found instanceof elementType))
    throw new Error(`Required UI element is missing: ${selector}`);
  return found;
}

export function renderApp(
  root: HTMLElement,
  store: AppStore,
  coordinator: AppCoordinator,
): () => void {
  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div><span class="eyebrow">Operations platform</span><h1>BIM Atlas</h1></div>
        <div class="status-chip" id="session-status"><span></span> Synthetic session</div>
      </header>
      <aside class="catalog-panel" aria-label="Building catalog">
        <div class="section-heading"><span>Buildings</span><small id="building-count"></small></div>
        <div id="building-list" class="building-list"></div>
      </aside>
      <main class="workspace">
        <section class="viewer-panel" aria-label="BIM viewer readiness">
          <div class="viewer-toolbar">
            <div><span class="eyebrow">Active model</span><h2 id="model-title">Select a building</h2></div>
            <div class="mode-tabs" id="mode-tabs"></div>
          </div>
          <div class="model-stage" id="model-stage"></div>
        </section>
        <aside class="operations-panel">
          <label class="search-label" for="unit-search">Managed spaces</label>
          <input id="unit-search" type="search" placeholder="Search code or name" autocomplete="off" />
          <div id="unit-list" class="unit-list"></div>
          <section id="occupancy-panel" class="occupancy-panel" aria-live="polite"></section>
        </aside>
      </main>
      <div class="error-banner" id="error-banner" role="alert" hidden></div>
    </div>`;

  const buildingList = requiredElement(root, "#building-list", HTMLElement);
  const buildingCount = requiredElement(root, "#building-count", HTMLElement);
  const modelTitle = requiredElement(root, "#model-title", HTMLElement);
  const modelStage = requiredElement(root, "#model-stage", HTMLElement);
  const modeTabs = requiredElement(root, "#mode-tabs", HTMLElement);
  const unitSearch = requiredElement(root, "#unit-search", HTMLInputElement);
  const unitList = requiredElement(root, "#unit-list", HTMLElement);
  const occupancyPanel = requiredElement(root, "#occupancy-panel", HTMLElement);
  const errorBanner = requiredElement(root, "#error-banner", HTMLElement);
  let searchTimer: number | undefined;

  unitSearch.addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(
      () => void coordinator.searchUnits(unitSearch.value),
      250,
    );
  });

  const update = (state: AppState): void => {
    buildingCount.textContent = `${String(state.catalog.buildings.length)} available`;
    buildingList.replaceChildren(
      ...state.catalog.buildings.map((building) => {
        const button = element("button", "building-card");
        button.type = "button";
        button.dataset.active = String(
          building.id === state.building.selectedId,
        );
        const code = element("span", "building-code");
        code.textContent = building.code;
        const name = element("strong");
        name.textContent = building.name;
        const locale = element("small");
        locale.textContent = `${building.locale} · ${building.timezone}`;
        button.append(code, name, locale);
        button.addEventListener(
          "click",
          () => void coordinator.openBuilding(building.id),
        );
        return button;
      }),
    );

    const manifest = state.model.manifest;
    modelTitle.textContent =
      manifest === undefined
        ? "Loading building session…"
        : `${manifest.label} · ${String(manifest.fragmentLayers.length)} layer${manifest.fragmentLayers.length === 1 ? "" : "s"}`;
    modeTabs.replaceChildren(
      ...(["overview", "bim", "units"] as const).map((mode) => {
        const button = element("button", "mode-button");
        button.type = "button";
        button.textContent = mode;
        button.dataset.active = String(state.mode === mode);
        button.addEventListener("click", () =>
          store.dispatch({ type: "ENTER_MODE", mode }),
        );
        return button;
      }),
    );

    if (manifest === undefined) {
      const loading = element("div", "loading-state");
      loading.textContent =
        state.model.status === "error"
          ? "Model session unavailable"
          : "Validating manifest and configuration…";
      modelStage.replaceChildren(loading);
    } else {
      const visual = element("div", "readiness-visual");
      const grid = element("div", "building-glyph");
      grid.setAttribute("aria-hidden", "true");
      const copy = element("div", "readiness-copy");
      const ready = element("span", "ready-badge");
      ready.textContent = "Manifest validated";
      const heading = element("h3");
      heading.textContent = state.building.detail?.name ?? manifest.label;
      const description = element("p");
      description.textContent = `Ready for ${manifest.fragmentLayers.map((layer) => layer.name).join(", ")}. The matching Fragments worker and fixture are the next viewer milestone.`;
      const metrics = element("div", "metrics");
      const metricEntries: ReadonlyArray<readonly [string, string]> = [
        [String(manifest.fragmentLayers.length), "Layers"],
        [String(manifest.namedViews.length), "Named views"],
        [String(manifest.capabilities.length), "Capabilities"],
      ];
      for (const [value, label] of metricEntries) {
        const metric = element("div");
        const strong = element("strong");
        strong.textContent = value;
        const small = element("small");
        small.textContent = label;
        metric.append(strong, small);
        metrics.append(metric);
      }
      copy.append(ready, heading, description, metrics);
      visual.append(grid, copy);
      modelStage.replaceChildren(visual);
    }

    unitSearch.disabled = state.building.status !== "ready";
    unitList.replaceChildren(
      ...state.units.items.map((unit) => {
        const button = element("button", "unit-card");
        button.type = "button";
        button.dataset.active = String(unit.id === state.units.selectedId);
        const text = element("span");
        const name = element("strong");
        name.textContent = unit.displayName;
        const detail = element("small");
        detail.textContent = `${unit.code} · ${unit.storeyCode}`;
        text.append(name, detail);
        const type = element("span", "unit-type");
        type.textContent = unit.unitType;
        button.append(text, type);
        button.addEventListener(
          "click",
          () => void coordinator.selectUnit(unit.id),
        );
        return button;
      }),
    );

    if (state.units.status === "ready" && state.units.items.length === 0) {
      const empty = element("p", "empty-state");
      empty.textContent = "No managed spaces match this search.";
      unitList.replaceChildren(empty);
    }

    const selectedUnit = state.units.items.find(
      (unit) => unit.id === state.units.selectedId,
    );
    if (selectedUnit === undefined) {
      occupancyPanel.replaceChildren();
    } else {
      const heading = element("h3");
      heading.textContent = `Occupancy · ${selectedUnit.code}`;
      const content = element("div");
      if (state.occupancies.status === "loading") {
        content.textContent = "Loading authorized fields…";
      } else if (state.occupancies.items.length === 0) {
        content.textContent = "No current occupancy records.";
      } else {
        for (const occupancy of state.occupancies.items) {
          const card = element("article", "occupancy-card");
          const name = element("strong");
          name.textContent = occupancy.displayName ?? "Identity restricted";
          const relationship = element("span");
          relationship.textContent = occupancy.relationshipType;
          card.append(name, relationship);
          if (occupancy.email !== undefined) {
            const email = element("small");
            email.textContent = occupancy.email;
            card.append(email);
          }
          content.append(card);
        }
      }
      occupancyPanel.replaceChildren(heading, content);
    }

    errorBanner.hidden = state.error === undefined;
    errorBanner.textContent = state.error ?? "";
  };

  const unsubscribe = store.subscribe(update);
  update(store.getState());
  return () => {
    window.clearTimeout(searchTimer);
    unsubscribe();
    root.replaceChildren();
  };
}
