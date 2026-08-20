# Model pipeline

The first pipeline slice validates versioned, non-executable onboarding packages.
It intentionally does not pretend to convert IFC without a representative IFC
fixture. Conversion, binding, fragment verification, publication, and rollback are
the next pipeline milestone.

```powershell
pnpm --filter @bim/model-pipeline validate:onboarding -- onboarding/building-alpha.json
```
