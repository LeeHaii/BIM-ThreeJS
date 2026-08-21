import type { AppCoordinator } from "../../app/app-coordinator.js";
import type { AppState } from "../../app/app-state.js";
import type { AppStore } from "../../app/app-store.js";
import { renderBimPanel } from "../bim-inspection/render-bim-panel.js";
import { renderHouseholdPanel } from "../units/render-household-panel.js";
import { ViewerSessionController } from "../viewer-runtime/index.js";

const ICONS = {
  cube: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.12 6.4-8-4.5a2 2 0 0 0-2.24 0l-8 4.5A2 2 0 0 0 2 8.16v7.68a2 2 0 0 0 .88 1.76l8 4.5a2 2 0 0 0 2.24 0l8-4.5A2 2 0 0 0 22 15.84V8.16a2 2 0 0 0-.88-1.76Z"/><path d="m2.5 7.5 9.5 5.5 9.5-5.5"/><path d="M12 13v9"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
  bim: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>`,
  households: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  hand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

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
  if (total === 0) return "Preparing 3D Engine";
  const pct = Math.round((loaded / total) * 100);
  return `${String(pct)}% · ${(loaded / 1_000_000).toFixed(1)} / ${(total / 1_000_000).toFixed(1)} MB`;
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
        <div class="brand-rail" aria-label="BIM Atlas">
          <div class="brand-logo-badge" title="BIM Atlas">${ICONS.cube}</div>
          <span class="brand-rail-text">ATLAS</span>
          <div class="brand-rail-indicator"></div>
        </div>
        <div class="left-panel-body">
          <button class="collapse-button" type="button" aria-label="Collapse panel">${ICONS.chevronLeft}</button>
          <div class="mode-panel-content"></div>
        </div>
      </aside>
      <header class="upper-panel ui-surface">
        <div class="primary-actions">
          <button class="nav-pill-button" type="button" data-action="reset">
            <span class="action-icon">${ICONS.reset}</span>
            <span>Reset view</span>
          </button>
          <button class="nav-pill-button" type="button" data-action="bim">
            <span class="action-icon">${ICONS.bim}</span>
            <span>BIM structure</span>
          </button>
          <button class="nav-pill-button" type="button" data-action="units">
            <span class="action-icon">${ICONS.households}</span>
            <span>Households</span>
          </button>
        </div>
        <div class="viewer-utilities">
          <div class="custom-select-wrapper">
            <select class="modern-select named-view-select" aria-label="Named camera view"></select>
            <span class="select-chevron">${ICONS.chevronDown}</span>
          </div>
          <details class="layer-menu">
            <summary>
              <span class="action-icon">${ICONS.layers}</span>
              <span>Layers</span>
              <span class="select-chevron" style="position: static; margin-left: 2px;">${ICONS.chevronDown}</span>
            </summary>
            <div class="layer-menu-content"></div>
          </details>
          <button class="nav-pill-button touch-mode-button" type="button" hidden>
            <span class="action-icon">${ICONS.hand}</span>
            <span>Touch Mode</span>
          </button>
          <div class="custom-select-wrapper">
            <select class="modern-select building-select" aria-label="Switch building"></select>
            <span class="select-chevron">${ICONS.chevronDown}</span>
          </div>
          <a class="nav-pill-button admin-nav-link" href="/admin" title="Open Admin Console" style="text-decoration: none;">
            <span class="action-icon">${ICONS.settings}</span>
            <span>Admin</span>
          </a>
        </div>
      </header>
      <main class="viewport-area">
        <div class="viewer-canvas-host" aria-label="Three-dimensional building viewport"></div>
        <div class="viewer-progress" role="status">
          <div class="viewer-progress-spinner"></div>
          <span class="viewer-progress-text"></span>
        </div>
        <div class="viewport-hint">
          <span class="hint-badge">Right Drag</span> Orbit
          <span class="hint-badge">Shift + Drag</span> Pan
          <span class="hint-badge">Wheel</span> Zoom
          <span class="hint-badge">Click</span> Inspect
        </div>
        <div class="development-banner">
          <span class="dev-indicator-dot"></span>
          <span>Development Fixture · Real .frag + GLB</span>
        </div>
      </main>
      <div class="error-toast" role="alert" hidden></div>
    </div>`;

  const shell = requiredElement<HTMLElement>(
    root,
    ".operator-shell",
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
  const progressText = requiredElement<HTMLElement>(
    progress,
    ".viewer-progress-text",
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
  bimButton.addEventListener("click", () => {
    const current = store.getState().mode;
    void viewer.setMode(current === "bim" ? "overview" : "bim");
  });
  unitsButton.addEventListener("click", () => {
    const current = store.getState().mode;
    void viewer.setMode(current === "units" ? "overview" : "units");
  });
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
    const popupWidth =
      state.mode === "units"
        ? Math.max(modePanel?.width ?? 720, 720)
        : Math.max(modePanel?.width ?? 420, 420);
    const upperHeight = manifest?.viewerUi.upperPanelHeight ?? 48;
    shell.style.setProperty("--panel-popup-width", `${String(popupWidth)}px`);
    shell.style.setProperty("--upper-height", `${String(upperHeight)}px`);
    shell.dataset.mode = state.mode;
    collapseButton.setAttribute(
      "aria-label",
      localize(
        manifest?.viewerUi.labels.collapse ?? { en: "Collapse panel" },
        locale,
      ),
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
    const namedViewWrapper = namedViewSelect.parentElement;
    if (namedViewWrapper instanceof HTMLElement) {
      namedViewWrapper.hidden =
        (manifest?.settings.namedViews.length ?? 0) === 0;
    }
    layerContent.replaceChildren(
      ...state.viewer.layers.map((layer) => {
        const label = document.createElement("label");
        label.className = "layer-item-label";
        const toggleControl = document.createElement("div");
        toggleControl.className = "layer-toggle-control";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "layer-checkbox";
        input.checked = layer.visible;
        input.disabled = layer.status !== "ready";
        input.addEventListener(
          "change",
          () => void viewer.setLayerVisibility(layer.id, input.checked),
        );
        const nameText = document.createElement("span");
        nameText.textContent = layer.name;
        toggleControl.append(input, nameText);

        const statusBadge = document.createElement("span");
        statusBadge.className = "layer-status-badge";
        statusBadge.dataset.status = layer.status;
        statusBadge.textContent = layer.status;
        label.append(toggleControl, statusBadge);
        return label;
      }),
    );
    touchButton.hidden =
      !touchCapable || manifest?.viewerUi.touchNavigation.enabled !== true;
    setButtonLabel(
      touchButton,
      state.viewer.touchNavigation === "orbit"
        ? "Touch: orbit"
        : "Touch: vertical",
    );

    if (state.mode === "bim") {
      renderBimPanel(panelContent, state);
    } else if (state.mode === "units") {
      renderHouseholdPanel(
        panelContent,
        state,
        (unitId) => void coordinator.selectUnit(unitId),
      );
    }

    progress.hidden = state.viewer.status === "ready";
    progress.dataset.status = state.viewer.status;
    progressText.textContent =
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
