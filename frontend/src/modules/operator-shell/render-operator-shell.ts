import type { AppCoordinator } from "../../app/app-coordinator.js";
import type { AppState } from "../../app/app-state.js";
import type { AppStore } from "../../app/app-store.js";
import { renderBimPanel } from "../bim-inspection/render-bim-panel.js";
import { createHouseholdEditor } from "../household-management/household-editor.js";
import { renderHouseholdPanel } from "../units/render-household-panel.js";
import { ViewerSessionController } from "../viewer-runtime/index.js";

// ============================================================================
// DEBUG TOOL: Set to false (or comment out) to easily disable debug tools
// ============================================================================
export const ENABLE_DEBUG_TOOLS: boolean = import.meta.env.DEV;

const ICONS = {
  cube: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.12 6.4-8-4.5a2 2 0 0 0-2.24 0l-8 4.5A2 2 0 0 0 2 8.16v7.68a2 2 0 0 0 .88 1.76l8 4.5a2 2 0 0 0 2.24 0l8-4.5A2 2 0 0 0 22 15.84V8.16a2 2 0 0 0-.88-1.76Z"/><path d="m2.5 7.5 9.5 5.5 9.5-5.5"/><path d="M12 13v9"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`,
  bim: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/><path d="M15 3v18"/></svg>`,
  households: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  layers: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
  chevronLeft: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`,
  hand: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
  terminal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`,
  copy: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  download: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
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
          <span class="brand-rail-text">TP-BIM</span>
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
          <div class="custom-select-wrapper named-view-wrapper">
            <span class="select-leading-icon">${ICONS.camera}</span>
            <select class="modern-select named-view-select" aria-label="Named camera view"></select>
            <span class="select-chevron">${ICONS.chevronDown}</span>
          </div>
          <details class="layer-menu">
            <summary class="layer-menu-summary">
              <span class="action-icon">${ICONS.layers}</span>
              <span>Layers</span>
              <span class="select-chevron">${ICONS.chevronDown}</span>
            </summary>
            <div class="layer-menu-content"></div>
          </details>
          <button class="nav-pill-button touch-mode-button" type="button" hidden>
            <span class="action-icon">${ICONS.hand}</span>
            <span>Touch Mode</span>
          </button>
          <div class="custom-select-wrapper building-select-wrapper">
            <span class="select-leading-icon">${ICONS.building}</span>
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
        <div class="env-opacity-control ui-surface" aria-label="Environment opacity" hidden>
          <div class="env-opacity-header">
            <span class="env-opacity-icon">${ICONS.layers}</span>
            <span class="env-opacity-label">Environment Opacity</span>
            <span class="env-opacity-badge font-mono">10%</span>
          </div>
          <div class="env-opacity-slider-row">
            <input type="range" class="env-opacity-slider" min="0" max="100" value="10" step="1" aria-label="Environment Model Opacity" />
          </div>
        </div>
        <div class="development-banner">
          <span class="dev-indicator-dot"></span>
          <span>Development Fixture · Real .frag + GLB</span>
        </div>
        ${
          ENABLE_DEBUG_TOOLS
            ? `
        <button class="debug-seed-btn" type="button" title="Open seed debug tools" aria-label="Open seed debug tools" aria-controls="debug-seed-panel" aria-expanded="false">
          <span class="action-icon" aria-hidden="true">${ICONS.terminal}</span>
        </button>
        <div id="debug-seed-panel" class="debug-seed-panel ui-surface" role="dialog" aria-labelledby="debug-seed-title" hidden>
          <div class="debug-seed-header">
            <div class="debug-seed-title-row">
              <span class="debug-seed-icon">${ICONS.terminal}</span>
              <h3 id="debug-seed-title" class="debug-seed-title">IFC Apartment Seed Extractor</h3>
              <span class="debug-badge">DEBUG</span>
            </div>
            <button class="debug-close-btn" type="button" aria-label="Close debug panel">&times;</button>
          </div>
          <div class="debug-seed-body">
            <p class="debug-seed-desc">
              Scans all IFC elements in current models containing <code>Apartment</code> metadata, extracts <code>Area</code> &amp; <code>LivingFloor</code>, groups by floor, and outputs downloadable JSON seeds.
            </p>
            <div class="debug-seed-actions">
              <button class="admin-btn admin-btn-primary debug-run-btn" type="button">
                <span>⚡ Scan &amp; Export Seeds (.json)</span>
              </button>
            </div>
            <div class="debug-status-row" hidden>
              <div class="debug-spinner" hidden></div>
              <span class="debug-status-text">Ready</span>
            </div>
            <div class="debug-result-container" hidden>
              <div class="debug-result-header">
                <span class="debug-result-count">0 items found</span>
                <div class="debug-result-buttons">
                  <button type="button" class="admin-btn admin-btn-secondary small debug-copy-btn">
                    ${ICONS.copy}
                    <span>Copy JSON</span>
                  </button>
                  <button type="button" class="admin-btn admin-btn-secondary small debug-save-btn">
                    ${ICONS.download}
                    <span>Save .json</span>
                  </button>
                </div>
              </div>
              <pre class="debug-json-preview font-mono"></pre>
            </div>
          </div>
        </div>`
            : ""
        }
      </main>
      <div class="household-editor-host"></div>
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
  const householdEditorHost = requiredElement<HTMLElement>(
    root,
    ".household-editor-host",
    HTMLElement,
  );
  const householdEditor = createHouseholdEditor(
    householdEditorHost,
    coordinator,
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
  const envOpacityControl = requiredElement<HTMLElement>(
    root,
    ".env-opacity-control",
    HTMLElement,
  );
  const envOpacitySlider = requiredElement<HTMLInputElement>(
    root,
    ".env-opacity-slider",
    HTMLInputElement,
  );
  const envOpacityBadge = requiredElement<HTMLElement>(
    root,
    ".env-opacity-badge",
    HTMLElement,
  );
  const viewer = new ViewerSessionController(store, canvasHost);
  viewer.start();
  const touchCapable =
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;
  let pointerStart: { readonly x: number; readonly y: number } | undefined;
  let hoverRaf: number | undefined;
  let lastHoverPos: { x: number; y: number } | undefined;
  let lastViewerLayoutKey = "";

  for (const surface of root.querySelectorAll(".ui-surface")) {
    surface.addEventListener("pointerdown", (event) => event.stopPropagation());
  }
  canvasHost.addEventListener("pointerdown", (event) => {
    if (event.button === 0)
      pointerStart = { x: event.clientX, y: event.clientY };
  });
  canvasHost.addEventListener("pointermove", (event) => {
    if (event.buttons !== 0 || pointerStart !== undefined) return;
    const state = store.getState();
    if (state.mode !== "bim" && state.mode !== "units") return;
    lastHoverPos = { x: event.clientX, y: event.clientY };
    if (hoverRaf === undefined) {
      hoverRaf = requestAnimationFrame(() => {
        hoverRaf = undefined;
        if (lastHoverPos !== undefined) {
          void viewer.hoverAt(lastHoverPos.x, lastHoverPos.y);
        }
      });
    }
  });
  canvasHost.addEventListener("pointerleave", () => {
    lastHoverPos = undefined;
    if (hoverRaf !== undefined) {
      cancelAnimationFrame(hoverRaf);
      hoverRaf = undefined;
    }
    void viewer.clearHover();
  });
  canvasHost.addEventListener("pointerup", (event) => {
    if (event.button !== 0 || pointerStart === undefined) return;
    const distance = Math.hypot(
      event.clientX - pointerStart.x,
      event.clientY - pointerStart.y,
    );
    pointerStart = undefined;
    if (distance <= 4) {
      void viewer.selectAt(event.clientX, event.clientY).then((unitId) => {
        if (unitId !== undefined) void coordinator.selectUnit(unitId);
      });
    }
  });
  envOpacitySlider.addEventListener("input", () => {
    const pct = Number(envOpacitySlider.value);
    envOpacityBadge.textContent = `${String(pct)}%`;
    viewer.setEnvironmentOpacity(pct / 100);
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

  if (ENABLE_DEBUG_TOOLS) {
    const debugBtn = root.querySelector<HTMLButtonElement>(".debug-seed-btn");
    const debugPanel = root.querySelector<HTMLElement>(".debug-seed-panel");
    const debugCloseBtn =
      root.querySelector<HTMLButtonElement>(".debug-close-btn");
    const debugRunBtn = root.querySelector<HTMLButtonElement>(".debug-run-btn");
    const debugStatusRow = root.querySelector<HTMLElement>(".debug-status-row");
    const debugStatusText =
      root.querySelector<HTMLElement>(".debug-status-text");
    const debugSpinner = root.querySelector<HTMLElement>(".debug-spinner");
    const debugResultContainer = root.querySelector<HTMLElement>(
      ".debug-result-container",
    );
    const debugResultCount = root.querySelector<HTMLElement>(
      ".debug-result-count",
    );
    const debugPreview = root.querySelector<HTMLElement>(".debug-json-preview");
    const debugCopyBtn =
      root.querySelector<HTMLButtonElement>(".debug-copy-btn");
    const debugSaveBtn =
      root.querySelector<HTMLButtonElement>(".debug-save-btn");

    let lastGeneratedJson = "";

    const triggerDownload = (jsonString: string, filename: string) => {
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    };

    debugBtn?.addEventListener("click", () => {
      if (debugPanel) {
        debugPanel.hidden = !debugPanel.hidden;
        debugBtn.setAttribute("aria-expanded", String(!debugPanel.hidden));
      }
    });

    debugCloseBtn?.addEventListener("click", () => {
      if (debugPanel) {
        debugPanel.hidden = true;
        debugBtn?.setAttribute("aria-expanded", "false");
        debugBtn?.focus();
      }
    });

    debugRunBtn?.addEventListener("click", () => void (async () => {
      if (debugRunBtn.disabled) return;
      debugRunBtn.disabled = true;
      if (debugStatusRow) debugStatusRow.hidden = false;
      if (debugSpinner) debugSpinner.hidden = false;
      if (debugStatusText) {
        debugStatusText.textContent = "Scanning IFC model elements...";
      }

      try {
        const result = await viewer.extractApartmentSeeds(
          (processed, total) => {
            if (debugStatusText) {
              debugStatusText.textContent =
                total > 0
                  ? `Processing elements: ${String(processed)} / ${String(total)} (${String(Math.round((processed / total) * 100))}%)`
                  : `Processing elements: ${String(processed)}...`;
            }
          },
        );

        // 1. Log to console as requested
        console.log("=== EXTRACTED IFC APARTMENT SEEDS ===", result);

        const totalFloors = Object.keys(result).length;
        const totalUnits = Object.values(result).reduce(
          (sum, arr) => sum + arr.length,
          0,
        );

        lastGeneratedJson = JSON.stringify(result, null, 2);

        // 2. Save / download JSON file automatically
        const state = store.getState();
        const bldgId = state.building.selectedId ?? "model";
        triggerDownload(lastGeneratedJson, `apartment-seeds-${bldgId}.json`);

        // 3. Display in UI panel
        if (debugSpinner) debugSpinner.hidden = true;
        if (debugStatusText) {
          debugStatusText.textContent = `Done! Extracted ${String(totalUnits)} apartments across ${String(totalFloors)} floors. (Logged to console & saved JSON)`;
        }
        if (debugResultCount) {
          debugResultCount.textContent = `${String(totalUnits)} apartments · ${String(totalFloors)} floors`;
        }
        if (debugPreview) {
          debugPreview.textContent = lastGeneratedJson;
        }
        if (debugResultContainer) {
          debugResultContainer.hidden = false;
        }
      } catch (err) {
        console.error("Error extracting apartment seeds:", err);
        if (debugSpinner) debugSpinner.hidden = true;
        if (debugStatusText) {
          debugStatusText.textContent = `Extraction failed: ${err instanceof Error ? err.message : String(err)}`;
        }
      } finally {
        debugRunBtn.disabled = false;
      }
    })());

    debugCopyBtn?.addEventListener("click", () => {
      if (lastGeneratedJson.length === 0) return;
      void navigator.clipboard.writeText(lastGeneratedJson);
      const span = debugCopyBtn.querySelector("span");
      if (span) {
        const orig = span.textContent;
        span.textContent = "Copied!";
        setTimeout(() => {
          span.textContent = orig;
        }, 1500);
      }
    });

    debugSaveBtn?.addEventListener("click", () => {
      if (lastGeneratedJson.length === 0) return;
      const state = store.getState();
      const bldgId = state.building.selectedId ?? "model";
      triggerDownload(lastGeneratedJson, `apartment-seeds-${bldgId}.json`);
    });
  }

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

    const isBimMode = state.mode === "bim";
    envOpacityControl.hidden = !isBimMode;
    if (isBimMode) {
      const pct = Math.round(state.environmentOpacity * 100);
      envOpacitySlider.value = String(pct);
      envOpacityBadge.textContent = `${String(pct)}%`;
    }

    if (state.mode === "bim") {
      renderBimPanel(panelContent, state);
    } else if (state.mode === "units") {
      renderHouseholdPanel(
        panelContent,
        state,
        (storey) => void viewer.showStorey(storey, state.units.clipRatio),
        (unitId) => {
          void viewer.selectUnitVisual(unitId);
          void coordinator.selectUnit(unitId);
        },
        (ratio) => void viewer.setUnitCutRatio(ratio),
        {
          canManage:
            state.building.detail?.permissions?.manageUnits === true &&
            state.building.detail.permissions.manageOccupancies,
          openEditor: (unit, trigger) => householdEditor.open(unit, trigger),
        },
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
    const viewerLayoutKey = `${state.mode}:${String(popupWidth)}:${String(upperHeight)}`;
    if (viewerLayoutKey !== lastViewerLayoutKey) {
      lastViewerLayoutKey = viewerLayoutKey;
      requestAnimationFrame(() => viewer.resize());
    }
  };

  const unsubscribe = store.subscribe(update);
  update(store.getState());
  return async () => {
    unsubscribe();
    householdEditor.dispose();
    await viewer.dispose();
    root.replaceChildren();
  };
}
