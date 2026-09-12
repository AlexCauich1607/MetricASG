from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

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

settings = Settings()