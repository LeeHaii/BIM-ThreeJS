# Reusable multi-building BIM operations platform

This repository is the runnable foundation for the supplied architecture plan. It
already demonstrates that one browser and one API can serve two materially
different building configurations without building-name or building-ID branches in
feature code.

## Implemented vertical slice

- Strict shared TypeScript identities and runtime schemas.
- Versioned active manifests and validated zero-code onboarding packages.
- FastAPI/SQLAlchemy API with building-scoped access and field-level person policy.
- Synthetic fixtures for a residential tower and federated campus.
- Browser catalog, deterministic building switch, manifest readiness view, unit
  search, selection, and privacy-safe occupancy display.
- Abort/stale-result protection, no-store operational requests, CI, and tests.

The Fragments converter and That Open 3D adapter are deliberately next: a real IFC
and converted `.frag` fixture are required to verify them honestly.

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

Open `http://localhost:5173`. The default synthetic facility administrator can
access both buildings. To exercise scoped access, set
`VITE_DEV_ACTOR_ID=90000000-0000-4000-8000-000000000002`; that operator can access
Alpha only and receives fewer person fields.

## Verify

```powershell
pnpm verify
pnpm --filter @bim/model-pipeline validate:onboarding -- onboarding/building-alpha.json
```

See `docs/architecture/README.md` for the milestone map.
