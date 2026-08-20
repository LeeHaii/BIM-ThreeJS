import { AppCoordinator } from "./app/app-coordinator.js";
import { initialState } from "./app/app-state.js";
import { createAppStore } from "./app/app-store.js";
import { ApiClient } from "./infrastructure/api/api-client.js";
import { renderApp } from "./ui/render-app.js";
import "./ui/styles.css";

const root = document.querySelector<HTMLElement>("#app");
if (root === null) throw new Error("Application root is missing");

const actorId =
  import.meta.env.VITE_DEV_ACTOR_ID ?? "90000000-0000-4000-8000-000000000001";
const api = new ApiClient(
  import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
  actorId,
);
const store = createAppStore(initialState);
const coordinator = new AppCoordinator(store, api);
const disposeUi = renderApp(root, store, coordinator);

void coordinator.start().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "Application startup failed";
  store.dispatch({
    type: "BUILDING_FAILED",
    generation: store.getState().generation,
    message,
  });
});

window.addEventListener(
  "pagehide",
  () => {
    coordinator.dispose();
    disposeUi();
  },
  { once: true },
);
