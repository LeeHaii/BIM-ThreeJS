# Backend

FastAPI application with explicit SQLAlchemy repositories and centralized,
building-scoped authorization. SQLite is the development baseline only; the data
model and queries are kept portable for PostgreSQL.

```powershell
uv sync --dev
$env:BIM_ALLOW_DEV_AUTH = 'true'
uv run uvicorn bim_api.main:app --app-dir src --reload
uv run pytest
```

Development authentication accepts `X-Actor-Id` only when
`BIM_ALLOW_DEV_AUTH=true`. Production startup refuses that setting.

The correction-plan schema uses the versioned development database
`bim-platform-v2.db`. The previous `bim-platform.db` is left untouched; production
installations should apply an equivalent managed migration rather than relying on
SQLite `create_all`.
