from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

class Settings(BaseSettings):
    app_env: str = Field(
        min_length=1,
        validation_alias="APP_ENV"
    )

    # Conexión principal utilizada por SQLAlchemy.
    database_url: str = Field(
        min_length=1,
        validation_alias="DATABASE_URL"
    )

    # Directorio privado para almacenar archivos de evidencias.
    evidence_storage_path: str = Field(
        default="/data/evidences",
        min_length=1,
        validation_alias="EVIDENCE_STORAGE_PATH"
    )

    reminder_timezone: str = Field(
        default="America/Merida",
        min_length=1,
        validation_alias="REMINDER_TIMEZONE",
    )

    # SMTP / Email notifications
    smtp_enabled: bool = Field(
        default=False,
        validation_alias="SMTP_ENABLED",
    )

    smtp_host: str = Field(
        default="",
        validation_alias="SMTP_HOST",
    )

    smtp_port: int = Field(
        default=587,
        ge=1,
        le=65535,
        validation_alias="SMTP_PORT",
    )

    smtp_username: str = Field(
        default="",
        validation_alias="SMTP_USERNAME",
    )

    smtp_password: str = Field(
        default="",
        validation_alias="SMTP_PASSWORD",
        repr=False,
    )

    smtp_from_email: str = Field(
        default="",
        validation_alias="SMTP_FROM_EMAIL",
    )

    smtp_use_starttls: bool = Field(
        default=True,
        validation_alias="SMTP_USE_STARTTLS",
    )

    # Configuración JWT.
    jwt_secret_key: str = Field(
        min_length=1,
        validation_alias="JWT_SECRET_KEY"
    )

    jwt_algorithm: str = Field(
        min_length=1,
        validation_alias="JWT_ALGORITHM"
    )

    # Duración de los tokens.
    access_token_expire_minutes: int = Field(
        gt=0,
        validation_alias="ACCESS_TOKEN_EXPIRE_MINUTES"
    )

    refresh_token_expire_days: int = Field(
        gt=0,
        validation_alias="REFRESH_TOKEN_EXPIRE_DAYS"
    )

    # Orígenes permitidos para CORS.
    # La conversión a lista se realizará cuando implementemos HU-005.
    cors_origins: str = Field(
        min_length=1,
        validation_alias="CORS_ORIGINS"
    )
    @field_validator("cors_origins")
    @classmethod
    def validate_cors_origins(cls, value: str) -> str:
        origins = [
            origin.strip()
            for origin in value.split(",")
            if origin.strip()
        ]

        if not origins:
            raise ValueError("CORS_ORIGINS must contain at least one origin")

        if "*" in origins:
            raise ValueError(
                "CORS_ORIGINS must not contain the wildcard origin '*'"
            )

        return value
    @model_validator(mode="after")
    def validate_environment_cors(self):
        origins = [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

        if self.app_env.lower() == "production":
            local_origins = {
                "http://localhost:4200",
                "http://127.0.0.1:4200",
            }

            if any(origin in local_origins for origin in origins):
                raise ValueError(
                    "Production CORS_ORIGINS must not contain local development origins"
                )

        return self

    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore",
    )

    @model_validator(mode="after")
    def validate_smtp_configuration(self):
        if not self.smtp_enabled:
            return self

        if not self.smtp_host.strip():
            raise ValueError(
                "SMTP_HOST is required when SMTP_ENABLED=true"
            )

        if not self.smtp_from_email.strip():
            raise ValueError(
                "SMTP_FROM_EMAIL is required when SMTP_ENABLED=true"
            )

        if bool(self.smtp_username) != bool(self.smtp_password):
            raise ValueError(
                "SMTP_USERNAME and SMTP_PASSWORD must be configured together"
            )

        return self

    @field_validator("reminder_timezone")
    @classmethod
    def validate_reminder_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as exc:
            raise ValueError(
                f"Invalid reminder timezone: {value}"
            ) from exc

        return value

settings = Settings()
