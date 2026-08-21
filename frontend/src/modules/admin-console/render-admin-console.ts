import type {
  AdminOccupancy,
  BuildingDetail,
  BuildingId,
  BuildingSummary,
  CreateBuildingInput,
  CreateOccupancyInput,
  CreateUnitInput,
  SceneManifestV2,
  UnitSummary,
  UpdateOccupancyInput,
  UpdateUnitInput,
} from "@bim/shared";
import type { ApiClient } from "../../infrastructure/api/api-client.js";

function escapeHtml(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return "";
  const str = String(text);
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = bytes / Math.pow(k, i);
  return `${val.toFixed(2)} ${sizes[i] ?? "Bytes"}`;
}

function getFormString(
  formData: FormData,
  name: string,
  defaultValue = "",
): string {
  const val = formData.get(name);
  return typeof val === "string" ? val.trim() : defaultValue;
}

export function renderAdminConsole(
  root: HTMLElement,
  api: ApiClient,
  initialBuildingId?: BuildingId,
): () => void {
  let buildings: readonly BuildingSummary[] = [];
  let currentBuildingId: BuildingId | undefined = initialBuildingId;
  let currentBuilding: BuildingDetail | null = null;
  let activeTab: "models" | "households" | "settings" = "models";
  let units: readonly UnitSummary[] = [];
  let unitSearchQuery = "";
  let activeSceneManifest: SceneManifestV2 | null = null;

  // Selected unit for resident modal
  let selectedUnitForResidents: UnitSummary | null = null;
  let currentAdminOccupancies: readonly AdminOccupancy[] = [];

  // Modals state
  let isNewProjectModalOpen = false;
  let isDeleteProjectModalOpen = false;
  let editingUnit: UnitSummary | null = null;
  let isSpaceModalOpen = false;
  let unitToDelete: UnitSummary | null = null;
  let editingOccupancy: AdminOccupancy | null = null;
  let isAddResidentFormOpen = false;

  let toastTimeout: number | undefined;

  function showToast(
    message: string,
    type: "success" | "error" = "success",
  ): void {
    const toastEl = root.querySelector<HTMLElement>(".admin-toast");
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = `admin-toast ${type} active`;
    if (toastTimeout) window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => {
      toastEl.className = "admin-toast";
    }, 4000);
  }

  async function loadInitialData(): Promise<void> {
    try {
      const page = await api.listBuildings();
      buildings = page.items;
      if (buildings.length === 0) {
        currentBuildingId = undefined;
        currentBuilding = null;
        activeSceneManifest = null;
        units = [];
        window.history.replaceState(null, "", "/admin");
        render();
        return;
      }

      const exists = buildings.some((b) => b.id === currentBuildingId);
      if (!exists) {
        currentBuildingId = buildings[0]?.id;
      }

      if (currentBuildingId) {
        await selectBuilding(currentBuildingId);
      } else {
        render();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load buildings";
      showToast(msg, "error");
      render();
    }
  }

  async function selectBuilding(id: BuildingId): Promise<void> {
    currentBuildingId = id;
    window.history.replaceState(null, "", `/admin/${id}`);
    try {
      const [detail, manifestResult, unitsResult] = await Promise.allSettled([
        api.getBuilding(id),
        api.getActiveSceneManifest(id),
        api.searchUnits(id, unitSearchQuery),
      ]);

      currentBuilding = detail.status === "fulfilled" ? detail.value : null;
      activeSceneManifest =
        manifestResult.status === "fulfilled" ? manifestResult.value : null;
      units = unitsResult.status === "fulfilled" ? unitsResult.value.items : [];

      render();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load project details";
      showToast(msg, "error");
      render();
    }
  }

  async function refreshUnits(): Promise<void> {
    if (!currentBuildingId) return;
    try {
      const page = await api.searchUnits(currentBuildingId, unitSearchQuery);
      units = page.items;
      renderUnitsTable();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to refresh units";
      showToast(msg, "error");
    }
  }

  async function openResidentModal(unit: UnitSummary): Promise<void> {
    selectedUnitForResidents = unit;
    editingOccupancy = null;
    isAddResidentFormOpen = false;
    try {
      if (currentBuildingId) {
        const occs = await api.getAdminOccupancies(currentBuildingId, unit.id);
        currentAdminOccupancies = [...occs];
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to load residents";
      showToast(msg, "error");
      currentAdminOccupancies = [];
    }
    renderResidentModal();
  }

  function render(): void {
    const selectedIdStr = currentBuildingId ? String(currentBuildingId) : "";
    root.innerHTML = `
      <div class="admin-workspace">
        <header class="admin-header">
          <div class="admin-header-brand">
            <div class="admin-logo-mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
            <div class="admin-brand-info">
              <span class="admin-brand-title">BIM Operations</span>
              <span class="admin-brand-badge">Admin Console</span>
            </div>
          </div>

          <div class="admin-header-center">
            <div class="admin-project-selector-wrapper">
              <label for="admin-building-select" class="admin-label-sr">Project:</label>
              <select id="admin-building-select" class="admin-select admin-project-select">
                ${buildings.length === 0 ? '<option value="">No projects available</option>' : ""}
                ${buildings
                  .map(
                    (b) =>
                      `<option value="${escapeHtml(b.id)}" ${b.id === currentBuildingId ? "selected" : ""}>
                        ${escapeHtml(b.name)} (${escapeHtml(b.code)})
                      </option>`,
                  )
                  .join("")}
              </select>
            </div>
            <button type="button" class="admin-btn admin-btn-secondary btn-new-project" title="Create a new project">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>New Project</span>
            </button>
            ${
              currentBuildingId
                ? `<button type="button" class="admin-btn admin-btn-ghost btn-delete-project" title="Delete current project" style="color: var(--accent-danger);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>`
                : ""
            }
          </div>

          <div class="admin-header-actions">
            ${
              currentBuildingId
                ? `<a href="/viewer/${selectedIdStr}" class="admin-btn admin-btn-primary admin-btn-viewer-link" target="_blank" rel="noopener noreferrer">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                    <span>Launch 3D Viewer</span>
                  </a>`
                : ""
            }
          </div>
        </header>

        <main class="admin-main">
          ${
            !currentBuildingId
              ? `
            <div class="admin-empty-state">
              <div class="admin-empty-icon">📁</div>
              <h2>No Building Project Selected</h2>
              <p>Create your first project or select one from the top bar to manage 3D models and households.</p>
              <button type="button" class="admin-btn admin-btn-primary btn-new-project">Create Project</button>
            </div>
          `
              : `
            <div class="admin-container">
              <!-- Tabs -->
              <div class="admin-tabs">
                <button type="button" class="admin-tab ${activeTab === "models" ? "active" : ""}" data-tab="models">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                  <span>3D Model & Environment</span>
                </button>
                <button type="button" class="admin-tab ${activeTab === "households" ? "active" : ""}" data-tab="households">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                  <span>Households & Managed Spaces (${String(units.length)})</span>
                </button>
                <button type="button" class="admin-tab ${activeTab === "settings" ? "active" : ""}" data-tab="settings">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                  <span>Project Settings</span>
                </button>
              </div>

              <!-- Tab Content -->
              <div class="admin-tab-body">
                ${activeTab === "models" ? renderModelsTab() : activeTab === "households" ? renderHouseholdsTab() : renderSettingsTab()}
              </div>
            </div>
          `
          }
        </main>

        <div class="admin-toast" role="alert"></div>

        <!-- Modals Root -->
        <div class="admin-modal-container"></div>
      </div>
    `;

    bindEvents();
    if (isNewProjectModalOpen) renderNewProjectModal();
    if (isDeleteProjectModalOpen) renderDeleteProjectModal();
    if (isSpaceModalOpen) renderSpaceModal();
    if (unitToDelete) renderDeleteSpaceModal();
    if (selectedUnitForResidents) renderResidentModal();
  }

  function renderModelsTab(): string {
    const hasActiveScene = activeSceneManifest !== null;
    const ifcLayer = activeSceneManifest?.layers.find(
      (l) => l.type === "fragments",
    );
    const gltfLayer = activeSceneManifest?.layers.find(
      (l) => l.type === "gltf",
    );
    const selectedIdStr = currentBuildingId ? String(currentBuildingId) : "";

    return `
      <div class="admin-card-grid">
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 class="admin-card-title">Active 3D Scene Status</h3>
              <p class="admin-card-subtitle">Current WebGL/ThreeJS spatial configuration for ${escapeHtml(currentBuilding?.name)}</p>
            </div>
            <span class="admin-status-pill ${hasActiveScene ? "active" : "inactive"}">
              ${hasActiveScene ? "Active & Published" : "Pending Model Setup"}
            </span>
          </div>
          <div class="admin-card-content">
            ${
              hasActiveScene
                ? `
              <div class="admin-meta-grid">
                <div class="admin-meta-item">
                  <span class="admin-meta-label">Scene Schema</span>
                  <span class="admin-meta-value font-mono">v${escapeHtml(activeSceneManifest?.schemaVersion)}</span>
                </div>
                <div class="admin-meta-item">
                  <span class="admin-meta-label">Active Layers</span>
                  <span class="admin-meta-value">${String(activeSceneManifest?.layers.length ?? 0)} layers</span>
                </div>
                <div class="admin-meta-item">
                  <span class="admin-meta-label">BIM Fragments Model</span>
                  <span class="admin-meta-value font-mono">${escapeHtml(ifcLayer?.name ?? "None")}</span>
                  <span class="admin-meta-sub">${ifcLayer ? formatBytes(ifcLayer.byteSize) : ""}</span>
                </div>
                <div class="admin-meta-item">
                  <span class="admin-meta-label">GLTF Environment Context</span>
                  <span class="admin-meta-value font-mono">${escapeHtml(gltfLayer?.name ?? "None")}</span>
                  <span class="admin-meta-sub">${gltfLayer ? formatBytes(gltfLayer.byteSize) : ""}</span>
                </div>
              </div>
              <div class="admin-card-actions">
                <a href="/viewer/${selectedIdStr}" class="admin-btn admin-btn-primary" target="_blank" rel="noopener noreferrer">
                  <span>Open Interactive 3D Viewer</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </a>
              </div>
            `
                : `
              <div class="admin-callout">
                <p>No 3D scene is currently configured for this project. Upload 1 IFC Model and 1 GLTF Environment below to activate real 3D visualization.</p>
              </div>
            `
            }
          </div>
        </div>

        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 class="admin-card-title">Upload & Setup 3D Models</h3>
              <p class="admin-card-subtitle">Upload 1 IFC model (or converted .frag) and 1 GLTF/GLB environment model to save to database.</p>
            </div>
          </div>
          <div class="admin-card-content">
            <form class="admin-form form-upload-models">
              <div class="admin-form-group">
                <label class="admin-form-label" for="input-ifc-model">
                  1. BIM / IFC Building Model (.ifc or .frag) <span class="required">*</span>
                </label>
                <div class="admin-file-dropzone" data-target="ifc">
                  <input type="file" id="input-ifc-model" name="ifc_file" accept=".ifc,.frag" class="admin-file-input" required />
                  <div class="admin-dropzone-content">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span class="file-name-label">Choose IFC or FRAG file or drag here</span>
                    <span class="file-info-label font-mono">Accepts .ifc or .frag</span>
                  </div>
                </div>
              </div>

              <div class="admin-form-group">
                <label class="admin-form-label" for="input-gltf-model">
                  2. Environment / Context Model (.glb or .gltf) <span class="required">*</span>
                </label>
                <div class="admin-file-dropzone" data-target="gltf">
                  <input type="file" id="input-gltf-model" name="gltf_file" accept=".glb,.gltf" class="admin-file-input" required />
                  <div class="admin-dropzone-content">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <span class="file-name-label">Choose GLTF or GLB file or drag here</span>
                    <span class="file-info-label font-mono">Accepts .glb or .gltf</span>
                  </div>
                </div>
              </div>

              <div class="admin-form-row">
                <div class="admin-form-group">
                  <label class="admin-form-label" for="input-model-name">IFC Model Display Name</label>
                  <input type="text" id="input-model-name" name="model_name" class="admin-input" value="Architectural Model" required />
                </div>
                <div class="admin-form-group">
                  <label class="admin-form-label" for="input-env-name">Environment Display Name</label>
                  <input type="text" id="input-env-name" name="env_name" class="admin-input" value="Surrounding Context" required />
                </div>
              </div>

              <div class="admin-form-footer">
                <button type="submit" class="admin-btn admin-btn-primary btn-save-models">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                    <polyline points="17 21 17 13 7 13 7 21"></polyline>
                    <polyline points="7 3 7 8 15 8"></polyline>
                  </svg>
                  <span>Save to Database & Activate 3D Scene</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  function renderHouseholdsTab(): string {
    return `
      <div class="admin-card">
        <div class="admin-card-header">
          <div>
            <h3 class="admin-card-title">Managed Spaces & Households</h3>
            <p class="admin-card-subtitle">Manage apartments, units, commercial spaces, and resident occupancy records for ${escapeHtml(currentBuilding?.name)}</p>
          </div>
          <button type="button" class="admin-btn admin-btn-primary btn-add-space">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Add Space / Apartment</span>
          </button>
        </div>

        <div class="admin-card-toolbar">
          <div class="admin-search-wrapper">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input type="text" class="admin-input input-unit-search" placeholder="Search by space code or name..." value="${escapeHtml(unitSearchQuery)}" />
          </div>
          <span class="admin-toolbar-count">${String(units.length)} spaces listed</span>
        </div>

        <div class="admin-units-table-container">
          ${renderUnitsTableMarkup()}
        </div>
      </div>
    `;
  }

  function renderUnitsTableMarkup(): string {
    if (units.length === 0) {
      return `
        <div class="admin-empty-table">
          <p>No managed spaces found matching your search.</p>
          <button type="button" class="admin-btn admin-btn-secondary btn-add-space">Create New Space</button>
        </div>
      `;
    }

    return `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Display Name</th>
            <th>Storey</th>
            <th>Type</th>
            <th>Area (m²)</th>
            <th>Owner / Registration</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${units
            .map(
              (u) => `
            <tr data-unit-id="${escapeHtml(u.id)}">
              <td class="font-mono font-bold">${escapeHtml(u.code)}</td>
              <td>${escapeHtml(u.displayName)}</td>
              <td><span class="admin-badge">${escapeHtml(u.storeyCode)}</span></td>
              <td><span class="admin-badge type">${escapeHtml(u.unitType)}</span></td>
              <td class="font-mono">${u.area !== undefined ? `${u.area.toFixed(1)} m²` : "—"}</td>
              <td>
                <div class="admin-table-owner">${escapeHtml(u.owner ?? "Unregistered")}</div>
                ${u.certificateNumber ? `<div class="admin-table-sub font-mono">Cert: ${escapeHtml(u.certificateNumber)}</div>` : ""}
              </td>
              <td>
                <span class="admin-status-pill small ${u.status === "active" ? "active" : "inactive"}">
                  ${escapeHtml(u.status)}
                </span>
              </td>
              <td class="text-right">
                <div class="admin-row-actions">
                  <button type="button" class="admin-action-btn btn-manage-residents" data-unit-id="${escapeHtml(u.id)}" title="Manage Residents">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                    </svg>
                    <span>Residents</span>
                  </button>
                  <button type="button" class="admin-action-btn btn-edit-space" data-unit-id="${escapeHtml(u.id)}" title="Edit space details">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button type="button" class="admin-action-btn danger btn-delete-space" data-unit-id="${escapeHtml(u.id)}" title="Delete space">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderUnitsTable(): void {
    const container = root.querySelector<HTMLElement>(
      ".admin-units-table-container",
    );
    if (container) {
      container.innerHTML = renderUnitsTableMarkup();
    }
  }

  function renderSettingsTab(): string {
    if (!currentBuilding) {
      return `
        <div class="admin-empty-state">
          <p>No project selected.</p>
        </div>
      `;
    }

    return `
      <div class="admin-card-grid">
        <div class="admin-card">
          <div class="admin-card-header">
            <div>
              <h3 class="admin-card-title">Project Profile & Configuration</h3>
              <p class="admin-card-subtitle">General metadata and spatial registry details for ${escapeHtml(currentBuilding.name)}</p>
            </div>
            <span class="admin-badge font-mono">${escapeHtml(currentBuilding.code)}</span>
          </div>
          <div class="admin-card-content">
            <div class="admin-meta-grid">
              <div class="admin-meta-item">
                <span class="admin-meta-label">Project Name</span>
                <span class="admin-meta-value">${escapeHtml(currentBuilding.name)}</span>
              </div>
              <div class="admin-meta-item">
                <span class="admin-meta-label">Project Code</span>
                <span class="admin-meta-value font-mono font-bold">${escapeHtml(currentBuilding.code)}</span>
              </div>
              <div class="admin-meta-item">
                <span class="admin-meta-label">Timezone</span>
                <span class="admin-meta-value font-mono">${escapeHtml(currentBuilding.timezone)}</span>
              </div>
              <div class="admin-meta-item">
                <span class="admin-meta-label">Locale</span>
                <span class="admin-meta-value font-mono">${escapeHtml(currentBuilding.locale)}</span>
              </div>
              <div class="admin-meta-item">
                <span class="admin-meta-label">Building ID</span>
                <span class="admin-meta-value font-mono" style="font-size: 11px;">${escapeHtml(currentBuilding.id)}</span>
              </div>
              <div class="admin-meta-item">
                <span class="admin-meta-label">Managed Spaces Count</span>
                <span class="admin-meta-value font-mono">${String(units.length)} units registered</span>
              </div>
            </div>
          </div>
        </div>

        <div class="admin-card danger-zone" style="border-color: rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.02);">
          <div class="admin-card-header">
            <div>
              <h3 class="admin-card-title" style="color: var(--accent-danger); display: flex; align-items: center; gap: 8px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <span>Danger Zone</span>
              </h3>
              <p class="admin-card-subtitle">Irreversible actions that permanently delete data and resources.</p>
            </div>
          </div>
          <div class="admin-card-content">
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <h4 style="font-size: 14px; font-weight: 600; color: var(--text-primary);">Delete this Building Project</h4>
              <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
                Once deleted, all 3D scene manifests, uploaded IFC fragments, GLTF environment models, managed apartments, and resident occupancies will be permanently destroyed.
              </p>
            </div>
            <div style="padding-top: 8px;">
              <button type="button" class="admin-btn admin-btn-danger btn-delete-project">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Delete Project</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // New Project Modal
  function renderNewProjectModal(): void {
    const container = root.querySelector<HTMLElement>(".admin-modal-container");
    if (!container) return;
    container.innerHTML = `
      <div class="admin-modal-backdrop">
        <div class="admin-modal" role="dialog" aria-labelledby="modal-project-title">
          <div class="admin-modal-header">
            <h3 id="modal-project-title" class="admin-modal-title">Create New Building Project</h3>
            <button type="button" class="admin-modal-close btn-close-modal">&times;</button>
          </div>
          <form class="admin-form form-create-project">
            <div class="admin-modal-body">
              <div class="admin-form-group">
                <label class="admin-form-label" for="proj-name">Building / Project Name <span class="required">*</span></label>
                <input type="text" id="proj-name" name="name" class="admin-input" placeholder="e.g. Residential Tower Delta" required />
              </div>
              <div class="admin-form-group">
                <label class="admin-form-label" for="proj-code">Project Code <span class="required">*</span></label>
                <input type="text" id="proj-code" name="code" class="admin-input font-mono" placeholder="e.g. DELTA" style="text-transform: uppercase;" required />
                <span class="admin-form-hint">Unique identifier used for asset paths and spatial registry.</span>
              </div>
              <div class="admin-form-row">
                <div class="admin-form-group">
                  <label class="admin-form-label" for="proj-tz">Timezone</label>
                  <input type="text" id="proj-tz" name="timezone" class="admin-input font-mono" value="UTC" required />
                </div>
                <div class="admin-form-group">
                  <label class="admin-form-label" for="proj-locale">Locale</label>
                  <input type="text" id="proj-locale" name="locale" class="admin-input font-mono" value="en" required />
                </div>
              </div>
            </div>
            <div class="admin-modal-footer">
              <button type="button" class="admin-btn admin-btn-secondary btn-close-modal">Cancel</button>
              <button type="submit" class="admin-btn admin-btn-primary">Create Project</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const form = container.querySelector<HTMLFormElement>(
      ".form-create-project",
    );

    container
      .querySelectorAll<HTMLButtonElement>(".btn-close-modal")
      .forEach((btn) => {
        btn.addEventListener("click", () => closeAllModals());
      });
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      void (async () => {
        const formData = new FormData(form);
        const payload: CreateBuildingInput = {
          name: getFormString(formData, "name"),
          code: getFormString(formData, "code").toUpperCase(),
          timezone: getFormString(formData, "timezone", "UTC"),
          locale: getFormString(formData, "locale", "en"),
        };

        try {
          const created = await api.createBuilding(payload);
          showToast(
            `Project "${created.name}" created successfully!`,
            "success",
          );
          isNewProjectModalOpen = false;
          closeAllModals();
          await loadInitialData();
          if (created.id) await selectBuilding(created.id);
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Failed to create project";
          showToast(msg, "error");
        }
      })();
    });
  }

  // Create / Edit Space Modal
  function renderSpaceModal(): void {
    const container = root.querySelector<HTMLElement>(".admin-modal-container");
    if (!container) return;
    const isEdit = editingUnit !== null;
    container.innerHTML = `
      <div class="admin-modal-backdrop">
        <div class="admin-modal large" role="dialog" aria-labelledby="modal-space-title">
          <div class="admin-modal-header">
            <h3 id="modal-space-title" class="admin-modal-title">${isEdit ? "Edit Space / Apartment" : "Add New Space / Apartment"}</h3>
            <button type="button" class="admin-modal-close btn-close-modal">&times;</button>
          </div>
          <form class="admin-form form-save-space">
            <div class="admin-modal-body">
              <div class="admin-form-row">
                <div class="admin-form-group">
                  <label class="admin-form-label" for="space-code">Space Code <span class="required">*</span></label>
                  <input type="text" id="space-code" name="code" class="admin-input font-mono" placeholder="e.g. 101" value="${escapeHtml(editingUnit?.code)}" required />
                </div>
                <div class="admin-form-group">
                  <label class="admin-form-label" for="space-name">Display Name <span class="required">*</span></label>
                  <input type="text" id="space-name" name="displayName" class="admin-input" placeholder="e.g. Apartment 101" value="${escapeHtml(editingUnit?.displayName)}" required />
                </div>
              </div>

              <div class="admin-form-row">
                <div class="admin-form-group">
                  <label class="admin-form-label" for="space-storey">Storey / Level Code <span class="required">*</span></label>
                  <input type="text" id="space-storey" name="storeyCode" class="admin-input font-mono" placeholder="e.g. L01" value="${escapeHtml(editingUnit?.storeyCode ?? "L01")}" required />
                </div>
                <div class="admin-form-group">
                  <label class="admin-form-label" for="space-type">Space Type <span class="required">*</span></label>
                  <select id="space-type" name="unitType" class="admin-select" required>
                    <option value="apartment" ${editingUnit?.unitType === "apartment" ? "selected" : ""}>Apartment</option>
                    <option value="duplex" ${editingUnit?.unitType === "duplex" ? "selected" : ""}>Duplex</option>
                    <option value="penthouse" ${editingUnit?.unitType === "penthouse" ? "selected" : ""}>Penthouse</option>
                    <option value="retail" ${editingUnit?.unitType === "retail" ? "selected" : ""}>Retail / Commercial</option>
                    <option value="common" ${editingUnit?.unitType === "common" ? "selected" : ""}>Common Facility</option>
                  </select>
                </div>
              </div>

              <div class="admin-form-row">
                <div class="admin-form-group">
                  <label class="admin-form-label" for="space-area">Floor Area (m²)</label>
                  <input type="number" step="0.1" id="space-area" name="area" class="admin-input font-mono" placeholder="e.g. 78.5" value="${escapeHtml(editingUnit?.area)}" />
                </div>
                <div class="admin-form-group">
                  <label class="admin-form-label" for="space-status">Status</label>
                  <select id="space-status" name="status" class="admin-select">
                    <option value="active" ${editingUnit?.status === "active" ? "selected" : ""}>Active</option>
                    <option value="inactive" ${editingUnit?.status === "inactive" ? "selected" : ""}>Inactive</option>
                  </select>
                </div>
              </div>

              <div class="admin-form-group">
                <label class="admin-form-label" for="space-address">Physical Address</label>
                <input type="text" id="space-address" name="address" class="admin-input" placeholder="e.g. 100 Innovation Way, Unit 101" value="${escapeHtml(editingUnit?.address)}" />
              </div>

              <div class="admin-form-row">
                <div class="admin-form-group">
                  <label class="admin-form-label" for="space-owner">Registered Owner</label>
                  <input type="text" id="space-owner" name="owner" class="admin-input" placeholder="e.g. John Doe" value="${escapeHtml(editingUnit?.owner)}" />
                </div>
                <div class="admin-form-group">
                  <label class="admin-form-label" for="space-cert">Title Certificate Number</label>
                  <input type="text" id="space-cert" name="certificateNumber" class="admin-input font-mono" placeholder="e.g. CERT-2026-001" value="${escapeHtml(editingUnit?.certificateNumber)}" />
                </div>
              </div>

              <div class="admin-form-group">
                <label class="admin-form-label" for="space-term">Ownership / Lease Term</label>
                <input type="text" id="space-term" name="ownershipTerm" class="admin-input" placeholder="e.g. Freehold or 99-year Lease" value="${escapeHtml(editingUnit?.ownershipTerm)}" />
              </div>
            </div>
            <div class="admin-modal-footer">
              <button type="button" class="admin-btn admin-btn-secondary btn-close-modal">Cancel</button>
              <button type="submit" class="admin-btn admin-btn-primary">${isEdit ? "Update Space" : "Save Space"}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const form = container.querySelector<HTMLFormElement>(".form-save-space");

    container
      .querySelectorAll<HTMLButtonElement>(".btn-close-modal")
      .forEach((btn) => {
        btn.addEventListener("click", () => closeAllModals());
      });
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      void (async () => {
        if (!currentBuildingId) return;
        const formData = new FormData(form);
        const areaStr = getFormString(formData, "area");
        const addressStr = getFormString(formData, "address");
        const ownerStr = getFormString(formData, "owner");
        const certStr = getFormString(formData, "certificateNumber");
        const termStr = getFormString(formData, "ownershipTerm");

        const payload: CreateUnitInput | UpdateUnitInput = {
          code: getFormString(formData, "code").toUpperCase(),
          displayName: getFormString(formData, "displayName"),
          storeyCode: getFormString(formData, "storeyCode", "L01").toUpperCase(),
          unitType: getFormString(formData, "unitType", "apartment"),
          status: getFormString(formData, "status") === "inactive" ? "inactive" : "active",
          address: addressStr.length > 0 ? addressStr : undefined,
          area: areaStr.length > 0 ? parseFloat(areaStr) : undefined,
          owner: ownerStr.length > 0 ? ownerStr : undefined,
          certificateNumber: certStr.length > 0 ? certStr : undefined,
          ownershipTerm: termStr.length > 0 ? termStr : undefined,
        };

        try {
          if (isEdit && editingUnit) {
            await api.updateUnit(currentBuildingId, editingUnit.id, payload);
            showToast(
              `Space "${payload.displayName ?? ""}" updated successfully!`,
              "success",
            );
          } else {
            await api.createUnit(currentBuildingId, payload as CreateUnitInput);
            showToast(
              `Space "${payload.displayName ?? ""}" created successfully!`,
              "success",
            );
          }
          isSpaceModalOpen = false;
          editingUnit = null;
          closeAllModals();
          await refreshUnits();
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Failed to save space";
          showToast(msg, "error");
        }
      })();
    });
  }

  // Delete Space Confirmation Modal
  function renderDeleteSpaceModal(): void {
    if (!unitToDelete) return;
    const container = root.querySelector<HTMLElement>(".admin-modal-container");
    if (!container) return;
    container.innerHTML = `
      <div class="admin-modal-backdrop">
        <div class="admin-modal" role="dialog" aria-labelledby="modal-del-space-title">
          <div class="admin-modal-header">
            <h3 id="modal-del-space-title" class="admin-modal-title">Delete Space</h3>
            <button type="button" class="admin-modal-close btn-close-modal">&times;</button>
          </div>
          <div class="admin-modal-body">
            <p>Are you sure you want to delete <strong>${escapeHtml(unitToDelete.displayName)} (${escapeHtml(unitToDelete.code)})</strong>?</p>
            <p class="admin-form-hint" style="color: var(--accent-danger); margin-top: 8px;">
              This will permanently delete this space and all of its associated resident and occupancy records.
            </p>
          </div>
          <div class="admin-modal-footer">
            <button type="button" class="admin-btn admin-btn-secondary btn-close-modal">Cancel</button>
            <button type="button" class="admin-btn admin-btn-danger btn-confirm-delete-space">Delete Permanently</button>
          </div>
        </div>
      </div>
    `;

    container
      .querySelectorAll<HTMLButtonElement>(".btn-close-modal")
      .forEach((btn) => {
        btn.addEventListener("click", () => closeAllModals());
      });

    container
      .querySelector(".btn-confirm-delete-space")
      ?.addEventListener("click", () => {
        void (async () => {
          if (!currentBuildingId || !unitToDelete) return;
          try {
            await api.deleteUnit(currentBuildingId, unitToDelete.id);
            showToast(`Space "${unitToDelete.displayName}" deleted.`, "success");
            unitToDelete = null;
            closeAllModals();
            await refreshUnits();
          } catch (err: unknown) {
            const msg =
              err instanceof Error ? err.message : "Failed to delete space";
            showToast(msg, "error");
          }
        })();
      });
  }

  // Delete Project Confirmation Modal
  function renderDeleteProjectModal(): void {
    if (!currentBuildingId || !currentBuilding) return;
    const container = root.querySelector<HTMLElement>(".admin-modal-container");
    if (!container) return;

    container.innerHTML = `
      <div class="admin-modal-backdrop">
        <div class="admin-modal" role="dialog" aria-labelledby="modal-del-project-title">
          <div class="admin-modal-header">
            <h3 id="modal-del-project-title" class="admin-modal-title" style="color: var(--accent-danger); display: flex; align-items: center; gap: 8px;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <span>Delete Building Project</span>
            </h3>
            <button type="button" class="admin-modal-close btn-close-modal">&times;</button>
          </div>
          <div class="admin-modal-body">
            <p>Are you sure you want to permanently delete <strong>${escapeHtml(currentBuilding.name)}</strong> (<span class="font-mono">${escapeHtml(currentBuilding.code)}</span>)?</p>
            
            <div class="admin-callout danger" style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); padding: 14px;">
              <h4 style="color: var(--accent-danger); font-size: 13px; font-weight: 600; margin-bottom: 6px;">Warning: This action is irreversible!</h4>
              <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">Deleting this project will permanently remove:</p>
              <ul style="font-size: 12px; color: var(--text-secondary); margin-left: 18px; line-height: 1.6;">
                <li>Active 3D Scene manifests and model versions</li>
                <li>All managed spaces (${String(units.length)} units)</li>
                <li>All resident profiles and occupancy records</li>
                <li>User access permissions and configurations</li>
              </ul>
            </div>
          </div>
          <div class="admin-modal-footer">
            <button type="button" class="admin-btn admin-btn-secondary btn-close-modal">Cancel</button>
            <button type="button" class="admin-btn admin-btn-danger btn-confirm-delete-project">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Delete Project Permanently</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const confirmBtn = container.querySelector<HTMLButtonElement>(
      ".btn-confirm-delete-project",
    );
    confirmBtn?.addEventListener("click", () => {
      void (async () => {
        if (!currentBuildingId || !currentBuilding) return;
        const bName = currentBuilding.name;
        const bId = currentBuildingId;

        confirmBtn.disabled = true;
        confirmBtn.innerHTML = `
          <svg class="admin-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          <span>Deleting Project...</span>
        `;

        try {
          await api.deleteBuilding(bId);
          showToast(`Project "${bName}" deleted successfully.`, "success");
          currentBuildingId = undefined;
          currentBuilding = null;
          isDeleteProjectModalOpen = false;
          closeAllModals();
          await loadInitialData();
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Failed to delete project";
          showToast(msg, "error");
          confirmBtn.disabled = false;
          confirmBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Delete Project Permanently</span>
          `;
        }
      })();
    });

    container
      .querySelectorAll<HTMLButtonElement>(".btn-close-modal")
      .forEach((btn) => {
        btn.addEventListener("click", () => closeAllModals());
      });
  }

  // Resident Management Modal / Drawer
  function renderResidentModal(): void {
    if (!selectedUnitForResidents) return;
    const container = root.querySelector<HTMLElement>(".admin-modal-container");
    if (!container) return;

    container.innerHTML = `
      <div class="admin-modal-backdrop">
        <div class="admin-modal extra-large" role="dialog" aria-labelledby="modal-res-title">
          <div class="admin-modal-header">
            <div>
              <h3 id="modal-res-title" class="admin-modal-title">Resident & Occupancy Management</h3>
              <p class="admin-card-subtitle font-mono">${escapeHtml(selectedUnitForResidents.displayName)} (${escapeHtml(selectedUnitForResidents.code)})</p>
            </div>
            <button type="button" class="admin-modal-close btn-close-modal">&times;</button>
          </div>

          <div class="admin-modal-body">
            <div class="admin-resident-header-actions">
              <h4>Registered Occupants (${String(currentAdminOccupancies.length)})</h4>
              ${
                !isAddResidentFormOpen && !editingOccupancy
                  ? `<button type="button" class="admin-btn admin-btn-primary small btn-toggle-add-resident">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      <span>Add Resident</span>
                    </button>`
                  : ""
              }
            </div>

            ${
              isAddResidentFormOpen || editingOccupancy
                ? renderResidentFormMarkup()
                : renderResidentListMarkup()
            }
          </div>

          <div class="admin-modal-footer">
            <button type="button" class="admin-btn admin-btn-secondary btn-close-modal">Close</button>
          </div>
        </div>
      </div>
    `;

    bindResidentModalEvents();
  }

  function renderResidentListMarkup(): string {
    if (currentAdminOccupancies.length === 0) {
      return `
        <div class="admin-empty-table">
          <p>No residents currently registered for this space.</p>
          <button type="button" class="admin-btn admin-btn-secondary btn-toggle-add-resident">Add First Resident</button>
        </div>
      `;
    }

    return `
      <div class="admin-resident-cards">
        ${currentAdminOccupancies
          .map(
            (occ) => `
          <div class="admin-resident-card" data-occ-id="${escapeHtml(occ.id)}">
            <div class="admin-resident-card-top">
              <div>
                <span class="admin-resident-name">${escapeHtml(occ.displayName ?? "Unknown Resident")}</span>
                <span class="admin-badge type">${escapeHtml(occ.relationshipType)}</span>
                <span class="admin-badge">${escapeHtml(occ.residenceType ?? "permanent")}</span>
              </div>
              <div class="admin-row-actions">
                <button type="button" class="admin-action-btn btn-edit-resident" data-occ-id="${escapeHtml(occ.id)}" title="Edit resident details">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  <span>Edit</span>
                </button>
                <button type="button" class="admin-action-btn danger btn-delete-resident" data-occ-id="${escapeHtml(occ.id)}" title="Remove resident">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>Remove</span>
                </button>
              </div>
            </div>
            <div class="admin-resident-details-grid font-mono">
              <div><span class="label">Citizen ID:</span> ${escapeHtml(occ.citizenId ?? "—")}</div>
              <div><span class="label">Phone:</span> ${escapeHtml(occ.phone ?? "—")}</div>
              <div><span class="label">Email:</span> ${escapeHtml(occ.email ?? "—")}</div>
              <div><span class="label">Date of Birth:</span> ${escapeHtml(occ.dateOfBirth ?? "—")}</div>
              <div><span class="label">Gender:</span> ${escapeHtml(occ.gender ?? "—")}</div>
              <div><span class="label">Start Date:</span> ${occ.startsAt ? escapeHtml(occ.startsAt.slice(0, 10)) : "—"}</div>
            </div>
          </div>
        `,
          )
          .join("")}
      </div>
    `;
  }

  function renderResidentFormMarkup(): string {
    const isEdit = editingOccupancy !== null;
    return `
      <div class="admin-form-panel">
        <h4>${isEdit ? "Edit Resident Record" : "Add New Resident to Space"}</h4>
        <form class="admin-form form-save-resident">
          <div class="admin-form-row">
            <div class="admin-form-group">
              <label class="admin-form-label" for="res-name">Full Name <span class="required">*</span></label>
              <input type="text" id="res-name" name="displayName" class="admin-input" placeholder="e.g. Jane Doe" value="${escapeHtml(editingOccupancy?.displayName)}" required />
            </div>
            <div class="admin-form-group">
              <label class="admin-form-label" for="res-rel">Relationship Type <span class="required">*</span></label>
              <select id="res-rel" name="relationshipType" class="admin-select" required>
                <option value="owner" ${editingOccupancy?.relationshipType === "owner" ? "selected" : ""}>Owner</option>
                <option value="tenant" ${editingOccupancy?.relationshipType === "tenant" ? "selected" : ""}>Tenant</option>
                <option value="family_member" ${editingOccupancy?.relationshipType === "family_member" ? "selected" : ""}>Family Member</option>
                <option value="guest" ${editingOccupancy?.relationshipType === "guest" ? "selected" : ""}>Guest</option>
              </select>
            </div>
          </div>

          <div class="admin-form-row">
            <div class="admin-form-group">
              <label class="admin-form-label" for="res-cid">National Citizen ID / Passport</label>
              <input type="text" id="res-cid" name="citizenId" class="admin-input font-mono" placeholder="e.g. ID-12345678" value="${escapeHtml(editingOccupancy?.citizenId)}" />
            </div>
            <div class="admin-form-group">
              <label class="admin-form-label" for="res-res-type">Residence Type</label>
              <select id="res-res-type" name="residenceType" class="admin-select">
                <option value="permanent" ${editingOccupancy?.residenceType === "permanent" ? "selected" : ""}>Permanent</option>
                <option value="temporary" ${editingOccupancy?.residenceType === "temporary" ? "selected" : ""}>Temporary</option>
              </select>
            </div>
          </div>

          <div class="admin-form-row">
            <div class="admin-form-group">
              <label class="admin-form-label" for="res-phone">Phone Number</label>
              <input type="text" id="res-phone" name="phone" class="admin-input font-mono" placeholder="e.g. +1 555-0199" value="${escapeHtml(editingOccupancy?.phone)}" />
            </div>
            <div class="admin-form-group">
              <label class="admin-form-label" for="res-email">Email Address</label>
              <input type="email" id="res-email" name="email" class="admin-input" placeholder="e.g. jane@example.com" value="${escapeHtml(editingOccupancy?.email)}" />
            </div>
          </div>

          <div class="admin-form-row">
            <div class="admin-form-group">
              <label class="admin-form-label" for="res-dob">Date of Birth</label>
              <input type="date" id="res-dob" name="dateOfBirth" class="admin-input font-mono" value="${escapeHtml(editingOccupancy?.dateOfBirth)}" />
            </div>
            <div class="admin-form-group">
              <label class="admin-form-label" for="res-gender">Gender</label>
              <select id="res-gender" name="gender" class="admin-select">
                <option value="">Unspecified</option>
                <option value="female" ${editingOccupancy?.gender === "female" ? "selected" : ""}>Female</option>
                <option value="male" ${editingOccupancy?.gender === "male" ? "selected" : ""}>Male</option>
                <option value="other" ${editingOccupancy?.gender === "other" ? "selected" : ""}>Other</option>
              </select>
            </div>
          </div>

          <div class="admin-form-footer">
            <button type="button" class="admin-btn admin-btn-secondary btn-cancel-resident-form">Cancel</button>
            <button type="submit" class="admin-btn admin-btn-primary">${isEdit ? "Update Resident" : "Add Resident"}</button>
          </div>
        </form>
      </div>
    `;
  }

  function bindResidentModalEvents(): void {
    const container = root.querySelector<HTMLElement>(".admin-modal-container");
    if (!container) return;

    container
      .querySelectorAll<HTMLButtonElement>(".btn-close-modal")
      .forEach((btn) => {
        btn.addEventListener("click", () => closeAllModals());
      });

    container
      .querySelector(".btn-toggle-add-resident")
      ?.addEventListener("click", () => {
        isAddResidentFormOpen = true;
        editingOccupancy = null;
        renderResidentModal();
      });

    container
      .querySelector(".btn-cancel-resident-form")
      ?.addEventListener("click", () => {
        isAddResidentFormOpen = false;
        editingOccupancy = null;
        renderResidentModal();
      });

    container
      .querySelectorAll<HTMLButtonElement>(".btn-edit-resident")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const occId = btn.dataset.occId;
          const found = currentAdminOccupancies.find((o) => o.id === occId);
          if (found) {
            editingOccupancy = found;
            isAddResidentFormOpen = false;
            renderResidentModal();
          }
        });
      });

    container
      .querySelectorAll<HTMLButtonElement>(".btn-delete-resident")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          void (async () => {
            const occId = btn.dataset.occId;
            if (!occId || !currentBuildingId || !selectedUnitForResidents)
              return;
            if (!confirm("Are you sure you want to remove this resident?"))
              return;
            try {
              await api.deleteOccupancy(currentBuildingId, occId);
              showToast("Resident removed successfully", "success");
              currentAdminOccupancies = currentAdminOccupancies.filter(
                (o) => o.id !== occId,
              );
              renderResidentModal();
            } catch (err: unknown) {
              const msg =
                err instanceof Error
                  ? err.message
                  : "Failed to delete resident";
              showToast(msg, "error");
            }
          })();
        });
      });

    const form = container.querySelector<HTMLFormElement>(
      ".form-save-resident",
    );
    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      void (async () => {
        if (!currentBuildingId || !selectedUnitForResidents) return;
        const formData = new FormData(form);
        const cid = getFormString(formData, "citizenId");
        const rType = getFormString(formData, "residenceType");
        const phoneStr = getFormString(formData, "phone");
        const emailStr = getFormString(formData, "email");
        const dobStr = getFormString(formData, "dateOfBirth");
        const genderStr = getFormString(formData, "gender");

        const payload: CreateOccupancyInput | UpdateOccupancyInput = {
          displayName: getFormString(formData, "displayName"),
          relationshipType: getFormString(
            formData,
            "relationshipType",
            "owner",
          ),
          citizenId: cid.length > 0 ? cid : undefined,
          residenceType: rType.length > 0 ? rType : undefined,
          phone: phoneStr.length > 0 ? phoneStr : undefined,
          email: emailStr.length > 0 ? emailStr : undefined,
          dateOfBirth: dobStr.length > 0 ? dobStr : undefined,
          gender: genderStr.length > 0 ? genderStr : undefined,
          status: "active",
        };

        try {
          if (editingOccupancy) {
            const updated = await api.updateOccupancy(
              currentBuildingId,
              editingOccupancy.id,
              payload,
            );
            showToast(
              `Resident "${updated.displayName ?? ""}" updated!`,
              "success",
            );
            currentAdminOccupancies = currentAdminOccupancies.map((o) =>
              o.id === updated.id ? updated : o,
            );
          } else {
            const created = await api.createOccupancy(
              currentBuildingId,
              selectedUnitForResidents.id,
              payload as CreateOccupancyInput,
            );
            showToast(
              `Resident "${created.displayName ?? ""}" added!`,
              "success",
            );
            currentAdminOccupancies = [created, ...currentAdminOccupancies];
          }
          editingOccupancy = null;
          isAddResidentFormOpen = false;
          renderResidentModal();
        } catch (err: unknown) {
          const msg =
            err instanceof Error ? err.message : "Failed to save resident";
          showToast(msg, "error");
        }
      })();
    });
  }

  function closeAllModals(): void {
    isNewProjectModalOpen = false;
    isDeleteProjectModalOpen = false;
    isSpaceModalOpen = false;
    editingUnit = null;
    unitToDelete = null;
    selectedUnitForResidents = null;
    editingOccupancy = null;
    isAddResidentFormOpen = false;
    const container = root.querySelector<HTMLElement>(".admin-modal-container");
    if (container) container.innerHTML = "";
  }

  function bindEvents(): void {
    // Project switcher
    const selectEl = root.querySelector<HTMLSelectElement>(
      "#admin-building-select",
    );
    selectEl?.addEventListener("change", () => {
      const val = selectEl.value;
      if (val) {
        void selectBuilding(val as BuildingId);
      }
    });

    // New project modal trigger
    root
      .querySelectorAll<HTMLButtonElement>(".btn-new-project")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          isNewProjectModalOpen = true;
          renderNewProjectModal();
        });
      });

    // Delete project modal trigger (header and settings danger zone)
    root
      .querySelectorAll<HTMLButtonElement>(".btn-delete-project")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!currentBuildingId || !currentBuilding) {
            showToast("No active project selected to delete", "error");
            return;
          }
          isDeleteProjectModalOpen = true;
          renderDeleteProjectModal();
        });
      });

    // Tab switching
    root.querySelectorAll<HTMLButtonElement>(".admin-tab").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        const tab = tabBtn.dataset.tab as
          | "models"
          | "households"
          | "settings"
          | undefined;
        if (tab && tab !== activeTab) {
          activeTab = tab;
          render();
        }
      });
    });

    // File Dropzones & File Selectors for Models Tab
    root
      .querySelectorAll<HTMLInputElement>(".admin-file-input")
      .forEach((input) => {
        input.addEventListener("change", () => {
          const file = input.files?.[0];
          const dropzone = input.closest(".admin-file-dropzone");
          if (dropzone && file) {
            const nameEl =
              dropzone.querySelector<HTMLElement>(".file-name-label");
            const infoEl =
              dropzone.querySelector<HTMLElement>(".file-info-label");
            if (nameEl) nameEl.textContent = file.name;
            if (infoEl)
              infoEl.textContent = `${formatBytes(file.size)} • Ready`;
            dropzone.classList.add("has-file");
          }
        });
      });

    // Model Upload Form Submission
    const modelUploadForm = root.querySelector<HTMLFormElement>(
      ".form-upload-models",
    );
    modelUploadForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      void (async () => {
        if (!currentBuildingId) return;

        const formData = new FormData(modelUploadForm);
        const ifcFile = formData.get("ifc_file") as File | null;
        const gltfFile = formData.get("gltf_file") as File | null;

        if (!ifcFile || ifcFile.size === 0) {
          showToast(
            "Please select an IFC or Fragments (.frag) model file",
            "error",
          );
          return;
        }
        if (!gltfFile || gltfFile.size === 0) {
          showToast(
            "Please select a GLTF or GLB (.glb) environment file",
            "error",
          );
          return;
        }

        const isIfcConversion = ifcFile.name.toLowerCase().endsWith(".ifc");
        const submitBtn = modelUploadForm.querySelector<HTMLButtonElement>(
          ".btn-save-models",
        );
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `
          <svg class="admin-spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="2" x2="12" y2="6"></line>
            <line x1="12" y1="18" x2="12" y2="22"></line>
            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
            <line x1="2" y1="12" x2="6" y2="12"></line>
            <line x1="18" y1="12" x2="22" y2="12"></line>
            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
          </svg>
          <span>${isIfcConversion ? "Converting IFC to Fragments (.frag)... please wait" : "Uploading & Saving to Database..."}</span>
        `;
        }

        try {
          const manifest = await api.uploadModels(currentBuildingId, formData);
          activeSceneManifest = manifest;
          showToast(
            "3D Models and Environment saved and activated successfully!",
            "success",
          );
          render();
        } catch (err: unknown) {
          const msg =
            err instanceof Error
              ? err.message
              : "Failed to upload and configure models";
          showToast(msg, "error");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>Save to Database & Activate 3D Scene</span>`;
          }
        }
      })();
    });

    // Space CRUD Triggers
    root
      .querySelectorAll<HTMLButtonElement>(".btn-add-space")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          editingUnit = null;
          isSpaceModalOpen = true;
          renderSpaceModal();
        });
      });

    // Unit Search
    const searchInput = root.querySelector<HTMLInputElement>(
      ".input-unit-search",
    );
    searchInput?.addEventListener("input", () => {
      unitSearchQuery = searchInput.value;
      void refreshUnits();
    });

    // Unit table action delegations
    root
      .querySelectorAll<HTMLButtonElement>(".btn-manage-residents")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const unitId = btn.dataset.unitId;
          const found = units.find((u) => u.id === unitId);
          if (found) void openResidentModal(found);
        });
      });

    root
      .querySelectorAll<HTMLButtonElement>(".btn-edit-space")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const unitId = btn.dataset.unitId;
          const found = units.find((u) => u.id === unitId);
          if (found) {
            editingUnit = found;
            isSpaceModalOpen = true;
            renderSpaceModal();
          }
        });
      });

    root
      .querySelectorAll<HTMLButtonElement>(".btn-delete-space")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const unitId = btn.dataset.unitId;
          const found = units.find((u) => u.id === unitId);
          if (found) {
            unitToDelete = found;
            renderDeleteSpaceModal();
          }
        });
      });

    // Close Modals (Delegation on modal container & direct buttons)
    const modalContainer = root.querySelector<HTMLElement>(
      ".admin-modal-container",
    );
    modalContainer?.addEventListener("click", (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.classList.contains("admin-modal-backdrop") ||
        target.closest(".btn-close-modal")
      ) {
        closeAllModals();
      }
    });

    root
      .querySelectorAll<HTMLButtonElement>(".btn-close-modal")
      .forEach((btn) => {
        btn.addEventListener("click", () => closeAllModals());
      });
  }

  const onGlobalKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      closeAllModals();
    }
  };
  window.addEventListener("keydown", onGlobalKeyDown);

  void loadInitialData();

  return () => {
    if (toastTimeout) window.clearTimeout(toastTimeout);
    window.removeEventListener("keydown", onGlobalKeyDown);
    root.innerHTML = "";
  };
}
