import * as OBC from "@thatopen/components";
import * as FRAGS from "@thatopen/fragments";
import type {
  CameraPose,
  PropertyEntry,
  PropertyGroup,
  SceneLayerManifest,
  SceneManifestV2,
} from "@bim/shared";
import CameraControls from "camera-controls";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type {
  ApartmentSeedsGrouped,
  ExtractedApartmentData,
  OperatorViewerPort,
  ViewerLayerState,
  ViewerPick,
} from "../../modules/viewer-runtime/viewer-port.js";

const selectionMaterial: FRAGS.MaterialDefinition = {
  color: new THREE.Color("#ff7a45"),
  opacity: 0.72,
  transparent: true,
  renderedFaces: FRAGS.RenderedFaces.TWO,
  preserveOriginalMaterial: true,
};

const hoverMaterial: FRAGS.MaterialDefinition = {
  color: new THREE.Color("#1e293b"),
  opacity: 0.75,
  transparent: true,
  renderedFaces: FRAGS.RenderedFaces.TWO,
  preserveOriginalMaterial: false,
};

const viewUpdateIntervalMs = 32;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown viewer error";
}

function propertyValue(
  value: unknown,
): string | number | boolean | null | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "object" && "value" in value) {
    return propertyValue((value as { value: unknown }).value);
  }
  return undefined;
}

function cleanCategoryName(rawCategory: string | undefined): string | undefined {
  if (rawCategory === undefined || rawCategory.length === 0) return undefined;
  const trimmed = rawCategory.trim();
  if (trimmed.toUpperCase().startsWith("IFC")) {
    const rest = trimmed.slice(3);
    return `Ifc${rest}`;
  }
  return trimmed;
}

interface ExtractedProperties {
  readonly properties: readonly PropertyEntry[];
  readonly groups: readonly PropertyGroup[];
  readonly category?: string | undefined;
}

