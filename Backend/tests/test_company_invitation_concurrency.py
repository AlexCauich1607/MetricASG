
from sqlalchemy import text
from concurrent.futures import ThreadPoolExecutor
from threading import Event, Barrier

import pytest
from sqlalchemy.exc import OperationalError
import uuid

from sqlalchemy.orm import Session

from app.core.roles import CompanyRole, UserRole
from app.models.company_model import Company
from app.models.company_membership_model import (
    CompanyMembership,
    CompanyMembershipStatus,
)
from app.models.company_invitation_model import CompanyInvitation
from app.models.user_model import User
from app.services.company_invitation_service import (
    CompanyInvitationService,
)

from fastapi import HTTPException

def test_independent_database_connections(
    independent_db_connections,
):
    first_connection, second_connection = (
        independent_db_connections
    )

    first_pid = first_connection.execute(
        text("SELECT pg_backend_pid()")
    ).scalar_one()

    second_pid = second_connection.execute(
        text("SELECT pg_backend_pid()")
    ).scalar_one()

    assert first_pid != second_pid

    database_name = first_connection.execute(
        text("SELECT current_database()")
    ).scalar_one()

    assert database_name == "metricasg_test_db"


def test_postgresql_for_update_blocks_concurrent_transaction(
    independent_db_connections,
):
    first_connection, second_connection = (
        independent_db_connections
    )

    # La tabla temporal es independiente de las tablas de MetricASG.
    first_connection.execute(
        text(
            "CREATE TEMP TABLE invitation_lock_test "
            "(id INTEGER PRIMARY KEY)"
        )
    )
    first_connection.execute(
        text("INSERT INTO invitation_lock_test (id) VALUES (1)")
    )
    first_connection.commit()

    # Ambas conexiones necesitan acceder a la misma tabla.
    # Por eso usamos una tabla normal de pruebas creada en
    # una transacción que revertiremos al terminar.
    first_connection.execute(
        text("SELECT pg_advisory_xact_lock(987654321)")
    )

    started = Event()

    def try_concurrent_lock():
        started.set()

        second_connection.execute(
            text("SET LOCAL lock_timeout = '500ms'")
        )

        try:
            second_connection.execute(
                text("SELECT pg_advisory_xact_lock(987654321)")
            )
            return False
        except OperationalError:
            second_connection.rollback()
            return True

    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(try_concurrent_lock)

            assert started.wait(timeout=5)
            assert future.result(timeout=5) is True
    finally:
        first_connection.rollback()
        second_connection.rollback()


def test_postgresql_for_update_prevents_concurrent_row_lock(
    independent_db_connections,
):
    first_connection, second_connection = independent_db_connections

    # Una tabla temporal de PostgreSQL no es visible entre
    # conexiones. Por eso utilizamos una tabla auxiliar normal
    # con un nombre exclusivo para esta prueba.
    import uuid

    table_name = f"test_row_lock_{uuid.uuid4().hex}"

    first_connection.execute(
        text(
            f"CREATE TABLE {table_name} "
            "(id INTEGER PRIMARY KEY)"
        )
    )
    first_connection.execute(
        text(f"INSERT INTO {table_name} (id) VALUES (1)")
    )
    first_connection.commit()

    try:
        first_connection.execute(
            text(
                f"SELECT id FROM {table_name} "
                "WHERE id = 1 FOR UPDATE"
            )
        ).first()

        second_connection.execute(
            text("SET LOCAL lock_timeout = '500ms'")
        )

        with pytest.raises(OperationalError):
            second_connection.execute(
                text(
                    f"SELECT id FROM {table_name} "
                    "WHERE id = 1 FOR UPDATE"
                )
            )

        second_connection.rollback()

    finally:
        first_connection.rollback()
        second_connection.rollback()

        first_connection.execute(
            text(f"DROP TABLE IF EXISTS {table_name}")
        )
        first_connection.commit()


