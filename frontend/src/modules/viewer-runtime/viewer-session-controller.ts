import type { CameraPose, HouseholdStorey, UnitId } from "@bim/shared";
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
    if (mode !== "units") await this.adapter?.clearStoreyView();
    if (mode === "overview") {
      await this.adapter?.clearSelection();
      await this.adapter?.clearHover();
      this.adapter?.setEnvironmentOpacity(1.0);
      this.store.dispatch({ type: "SET_ENVIRONMENT_OPACITY", opacity: 1.0 });
    } else if (mode === "bim") {
      this.adapter?.setEnvironmentOpacity(0.10);
      this.store.dispatch({ type: "SET_ENVIRONMENT_OPACITY", opacity: 0.10 });
    } else {
      await this.adapter?.clearSelection();
      await this.adapter?.clearHover();
      this.adapter?.setEnvironmentOpacity(0.25);
      this.store.dispatch({ type: "SET_ENVIRONMENT_OPACITY", opacity: 0.25 });
    }
    this.store.dispatch({ type: "ENTER_MODE", mode });
  }

  public async hoverAt(clientX: number, clientY: number): Promise<void> {
    const state = this.store.getState();
    if (state.viewer.status !== "ready") return;
    if (state.mode === "bim") await this.adapter?.hover(clientX, clientY);
    if (state.mode === "units") await this.adapter?.hoverUnit(clientX, clientY);
  }

  public async clearHover(): Promise<void> {
    await this.adapter?.clearHover();
  }

  public setEnvironmentOpacity(opacity: number): void {
    this.adapter?.setEnvironmentOpacity(opacity);
    this.store.dispatch({ type: "SET_ENVIRONMENT_OPACITY", opacity });
  }

  public async selectAt(
    clientX: number,
    clientY: number,
  ): Promise<UnitId | undefined> {
    const state = this.store.getState();
    if (state.viewer.status !== "ready") return undefined;
    if (state.mode === "units") {
      return this.adapter?.pickUnit(clientX, clientY);
    }
    if (state.mode !== "bim") return undefined;
    this.store.dispatch({
      type: "BIM_ELEMENT_LOADING",
      generation: state.generation,
    });
    try {
      const selection = await this.adapter?.pick(clientX, clientY);
      if (selection === undefined) {
        await this.adapter?.clearSelection();
        this.store.dispatch({ type: "CLEAR_BIM_SELECTION" });
        return undefined;
      }
      this.store.dispatch({
        type: "SELECT_BIM_ELEMENT",
        generation: state.generation,
        selection,
      });
      return undefined;
    } catch {
      await this.adapter?.clearSelection();
      this.store.dispatch({ type: "CLEAR_BIM_SELECTION" });
      return undefined;
    }
  }

  public async showStorey(
    storey: HouseholdStorey,
    cutRatio: 0.2 | 0.5,
  ): Promise<void> {
    const state = this.store.getState();
    if (state.mode !== "units" || state.viewer.status !== "ready") return;
    this.store.dispatch({
      type: "SELECT_STOREY",
      generation: state.generation,
      storeyCode: storey.code,
    });
    const storeyIndex = state.units.storeys.findIndex(
      (candidate) => candidate.code === storey.code,
    );
    const adjacentStorey =
      state.units.storeys[storeyIndex + 1] ??
      state.units.storeys[storeyIndex - 1];
    await this.adapter?.showStorey(storey, cutRatio, adjacentStorey);
  }

  public async setUnitCutRatio(cutRatio: 0.2 | 0.5): Promise<void> {
    this.store.dispatch({ type: "SET_UNIT_CUT_RATIO", cutRatio });
    const state = this.store.getState();
    const storey = state.units.storeys.find(
      (candidate) => candidate.code === state.units.selectedStoreyCode,
    );
    if (storey !== undefined) {
      const storeyIndex = state.units.storeys.findIndex(
        (candidate) => candidate.code === storey.code,
      );
      const adjacentStorey =
        state.units.storeys[storeyIndex + 1] ??
        state.units.storeys[storeyIndex - 1];
      await this.adapter?.showStorey(storey, cutRatio, adjacentStorey);
    }
  }

  public selectUnitVisual(unitId: UnitId): Promise<void> {
    return this.adapter?.selectUnitVisual(unitId) ?? Promise.resolve();
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
