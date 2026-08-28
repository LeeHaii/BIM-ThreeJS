import type { HouseholdStorey } from "@bim/shared";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { ThatOpenViewerAdapter } from "../src/infrastructure/thatopen/thatopen-viewer-adapter.js";

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
