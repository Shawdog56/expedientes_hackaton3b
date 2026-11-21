import base64

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


@pytest.fixture(autouse=True)
def claves_de_prueba(monkeypatch):
    """Claves fijas solo para pruebas; nunca se usan fuera de pytest."""
    monkeypatch.setattr(settings, "claves_cifrado", {"v1": base64.b64encode(b"1" * 32).decode()})
    monkeypatch.setattr(settings, "clave_cifrado_activa", "v1")
    monkeypatch.setattr(settings, "clave_indice", base64.b64encode(b"i" * 32).decode())
    monkeypatch.setattr(settings, "pepper_password", base64.b64encode(b"p" * 32).decode())
    monkeypatch.setattr(settings, "auth_requerida", False)


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
