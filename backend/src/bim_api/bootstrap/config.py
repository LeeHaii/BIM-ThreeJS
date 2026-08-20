from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BIM_", env_file=".env", extra="ignore")

    environment: str = "development"
    database_url: str = "sqlite:///./bim-platform-v2.db"
    allow_dev_auth: bool = False
    seed_synthetic_data: bool = True
    seed_path: Path = (
        Path(__file__).resolve().parents[4] / "database" / "seeds" / "synthetic" / "platform.json"
    )
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)

    @model_validator(mode="after")
    def prohibit_dev_auth_in_production(self) -> "Settings":
        if self.environment == "production" and self.allow_dev_auth:
            raise ValueError("Development header authentication cannot run in production")
        return self