@pytest.fixture
def concurrent_invitation_data(independent_db_connections):
    first_connection, second_connection = independent_db_connections

    unique_id = uuid.uuid4().hex
    session = Session(bind=first_connection, expire_on_commit=False)

    company = Company(
        name=f"Concurrency Test Company {unique_id}",
        active=True,
    )

    inviter = User(
        name="Inviter",
        lastname="Test",
        company_name=company.name,
        email=f"inviter-{unique_id}@test.local",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    recipient = User(
        name="Recipient",
        lastname="Test",
        company_name="Other Company",
        email=f"recipient-{unique_id}@test.local",
        password="test-password",
        role=UserRole.USER,
        active=True,
    )

    company_id = None
    inviter_id = None
    recipient_id = None
    invitation_id = None

    try:
        session.add_all([company, inviter, recipient])
        session.flush()

        company_id = company.id
        inviter_id = inviter.id
        recipient_id = recipient.id

        session.add(
            CompanyMembership(
                company_id=company_id,
                user_id=inviter_id,
                role=CompanyRole.COMPANY_ADMIN,
                status=CompanyMembershipStatus.ACTIVE,
            )
        )
        session.commit()

        invitation, token = CompanyInvitationService().create_invitation(
            db=session,
            company_id=company_id,
            invited_by_user_id=inviter_id,
            email=recipient.email,
        )

        invitation_id = invitation.id

        # Finalizar la transacción de lectura iniciada por refresh().
        # Los datos ya fueron confirmados por create_invitation().
        session.rollback()

        yield {
            "company_id": company_id,
            "inviter_id": inviter_id,
            "recipient_id": recipient_id,
            "invitation_id": invitation_id,
            "token": token,
        }

    finally:
        session.rollback()
        second_connection.rollback()

        try:
            if company_id is not None:
                session.query(CompanyMembership).filter(
                    CompanyMembership.company_id == company_id
                ).delete(synchronize_session=False)

                session.query(CompanyInvitation).filter(
                    CompanyInvitation.company_id == company_id
                ).delete(synchronize_session=False)

            for user_id in (inviter_id, recipient_id):
                if user_id is not None:
                    user = session.get(User, user_id)
                    if user is not None:
                        session.delete(user)

            if company_id is not None:
                company_to_delete = session.get(Company, company_id)
                if company_to_delete is not None:
                    session.delete(company_to_delete)

            session.commit()

        finally:
            session.close()

def test_concurrent_invitation_data_is_visible(
    concurrent_invitation_data,
    independent_db_connections,
):
    _, second_connection = independent_db_connections

    invitation_id = concurrent_invitation_data["invitation_id"]

    result = second_connection.execute(
        text(
            "SELECT id FROM company_invitations "
            "WHERE id = :invitation_id"
        ),
        {"invitation_id": invitation_id},
    ).scalar_one()

    assert result == invitation_id


def test_concurrent_accept_invitation_only_one_succeeds(
    concurrent_invitation_data,
    independent_db_connections,
):
    first_connection, second_connection = independent_db_connections

    token = concurrent_invitation_data["token"]
    recipient_id = concurrent_invitation_data["recipient_id"]
    company_id = concurrent_invitation_data["company_id"]

    barrier = Barrier(2)

    def accept_with_connection(connection):
        db = Session(
            bind=connection,
            expire_on_commit=False,
        )

        try:
            barrier.wait(timeout=5)

            membership = CompanyInvitationService().accept_invitation(
                db=db,
                token=token,
                current_user_id=recipient_id,
            )

            return ("success", membership.id)

        except HTTPException as exc:
            return ("http_error", exc.status_code)

        finally:
            db.close()

    with ThreadPoolExecutor(max_workers=2) as executor:
        first_future = executor.submit(
            accept_with_connection,
            first_connection,
        )

        second_future = executor.submit(
            accept_with_connection,
            second_connection,
        )

        results = [
            first_future.result(timeout=15),
            second_future.result(timeout=15),
        ]

    assert sum(
        result[0] == "success"
        for result in results
    ) == 1

    assert sum(
        result == ("http_error", 409)
        for result in results
    ) == 1

    # Cerrar cualquier transacción de lectura antes de verificar.
    first_connection.rollback()
    second_connection.rollback()

    memberships = first_connection.execute(
        text(
            "SELECT id FROM company_memberships "
            "WHERE user_id = :user_id "
            "AND company_id = :company_id"
        ),
        {
            "user_id": recipient_id,
            "company_id": company_id,
        },
    ).fetchall()

    assert len(memberships) == 1

    first_connection.rollback()
