# Database

This boundary owns schema evolution, verification, and synthetic fixtures. The
foundation runtime uses SQLAlchemy metadata against SQLite; production remains
targeted at PostgreSQL and is not approved until Alembic migration parity and
backup/restore verification are added.

The synthetic fixture deliberately contains two buildings with different model
layer counts, storey/unit shapes, feature flags, camera poses, locales, and binding
conventions. No real person data belongs in this directory.
