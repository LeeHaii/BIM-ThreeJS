import { buildingIdSchema, type BuildingId } from "@bim/shared";
import { AppCoordinator } from "./app/app-coordinator.js";
import { initialState } from "./app/app-state.js";
import { createAppStore } from "./app/app-store.js";
import { ApiClient } from "./infrastructure/api/api-client.js";
import { renderAdminConsole } from "./modules/admin-console/render-admin-console.js";
import { renderOperatorShell } from "./modules/operator-shell/render-operator-shell.js";
import "./ui/styles.css";

interface RouteResult {
  readonly mode: "admin" | "viewer";
  readonly buildingId?: BuildingId;
}

function parseRoute(): RouteResult {
  const pathname = window.location.pathname;
  if (pathname.startsWith("/admin")) {
    const match = /^\/admin(?:\/([^/]+))?\/?$/.exec(pathname);
    const buildingIdRaw = match?.[1];
    const parsed = buildingIdRaw
      ? buildingIdSchema.safeParse(buildingIdRaw)
      : undefined;
    return parsed?.success
      ? { mode: "admin", buildingId: parsed.data }
      : { mode: "admin" };
  }

  const match = /^\/viewer\/([^/]+)\/?$/.exec(pathname);
  if (match?.[1] !== undefined) {
    const parsed = buildingIdSchema.safeParse(match[1]);
    if (parsed.success) {
      return { mode: "viewer", buildingId: parsed.data };
    }
  }

  return { mode: "viewer" };
}

const rootElement = document.querySelector<HTMLElement>("#app");
if (rootElement === null) throw new Error("Application root is missing");
const appRoot: HTMLElement = rootElement;

const actorId =
  import.meta.env.VITE_DEV_ACTOR_ID ?? "90000000-0000-4000-8000-000000000001";
const api = new ApiClient(
  import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  actorId,
);

let currentDisposer: (() => void | Promise<void>) | null = null;
let currentCoordinator: AppCoordinator | null = null;

function mountRoute(): void {
  if (currentDisposer !== null) {
    void currentDisposer();
    currentDisposer = null;
  }
  if (currentCoordinator !== null) {
    currentCoordinator.dispose();
    currentCoordinator = null;
  }

  const route = parseRoute();
  if (route.mode === "admin") {
    currentDisposer = renderAdminConsole(appRoot, api, route.buildingId);
  } else {
    const store = createAppStore(initialState);
    const coordinator = new AppCoordinator(store, api);
    currentCoordinator = coordinator;
    currentDisposer = renderOperatorShell(appRoot, store, coordinator);

    void coordinator.start(route.buildingId).catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Application startup failed";
      store.dispatch({
        type: "BUILDING_FAILED",
        generation: store.getState().generation,
        message,
      });
    });
  }
}

mountRoute();

window.addEventListener("popstate", () => {
  mountRoute();
});

window.addEventListener(
  "pagehide",
  () => {
    if (currentCoordinator !== null) currentCoordinator.dispose();
    if (currentDisposer !== null) void currentDisposer();
  },
  { once: true },
);
