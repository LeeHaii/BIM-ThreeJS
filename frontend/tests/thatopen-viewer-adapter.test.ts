import type {
  HouseholdStorey,
  ModelVersionId,
  SceneManifestV2,
} from "@bim/shared";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { ThatOpenViewerAdapter } from "../src/infrastructure/thatopen/thatopen-viewer-adapter.js";
import type { BimElementSummary } from "../src/modules/viewer-runtime/viewer-port.js";

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: ((value: T) => void) | undefined;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return {
    promise,
    resolve: (value) => resolve?.(value),
  };
}

function storey(code: string): HouseholdStorey {
  return {
    code,
    label: `Floor ${code}`,
    unitCount: 0,
    boundUnitCount: 0,
    units: [],
  };
}

function createHarness() {
  const setPlane = vi.fn();
  const updateClippingPlanes = vi.fn();
  const update = vi.fn().mockResolvedValue(undefined);
  const fragments = {
    core: { update },
    highlight: vi.fn().mockResolvedValue(undefined),
    resetHighlight: vi.fn().mockResolvedValue(undefined),
    list: { get: vi.fn() },
  };
  const world = {
    renderer: { setPlane, updateClippingPlanes },
    scene: { three: { add: vi.fn() } },
  };
  const adapter = new ThatOpenViewerAdapter();
  const internals = adapter as unknown as {
    fragments: typeof fragments;
    world: typeof world;
    activeStoreyCode?: string;
    activeFloorTop?: number;
    activeFloorHeight?: number;
    unitClippingPlane: THREE.Plane;
    unitClippingPlanes: THREE.Plane[];
    prepareStoreyView: (selected: HouseholdStorey) => Promise<{
      storey: HouseholdStorey;
      items: Record<string, Set<number>>;
      unitByElement: ReadonlyMap<string, never>;
      unitElements: ReadonlyMap<never, never>;
      floorTop: number;
      floorHeight: number;
    }>;
  };
  internals.fragments = fragments;
  internals.world = world;
  return {
    adapter,
    internals,
    fragments,
    setPlane,
    updateClippingPlanes,
    update,
  };
}

describe("ThatOpenViewerAdapter floor sections", () => {
  it("keeps the current plane while preparing and lets the latest floor win", async () => {
    const { adapter, internals, setPlane } = createHarness();
    const first =
      deferred<Awaited<ReturnType<typeof internals.prepareStoreyView>>>();
    const second =
      deferred<Awaited<ReturnType<typeof internals.prepareStoreyView>>>();
    internals.unitClippingPlanes = [internals.unitClippingPlane];
    internals.activeStoreyCode = "L20";
    internals.activeFloorTop = 70;
    internals.activeFloorHeight = 3.6;
    internals.prepareStoreyView = vi.fn((selected: HouseholdStorey) =>
      selected.code === "L05" ? first.promise : second.promise,
    );

    const firstSelection = adapter.showStorey(storey("L05"), 0.5);
    const secondSelection = adapter.showStorey(storey("L12"), 0.5);

    expect(setPlane).not.toHaveBeenCalledWith(
      false,
      expect.any(THREE.Plane),
      false,
    );
    second.resolve({
      storey: storey("L12"),
      items: {},
      unitByElement: new Map<string, never>(),
      unitElements: new Map<never, never>(),
      floorTop: 40,
      floorHeight: 3.6,
    });
    await secondSelection;
    first.resolve({
      storey: storey("L05"),
      items: {},
      unitByElement: new Map<string, never>(),
      unitElements: new Map<never, never>(),
      floorTop: 15,
      floorHeight: 3.6,
    });
    await firstSelection;

    expect(internals.activeStoreyCode).toBe("L12");
    expect(internals.unitClippingPlane.constant).toBeCloseTo(41.8);
    expect(setPlane).not.toHaveBeenCalledWith(
      false,
      expect.any(THREE.Plane),
      false,
    );
  });

  it("changes cut height without rebuilding the floor", async () => {
    const {
      adapter,
      internals,
      fragments,
      setPlane,
      updateClippingPlanes,
      update,
    } = createHarness();
    internals.activeStoreyCode = "L07";
    internals.activeFloorTop = 20;
    internals.activeFloorHeight = 4;
    internals.unitClippingPlanes = [internals.unitClippingPlane];

    await adapter.setStoreyCutRatio("L07", 0.2);

    expect(internals.unitClippingPlane.constant).toBeCloseTo(20.8);
    expect(updateClippingPlanes).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(setPlane).not.toHaveBeenCalled();
    expect(fragments.highlight).not.toHaveBeenCalled();
    expect(fragments.resetHighlight).not.toHaveBeenCalled();
  });
});

