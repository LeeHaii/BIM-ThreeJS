# Reusable multi-building BIM operations platform

This repository is the runnable foundation for the supplied architecture plan. It
already demonstrates that one browser and one API can serve two materially
different building configurations without building-name or building-ID branches in
feature code.

## Implemented operator slice

- Strict shared TypeScript identities and runtime schemas.
- Versioned active manifests and validated zero-code onboarding packages.
- FastAPI/SQLAlchemy API with building-scoped access and field-level person policy.
- Synthetic fixtures for a residential tower and federated campus.
- Manifest-driven operator shell with left/upper panels and a canvas that resizes
  with the current mode.
- Pinned That Open/Three/web-ifc runtime, self-hosted Fragments worker/WASM, real
  `.frag` loading, GLB context loading, camera views, layer controls, and BIM
  picking/highlighting.
- Current-building routes, deterministic switching, mode-gated BIM/household
  panels, and privacy-safe occupancy tables.
- `SceneManifestV2` active-scene API with runtime compatibility, asset hashes,
  cameras, transforms, property profiles, and per-building UI configuration.
- Reproducible IFC-to-Fragments conversion using the included legal test fixture.
- Abort/stale-result protection, no-store operational requests, CI, and tests.

The bundled fixtures are development data. The banner in the operator viewer keeps
that distinction visible even though the geometry pipeline itself is real.

## Run locally

Prerequisites: Node 20.11+ with pnpm 11.19.0, Python 3.12+, and uv.

```powershell
pnpm install
pnpm backend:sync
$env:BIM_ALLOW_DEV_AUTH = 'true'
uv run --directory backend uvicorn bim_api.main:app --app-dir src --reload
```

In a second terminal:

```powershell
pnpm dev
```

Open `http://localhost:5173/viewer/11111111-1111-4111-8111-111111111111`. The default synthetic facility administrator can
access both buildings. To exercise scoped access, set
`VITE_DEV_ACTOR_ID=90000000-0000-4000-8000-000000000002`; that operator can access
Alpha only and receives fewer person fields.

This update uses `backend/bim-platform-v2.db` for local development. Any prior
`bim-platform.db` is preserved because SQLAlchemy `create_all` does not migrate an
existing SQLite schema.

## Verify

```powershell
pnpm verify
pnpm --filter @bim/model-pipeline validate:onboarding onboarding/building-alpha.json
pnpm --filter @bim/model-pipeline convert:ifc tests/fixtures/small.ifc ../frontend/public/model-assets/small.frag
```

See `docs/architecture/README.md` for the milestone map.
