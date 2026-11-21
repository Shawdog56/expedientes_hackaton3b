from pathlib import Path

import pytest

from app.api.routes import expedientes as rutas
from tests.test_expedientes import pdf_bytes

PDF = pdf_bytes(1)


class ServicioFalso:
    """Reemplaza al servicio con agentes (OCR y LLM): solo registra lo que le llega."""

    entregados: list[tuple[str, Path, bytes]] = []

    async def auditar_archivos(self, archivos, anio_referencia=None):
        for nombre, ruta in archivos:
            ServicioFalso.entregados.append((nombre, ruta, Path(ruta).read_bytes()))
        return {"veredicto": "Cumple", "documentos": [nombre for nombre, _ in archivos]}


@pytest.fixture
def servicio_falso(monkeypatch):
    ServicioFalso.entregados = []
    monkeypatch.setattr(rutas, "ExpedienteService", ServicioFalso)
    return ServicioFalso


def _subir(client):
    r = client.post(
        "/api/expedientes",
        files=[("archivos", ("Escrituras.pdf", PDF, "application/octet-stream"))],
    )
    assert r.status_code == 201
    return r.json()["id"]


def test_auditar_un_expediente_guardado_entrega_los_archivos_en_claro(client, servicio_falso):
    exp_id = _subir(client)
    r = client.post(f"/api/expedientes/{exp_id}/auditar")
    assert r.status_code == 200
    assert r.json()["documentos"] == ["Escrituras.pdf"]
    [(nombre, ruta, contenido)] = servicio_falso.entregados
    assert nombre == "Escrituras.pdf"
    assert contenido == PDF  # el agente recibió el PDF original, no los bytes cifrados


def test_la_copia_en_claro_se_borra_al_terminar(client, servicio_falso):
    exp_id = _subir(client)
    client.post(f"/api/expedientes/{exp_id}/auditar")
    [(_, ruta, _)] = servicio_falso.entregados
    assert not Path(ruta).exists() and not Path(ruta).parent.exists()


def test_un_archivo_alterado_no_se_audita(client, servicio_falso, storage_temporal):
    exp_id = _subir(client)
    for archivo in storage_temporal.rglob("*.enc"):
        datos = bytearray(archivo.read_bytes())
        datos[-5] ^= 1
        archivo.write_bytes(bytes(datos))
    r = client.post(f"/api/expedientes/{exp_id}/auditar")
    assert r.status_code == 500
    assert servicio_falso.entregados == []


def test_expediente_inexistente_o_sin_archivos(client, servicio_falso, storage_temporal):
    import uuid

    assert client.post(f"/api/expedientes/{uuid.uuid4()}/auditar").status_code == 404
    exp_id = _subir(client)
    for archivo in storage_temporal.rglob("*.enc"):
        archivo.unlink()
    assert client.post(f"/api/expedientes/{exp_id}/auditar").status_code == 422
