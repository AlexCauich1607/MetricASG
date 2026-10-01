import importlib
import pkgutil

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.database.database import get_db
from app.main import app


# Register SQLAlchemy models before mapper configuration
import app.models as models_package

for module_info in pkgutil.iter_modules(models_package.__path__):
    if module_info.name.endswith("_model"):
        importlib.import_module(
            f"app.models.{module_info.name}"
        )


TEST_DATABASE_URL = (
    make_url(settings.database_url)
    .set(database="metricasg_test_db")
    .render_as_string(hide_password=False)
)


engine = create_engine(
    TEST_DATABASE_URL
)

TestingSessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False
)


@pytest.fixture
def db_session():
    connection = engine.connect()
    transaction = connection.begin()

    db = TestingSessionLocal(
        bind=connection,
        join_transaction_mode="create_savepoint",
    )

    try:
        yield db
    finally:
        db.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
