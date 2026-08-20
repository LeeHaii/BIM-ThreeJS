# Model pipeline

The pipeline validates versioned, non-executable onboarding packages and performs
real IFC-to-Fragments conversion with pinned `@thatopen/fragments` and `web-ifc`
versions. The included `small.ifc` fixture and its attribution are under
`tests/fixtures`.

```powershell
pnpm --filter @bim/model-pipeline validate:onboarding onboarding/building-alpha.json
pnpm --filter @bim/model-pipeline convert:ifc tests/fixtures/small.ifc ../frontend/public/model-assets/small.frag
```

Conversion writes the `.frag` payload and a sibling JSON report containing its byte
size, SHA-256 digest, and converter/runtime versions.
