from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.controllers import controllers
from app.core.config import settings

from .database.database import Base, engine
from .database.seed import seed_database


Base.metadata.create_all(bind=engine)
seed_database()


app = FastAPI(
    title="ASG Metrics API",
    version="1.0.0",
    description=(
        "Backend de ASG Metrics con FastAPI, PostgreSQL "
        "y controladores generados dinámicamente."
    )
)


origins = [
    origin.strip()
    for origin in settings.cors_origins.split(",")
    if origin.strip()
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


for controller in controllers:
    app.include_router(controller.router)


@app.get("/")
def root():
    return {
        "status": "running",
        "api": "ASG Metrics",
        "version": "1.0.0"
    }