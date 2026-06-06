from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from typing import List, Union
from pydantic import field_validator

# Explicitly load .env before pydantic reads it
load_dotenv()


class Settings(BaseSettings):
    # ── Project ───────────────────────────────────
    PROJECT_NAME: str = "ISP SLA Monitor"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True

    # ── Database ──────────────────────────────────
    # Use asyncpg driver for async SQLAlchemy
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgrespassword@localhost:5432/isp_monitor"

    # ── Redis ─────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Auth ─────────────────────────────────────
    SECRET_KEY: str = "change-me-before-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── CORS ─────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = ["*"]

    # ── SMTP Alerts ──────────────────────────────
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "alerts@example.com"

    # ── Twilio Alerts ──────────────────────────────
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_WHATSAPP_NUMBER: str = ""
    
    # ── Razorpay ──────────────────────────────────
    RAZORPAY_KEY_ID: str = "rzp_test_dummy"
    RAZORPAY_KEY_SECRET: str = "dummy_secret"

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
