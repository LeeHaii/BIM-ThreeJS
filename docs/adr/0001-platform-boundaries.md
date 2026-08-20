# ADR 0001: Platform boundaries

Status: accepted

Use one repository with independently testable frontend, backend, database, model
pipeline, and shared-contract boundaries. Only public module entry points may be
imported across modules. Building-specific details are versioned data.
