# Apartment floor index

The household viewer does not search the IFC model when an operator opens the
panel. Apartment-to-geometry relationships are extracted once, stored in the
database, and returned as a small floor index.

## Data flow

1. The model pipeline examines only `IFCSPACE`, `IFCSLAB`, and
   `IFCBUILDINGELEMENTPROXY` candidates. It reads property relations once and
   looks for apartment, floor, and area aliases such as `Apartment`,
   `LivingFloor`, and `NetArea`.
2. IFC conversion writes both the Fragments model and a versioned
   `<model>.frag.unit-bindings.json` sidecar. Each binding contains the
   apartment code, normalized storey code, IFC Express ID, Global ID, category,
   and optional area.
3. Import matches the apartment code to the building's `units` row and stores
   the Express ID in an active, model-version-specific binding set.
4. `GET /api/v1/buildings/{buildingId}/households` returns active apartments
   grouped by floor with their model-local IDs. Selecting a floor therefore
   resolves only its apartments (normally a handful of IDs), not every model
   element.
5. The viewer applies a horizontal clipping plane at either 20% or 50% of the
   measured floor height, reconstructs translucent apartment slab overlays from
   those IDs, and raycasts the overlays for apartment selection.

Binding sets are immutable snapshots for a model version. A new import retires
the previous active set, so stale IDs are not mixed with a replacement model.

## IFC authoring convention

Put the apartment metadata on an `IfcSpace`, `IfcSlab`, or
`IfcBuildingElementProxy` that has geometry. Recommended property names are:

- `Apartment`: the exact unit code stored in the application database, such as
  `P701`.
- `LivingFloor`: a floor number or name, such as `7`, `Level 07`, or `B2`.
- `Area`, `NetArea`, or `GrossArea`: optional numeric area.

The extractor also accepts common aliases defined in
`model-pipeline/src/services/ifc-unit-binding-service.ts`. Apartment codes are
matched case-insensitively. Floors are normalized to values such as `L07` and
`B02`.

## Generate and import

Normal IFC conversion creates the sidecar automatically:

```powershell
pnpm --filter @bim/model-pipeline convert:ifc input.ifc output.frag
```

For a Fragments model that was converted previously, generate only the index:

```powershell
pnpm --filter @bim/model-pipeline extract:unit-bindings input.ifc unit-bindings.json
```

Review `warnings`, `storeys`, and `bindings` in the JSON before import. With a
facility-administrator development session, import it into the active model:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:8000/api/v1/admin/buildings/<building-id>/models/active/unit-bindings" `
  -ContentType "application/json" `
  -InFile unit-bindings.json
```

The response reports matched units, total bindings, coverage, and unmatched
apartment codes. Uploading an IFC through the Admin model endpoint performs the
conversion and sidecar import together.

## Runtime complexity

The expensive IFC property traversal is an offline conversion/import step. At
runtime the API performs indexed database lookups, and a selected floor loads
geometry only for the IDs in that floor. The manual development seed extractor
remains available for diagnostics but is not part of the production viewer
path.
