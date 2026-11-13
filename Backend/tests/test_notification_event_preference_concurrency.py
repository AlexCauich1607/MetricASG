import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.notification_event_preference_model import (
    NotificationEventPreference,
)
from app.models.user_model import User


EVENT_TYPE = "IMPROVEMENT_ACTION_DUE"


def test_concurrent_event_preference_upsert(
    independent_db_connections,
):
    first_connection, second_connection = independent_db_connections

    unique_id = uuid.uuid4().hex
    user_id = None

    setup_session = Session(
        bind=first_connection,
        expire_on_commit=False,
    )

    try:
        user = User(
            name="Concurrent Preference Test",
            company_name="Test Company",
            email=f"concurrent-preference-{unique_id}@test.local",
            password="test-password-hash",
        )

        setup_session.add(user)
        setup_session.commit()

        user_id = user.id

        # End any transaction started by reading the user ID.
        setup_session.rollback()

        barrier = Barrier(2)

        def upsert_preference(connection, enabled):
            session = Session(
                bind=connection,
                expire_on_commit=False,
            )

            try:
                statement = insert(
                    NotificationEventPreference
                ).values(
                    user_id=user_id,
                    event_type=EVENT_TYPE,
                    in_app_enabled=enabled,
                    email_enabled=True,
                )

                statement = statement.on_conflict_do_update(
                    constraint=(
                        "uq_notification_event_preference_user_event"
                    ),
                    set_={
                        "in_app_enabled": (
                            statement.excluded.in_app_enabled
                        ),
                        "email_enabled": (
                            statement.excluded.email_enabled
                        ),
                        "updated_at": func.now(),
                    },
                )

                barrier.wait(timeout=5)

                session.execute(statement)
                session.commit()

                return True

            finally:
                session.close()

        with ThreadPoolExecutor(max_workers=2) as executor:
            first_future = executor.submit(
                upsert_preference,
                first_connection,
                False,
            )

            second_future = executor.submit(
                upsert_preference,
                second_connection,
                True,
            )

            results = [
                first_future.result(timeout=15),
                second_future.result(timeout=15),
            ]

        assert results == [True, True]

        first_connection.rollback()
        second_connection.rollback()

        preferences = first_connection.execute(
            select(NotificationEventPreference).where(
                NotificationEventPreference.user_id == user_id,
                NotificationEventPreference.event_type == EVENT_TYPE,
            )
        ).fetchall()

        assert len(preferences) == 1

    finally:
        first_connection.rollback()
        second_connection.rollback()

        if user_id is not None:
            setup_session.query(
                NotificationEventPreference
            ).filter(
                NotificationEventPreference.user_id == user_id
            ).delete(synchronize_session=False)

            user = setup_session.get(User, user_id)

            if user is not None:
                setup_session.delete(user)

            setup_session.commit()

        setup_session.close()
