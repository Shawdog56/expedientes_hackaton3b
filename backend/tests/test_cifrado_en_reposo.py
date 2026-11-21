import tempfile
import uuid
from pathlib import Path

import pytest
from sqlalchemy import text

from app.core.config import settings
from app.db.models import Documento
from app.services import expedientes as svc
from tests.test_expedientes import imagen_bytes, pdf_bytes

PDF = pdf_bytes(2)
PNG = imagen_bytes("PNG")


@pytest.fixture
def subido(client):
    files = [
        ("archivos", ("Familia Perez/Escritura Juan Perez.pdf", PDF, "application/octet-stream")),
        ("archivos", ("Familia Perez/predial.png", PNG, "application/octet-stream")),
        ("archivos", ("Familia Perez/nota.txt", b"hola", "application/octet-stream")),
    ]
    rutas = ["Familia Perez/Escritura Juan Perez.pdf", "Familia Perez/predial.png", "Familia Perez/nota.txt"]
    r = client.post("/api/expedientes", files=files, data={"rutas": rutas, "nombre": "Sucesion Perez"})
    assert r.status_code == 201
    return r.json()


def _archivos_en_disco(storage):
    return [p for p in storage.rglob("*") if p.is_file()]


def test_en_disco_todo_va_cifrado_y_sin_nombres_originales(subido, storage_temporal):
    archivos = _archivos_en_disco(storage_temporal)
    assert len(archivos) == 2
    for archivo in archivos:
        assert archivo.suffix == ".enc"
        contenido = archivo.read_bytes()
        assert not contenido.startswith(b"%PDF") and not contenido.startswith(b"\x89PNG")
    rutas = " ".join(str(p.relative_to(storage_temporal)) for p in storage_temporal.rglob("*"))
    for nombre in ("Perez", "Familia", "Escritura", "predial", "Sucesion"):
        assert nombre not in rutas


def test_nombres_y_rutas_se_guardan_cifrados_en_la_base(subido, db_session):
    with db_session() as db:
        crudo = [
            db.execute(text("SELECT nombre FROM expedientes")).scalar_one(),
            *db.execute(text("SELECT nombre FROM documentos")).scalars(),
            *db.execute(text("SELECT ruta FROM documentos")).scalars(),
            *db.execute(text("SELECT ruta FROM archivos_rechazados")).scalars(),
        ]
        assert crudo and all(valor.startswith("enc1.") for valor in crudo)
        almacenamiento = " ".join(db.execute(text("SELECT ruta_almacenamiento FROM documentos")).scalars())
        assert "Perez" not in almacenamiento and "Escritura" not in almacenamiento


def test_la_api_devuelve_los_nombres_en_claro_y_ordenados(subido, client):
    assert subido["nombre"] == "Sucesion Perez"
    rutas = [d["ruta"] for d in subido["documentos"]]
    assert rutas == sorted(rutas) == [
        "Familia Perez/Escritura Juan Perez.pdf",
        "Familia Perez/predial.png",
    ]
    assert [r["ruta"] for r in subido["rechazados"]] == ["Familia Perez/nota.txt"]
    assert client.get(f"/api/expedientes/{subido['id']}").json()["nombre"] == "Sucesion Perez"


def test_el_visor_entrega_el_contenido_exacto(subido, client):
    for doc, original, tipo in (
        (subido["documentos"][0], PDF, "application/pdf"),
        (subido["documentos"][1], PNG, "image/png"),
    ):
        r = client.get(f"/api/documentos/{doc['id']}/archivo")
        assert r.status_code == 200
        assert r.content == original
        assert r.headers["content-type"] == tipo
        assert r.headers["content-length"] == str(len(original))
        assert r.headers["content-disposition"].startswith("inline; filename*=UTF-8''")


def test_documento_en_claro_entrega_una_copia_temporal(subido, db_session):
    with db_session() as db:
        doc = db.get(Documento, uuid.UUID(subido["documentos"][0]["id"]))
        with svc.documento_en_claro(doc) as ruta:
            assert ruta.read_bytes() == PDF
            assert ruta.suffix == ".pdf"
            copia = ruta
        assert not copia.exists() and not copia.parent.exists()


def test_archivos_anteriores_al_cifrado_se_siguen_leyendo(subido, client, db_session):
    doc = subido["documentos"][0]
    with db_session() as db:
        documento = db.get(Documento, uuid.UUID(doc["id"]))
        ruta = documento.ruta_almacenamiento
        with svc.documento_en_claro(documento):
            pass
    Path(ruta).write_bytes(PDF)  # simula un archivo guardado antes de existir el cifrado
    r = client.get(f"/api/documentos/{doc['id']}/archivo")
    assert r.status_code == 200 and r.content == PDF
    with db_session() as db:
        with svc.documento_en_claro(db.get(Documento, uuid.UUID(doc["id"]))) as en_claro:
            assert en_claro == Path(ruta)


def test_un_archivo_alterado_no_se_entrega(subido, client, storage_temporal):
    doc = subido["documentos"][0]
    for archivo in _archivos_en_disco(storage_temporal):
        datos = bytearray(archivo.read_bytes())
        datos[-5] ^= 1
        archivo.write_bytes(bytes(datos))
    r = client.get(f"/api/documentos/{doc['id']}/archivo")
    assert r.status_code == 500
    assert b"%PDF" not in r.content


def test_un_archivo_copiado_a_otro_documento_no_se_abre(subido, client, db_session):
    a, b = subido["documentos"]
    with db_session() as db:
        ruta_a = db.get(Documento, uuid.UUID(a["id"])).ruta_almacenamiento
        ruta_b = db.get(Documento, uuid.UUID(b["id"])).ruta_almacenamiento
    Path(ruta_b).write_bytes(Path(ruta_a).read_bytes())
    assert client.get(f"/api/documentos/{b['id']}/archivo").status_code == 500
    assert client.get(f"/api/documentos/{a['id']}/archivo").status_code == 200


def test_sin_claves_no_se_guarda_nada(client, monkeypatch, storage_temporal):
    monkeypatch.setattr(settings, "claves_cifrado", {})
    r = client.post(
        "/api/expedientes", files=[("archivos", ("a.pdf", PDF, "application/octet-stream"))]
    )
    assert r.status_code == 503
    assert "claves de cifrado" in r.json()["detail"]
    assert list(storage_temporal.rglob("*")) == []


def test_los_archivos_en_claro_temporales_no_quedan(client, monkeypatch, tmp_path):
    temporales = tmp_path / "tmp"
    temporales.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(temporales))
    ok = client.post("/api/expedientes", files=[("archivos", ("a.pdf", PDF, "application/octet-stream"))])
    assert ok.status_code == 201
    rechazado = client.post(
        "/api/expedientes", files=[("archivos", ("b.pdf", b"no es pdf", "application/octet-stream"))]
    )
    assert rechazado.status_code == 422
    assert list(temporales.iterdir()) == []
