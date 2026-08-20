import type { AppCoordinator } from "../../app/app-coordinator.js";
import type { AppState } from "../../app/app-state.js";
import type { AppStore } from "../../app/app-store.js";
import { renderBimPanel } from "../bim-inspection/render-bim-panel.js";
import { renderHouseholdPanel } from "../units/render-household-panel.js";
import { ViewerSessionController } from "../viewer-runtime/index.js";

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

function localize(
  text: Readonly<Record<string, string>>,
  locale: string,
): string {
  const language = locale.split("-")[0] ?? "en";
  return text[language] ?? text.en ?? Object.values(text)[0] ?? "";
}

function formatBytes(loaded: number, total: number): string {
  if (total === 0) return "Preparing viewer";
  return `${String(Math.round((loaded / total) * 100))}% · ${(loaded / 1_000_000).toFixed(1)} / ${(total / 1_000_000).toFixed(1)} MB`;
}

function setButtonLabel(button: HTMLButtonElement, label: string): void {
  const text = button.querySelector("span:last-child");
  if (text instanceof HTMLSpanElement) text.textContent = label;
}

export function renderOperatorShell(
  root: HTMLElement,
  store: AppStore,
  coordinator: AppCoordinator,
): () => Promise<void> {
  root.innerHTML = `
    <div class="operator-shell" data-mode="overview">
      <aside class="left-panel ui-surface" aria-label="Mode panel">
        <div class="brand-rail" aria-label="BIM Atlas"><span>B</span><small>ATLAS</small></div>
        <div class="left-panel-body">
          <button class="collapse-button" type="button" aria-label="Collapse panel">‹</button>
          <div class="mode-panel-content"></div>
        </div>
      </aside>
      <header class="upper-panel ui-surface">
        <div class="primary-actions">
          <button type="button" data-action="reset"><span class="action-icon">⌂</span><span>Reset view</span></button>
          <button type="button" data-action="bim"><span class="action-icon">▦</span><span>BIM structure</span></button>
          <button type="button" data-action="units"><span class="action-icon">⌘</span><span>Households</span></button>
        </div>
        <div class="viewer-utilities">
          <select class="named-view-select" aria-label="Named camera view"></select>
          <details class="layer-menu"><summary>Layers</summary><div class="layer-menu-content"></div></details>
          <button class="touch-mode-button" type="button" hidden></button>
          <select class="building-select" aria-label="Switch building"></select>
        </div>
      </header>
      <main class="viewport-area">
        <div class="viewer-canvas-host" aria-label="Three-dimensional building viewport"></div>
        <div class="viewer-progress" role="status"></div>
        <div class="viewport-hint">Right drag orbit · Shift + right drag vertical · Wheel zoom · Left click inspect</div>
        <div class="development-banner">Development fixture · real .frag + GLB · synthetic operations data</div>
      </main>
      <div class="error-toast" role="alert" hidden></div>
    </div>`;

  const shell = requiredElement<HTMLElement>(
    root,
    ".operator-shell",
    HTMLElement,
  );
  const leftBody = requiredElement<HTMLElement>(
    root,
    ".left-panel-body",
    HTMLElement,
  );
  const panelContent = requiredElement<HTMLElement>(
    root,
    ".mode-panel-content",
    HTMLElement,
  );
  const collapseButton = requiredElement<HTMLButtonElement>(
    root,
    ".collapse-button",
    HTMLButtonElement,
  );
  const canvasHost = requiredElement<HTMLElement>(
    root,
    ".viewer-canvas-host",
    HTMLElement,
  );
  const progress = requiredElement<HTMLElement>(
    root,
    ".viewer-progress",
    HTMLElement,
  );
  const errorToast = requiredElement<HTMLElement>(
    root,
    ".error-toast",
    HTMLElement,
  );
  const buildingSelect = requiredElement<HTMLSelectElement>(
    root,
    ".building-select",
    HTMLSelectElement,
  );
  const namedViewSelect = requiredElement<HTMLSelectElement>(
    root,
    ".named-view-select",
    HTMLSelectElement,
  );
  const layerContent = requiredElement<HTMLElement>(
    root,
    ".layer-menu-content",
    HTMLElement,
  );
  const touchButton = requiredElement<HTMLButtonElement>(
    root,
    ".touch-mode-button",
    HTMLButtonElement,
  );
  const resetButton = requiredElement<HTMLButtonElement>(
    root,
    '[data-action="reset"]',
    HTMLButtonElement,
  );
  const bimButton = requiredElement<HTMLButtonElement>(
    root,
    '[data-action="bim"]',
    HTMLButtonElement,
  );
  const unitsButton = requiredElement<HTMLButtonElement>(
    root,
    '[data-action="units"]',
    HTMLButtonElement,
  );
  const viewer = new ViewerSessionController(store, canvasHost);
  viewer.start();
  const touchCapable =
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;
  let pointerStart: { readonly x: number; readonly y: number } | undefined;

  for (const surface of root.querySelectorAll(".ui-surface")) {
    surface.addEventListener("pointerdown", (event) => event.stopPropagation());
  }
  canvasHost.addEventListener("pointerdown", (event) => {
    if (event.button === 0)
      pointerStart = { x: event.clientX, y: event.clientY };
  });
  canvasHost.addEventListener("pointerup", (event) => {
    if (event.button !== 0 || pointerStart === undefined) return;
    const distance = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y,
    );
    pointerStart = undefined;
    if (distance <= 4) void viewer.selectAt(event.clientX, event.clientY);
  });
  resetButton.addEventListener("click", () => void viewer.resetCamera());
  bimButton.addEventListener("click", () => void viewer.setMode("bim"));
  unitsButton.addEventListener("click", () => void viewer.setMode("units"));
  collapseButton.addEventListener(
    "click",
    () => void viewer.setMode("overview"),
  );
  touchButton.addEventListener("click", () => {
    const next =
      store.getState().viewer.touchNavigation === "orbit"
        ? "vertical"
        : "orbit";
    viewer.setTouchNavigation(next);
  });
  buildingSelect.addEventListener("change", () => {
    const building = store
      .getState()
      .catalog.buildings.find((item) => item.id === buildingSelect.value);
    if (building === undefined) return;
    history.pushState({}, "", `/viewer/${building.id}`);
    void coordinator.openBuilding(building.id);
  });
  namedViewSelect.addEventListener("change", () => {
    const view = store
      .getState()
      .model.manifest?.settings.namedViews.find(
        (item) => item.id === namedViewSelect.value,
      );
    if (view !== undefined) void viewer.setCamera(view.camera);
  });

  const update = (state: AppState): void => {
    const manifest = state.model.manifest;
    const locale = state.building.detail?.locale ?? "en";
    const modePanel = manifest?.viewerUi.modePanels.find(
      (panel) => panel.mode === state.mode,
    );
    const leftWidth =
      state.mode === "overview"
        ? (manifest?.viewerUi.collapsedLeftWidth ?? 35)
        : (modePanel?.width ?? 280);
    const upperHeight = manifest?.viewerUi.upperPanelHeight ?? 34;
    shell.style.setProperty("--left-width", `${String(leftWidth)}px`);
    shell.style.setProperty("--upper-height", `${String(upperHeight)}px`);
    shell.dataset.mode = state.mode;
    leftBody.hidden = state.mode === "overview";
    collapseButton.textContent = localize(
      manifest?.viewerUi.labels.collapse ?? { en: "Collapse" },
      locale,
    );
    resetButton.dataset.active = "false";
    bimButton.dataset.active = String(state.mode === "bim");
    unitsButton.dataset.active = String(state.mode === "units");
    if (manifest !== undefined) {
      const reset = manifest.viewerUi.upperToolbar.find(
        (action) => action.id === "reset",
      );
      const bim = manifest.viewerUi.upperToolbar.find(
        (action) => action.id === "bim",
      );
      const units = manifest.viewerUi.upperToolbar.find(
        (action) => action.id === "households",
      );
      setButtonLabel(
        resetButton,
        localize(reset?.label ?? { en: "Reset view" }, locale),
      );
      setButtonLabel(
        bimButton,
        localize(bim?.label ?? { en: "BIM structure" }, locale),
      );
      setButtonLabel(
        unitsButton,
        localize(units?.label ?? { en: "Households" }, locale),
      );
    }

    buildingSelect.replaceChildren(
      ...state.catalog.buildings.map((building) => {
        const option = document.createElement("option");
        option.value = building.id;
        option.textContent = building.name;
        option.selected = building.id === state.building.selectedId;
        return option;
      }),
    );
    namedViewSelect.replaceChildren(
      ...(manifest?.settings.namedViews ?? []).map((view) => {
        const option = document.createElement("option");
        option.value = view.id;
        option.textContent = view.label;
        return option;
      }),
    );
    namedViewSelect.hidden = (manifest?.settings.namedViews.length ?? 0) === 0;
    layerContent.replaceChildren(
      ...state.viewer.layers.map((layer) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = layer.visible;
        input.disabled = layer.status !== "ready";
        input.addEventListener(
          "change",
          () => void viewer.setLayerVisibility(layer.id, input.checked),
        );
        const text = document.createElement("span");
        text.textContent = `${layer.name} · ${layer.status}`;
        label.append(input, text);
        return label;
      }),
    );
    touchButton.hidden =
      !touchCapable || manifest?.viewerUi.touchNavigation.enabled !== true;
    touchButton.textContent =
      state.viewer.touchNavigation === "orbit"
        ? "Touch: orbit"
        : "Touch: vertical";

    if (state.mode === "bim") {
      renderBimPanel(panelContent, state);
    } else if (state.mode === "units") {
      renderHouseholdPanel(
        panelContent,
        state,
        (unitId) => void coordinator.selectUnit(unitId),
      );
    } else {
      panelContent.replaceChildren();
    }

    progress.hidden = state.viewer.status === "ready";
    progress.dataset.status = state.viewer.status;
    progress.textContent =
      state.viewer.status === "error"
        ? "Viewer asset unavailable"
        : formatBytes(state.viewer.loadedBytes, state.viewer.totalBytes);
    errorToast.hidden = state.error === undefined;
    errorToast.textContent = state.error ?? "";
    requestAnimationFrame(() => viewer.resize());
  };

  const unsubscribe = store.subscribe(update);
  update(store.getState());
  return async () => {
    unsubscribe();
    await viewer.dispose();
    root.replaceChildren();
  };
}
