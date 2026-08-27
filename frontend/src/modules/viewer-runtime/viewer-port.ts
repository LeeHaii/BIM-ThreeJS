import type {
  CameraPose,
  ElementRef,
  HouseholdStorey,
  PropertyEntry,
  PropertyGroup,
  SceneManifestV2,
  UnitId,
} from "@bim/shared";

export interface ViewerLayerState {
  readonly id: string;
  readonly name: string;
  readonly type: "fragments" | "gltf";
  readonly visible: boolean;
  readonly status: "loading" | "ready" | "failed";
  readonly error?: string | undefined;
}

export interface ViewerPick {
  readonly ref: ElementRef;
  readonly title: string;
  readonly category?: string | undefined;
  readonly worldPosition: readonly [number, number, number];
  readonly properties: readonly PropertyEntry[];
  readonly groups?: readonly PropertyGroup[] | undefined;
}

export interface ExtractedApartmentData {
  readonly Apartment: string;
  readonly Area: number;
  readonly LivingFloor?: string | number | undefined;
  readonly ExpressID?: number | undefined;
  readonly GlobalId?: string | undefined;
  readonly Category?: string | undefined;
}

export type ApartmentSeedsGrouped = Record<
  string,
  Array<ExtractedApartmentData>
>;

export interface OperatorViewerPort {
  initialize(container: HTMLElement, manifest: SceneManifestV2): Promise<void>;
  loadScene(
    manifest: SceneManifestV2,
    signal: AbortSignal,
    onProgress: (
      loadedBytes: number,
      totalBytes: number,
      layer: ViewerLayerState,
    ) => void,
  ): Promise<readonly ViewerLayerState[]>;
  pick(clientX: number, clientY: number): Promise<ViewerPick | undefined>;
  clearSelection(): Promise<void>;
  hover(clientX: number, clientY: number): Promise<void>;
  clearHover(): Promise<void>;
  showStorey(
    storey: HouseholdStorey,
    cutRatio?: 0.2 | 0.5,
    adjacentStorey?: HouseholdStorey,
  ): Promise<void>;
  clearStoreyView(): Promise<void>;
  hoverUnit(clientX: number, clientY: number): Promise<void>;
  pickUnit(clientX: number, clientY: number): Promise<UnitId | undefined>;
  selectUnitVisual(unitId: UnitId): Promise<void>;
  setEnvironmentOpacity(opacity: number): void;
  setLayerVisibility(layerId: string, visible: boolean): Promise<void>;
  setCamera(pose: CameraPose, animate?: boolean): Promise<void>;
  resetCamera(): Promise<void>;
  setTouchNavigation(mode: "orbit" | "vertical"): void;
  resize(): void;
  dispose(): Promise<void>;
  extractApartmentSeeds?(
    onProgress?: (processed: number, total: number) => void,
  ): Promise<ApartmentSeedsGrouped>;
}
