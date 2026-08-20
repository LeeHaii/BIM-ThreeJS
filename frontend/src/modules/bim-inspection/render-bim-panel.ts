import type { SceneManifestV2 } from "@bim/shared";
import type { AppState } from "../../app/app-state.js";

function row(label: string, value: string): HTMLDivElement {
  const item = document.createElement("div");
  item.className = "property-row";
  const key = document.createElement("dt");
  key.textContent = label;
  const content = document.createElement("dd");
  content.textContent = value;
  item.append(key, content);
  return item;
}

export function renderBimPanel(container: HTMLElement, state: AppState): void {
  const selection = state.bimSelection;
  const manifest = state.model.manifest;
  container.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "panel-section-heading";
  const eyebrow = document.createElement("span");
  eyebrow.textContent = "BIM information";
  const title = document.createElement("h2");
  title.textContent = selection?.title ?? "Select a BIM element";
  heading.append(eyebrow, title);
  container.append(heading);

  if (selection === undefined) {
    const empty = document.createElement("p");
    empty.className = "panel-empty";
    empty.textContent =
      "Click visible BIM geometry to inspect its real coordinates and properties.";
    container.append(empty);
    return;
  }

  const coordinates = document.createElement("dl");
  coordinates.className = "coordinate-grid";
  selection.worldPosition.forEach((value, index) => {
    const axis = ["X", "Y", "Z"][index] ?? "";
    coordinates.append(row(axis, value.toFixed(3)));
  });
  container.append(coordinates);

  const profile = activeProfile(manifest, selection.ref.modelVersionId);
  const ignored = new Set(profile?.ignoredKeys ?? []);
  const properties = document.createElement("dl");
  properties.className = "property-list";
  for (const property of selection.properties) {
    if (ignored.has(property.key)) continue;
    const label = profile?.aliases[property.key] ?? property.key;
    const value = property.value === null ? "—" : String(property.value);
    properties.append(
      row(
        label,
        property.unit === undefined ? value : `${value} ${property.unit}`,
      ),
    );
  }
  if (properties.childElementCount === 0)
    properties.append(row("Properties", "No configured values"));
  container.append(properties);
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
