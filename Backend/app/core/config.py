from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Entorno de ejecución: development, production, etc.
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

    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()