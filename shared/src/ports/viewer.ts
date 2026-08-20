import type { CameraPose, ElementRef, FragmentLayer } from "../domain/types.js";

export interface ViewerTarget {
  readonly modelVersionId: string;
  readonly localIds: readonly number[];
}

export interface ViewerLayerHandle {
  readonly id: string;
  dispose(): Promise<void>;
}

export interface ViewerPort {
  initialize(container: HTMLElement): Promise<void>;
  loadFragmentLayer(
    layer: FragmentLayer,
    bytes: ArrayBuffer,
    signal: AbortSignal,
  ): Promise<ViewerLayerHandle>;
  pick(pointer: {
    readonly x: number;
    readonly y: number;
  }): Promise<ElementRef | undefined>;
  setVisibility(
    targets: readonly ViewerTarget[],
    visible: boolean,
  ): Promise<void>;
  fitTo(targets: readonly ViewerTarget[]): Promise<void>;
  setCamera(pose: CameraPose): Promise<void>;
  resize(): void;
  dispose(): Promise<void>;
}
