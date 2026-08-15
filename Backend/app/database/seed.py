from sqlalchemy.orm import Session
from app.database.database import SessionLocal
from app.models.ambit_model import Ambit
from app.models.maturity_level_model import MaturityLevel


def seed_database():
    db: Session = SessionLocal()

    try:
    
        ambits_data = [
            {
                "name": "Ambiental",
                "description": "",
                "letter": "A",
                "color": "#37AB48",
                "is_removable": False
            },
            {
                "name": "Social",
                "description": "",
                "letter": "S",
                "color": "#1565C0",
                "is_removable": False
            },
            {
                "name": "Gobernanza",
                "description": "",
                "letter": "G",
                "color": "#4527A0",
                "is_removable": False
            }

        ]

        for data in ambits_data:
            exists = db.query(Ambit).filter(
                Ambit.letter == data["letter"]
            ).first()

            if not exists:
                db.add(Ambit(**data))

        maturity_levels_data = [
            {
                "name": "Básico",
                "value": 6,
                "description": "",
                "min_score": 6,
                "max_score": 7.4,
                "color": "#a6074c",
                "is_removable": False
            },
            {
                "name": "Intermedio",
                "value": 8,
                "description": "",
                "min_score": 7.5,
                "max_score": 9.4,
                "color": "#13b46e",
                "is_removable": False
            },
            {
                "name": "Avanzado",
                "value": 10,
                "description": "",
                "min_score": 9.5,
                "max_score": 10,
                "color": "#0a4057",
                "is_removable": False
            }
        ]

        for data in maturity_levels_data:
            exists = db.query(MaturityLevel).filter(
                MaturityLevel.value == data["value"]
            ).first()

            if not exists:
                db.add(MaturityLevel(**data))

        db.commit()

    finally:
        db.close()
