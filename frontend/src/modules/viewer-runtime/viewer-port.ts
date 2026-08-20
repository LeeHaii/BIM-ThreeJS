import type {
  CameraPose,
  ElementRef,
  PropertyEntry,
  SceneManifestV2,
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
  readonly worldPosition: readonly [number, number, number];
  readonly properties: readonly PropertyEntry[];
}

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
  setLayerVisibility(layerId: string, visible: boolean): Promise<void>;
  setCamera(pose: CameraPose, animate?: boolean): Promise<void>;
  resetCamera(): Promise<void>;
  setTouchNavigation(mode: "orbit" | "vertical"): void;
  resize(): void;
  dispose(): Promise<void>;
}
