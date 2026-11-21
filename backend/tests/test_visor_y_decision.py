import uuid

import pytest
from sqlalchemy import text

from app.core.config import settings
from tests.test_expedientes import imagen_bytes, pdf_bytes


@pytest.fixture
def expediente(client):
    """Expediente con un PDF de 2 páginas y una imagen PNG."""
    files = [
        ("archivos", ("01 Escritura.pdf", pdf_bytes(2), "application/octet-stream")),
        ("archivos", ("predial.png", imagen_bytes("PNG"), "application/octet-stream")),
    ]
    respuesta = client.post("/api/expedientes", files=files)
    assert respuesta.status_code == 201
    return respuesta.json()


def _documento(expediente, nombre):
    return next(d for d in expediente["documentos"] if d["nombre"] == nombre)


# ------------------------------------------------------------- ver el archivo


def test_ver_pdf_en_linea_con_su_tipo_de_contenido(client, expediente):
    doc = _documento(expediente, "01 Escritura.pdf")
    r = client.get(f"/api/documentos/{doc['id']}/archivo")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.headers["content-disposition"].startswith("inline")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["cache-control"] == "private, no-store"
    assert r.content.startswith(b"%PDF")


def test_ver_imagen(client, expediente):
    doc = _documento(expediente, "predial.png")
    r = client.get(f"/api/documentos/{doc['id']}/archivo")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    assert r.content.startswith(b"\x89PNG")


def test_documento_inexistente_da_404(client):
    assert client.get(f"/api/documentos/{uuid.uuid4()}/archivo").status_code == 404
    assert client.get("/api/documentos/no-es-uuid/archivo").status_code == 422


def test_archivo_borrado_del_disco_da_404(client, expediente, storage_temporal):
    doc = _documento(expediente, "01 Escritura.pdf")
    for archivo in storage_temporal.rglob("*.enc"):
        archivo.unlink()
    assert client.get(f"/api/documentos/{doc['id']}/archivo").status_code == 404


def test_no_sirve_archivos_fuera_del_volumen(client, expediente, db_session, tmp_path_factory):
    """Si la ruta guardada apuntara fuera del volumen (p. ej. por una fila alterada), no se sirve."""
    secreto = tmp_path_factory.mktemp("fuera") / "secreto.pdf"
    secreto.write_bytes(pdf_bytes())
    doc = _documento(expediente, "01 Escritura.pdf")
    with db_session() as db:
        db.execute(
            text("UPDATE documentos SET ruta_almacenamiento = :ruta WHERE id = :id"),
            {"ruta": str(secreto), "id": uuid.UUID(doc["id"]).hex},
        )
        db.commit()
    assert client.get(f"/api/documentos/{doc['id']}/archivo").status_code == 404


def test_ruta_con_traversal_no_sale_del_volumen(client, expediente, db_session):
    doc = _documento(expediente, "01 Escritura.pdf")
    with db_session() as db:
        db.execute(
            text("UPDATE documentos SET ruta_almacenamiento = :ruta WHERE id = :id"),
            {"ruta": str(settings.storage_dir / ".." / ".." / "etc" / "passwd"), "id": uuid.UUID(doc["id"]).hex},
        )
        db.commit()
    assert client.get(f"/api/documentos/{doc['id']}/archivo").status_code == 404


# ------------------------------------------------------------- decisión final


def test_un_expediente_nuevo_no_tiene_decision(expediente):
    assert expediente["decision_final"] is None
    assert expediente["decidido_en"] is None
    assert expediente["decidido_por"] is None


def test_aceptar_expediente(client, expediente):
    r = client.put(f"/api/expedientes/{expediente['id']}/decision", json={"decision": "aceptado"})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["decision_final"] == "aceptado"
    assert cuerpo["decidido_en"] is not None
    assert cuerpo["decidido_por"] is None
    # La decisión persiste y no altera el estado del flujo de los agentes.
    leido = client.get(f"/api/expedientes/{expediente['id']}").json()
    assert leido["decision_final"] == "aceptado"
    assert leido["estado"] == expediente["estado"]


def test_la_ultima_decision_reemplaza_a_la_anterior(client, expediente):
    url = f"/api/expedientes/{expediente['id']}/decision"
    client.put(url, json={"decision": "aceptado"})
    r = client.put(url, json={"decision": "rechazado"})
    assert r.json()["decision_final"] == "rechazado"


def test_decision_invalida_o_expediente_inexistente(client, expediente):
    url = f"/api/expedientes/{expediente['id']}/decision"
    assert client.put(url, json={"decision": "quizas"}).status_code == 422
    assert client.put(url, json={}).status_code == 422
    r = client.put(f"/api/expedientes/{uuid.uuid4()}/decision", json={"decision": "aceptado"})
    assert r.status_code == 404
