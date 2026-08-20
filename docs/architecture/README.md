# Architecture

This repository is a modular monorepo with four runtime/deployment boundaries:

- `frontend`: browser presentation and session coordination.
- `backend`: FastAPI application services and infrastructure adapters.
- `database`: migration, verification, and synthetic data ownership.
- `model-pipeline`: immutable model onboarding and conversion workflow.
- `shared`: environment-neutral TypeScript values and transport schemas.

Dependencies point inward. Domain code does not import HTTP, SQL, Three.js, That
Open, Fragments, storage, or identity-provider types. Building differences enter
the platform through records, manifests, profiles, bindings, and onboarding files.

## Delivery milestones

1. Platform foundation and multi-building operational vertical slice (current).
2. PostgreSQL migration parity and transactional model activation.
3. IFC inspection/conversion/binding with representative fixtures.
4. That Open fragment viewer, BIM inspection, and lifecycle tests.
5. Publication, E2E, performance, security, and production delivery gates.
