# Frontend

Vanilla TypeScript/Vite operator viewer over a pure reducer, an explicit application
coordinator, and a disposable viewer-session adapter. It provides current-building
routes, deterministic switching, real Fragments/GLB layers, camera and layer
controls, BIM picking, and mode-gated household data.

`pnpm runtime:assets` verifies the exact dependency versions and copies the matching
Fragments worker and web-ifc WASM into `public`. Both scene fixtures are hash- and
size-verified before loading. Operational records remain explicitly synthetic.