describe("ThatOpenViewerAdapter default camera", () => {
  it("captures the live camera pose and uses it for reset", async () => {
    const adapter = new ThatOpenViewerAdapter();
    const getPosition = vi.fn((out: THREE.Vector3) => out.set(12, 8, -4));
    const getTarget = vi.fn((out: THREE.Vector3) => out.set(1, 2, 3));
    const setLookAt = vi.fn().mockResolvedValue(undefined);
    const camera = new THREE.PerspectiveCamera(57, 1, 0.1, 1_000);
    const internals = adapter as unknown as {
      world: {
        camera: {
          three: THREE.PerspectiveCamera;
          controls: {
            getPosition: typeof getPosition;
            getTarget: typeof getTarget;
            setLookAt: typeof setLookAt;
          };
        };
      };
    };
    internals.world = {
      camera: {
        three: camera,
        controls: { getPosition, getTarget, setLookAt },
      },
    };

    const captured = adapter.getCurrentCameraPose();
    adapter.setDefaultCamera(captured);

    expect(captured).toEqual({
      position: [12, 8, -4],
      target: [1, 2, 3],
      fov: 57,
    });

    await adapter.resetCamera();

    expect(setLookAt).toHaveBeenCalledWith(12, 8, -4, 1, 2, 3, true);
  });
});

describe("ThatOpenViewerAdapter BIM structure", () => {
  it("focuses a selected catalog element using precomputed bounding box without geometry query", async () => {
    const modelVersionId =
      "32222222-2222-4222-8222-222222222222" as ModelVersionId;
    const itemData = {
      _localId: { value: 42 },
      _category: { value: "IfcWall" },
      _guid: { value: "wall-guid" },
      Name: { value: "Exterior wall" },
    };
    const model = {
      getLocalIds: vi.fn().mockResolvedValue([42]),
      getItemsData: vi.fn().mockResolvedValue([itemData]),
      getMergedBox: vi.fn(),
    };
    const fitToBox = vi.fn().mockResolvedValue([]);
    const fragments = {
      list: { get: vi.fn().mockReturnValue(model) },
      highlight: vi.fn().mockResolvedValue(undefined),
      resetHighlight: vi.fn().mockResolvedValue(undefined),
      core: { update: vi.fn().mockResolvedValue(undefined) },
    };
    const adapter = new ThatOpenViewerAdapter();
    const internals = adapter as unknown as {
      fragments: typeof fragments;
      manifest: SceneManifestV2;
      fragmentLayerIds: Set<string>;
      world: {
        camera: {
          controls: {
            fitToBox: typeof fitToBox;
            getTarget: (out: THREE.Vector3) => THREE.Vector3;
          };
        };
      };
    };
    internals.fragments = fragments;
    internals.manifest = {
      layers: [
        {
          id: "model-main",
          bim: { modelVersionId },
        },
      ],
    } as unknown as SceneManifestV2;
    internals.fragmentLayerIds.add("model-main");
    internals.world = {
      camera: {
        controls: {
          fitToBox,
          getTarget: (out) => out.set(0, 0, 0),
        },
      },
    };

    const element: BimElementSummary = {
      layerId: "model-main",
      ref: { modelVersionId, modelLocalId: 42, globalId: "wall-guid" },
      title: "Exterior wall",
      category: "IfcWall",
      box: { min: [10, 2, -5], max: [14, 6, -1] },
    };

    const selection = await adapter.selectBimElement(element);
    expect(fragments.highlight).toHaveBeenCalledWith(expect.any(Object), {
      "model-main": new Set([42]),
    });
    expect(model.getMergedBox).not.toHaveBeenCalled();
    expect(fitToBox).toHaveBeenCalledWith(
      expect.any(THREE.Box3),
      true,
      expect.objectContaining({ paddingLeft: 1.4 }),
    );
    expect(selection).toMatchObject({
      layerId: "model-main",
      title: "Exterior wall",
      category: "IfcWall",
      worldPosition: [12, 4, -3],
    });
  });
});
