import {
  createOccupancyInputSchema,
  updateOccupancyInputSchema,
  updateUnitInputSchema,
  type AdminOccupancy,
  type CreateOccupancyInput,
  type HouseholdUnitSummary,
  type UnitId,
  type UnitSummary,
  type UpdateOccupancyInput,
  type UpdateUnitInput,
} from "@bim/shared";

export interface HouseholdManagementPort {
  getAdminOccupancies(
    unitId: UnitId,
    signal?: AbortSignal,
  ): Promise<readonly AdminOccupancy[]>;
  updateUnit(
    unitId: UnitId,
    payload: UpdateUnitInput,
    signal?: AbortSignal,
  ): Promise<UnitSummary>;
  createOccupancy(
    unitId: UnitId,
    payload: CreateOccupancyInput,
    signal?: AbortSignal,
  ): Promise<AdminOccupancy>;
  updateOccupancy(
    occupancyId: string,
    payload: UpdateOccupancyInput,
    signal?: AbortSignal,
  ): Promise<AdminOccupancy>;
  deleteOccupancy(
    occupancyId: string,
    signal?: AbortSignal,
  ): Promise<void>;
  refreshOccupancies(unitId: UnitId): Promise<void>;
}

export interface HouseholdEditor {
  open(unit: HouseholdUnitSummary, trigger?: HTMLElement): void;
  close(): void;
  dispose(): void;
}

type EditorTab = "apartment" | "residents";

function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function messageFrom(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return error instanceof Error ? error.message : "The request could not be completed";
}

