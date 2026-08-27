import type { CameraPose } from "@bim/shared";
import type { AppStore } from "../../app/app-store.js";
import { ThatOpenViewerAdapter } from "../../infrastructure/thatopen/thatopen-viewer-adapter.js";
import type { ApartmentSeedsGrouped } from "./viewer-port.js";

function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return error instanceof Error ? error.message : "Viewer session failed";
}

export class ViewerSessionController {
  private adapter: ThatOpenViewerAdapter | undefined;
  private loadController: AbortController | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private unsubscribe: (() => void) | undefined;
  private sceneVersionId: string | undefined;

  public constructor(
    private readonly store: AppStore,
    private readonly container: HTMLElement,
  ) {}

  public start(): void {
    this.resizeObserver = new ResizeObserver(() => this.adapter?.resize());
    this.resizeObserver.observe(this.container);
    this.unsubscribe = this.store.subscribe(() => void this.openCurrentScene());
    void this.openCurrentScene();
  }

  private async openCurrentScene(): Promise<void> {
    const state = this.store.getState();
    const manifest = state.model.manifest;
    if (
      manifest === undefined ||
      manifest.sceneVersionId === this.sceneVersionId
    )
      return;
    this.sceneVersionId = manifest.sceneVersionId;
    this.loadController?.abort();
    await this.adapter?.dispose();
    this.container.replaceChildren();
    const adapter = new ThatOpenViewerAdapter();
    const controller = new AbortController();
    this.adapter = adapter;
    this.loadController = controller;
    const generation = state.generation;
    const totalBytes = manifest.layers.reduce(
      (sum, layer) => sum + layer.byteSize,
      0,
    );
    this.store.dispatch({ type: "VIEWER_LOADING", generation, totalBytes });
    try {
      await adapter.initialize(this.container, manifest);
      const layers = await adapter.loadScene(
        manifest,
        controller.signal,
        (loadedBytes, currentTotal, layer) => {
          this.store.dispatch({
            type: "VIEWER_PROGRESS",
            generation,
            loadedBytes,
            totalBytes: currentTotal,
            layer,
          });
        },
      );
      this.store.dispatch({ type: "VIEWER_READY", generation, layers });
      adapter.resize();
    } catch (error: unknown) {
      const message = errorMessage(error);
      if (message.length > 0)
        this.store.dispatch({ type: "VIEWER_FAILED", generation, message });
    }
  }

  public async setMode(mode: "overview" | "bim" | "units"): Promise<void> {
    if (mode !== "bim") {
      await this.adapter?.clearSelection();
      await this.adapter?.clearHover();
      this.adapter?.setEnvironmentOpacity(1.0);
    } else {
      this.adapter?.setEnvironmentOpacity(0.10);
      this.store.dispatch({ type: "SET_ENVIRONMENT_OPACITY", opacity: 0.10 });
    }
    this.store.dispatch({ type: "ENTER_MODE", mode });
  }

  public async hoverAt(clientX: number, clientY: number): Promise<void> {
    const state = this.store.getState();
    if (state.mode !== "bim" || state.viewer.status !== "ready") return;
    await this.adapter?.hover(clientX, clientY);
  }

  public async clearHover(): Promise<void> {
    await this.adapter?.clearHover();
  }

  public setEnvironmentOpacity(opacity: number): void {
    this.adapter?.setEnvironmentOpacity(opacity);
    this.store.dispatch({ type: "SET_ENVIRONMENT_OPACITY", opacity });
  }

  public async selectAt(clientX: number, clientY: number): Promise<void> {
    const state = this.store.getState();
    if (state.mode !== "bim" || state.viewer.status !== "ready") return;
    this.store.dispatch({
      type: "BIM_ELEMENT_LOADING",
      generation: state.generation,
    });
    try {
      const selection = await this.adapter?.pick(clientX, clientY);
      if (selection === undefined) {
        await this.adapter?.clearSelection();
        this.store.dispatch({ type: "CLEAR_BIM_SELECTION" });
        return;
      }
      this.store.dispatch({
        type: "SELECT_BIM_ELEMENT",
        generation: state.generation,
        selection,
      });
    } catch {
      await this.adapter?.clearSelection();
      this.store.dispatch({ type: "CLEAR_BIM_SELECTION" });
    }
  }

  public resetCamera(): Promise<void> {
    return this.adapter?.resetCamera() ?? Promise.resolve();
  }

  public setCamera(pose: CameraPose): Promise<void> {
    return this.adapter?.setCamera(pose) ?? Promise.resolve();
  }

  public async setLayerVisibility(
    layerId: string,
    visible: boolean,
  ): Promise<void> {
    await this.adapter?.setLayerVisibility(layerId, visible);
    this.store.dispatch({ type: "SET_LAYER_VISIBILITY", layerId, visible });
  }

  public setTouchNavigation(mode: "orbit" | "vertical"): void {
    this.adapter?.setTouchNavigation(mode);
    this.store.dispatch({ type: "SET_TOUCH_NAVIGATION", mode });
  }

  public async extractApartmentSeeds(
    onProgress?: (processed: number, total: number) => void,
  ): Promise<ApartmentSeedsGrouped> {
    if (this.adapter === undefined) return {};
    return this.adapter.extractApartmentSeeds(onProgress);
  }

  public resize(): void {
    this.adapter?.resize();
  }

  public async dispose(): Promise<void> {
    this.unsubscribe?.();
    this.resizeObserver?.disconnect();
    this.loadController?.abort();
    await this.adapter?.clearHover();
    await this.adapter?.dispose();
    this.container.replaceChildren();
  }
}
