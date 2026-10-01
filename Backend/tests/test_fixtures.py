from sqlalchemy import text


def test_database_fixture_is_available(db_session):
    result = db_session.execute(
        text("SELECT 1")
    ).scalar_one()

    assert result == 1


def test_client_fixture_is_available(client):
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["status"] == "running"