function formString(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function optionalString(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function nullableString(value: string): string | null {
  return value.length > 0 ? value : null;
}

function dateToIso(value: string): string | undefined {
  return value.length > 0 ? `${value}T00:00:00.000Z` : undefined;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstIssue(result: { readonly error: { readonly issues: readonly { readonly message: string }[] } }): string {
  return result.error.issues[0]?.message ?? "Please check the form values";
}

function selected(value: string | undefined, expected: string): string {
  return value === expected ? " selected" : "";
}

export function createHouseholdEditor(
  host: HTMLElement,
  port: HouseholdManagementPort,
): HouseholdEditor {
  let unit: HouseholdUnitSummary | undefined;
  let opener: HTMLElement | undefined;
  let activeTab: EditorTab = "apartment";
  let occupancies: readonly AdminOccupancy[] = [];
  let residentsLoaded = false;
  let residentsLoading = false;
  let editingOccupancy: AdminOccupancy | undefined;
  let addingResident = false;
  let deleteCandidate: AdminOccupancy | undefined;
  let dirty = false;
  let discardConfirmation = false;
  let discardTarget: "close" | "resident-list" | EditorTab = "close";
  let saving = false;
  let notice: string | undefined;
  let error: string | undefined;
  let requestVersion = 0;
  let loadController: AbortController | undefined;
  let mutationController: AbortController | undefined;

  function setBackgroundInert(value: boolean): void {
    const shell = host.parentElement?.querySelector<HTMLElement>(
      ".operator-shell",
    );
    if (shell !== undefined && shell !== null) shell.inert = value;
  }

  function closeImmediately(): void {
    requestVersion += 1;
    loadController?.abort();
    mutationController?.abort();
    const fallbackOpener = host.parentElement?.querySelector<HTMLElement>(
      ".unit-manage-button",
    );
    unit = undefined;
    occupancies = [];
    host.replaceChildren();
    setBackgroundInert(false);
    if (opener?.isConnected === true) opener.focus();
    else fallbackOpener?.focus();
    opener = undefined;
  }

  function requestClose(): void {
    if (saving) return;
    if (dirty) {
      discardTarget = "close";
      discardConfirmation = true;
      render(".household-editor-continue");
      return;
    }
    closeImmediately();
  }

  function renderApartment(): string {
    if (unit === undefined) return "";
    return `
      <form class="household-editor-form" data-form="apartment">
        <div class="household-editor-readonly-grid" aria-label="Apartment identifiers">
          <div><span>Apartment code</span><strong>${escapeHtml(unit.code)}</strong></div>
          <div><span>Floor</span><strong>${escapeHtml(unit.storeyCode)}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(unit.status)}</strong></div>
          <div><span>3D mapping</span><strong>${unit.modelLocalIds.length > 0 ? `${String(unit.modelLocalIds.length)} element(s)` : "Data only"}</strong></div>
        </div>
        <p class="household-editor-hint">Floor, code, status, and model bindings stay read-only here because changing them can invalidate the active 3D floor view.</p>
        <div class="household-editor-form-grid">
          <div class="household-editor-field household-editor-field-wide">
            <label for="household-unit-name">Display name</label>
            <input id="household-unit-name" name="displayName" type="text" maxlength="200" value="${escapeHtml(unit.displayName)}" required />
          </div>
          <div class="household-editor-field">
            <label for="household-unit-type">Space type</label>
            <select id="household-unit-type" name="unitType">
              <option value="apartment"${selected(unit.unitType, "apartment")}>Apartment</option>
              <option value="duplex"${selected(unit.unitType, "duplex")}>Duplex</option>
              <option value="penthouse"${selected(unit.unitType, "penthouse")}>Penthouse</option>
              <option value="retail"${selected(unit.unitType, "retail")}>Retail / Commercial</option>
              <option value="common"${selected(unit.unitType, "common")}>Common Facility</option>
            </select>
          </div>
          <div class="household-editor-field">
            <label for="household-unit-area">Floor area (m²)</label>
            <input id="household-unit-area" name="area" type="number" min="0" step="0.1" value="${escapeHtml(unit.area)}" />
          </div>
          <div class="household-editor-field household-editor-field-wide">
            <label for="household-unit-address">Physical address</label>
            <input id="household-unit-address" name="address" type="text" value="${escapeHtml(unit.address)}" />
          </div>
          <div class="household-editor-field">
            <label for="household-unit-owner">Registered owner</label>
            <input id="household-unit-owner" name="owner" type="text" value="${escapeHtml(unit.owner)}" />
          </div>
          <div class="household-editor-field">
            <label for="household-unit-certificate">Certificate number</label>
            <input id="household-unit-certificate" name="certificateNumber" type="text" value="${escapeHtml(unit.certificateNumber)}" />
          </div>
          <div class="household-editor-field household-editor-field-wide">
            <label for="household-unit-term">Ownership / lease term</label>
            <input id="household-unit-term" name="ownershipTerm" type="text" value="${escapeHtml(unit.ownershipTerm)}" />
          </div>
        </div>
        <div class="household-editor-form-actions">
          <button type="button" class="household-editor-button secondary household-editor-cancel">Cancel</button>
          <button type="submit" class="household-editor-button primary">Save apartment</button>
        </div>
      </form>`;
  }

  function renderResidentForm(): string {
    const current = editingOccupancy;
    const isEdit = current !== undefined;
    const startsAt = current?.startsAt.slice(0, 10) ?? today();
    const endsAt = current?.endsAt?.slice(0, 10) ?? "";
    return `
      <form class="household-editor-form" data-form="resident">
        <div class="household-editor-subheading">
          <div><span>Resident record</span><h3>${isEdit ? "Edit resident" : "Add resident"}</h3></div>
          <button type="button" class="household-editor-button secondary household-editor-back-residents">Back to residents</button>
        </div>
        <fieldset>
          <legend>Person details</legend>
          <div class="household-editor-form-grid">
            <div class="household-editor-field household-editor-field-wide">
              <label for="household-resident-name">Full name</label>
              <input id="household-resident-name" name="displayName" type="text" value="${escapeHtml(current?.displayName)}" required />
            </div>
            <div class="household-editor-field">
              <label for="household-resident-id">Citizen ID / passport</label>
              <input id="household-resident-id" name="citizenId" type="text" value="${escapeHtml(current?.citizenId)}" />
            </div>
            <div class="household-editor-field">
              <label for="household-resident-dob">Date of birth</label>
              <input id="household-resident-dob" name="dateOfBirth" type="date" value="${escapeHtml(current?.dateOfBirth)}" />
            </div>
            <div class="household-editor-field">
              <label for="household-resident-phone">Phone</label>
              <input id="household-resident-phone" name="phone" type="tel" value="${escapeHtml(current?.phone)}" />
            </div>
            <div class="household-editor-field">
              <label for="household-resident-email">Email</label>
              <input id="household-resident-email" name="email" type="email" value="${escapeHtml(current?.email)}" />
            </div>
            <div class="household-editor-field">
              <label for="household-resident-gender">Gender</label>
              <select id="household-resident-gender" name="gender">
                <option value="">Unspecified</option>
                <option value="female"${selected(current?.gender, "female")}>Female</option>
                <option value="male"${selected(current?.gender, "male")}>Male</option>
                <option value="other"${selected(current?.gender, "other")}>Other</option>
              </select>
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend>Occupancy details</legend>
          <div class="household-editor-form-grid">
            <div class="household-editor-field">
              <label for="household-resident-relationship">Relationship</label>
              <select id="household-resident-relationship" name="relationshipType" required>
                <option value="owner"${selected(current?.relationshipType, "owner")}>Owner</option>
                <option value="tenant"${selected(current?.relationshipType, "tenant")}>Tenant</option>
                <option value="family_member"${selected(current?.relationshipType, "family_member")}>Family member</option>
                <option value="guest"${selected(current?.relationshipType, "guest")}>Guest</option>
              </select>
            </div>
            <div class="household-editor-field">
              <label for="household-resident-type">Residence type</label>
              <select id="household-resident-type" name="residenceType">
                <option value="permanent"${selected(current?.residenceType ?? "permanent", "permanent")}>Permanent</option>
                <option value="temporary"${selected(current?.residenceType, "temporary")}>Temporary</option>
              </select>
            </div>
            <div class="household-editor-field">
              <label for="household-resident-status">Status</label>
              <select id="household-resident-status" name="status">
                <option value="active"${selected(current?.status ?? "active", "active")}>Active</option>
                <option value="inactive"${selected(current?.status, "inactive")}>Inactive</option>
              </select>
            </div>
            <div class="household-editor-field">
              <label for="household-resident-start">Start date</label>
              <input id="household-resident-start" name="startsAt" type="date" value="${escapeHtml(startsAt)}" required />
            </div>
            <div class="household-editor-field">
              <label for="household-resident-end">End date</label>
              <input id="household-resident-end" name="endsAt" type="date" min="${escapeHtml(startsAt)}" value="${escapeHtml(endsAt)}" />
            </div>
          </div>
        </fieldset>
        <div class="household-editor-form-actions">
          <button type="button" class="household-editor-button secondary household-editor-back-residents">Cancel</button>
          <button type="submit" class="household-editor-button primary">${isEdit ? "Update resident" : "Add resident"}</button>
        </div>
      </form>`;
  }

  function renderResidentList(): string {
    if (residentsLoading) {
      return `<div class="household-editor-loading" role="status"><span></span>Loading resident records…</div>`;
    }
    if (error !== undefined && !residentsLoaded) {
      return `<div class="household-editor-empty"><p>${escapeHtml(error)}</p><button type="button" class="household-editor-button secondary household-editor-retry">Retry</button></div>`;
    }
    const deleteConfirmation = deleteCandidate
      ? `<div class="household-editor-confirmation" role="alert">
          <div><strong>Remove ${escapeHtml(deleteCandidate.displayName ?? "this resident")}?</strong><span>This removes the occupancy record from this apartment.</span></div>
          <div><button type="button" class="household-editor-button secondary household-editor-cancel-delete">Cancel</button><button type="button" class="household-editor-button danger household-editor-confirm-delete">Remove resident</button></div>
        </div>`
      : "";
    if (occupancies.length === 0) {
      return `${deleteConfirmation}<div class="household-editor-empty"><p>No resident records are registered for this apartment.</p><button type="button" class="household-editor-button primary household-editor-add-resident">Add first resident</button></div>`;
    }
    return `${deleteConfirmation}
      <div class="household-editor-list-header"><strong>${String(occupancies.length)} resident record${occupancies.length === 1 ? "" : "s"}</strong><button type="button" class="household-editor-button primary household-editor-add-resident">Add resident</button></div>
      <div class="household-editor-resident-list">
        ${occupancies
          .map(
            (occupancy) => `<article class="household-editor-resident-card">
              <div class="household-editor-resident-primary">
                <div><strong>${escapeHtml(occupancy.displayName ?? "Unnamed resident")}</strong><span>${escapeHtml(occupancy.relationshipType)} · ${escapeHtml(occupancy.residenceType ?? "Unspecified")}</span></div>
                <span class="household-editor-status" data-active="${String(occupancy.status === "active")}">${escapeHtml(occupancy.status)}</span>
              </div>
              <dl>
                <div><dt>Citizen ID</dt><dd>${escapeHtml(occupancy.citizenId ?? "—")}</dd></div>
                <div><dt>Phone</dt><dd>${escapeHtml(occupancy.phone ?? "—")}</dd></div>
                <div><dt>Email</dt><dd>${escapeHtml(occupancy.email ?? "—")}</dd></div>
                <div><dt>Period</dt><dd>${escapeHtml(occupancy.startsAt.slice(0, 10))} → ${escapeHtml(occupancy.endsAt?.slice(0, 10) ?? "Current")}</dd></div>
              </dl>
              <div class="household-editor-card-actions">
                <button type="button" class="household-editor-button secondary household-editor-edit-resident" data-occupancy-id="${escapeHtml(occupancy.id)}">Edit</button>
                <button type="button" class="household-editor-button quiet-danger household-editor-delete-resident" data-occupancy-id="${escapeHtml(occupancy.id)}">Remove</button>
              </div>
            </article>`,
          )
          .join("")}
      </div>`;
  }

  function renderResidents(): string {
    return addingResident || editingOccupancy !== undefined
      ? renderResidentForm()
      : renderResidentList();
  }

  function render(focusSelector?: string): void {
    if (unit === undefined) {
      host.replaceChildren();
      return;
    }
    const feedback = error
      ? `<div class="household-editor-feedback error" role="alert">${escapeHtml(error)}</div>`
      : notice
        ? `<div class="household-editor-feedback success" role="status">${escapeHtml(notice)}</div>`
        : "";
    const discard = discardConfirmation
      ? `<div class="household-editor-confirmation" role="alert"><div><strong>Discard unsaved changes?</strong><span>Your edits have not been saved.</span></div><div><button type="button" class="household-editor-button secondary household-editor-continue">Continue editing</button><button type="button" class="household-editor-button danger household-editor-discard">Discard changes</button></div></div>`
      : "";
    host.innerHTML = `
      <div class="household-editor-backdrop">
        <section class="household-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="household-editor-title">
          <header class="household-editor-header">
            <div><span>Household management</span><h2 id="household-editor-title">${escapeHtml(unit.displayName)} · ${escapeHtml(unit.code)}</h2></div>
            <button type="button" class="household-editor-close" aria-label="Close household editor"${saving ? " disabled" : ""}>&times;</button>
          </header>
          <div class="household-editor-tabs" role="tablist" aria-label="Household editor sections">
            <button type="button" role="tab" data-tab="apartment" aria-selected="${String(activeTab === "apartment")}">Apartment</button>
            <button type="button" role="tab" data-tab="residents" aria-selected="${String(activeTab === "residents")}">Residents</button>
          </div>
          <div class="household-editor-body">
            ${feedback}${discard}
            ${activeTab === "apartment" ? renderApartment() : renderResidents()}
          </div>
        </section>
      </div>`;
    bindEvents();
    const target = focusSelector
      ? host.querySelector<HTMLElement>(focusSelector)
      : host.querySelector<HTMLElement>("[role=tab][aria-selected=true]");
    target?.focus();
  }

  function markFormDirty(form: HTMLFormElement): void {
    form.addEventListener("input", () => {
      dirty = true;
      discardConfirmation = false;
      notice = undefined;
    });
  }

  function showFormError(form: HTMLFormElement, value: string): void {
    error = value;
    let feedback = host.querySelector<HTMLElement>(".household-editor-feedback");
    if (feedback === null) {
      feedback = document.createElement("div");
      feedback.className = "household-editor-feedback error";
      feedback.setAttribute("role", "alert");
      feedback.tabIndex = -1;
      form.before(feedback);
    }
    feedback.className = "household-editor-feedback error";
    feedback.tabIndex = -1;
    feedback.textContent = value;
    feedback.focus();
  }

  function setFormBusy(form: HTMLFormElement, busy: boolean, label: string): void {
    saving = busy;
    form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
      "input, select, button",
    ).forEach((control) => {
      control.disabled = busy;
    });
    const submit = form.querySelector<HTMLButtonElement>("button[type=submit]");
    if (submit !== null) submit.textContent = busy ? "Saving…" : label;
  }

  async function saveApartment(form: HTMLFormElement): Promise<void> {
    if (unit === undefined || saving) return;
    const data = new FormData(form);
    const areaValue = formString(data, "area");
    const candidate: UpdateUnitInput = {
      displayName: formString(data, "displayName"),
      unitType: formString(data, "unitType"),
      area: areaValue.length > 0 ? Number(areaValue) : null,
      address: nullableString(formString(data, "address")),
      owner: nullableString(formString(data, "owner")),
      certificateNumber: nullableString(formString(data, "certificateNumber")),
      ownershipTerm: nullableString(formString(data, "ownershipTerm")),
    };
    const parsed = updateUnitInputSchema.safeParse(candidate);
    if (!parsed.success) {
      showFormError(form, firstIssue(parsed));
      return;
    }
    error = undefined;
    setFormBusy(form, true, "Save apartment");
    mutationController = new AbortController();
    try {
      const updated = await port.updateUnit(unit.id, parsed.data, mutationController.signal);
      unit = { ...unit, ...updated };
      dirty = false;
      saving = false;
      notice = "Apartment details saved.";
      render(".household-editor-close");
    } catch (caught: unknown) {
      const value = messageFrom(caught);
      saving = false;
      setFormBusy(form, false, "Save apartment");
      if (value) showFormError(form, value);
    }
  }

  async function saveResident(form: HTMLFormElement): Promise<void> {
    if (unit === undefined || saving) return;
    const data = new FormData(form);
    const startsAtValue = formString(data, "startsAt");
    const endsAtValue = formString(data, "endsAt");
    if (endsAtValue.length > 0 && endsAtValue <= startsAtValue) {
      showFormError(form, "End date must be later than the start date.");
      return;
    }
    const common = {
      displayName: formString(data, "displayName"),
      relationshipType: formString(data, "relationshipType"),
      residenceType: formString(data, "residenceType"),
      status: formString(data, "status"),
      startsAt: dateToIso(startsAtValue),
    };
    const email = formString(data, "email");
    const phone = formString(data, "phone");
    const citizenId = formString(data, "citizenId");
    const dateOfBirth = formString(data, "dateOfBirth");
    const gender = formString(data, "gender");
    const isEdit = editingOccupancy !== undefined;
    const candidate: CreateOccupancyInput | UpdateOccupancyInput = isEdit
      ? {
          ...common,
          email: nullableString(email),
          phone: nullableString(phone),
          citizenId: nullableString(citizenId),
          dateOfBirth: nullableString(dateOfBirth),
          gender: nullableString(gender),
          endsAt: dateToIso(endsAtValue) ?? null,
        }
      : {
          ...common,
          email: optionalString(email),
          phone: optionalString(phone),
          citizenId: optionalString(citizenId),
          dateOfBirth: optionalString(dateOfBirth),
          gender: optionalString(gender),
          endsAt: dateToIso(endsAtValue),
        };
    const parsed = isEdit
      ? updateOccupancyInputSchema.safeParse(candidate)
      : createOccupancyInputSchema.safeParse(candidate);
    if (!parsed.success) {
      showFormError(form, firstIssue(parsed));
      return;
    }
    error = undefined;
    const editingId = editingOccupancy?.id;
    setFormBusy(form, true, isEdit ? "Update resident" : "Add resident");
    mutationController = new AbortController();
    try {
      const saved = editingId
        ? await port.updateOccupancy(
            editingId,
            parsed.data,
            mutationController.signal,
          )
        : await port.createOccupancy(
            unit.id,
            parsed.data as CreateOccupancyInput,
            mutationController.signal,
          );
      occupancies = editingId
        ? occupancies.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...occupancies];
      editingOccupancy = undefined;
      addingResident = false;
      dirty = false;
      saving = false;
      notice = editingId ? "Resident record updated." : "Resident added.";
      render(".household-editor-add-resident");
      void port.refreshOccupancies(unit.id);
    } catch (caught: unknown) {
      const value = messageFrom(caught);
      saving = false;
      setFormBusy(form, false, isEdit ? "Update resident" : "Add resident");
      if (value) showFormError(form, value);
    }
  }

  async function removeResident(button: HTMLButtonElement): Promise<void> {
    if (unit === undefined || deleteCandidate === undefined || saving) return;
    saving = true;
    button.disabled = true;
    button.textContent = "Removing…";
    mutationController = new AbortController();
    const removedId = deleteCandidate.id;
    try {
      await port.deleteOccupancy(removedId, mutationController.signal);
      occupancies = occupancies.filter((item) => item.id !== removedId);
      deleteCandidate = undefined;
      saving = false;
      notice = "Resident removed.";
      error = undefined;
      render(".household-editor-add-resident");
      void port.refreshOccupancies(unit.id);
    } catch (caught: unknown) {
      saving = false;
      button.disabled = false;
      button.textContent = "Remove resident";
      const value = messageFrom(caught);
      if (value) {
        error = value;
        render(".household-editor-confirm-delete");
      }
    }
  }

  function bindEvents(): void {
    const backdrop = host.querySelector<HTMLElement>(".household-editor-backdrop");
    const dialog = host.querySelector<HTMLElement>(".household-editor-dialog");
    if (backdrop === null || dialog === null) return;
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) requestClose();
    });
    backdrop.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    host.querySelector(".household-editor-close")?.addEventListener("click", requestClose);
    host.querySelector(".household-editor-cancel")?.addEventListener("click", requestClose);
    host.querySelector(".household-editor-continue")?.addEventListener("click", () => {
      discardConfirmation = false;
      render(activeTab === "apartment" ? "#household-unit-name" : "#household-resident-name");
    });
    host.querySelector(".household-editor-discard")?.addEventListener("click", () => {
      dirty = false;
      discardConfirmation = false;
      if (discardTarget === "close") {
        closeImmediately();
      } else if (discardTarget === "resident-list") {
        addingResident = false;
        editingOccupancy = undefined;
        render(".household-editor-add-resident");
      } else {
        activeTab = discardTarget;
        addingResident = false;
        editingOccupancy = undefined;
        render(`[data-tab='${activeTab}']`);
        if (activeTab === "residents" && !residentsLoaded) void loadResidents();
      }
    });
    host.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        if (saving) return;
        const nextTab = button.dataset.tab === "residents" ? "residents" : "apartment";
        if (dirty) {
          discardTarget = nextTab;
          discardConfirmation = true;
          render(".household-editor-continue");
          return;
        }
        activeTab = nextTab;
        notice = undefined;
        error = undefined;
        render(`[data-tab='${activeTab}']`);
        if (activeTab === "residents" && !residentsLoaded) void loadResidents();
      });
    });
    const apartmentForm = host.querySelector<HTMLFormElement>("[data-form=apartment]");
    if (apartmentForm !== null) {
      markFormDirty(apartmentForm);
      apartmentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        void saveApartment(apartmentForm);
      });
    }
    const residentForm = host.querySelector<HTMLFormElement>("[data-form=resident]");
    if (residentForm !== null) {
      markFormDirty(residentForm);
      residentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        void saveResident(residentForm);
      });
      residentForm.querySelector<HTMLInputElement>("[name=startsAt]")?.addEventListener("change", (event) => {
        const input = event.currentTarget;
        if (!(input instanceof HTMLInputElement)) return;
        const end = residentForm.querySelector<HTMLInputElement>("[name=endsAt]");
        if (end !== null) end.min = input.value;
      });
    }
    host.querySelectorAll(".household-editor-back-residents").forEach((button) => {
      button.addEventListener("click", () => {
        if (dirty) {
          discardTarget = "resident-list";
          discardConfirmation = true;
          render(".household-editor-continue");
          return;
        }
        addingResident = false;
        editingOccupancy = undefined;
        render(".household-editor-add-resident");
      });
    });
    host.querySelector(".household-editor-add-resident")?.addEventListener("click", () => {
      addingResident = true;
      editingOccupancy = undefined;
      notice = undefined;
      render("#household-resident-name");
    });
    host.querySelectorAll<HTMLButtonElement>(".household-editor-edit-resident").forEach((button) => {
      button.addEventListener("click", () => {
        editingOccupancy = occupancies.find((item) => item.id === button.dataset.occupancyId);
        addingResident = false;
        notice = undefined;
        render("#household-resident-name");
      });
    });
    host.querySelectorAll<HTMLButtonElement>(".household-editor-delete-resident").forEach((button) => {
      button.addEventListener("click", () => {
        deleteCandidate = occupancies.find((item) => item.id === button.dataset.occupancyId);
        error = undefined;
        render(".household-editor-cancel-delete");
      });
    });
    host.querySelector(".household-editor-cancel-delete")?.addEventListener("click", () => {
      deleteCandidate = undefined;
      render(".household-editor-add-resident");
    });
    const confirmDelete = host.querySelector<HTMLButtonElement>(".household-editor-confirm-delete");
    confirmDelete?.addEventListener("click", () => void removeResident(confirmDelete));
    host.querySelector(".household-editor-retry")?.addEventListener("click", () => void loadResidents());
  }

  async function loadResidents(): Promise<void> {
    if (unit === undefined) return;
    loadController?.abort();
    const controller = new AbortController();
    loadController = controller;
    const version = ++requestVersion;
    residentsLoading = true;
    error = undefined;
    render();
    try {
      const result = await port.getAdminOccupancies(unit.id, controller.signal);
      if (version !== requestVersion) return;
      occupancies = result;
      residentsLoaded = true;
      residentsLoading = false;
      render(".household-editor-add-resident");
    } catch (caught: unknown) {
      if (version !== requestVersion) return;
      const value = messageFrom(caught);
      residentsLoading = false;
      residentsLoaded = false;
      if (value) error = value;
      render(".household-editor-retry");
    }
  }

  return {
    open(nextUnit, trigger) {
      requestVersion += 1;
      loadController?.abort();
      mutationController?.abort();
      unit = nextUnit;
      opener = trigger;
      activeTab = "apartment";
      occupancies = [];
      residentsLoaded = false;
      residentsLoading = false;
      editingOccupancy = undefined;
      addingResident = false;
      deleteCandidate = undefined;
      dirty = false;
      discardConfirmation = false;
      discardTarget = "close";
      saving = false;
      notice = undefined;
      error = undefined;
      setBackgroundInert(true);
      render("#household-unit-name");
    },
    close: requestClose,
    dispose: closeImmediately,
  };
}
