import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db import models  # noqa: F401
from app.db.session import Base, get_db
from app.main import app


@pytest.fixture(autouse=True)
def storage_temporal(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "storage_dir", tmp_path)
    return tmp_path


@pytest.fixture
def db_session():
    """SQLite en memoria: rápido y aislado por prueba (los modelos son portables)."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    yield Session
    engine.dispose()


@pytest.fixture
def client(db_session):
    def _get_db():
        with db_session() as db:
            yield db

    app.dependency_overrides[get_db] = _get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