function extractAllPropertiesAndGroups(
  item: Record<string, unknown> | undefined,
): ExtractedProperties {
  if (item === undefined) {
    return { properties: [], groups: [] };
  }

  const allFlatProps: PropertyEntry[] = [];
  const groupsMap = new Map<string, { label: string; entries: PropertyEntry[] }>();

  function getOrCreateGroup(key: string, label: string) {
    let group = groupsMap.get(key);
    if (!group) {
      group = { label, entries: [] };
      groupsMap.set(key, group);
    }
    return group;
  }

  // 1. Category
  const catObj = item._category ?? item.category;
  const rawCat = propertyValue(catObj);
  const category =
    typeof rawCat === "string" ? cleanCategoryName(rawCat) : undefined;

  // 2. Attributes & Identity
  const identityGroup = getOrCreateGroup("identity", "Attributes & Identity");

  for (const [key, raw] of Object.entries(item)) {
    if (Array.isArray(raw)) continue;
    if (
      key.startsWith("_") &&
      key !== "_guid" &&
      key !== "_localId" &&
      key !== "_category"
    ) {
      continue;
    }
    const val = propertyValue(raw);
    if (val !== undefined) {
      const displayKey =
        key === "_guid" ? "GlobalId" : key === "_localId" ? "ExpressID" : key;
      const entry: PropertyEntry = { key: displayKey, value: val };
      identityGroup.entries.push(entry);
      allFlatProps.push(entry);
    }
  }

  // Helper to extract properties from a PropertySet / QuantitySet / Dictionary
  function processPropertySet(
    psetObj: Record<string, unknown>,
    defaultGroupName = "Property Set",
  ): void {
    const nameVal = psetObj.Name ?? psetObj.name;
    const rawPsetName = propertyValue(nameVal);
    const psetName =
      typeof rawPsetName === "string" && rawPsetName.trim().length > 0
        ? rawPsetName.trim()
        : defaultGroupName;
    const groupKey = `pset_${psetName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const group = getOrCreateGroup(groupKey, psetName);

    const rawPropsList =
      psetObj.HasProperties ??
      psetObj.hasProperties ??
      psetObj.Quantities ??
      psetObj.quantities ??
      psetObj.Properties ??
      psetObj.properties;

    if (Array.isArray(rawPropsList)) {
      for (const propItem of rawPropsList) {
        if (typeof propItem !== "object" || propItem === null) continue;
        const propRecord = propItem as Record<string, unknown>;
        const propKeyRaw = propertyValue(
          propRecord.Name ?? propRecord.name ?? propRecord.key,
        );
        if (typeof propKeyRaw !== "string" || propKeyRaw.trim().length === 0) {
          continue;
        }
        const propKey = propKeyRaw.trim();

        const propVal = propertyValue(
          propRecord.NominalValue ??
            propRecord.nominalValue ??
            propRecord.LengthValue ??
            propRecord.AreaValue ??
            propRecord.VolumeValue ??
            propRecord.CountValue ??
            propRecord.Value ??
            propRecord.value,
        );

        if (propVal !== undefined) {
          const rawUnit = propertyValue(propRecord.Unit ?? propRecord.unit);
          const unit = typeof rawUnit === "string" ? rawUnit : undefined;
          const entry: PropertyEntry = {
            key: propKey,
            value: propVal,
            unit,
          };
          group.entries.push(entry);
          allFlatProps.push(entry);
        }
      }
    } else {
      for (const [k, v] of Object.entries(psetObj)) {
        if (Array.isArray(v) || k.startsWith("_") || k === "Name" || k === "name") {
          continue;
        }
        const scalarVal = propertyValue(v);
        if (scalarVal !== undefined) {
          const entry: PropertyEntry = { key: k, value: scalarVal };
          group.entries.push(entry);
          allFlatProps.push(entry);
        }
      }
    }
  }

  // 3. Property Sets (IsDefinedBy)
  if (Array.isArray(item.IsDefinedBy)) {
    for (const relItem of item.IsDefinedBy) {
      if (typeof relItem === "object" && relItem !== null) {
        processPropertySet(relItem as Record<string, unknown>, "Property Set");
      }
    }
  }

  // 4. Type Properties (IsTypedBy)
  if (Array.isArray(item.IsTypedBy)) {
    const typeGroup = getOrCreateGroup("type_properties", "Type Properties");
    for (const typeItem of item.IsTypedBy) {
      if (typeof typeItem !== "object" || typeItem === null) continue;
      const typeRecord = typeItem as Record<string, unknown>;
      for (const [k, v] of Object.entries(typeRecord)) {
        if (Array.isArray(v)) {
          if (k === "HasPropertySets" || k === "IsDefinedBy") {
            for (const pset of v) {
              if (typeof pset === "object" && pset !== null) {
                processPropertySet(
                  pset as Record<string, unknown>,
                  "Type Property Set",
                );
              }
            }
          }
        } else if (!k.startsWith("_")) {
          const val = propertyValue(v);
          if (val !== undefined) {
            const entry: PropertyEntry = { key: `Type ${k}`, value: val };
            typeGroup.entries.push(entry);
            allFlatProps.push(entry);
          }
        }
      }
    }
  }

  // 5. Spatial Structure (ContainedInStructure)
  if (Array.isArray(item.ContainedInStructure)) {
    const spatialGroup = getOrCreateGroup("spatial", "Spatial Location");
    for (const spatialItem of item.ContainedInStructure) {
      if (typeof spatialItem !== "object" || spatialItem === null) continue;
      const spatialRecord = spatialItem as Record<string, unknown>;
      const cat = propertyValue(spatialRecord._category);
      const name = propertyValue(spatialRecord.Name ?? spatialRecord.name);
      const longName = propertyValue(spatialRecord.LongName);
      const elevation = propertyValue(spatialRecord.Elevation);

      const catStr = typeof cat === "string" ? cat : undefined;
      const label = cleanCategoryName(catStr) ?? "Spatial Container";
      if (name !== undefined) {
        spatialGroup.entries.push({ key: `${label} Name`, value: name });
        allFlatProps.push({ key: `${label} Name`, value: name });
      }
      if (longName !== undefined) {
        spatialGroup.entries.push({ key: `${label} Long Name`, value: longName });
        allFlatProps.push({ key: `${label} Long Name`, value: longName });
      }
      if (elevation !== undefined) {
        spatialGroup.entries.push({
          key: `${label} Elevation`,
          value: elevation,
          unit: "m",
        });
        allFlatProps.push({
          key: `${label} Elevation`,
          value: elevation,
          unit: "m",
        });
      }
    }
  }

  // 6. Materials (HasAssociations)
  if (Array.isArray(item.HasAssociations)) {
    const matGroup = getOrCreateGroup("materials", "Materials & Finishes");
    for (const matItem of item.HasAssociations) {
      if (typeof matItem !== "object" || matItem === null) continue;
      const matRecord = matItem as Record<string, unknown>;
      const name = propertyValue(matRecord.Name ?? matRecord.name);
      if (name !== undefined) {
        matGroup.entries.push({ key: "Material", value: name });
        allFlatProps.push({ key: "Material", value: name });
      }
      for (const [k, v] of Object.entries(matRecord)) {
        if (
          Array.isArray(v) ||
          k.startsWith("_") ||
          k === "Name" ||
          k === "name"
        ) {
          continue;
        }
        const val = propertyValue(v);
        if (val !== undefined) {
          matGroup.entries.push({ key: k, value: val });
          allFlatProps.push({ key: k, value: val });
        }
      }
    }
  }

  // Format groups array (filter out empty groups)
  const groups: PropertyGroup[] = [];
  for (const [key, group] of groupsMap.entries()) {
    if (group.entries.length > 0) {
      groups.push({
        key,
        label: group.label,
        entries: group.entries,
      });
    }
  }

  return {
    properties: allFlatProps,
    groups,
    category,
  };
}

function propertyNamed(
  properties: readonly PropertyEntry[],
  ...keys: readonly string[]
): string | undefined {
  for (const key of keys) {
    const value = properties.find((property) => property.key === key)?.value;
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return undefined;
}

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function fetchVerifiedAsset(
  layer: SceneLayerManifest,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(layer.assetUrl, { signal, cache: "no-cache" });
  if (!response.ok)
    throw new Error(`${layer.name} returned HTTP ${String(response.status)}`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(
      `${layer.name} resolved to HTML instead of a ${layer.type} asset`,
    );
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== layer.byteSize) {
    throw new Error(
      `${layer.name} size mismatch: expected ${String(layer.byteSize)}, received ${String(buffer.byteLength)}`,
    );
  }
  if ((await sha256(buffer)) !== layer.contentHash.toLowerCase()) {
    throw new Error(`${layer.name} failed its SHA-256 verification`);
  }
  return buffer;
}

async function verifyRuntimeAsset(
  url: string,
  expected: "worker" | "wasm",
): Promise<void> {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok)
    throw new Error(
      `${expected} runtime asset returned HTTP ${String(response.status)}`,
    );
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html"))
    throw new Error(
      `${expected} runtime asset resolved to HTML instead of binary/script`,
    );
}

export class ThatOpenViewerAdapter implements OperatorViewerPort {
  private components: OBC.Components | undefined;
  private world:
    | OBC.SimpleWorld<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>
    | undefined;

  private fragments: OBC.FragmentsManager | undefined;
  private defaultCamera: CameraPose | undefined;
  private manifest: SceneManifestV2 | undefined;
  private readonly contextLayers = new Map<string, THREE.Group>();
  private readonly fragmentLayerIds = new Set<string>();
  private hovered: { modelId: string; localId: number } | undefined;
  private selected: { modelId: string; localId: number } | undefined;
  private hoverToken = 0;

  public async initialize(
    container: HTMLElement,
    manifest: SceneManifestV2,
  ): Promise<void> {
    this.manifest = manifest;
    this.defaultCamera = manifest.settings.defaultCamera;
    await verifyRuntimeAsset(
      manifest.runtimeCompatibility.workerUrl,
      "worker",
    );
    await verifyRuntimeAsset(
      manifest.runtimeCompatibility.wasmUrl,
      "wasm",
    );

    const components = new OBC.Components();
    const world = components
      .get(OBC.Worlds)
      .create<OBC.SimpleScene, OBC.SimpleCamera, OBC.SimpleRenderer>();
    world.scene = new OBC.SimpleScene(components);
    world.scene.setup({
      backgroundColor: new THREE.Color(manifest.settings.background.color),
      ambientLight: {
        color: new THREE.Color(manifest.settings.lighting.ambientColor),
        intensity: manifest.settings.lighting.ambientIntensity,
      },
      directionalLight: {
        color: new THREE.Color(manifest.settings.lighting.directionalColor),
        intensity: manifest.settings.lighting.directionalIntensity,
        position: new THREE.Vector3(
          ...manifest.settings.lighting.directionalPosition,
        ),
      },
    });
    world.renderer = new OBC.SimpleRenderer(components, container, {
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    world.renderer.three.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    world.camera = new OBC.SimpleCamera(components);
    components.init();
    components.get(OBC.Grids).create(world);

    const fragments = components.get(OBC.FragmentsManager);
    fragments.init(manifest.runtimeCompatibility.workerUrl);
    fragments.core.settings.maxUpdateRate = viewUpdateIntervalMs;
    fragments.list.onItemSet.add(({ value: model }) => {
      model.useCamera(world.camera.three);
      world.scene.three.add(model.object);
      void fragments.core.update(true);
    });
    world.camera.controls.addEventListener("update", () => {
      void fragments.core.update();
    });
    world.camera.controls.addEventListener("rest", () => {
      void fragments.core.update(true);
    });
    const controls = world.camera.controls;
    controls.mouseButtons.left = CameraControls.ACTION.NONE;
    controls.mouseButtons.right = CameraControls.ACTION.ROTATE;
    controls.mouseButtons.middle = CameraControls.ACTION.TRUCK;
    controls.mouseButtons.wheel = CameraControls.ACTION.DOLLY;
    controls.touches.two = CameraControls.ACTION.TOUCH_DOLLY;
    controls.minDistance = manifest.settings.navigation.minimumDistance;
    controls.maxDistance = manifest.settings.navigation.maximumDistance;

    this.components = components;
    this.world = world;
    this.fragments = fragments;
    this.setTouchNavigation(manifest.viewerUi.touchNavigation.defaultMode);
    await this.resetCamera();
  }

  public async loadScene(
    manifest: SceneManifestV2,
    signal: AbortSignal,
    onProgress: (
      loadedBytes: number,
      totalBytes: number,
      layer: ViewerLayerState,
    ) => void,
  ): Promise<readonly ViewerLayerState[]> {
    const world = this.requireWorld();
    const fragments = this.requireFragments();
    const totalBytes = manifest.layers.reduce(
      (sum, layer) => sum + layer.byteSize,
      0,
    );
    let loadedBytes = 0;
    const states = await Promise.all(
      manifest.layers.map(async (layer): Promise<ViewerLayerState> => {
        const loading: ViewerLayerState = {
          id: layer.id,
          name: layer.name,
          type: layer.type,
          visible: layer.defaultVisible,
          status: "loading",
        };
        onProgress(loadedBytes, totalBytes, loading);
        try {
          const buffer = await fetchVerifiedAsset(layer, signal);
          if (signal.aborted)
            throw new DOMException("Scene load canceled", "AbortError");
          if (layer.type === "fragments") {
            const model = await fragments.core.load(buffer, {
              modelId: layer.id,
              camera: world.camera.three,
            });
            model.object.matrix.fromArray(layer.transform);
            model.object.matrixAutoUpdate = false;
            model.object.updateMatrixWorld(true);
            await model.setVisible(undefined, layer.defaultVisible);
            this.fragmentLayerIds.add(layer.id);
          } else {
            const gltf = await new GLTFLoader().parseAsync(buffer, "");
            gltf.scene.matrix.fromArray(layer.transform);
            gltf.scene.matrixAutoUpdate = false;
            gltf.scene.visible = layer.defaultVisible;
            gltf.scene.traverse((object) => {
              if (object instanceof THREE.Mesh) {
                object.castShadow = layer.castShadow;
                object.receiveShadow = layer.receiveShadow;
              }
            });
            world.scene.three.add(gltf.scene);
            this.contextLayers.set(layer.id, gltf.scene);
          }
          loadedBytes += layer.byteSize;
          const ready: ViewerLayerState = { ...loading, status: "ready" };
          onProgress(loadedBytes, totalBytes, ready);
          return ready;
        } catch (error: unknown) {
          if (signal.aborted) throw error;
          const failed: ViewerLayerState = {
            ...loading,
            status: "failed",
            error: errorMessage(error),
          };
          onProgress(loadedBytes, totalBytes, failed);
          return failed;
        }
      }),
    );
    if (
      !states.some(
        (state) => state.type === "fragments" && state.status === "ready",
      )
    ) {
      throw new Error("No verified BIM layer could be loaded");
    }
    await fragments.core.update(true);
    return states;
  }

  public async pick(
    clientX: number,
    clientY: number,
  ): Promise<ViewerPick | undefined> {
    const world = this.requireWorld();
    const fragments = this.requireFragments();
    const renderer = world.renderer;
    if (renderer === null) throw new Error("Viewer renderer is unavailable");
    const result = await fragments.raycast({
      camera: world.camera.three,
      mouse: new THREE.Vector2(clientX, clientY),
      dom: renderer.three.domElement,
    });
    if (result === undefined) return undefined;
    this.hoverToken++;
    await this.clearHover();
    await this.clearSelection();
    const modelId = result.fragments.modelId;
    await fragments.highlight(selectionMaterial, {
      [modelId]: new Set([result.localId]),
    });
    await fragments.core.update();
    this.selected = { modelId, localId: result.localId };
    const [data] = await result.fragments.getItemsData([result.localId], {
      attributesDefault: true,
      relations: {
        IsDefinedBy: { attributes: true, relations: true },
        IsTypedBy: { attributes: true, relations: true },
        HasAssociations: { attributes: true, relations: true },
        ContainedInStructure: { attributes: true, relations: true },
        HasAssignments: { attributes: true, relations: true },
        DefinesType: { attributes: true, relations: true },
      },
    });
    const extracted = extractAllPropertiesAndGroups(
      data as Record<string, unknown> | undefined,
    );
    const manifestLayer = this.manifest?.layers.find(
      (layer) => layer.id === modelId,
    );
    const versionId = manifestLayer?.bim?.modelVersionId;
    if (versionId === undefined) return undefined;
    return {
      ref: {
        modelVersionId: versionId,
        modelLocalId: result.localId,
        globalId: propertyNamed(extracted.properties, "GlobalId"),
      },
      title:
        propertyNamed(extracted.properties, "Name", "LongName", "ObjectType") ??
        (extracted.category !== undefined
          ? `${extracted.category} (${String(result.localId)})`
          : `Element ${String(result.localId)}`),
      category: extracted.category,
      worldPosition: [result.point.x, result.point.y, result.point.z],
      properties: extracted.properties,
      groups: extracted.groups,
    };
  }

  public async clearSelection(): Promise<void> {
    if (this.selected === undefined || this.fragments === undefined) return;
    const { modelId, localId } = this.selected;
    this.selected = undefined;
    await this.fragments.resetHighlight({
      [modelId]: new Set([localId]),
    });
    await this.fragments.core.update();
  }

  public async hover(clientX: number, clientY: number): Promise<void> {
    const token = ++this.hoverToken;
    const world = this.world;
    const fragments = this.fragments;
    if (world === undefined || fragments === undefined) return;
    const renderer = world.renderer;
    if (renderer === null) return;
    const result = await fragments.raycast({
      camera: world.camera.three,
      mouse: new THREE.Vector2(clientX, clientY),
      dom: renderer.three.domElement,
    });
    if (token !== this.hoverToken) return;
    if (result === undefined) {
      await this.clearHover();
      return;
    }
    const modelId = result.fragments.modelId;
    const localId = result.localId;
    // Do not overwrite selection highlight with hover
    if (
      this.selected !== undefined &&
      this.selected.modelId === modelId &&
      this.selected.localId === localId
    ) {
      await this.clearHover();
      return;
    }
    // Already hovered
    if (
      this.hovered !== undefined &&
      this.hovered.modelId === modelId &&
      this.hovered.localId === localId
    ) {
      return;
    }
    await this.clearHover();
    if (token !== this.hoverToken) return;
    await fragments.highlight(hoverMaterial, {
      [modelId]: new Set([localId]),
    });
    await fragments.core.update();
    this.hovered = { modelId, localId };
  }

  public async clearHover(): Promise<void> {
    if (this.hovered === undefined || this.fragments === undefined) return;
    const { modelId, localId } = this.hovered;
    this.hovered = undefined;
    if (
      this.selected !== undefined &&
      this.selected.modelId === modelId &&
      this.selected.localId === localId
    ) {
      return;
    }
    await this.fragments.resetHighlight({
      [modelId]: new Set([localId]),
    });
    await this.fragments.core.update();
  }

  public setEnvironmentOpacity(opacity: number): void {
    const clamped = Math.max(0, Math.min(1, opacity));
    for (const scene of this.contextLayers.values()) {
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const mat of materials) {
            if (mat instanceof THREE.Material) {
              if (mat.userData["originalTransparent"] === undefined) {
                mat.userData["originalTransparent"] = mat.transparent;
                mat.userData["originalOpacity"] = mat.opacity;
              }
              mat.transparent =
                clamped < 1 || Boolean(mat.userData["originalTransparent"]);
              const origOpacity =
                (mat.userData["originalOpacity"] as number | undefined) ?? 1;
              mat.opacity = clamped * origOpacity;
              mat.needsUpdate = true;
            }
          }
        }
      });
    }
  }

  public async setLayerVisibility(
    layerId: string,
    visible: boolean,
  ): Promise<void> {
    const context = this.contextLayers.get(layerId);
    if (context !== undefined) context.visible = visible;
    if (this.fragmentLayerIds.has(layerId)) {
      const model = this.requireFragments().list.get(layerId);
      if (model !== undefined) await model.setVisible(undefined, visible);
    }
    await this.fragments?.core.update(true);
  }

  public async setCamera(pose: CameraPose, animate = true): Promise<void> {
    const world = this.requireWorld();
    if (
      world.camera.three instanceof THREE.PerspectiveCamera &&
      pose.fov !== undefined
    ) {
      world.camera.three.fov = pose.fov;
      world.camera.three.updateProjectionMatrix();
    }
    await world.camera.controls.setLookAt(
      ...pose.position,
      ...pose.target,
      animate,
    );
    await this.fragments?.core.update(true);
  }

  public async resetCamera(): Promise<void> {
    if (this.defaultCamera !== undefined)
      await this.setCamera(this.defaultCamera);
  }

  public setTouchNavigation(mode: "orbit" | "vertical"): void {
    if (this.world === undefined) return;
    this.world.camera.controls.touches.one =
      mode === "orbit"
        ? CameraControls.ACTION.TOUCH_ROTATE
        : CameraControls.ACTION.TOUCH_TRUCK;
  }

  public resize(): void {
    if (this.world === undefined) return;
    this.world.renderer?.resize();
    this.world.camera.updateAspect();
  }

  public async dispose(): Promise<void> {
    await this.clearHover();
    await this.clearSelection();
    for (const object of this.contextLayers.values()) {
      object.removeFromParent();
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const geometry = child.geometry as unknown as THREE.BufferGeometry;
        const material = child.material as unknown as
          | THREE.Material
          | THREE.Material[];
        geometry.dispose();
        const materials = Array.isArray(material) ? material : [material];
        materials.forEach((material) => material.dispose());
      });
    }
    this.contextLayers.clear();
    this.fragmentLayerIds.clear();
    this.components?.dispose();
    this.components = undefined;
    this.world = undefined;
    this.fragments = undefined;
    this.manifest = undefined;
  }

  public async extractApartmentSeeds(
    onProgress?: (processed: number, total: number) => void,
  ): Promise<ApartmentSeedsGrouped> {
    if (this.fragments === undefined) return {};
    const grouped: Record<string, ExtractedApartmentData[]> = {};

    let totalElements = 0;
    let processedElements = 0;

    const modelTasks: Array<{
      model: FRAGS.FragmentsModel;
      localIds: number[];
    }> = [];

    for (const layerId of this.fragmentLayerIds) {
      const model = this.fragments.list.get(layerId);
      if (!model) continue;
      try {
        const rawIds = await model.getLocalIds();
        const ids: number[] = Array.isArray(rawIds)
          ? (rawIds as number[])
          : Array.from((rawIds as Iterable<number> | undefined) ?? []);
        if (ids.length > 0) {
          modelTasks.push({ model, localIds: ids });
          totalElements += ids.length;
        }
      } catch (err) {
        console.warn(`Failed to get localIds for layer ${layerId}:`, err);
      }
    }

    onProgress?.(0, totalElements);

    const BATCH_SIZE = 100;

    for (const { model, localIds } of modelTasks) {
      for (let i = 0; i < localIds.length; i += BATCH_SIZE) {
        const batch = localIds.slice(i, i + BATCH_SIZE);
        try {
          const itemsData = await model.getItemsData(batch, {
            attributesDefault: true,
            relations: {
              IsDefinedBy: { attributes: true, relations: true },
              IsTypedBy: { attributes: true, relations: true },
              HasAssociations: { attributes: true, relations: true },
              ContainedInStructure: { attributes: true, relations: true },
              HasAssignments: { attributes: true, relations: true },
              DefinesType: { attributes: true, relations: true },
            },
          });

          for (const item of itemsData) {
            if (!item || typeof item !== "object") continue;
            const extracted = extractAllPropertiesAndGroups(
              item as Record<string, unknown>,
            );

            // 1. Search for Apartment property
            let apartmentVal: string | undefined;
            for (const prop of extracted.properties) {
              const k = prop.key.trim().toLowerCase();
              if (
                k === "apartment" ||
                k === "apartmentno" ||
                k === "apartment_no" ||
                k === "apartmentnumber" ||
                k === "apartment_number" ||
                k === "apartmentname" ||
                k === "apartment_name" ||
                k === "canho" ||
                k === "can_ho" ||
                k === "ma_can_ho" ||
                k === "unit" ||
                k === "unit_no" ||
                k === "unit_name"
              ) {
                if (prop.value !== null && prop.value !== undefined) {
                  const s = String(prop.value).trim();
                  if (s.length > 0) {
                    apartmentVal = s;
                    break;
                  }
                }
              }
            }

            if (!apartmentVal) {
              const directItem = item as Record<string, unknown>;
              for (const [k, v] of Object.entries(directItem)) {
                if (
                  k.toLowerCase() === "apartment" &&
                  v !== null &&
                  v !== undefined
                ) {
                  const s = String(propertyValue(v) ?? "").trim();
                  if (s.length > 0) {
                    apartmentVal = s;
                    break;
                  }
                }
              }
            }

            if (!apartmentVal) continue;

            // 2. Search for Area property
            let areaVal = 0;
            for (const prop of extracted.properties) {
              const k = prop.key.trim().toLowerCase();
              if (
                k === "area" ||
                k === "grossarea" ||
                k === "netarea" ||
                k === "grossfloorarea" ||
                k === "netfloorarea" ||
                k === "gross_floor_area" ||
                k === "net_floor_area" ||
                k === "livingarea" ||
                k === "usablearea" ||
                k === "dien_tich" ||
                k === "dientich" ||
                k === "areavalue"
              ) {
                if (typeof prop.value === "number") {
                  areaVal = Math.round(prop.value * 100) / 100;
                  break;
                } else if (typeof prop.value === "string") {
                  const num = parseFloat(prop.value.replace(/[^0-9.-]+/g, ""));
                  if (!isNaN(num) && num > 0) {
                    areaVal = Math.round(num * 100) / 100;
                    break;
                  }
                }
              }
            }

            // 3. Search for LivingFloor property
            let livingFloorVal: string | undefined;

            for (const prop of extracted.properties) {
              const k = prop.key.trim().toLowerCase();
              if (
                k === "livingfloor" ||
                k === "living_floor" ||
                k === "living floor" ||
                k === "floor" ||
                k === "storey" ||
                k === "level" ||
                k === "tang" ||
                k === "tang_so"
              ) {
                if (prop.value !== null && prop.value !== undefined) {
                  const s = String(prop.value).trim();
                  if (s.length > 0) {
                    livingFloorVal = s;
                    break;
                  }
                }
              }
            }

            if (!livingFloorVal) {
              for (const prop of extracted.properties) {
                const k = prop.key.trim().toLowerCase();
                if (
                  k.includes("storey name") ||
                  k.includes("spatial container name") ||
                  k.includes("building storey")
                ) {
                  if (prop.value !== null && prop.value !== undefined) {
                    const s = String(prop.value).trim();
                    if (s.length > 0) {
                      livingFloorVal = s;
                      break;
                    }
                  }
                }
              }
            }

            if (!livingFloorVal) {
              const match = /(?:[A-Za-z_-]*)(\d{1,2})(\d{2})$/.exec(apartmentVal);
              if (match?.[1]) {
                livingFloorVal = String(parseInt(match[1], 10));
              } else {
                const singleNumMatch = /\d+/.exec(apartmentVal);
                if (singleNumMatch) {
                  const n = parseInt(singleNumMatch[0], 10);
                  if (n >= 100) {
                    livingFloorVal = String(Math.floor(n / 100));
                  } else {
                    livingFloorVal = String(n);
                  }
                }
              }
            }

            let floorKey = livingFloorVal ?? "Unknown";
            const floorDigits = /(?:Floor|Level|Tầng|Storey|L)?\s*0*(\d+)/i.exec(
              floorKey,
            );
            if (floorDigits?.[1]) {
              floorKey = floorDigits[1];
            }

            let floorList = grouped[floorKey];
            if (!floorList) {
              floorList = [];
              grouped[floorKey] = floorList;
            }

            const existingIndex = floorList.findIndex(
              (u) => u.Apartment === apartmentVal,
            );

            const globalId = propertyNamed(extracted.properties, "GlobalId");
            const expressId =
              typeof (item as Record<string, unknown>)._localId === "number"
                ? ((item as Record<string, unknown>)._localId as number)
                : undefined;

            const category = extracted.category;

            if (existingIndex >= 0) {
              const existing = floorList[existingIndex];
              if (existing && existing.Area === 0 && areaVal > 0) {
                floorList[existingIndex] = {
                  ...existing,
                  Area: areaVal,
                };
              }
            } else {
              floorList.push({
                Apartment: apartmentVal,
                Area: areaVal,
                ...(livingFloorVal !== undefined
                  ? { LivingFloor: livingFloorVal }
                  : {}),
                ...(expressId !== undefined ? { ExpressID: expressId } : {}),
                ...(globalId !== undefined ? { GlobalId: globalId } : {}),
                ...(category !== undefined ? { Category: category } : {}),
              });
            }
          }
        } catch (err) {
          console.warn("Error processing batch of IFC items:", err);
        }

        processedElements += batch.length;
        onProgress?.(processedElements, totalElements);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const sortedGrouped: Record<string, ExtractedApartmentData[]> = {};

    const sortedFloorKeys = Object.keys(grouped).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, undefined, { numeric: true });
    });

    for (const key of sortedFloorKeys) {
      const list = grouped[key] ?? [];
      list.sort((a, b) =>
        a.Apartment.localeCompare(b.Apartment, undefined, { numeric: true }),
      );
      sortedGrouped[key] = list;
    }

    return sortedGrouped;
  }


  private requireWorld(): OBC.SimpleWorld<
    OBC.SimpleScene,
    OBC.SimpleCamera,
    OBC.SimpleRenderer
  > {
    if (this.world === undefined)
      throw new Error("Viewer has not been initialized");
    return this.world;
  }

  private requireFragments(): OBC.FragmentsManager {
    if (this.fragments === undefined)
      throw new Error("Fragments manager is unavailable");
    return this.fragments;
  }
}
