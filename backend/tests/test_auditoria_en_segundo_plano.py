"""Auditoría en segundo plano: se inicia, se consulta el progreso y se obtiene el resultado.

El OCR y el modelo se reemplazan por un servicio falso: las pruebas no necesitan Ollama ni PaddleOCR.
"""

import asyncio
import time
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import auditorias
from tests.test_expedientes import pdf_bytes


class ServicioFalso:
    rutas_vistas: list[Path] = []
    falla: BaseException | None = None
    pausa = 0.02
    fases_vistas: list[dict] = []  # instantáneas del estado tomadas desde la API durante la auditoría

    async def auditar_archivos(self, archivos, anio_referencia=None, al_avanzar=None):
        total = len(archivos)
        for indice, (nombre, ruta) in enumerate(archivos):
            for fase in ("leyendo", "esperando_modelo", "analizando"):
                al_avanzar({"documentos_total": total, "etapa": "extraer", "documentos_listos": indice,
                            "documento_fase": (indice, fase)})
                await asyncio.sleep(ServicioFalso.pausa)
            assert Path(ruta).read_bytes().startswith(b"%PDF")  # copia descifrada, no el .enc
            ServicioFalso.rutas_vistas.append(Path(ruta))
            if ServicioFalso.falla is not None:
                raise ServicioFalso.falla
            al_avanzar({"documentos_total": total, "etapa": "extraer", "documentos_listos": indice + 1,
                        "documento_fase": (indice, "listo")})
        al_avanzar({"documentos_total": total, "etapa": "validacion_cruzada", "documentos_listos": total})
        return {
            "veredicto": "Requiere Revisión",
            "confianza_veredicto": 70,
            "documentos": [{"archivo": nombre, "clase": "predial"} for nombre, _ in archivos],
        }


@pytest.fixture
def api(client, monkeypatch):
    """Cliente con un bucle de eventos persistente, para que la tarea en segundo plano siga viva."""
    ServicioFalso.rutas_vistas = []
    ServicioFalso.pausa = 0.02
    ServicioFalso.falla = None
    monkeypatch.setattr(auditorias, "ExpedienteService", ServicioFalso)
    auditorias._auditorias.clear()
    with TestClient(app) as persistente:
        yield persistente
    auditorias._auditorias.clear()


def _subir(api, nombres=("Escrituras.pdf", "Predial.pdf")):
    r = api.post(
        "/api/expedientes",
        files=[("archivos", (n, pdf_bytes(), "application/octet-stream")) for n in nombres],
    )
    assert r.status_code == 201
    return r.json()


def _esperar(api, exp_id, segundos=5.0):
    limite = time.monotonic() + segundos
    while time.monotonic() < limite:
        estado = api.get(f"/api/expedientes/{exp_id}/auditoria").json()
        if estado["estado"] != "en_proceso":
            return estado
        time.sleep(0.02)
    raise AssertionError("la auditoría no terminó")


def test_iniciar_consultar_y_obtener_resultado(api):
    expediente = _subir(api)
    r = api.post(f"/api/expedientes/{expediente['id']}/auditoria")
    assert r.status_code == 202
    assert r.json()["estado"] == "en_proceso"
    assert r.json()["documentos_total"] == 2

    final = _esperar(api, expediente["id"])
    assert final["estado"] == "completada"
    assert final["etapa"] == "dictamen"
    assert final["documentos_listos"] == 2
    assert final["resultado"]["veredicto"] == "Requiere Revisión"
    ids = {d["id"] for d in expediente["documentos"]}
    assert {d["documento_id"] for d in final["resultado"]["documentos"]} == ids


def test_las_copias_en_claro_se_borran_al_terminar(api):
    expediente = _subir(api)
    api.post(f"/api/expedientes/{expediente['id']}/auditoria")
    _esperar(api, expediente["id"])
    assert ServicioFalso.rutas_vistas and not any(r.exists() for r in ServicioFalso.rutas_vistas)


def test_una_segunda_peticion_devuelve_la_auditoria_en_curso(api):
    expediente = _subir(api)
    primera = api.post(f"/api/expedientes/{expediente['id']}/auditoria").json()
    segunda = api.post(f"/api/expedientes/{expediente['id']}/auditoria").json()
    assert segunda["iniciada_en"] == primera["iniciada_en"]
    _esperar(api, expediente["id"])


def test_si_el_modelo_no_responde_se_informa_sin_detalles(api):
    ServicioFalso.falla = ConnectionError("conexión rechazada a ollama:11434")
    expediente = _subir(api)
    api.post(f"/api/expedientes/{expediente['id']}/auditoria")
    final = _esperar(api, expediente["id"])
    assert final["estado"] == "error"
    assert "modelo de lenguaje" in final["error"]
    assert "11434" not in final["error"]
    assert final["documentos_en_curso"] == []
    assert not any(r.exists() for r in ServicioFalso.rutas_vistas)


def test_expediente_inexistente_sin_archivos_o_sin_auditoria(api, storage_temporal):
    assert api.post(f"/api/expedientes/{uuid.uuid4()}/auditoria").status_code == 404
    assert api.get(f"/api/expedientes/{uuid.uuid4()}/auditoria").status_code == 404
    expediente = _subir(api, ("Escrituras.pdf",))
    for archivo in storage_temporal.rglob("*.enc"):
        archivo.unlink()
    assert api.post(f"/api/expedientes/{expediente['id']}/auditoria").status_code == 422


def test_el_progreso_informa_la_fase_de_cada_documento(api):
    ServicioFalso.pausa = 0.15
    expediente = _subir(api)
    inicio = api.post(f"/api/expedientes/{expediente['id']}/auditoria").json()
    assert [d["fase"] for d in inicio["documentos"]] == ["en_espera", "en_espera"]
    assert {d["id"] for d in inicio["documentos"]} == {d["id"] for d in expediente["documentos"]}

    vistas = set()
    limite = time.monotonic() + 5
    while time.monotonic() < limite:
        estado = api.get(f"/api/expedientes/{expediente['id']}/auditoria").json()
        vistas.update(d["fase"] for d in estado["documentos"])
        if estado["estado"] != "en_proceso":
            break
        time.sleep(0.03)
    assert {"leyendo", "esperando_modelo", "analizando"} <= vistas
    assert [d["fase"] for d in estado["documentos"]] == ["listo", "listo"]
    assert estado["documentos_en_curso"] == []


def test_la_cola_indica_cuantos_expedientes_van_delante(api):
    ServicioFalso.pausa = 0.15
    primero = _subir(api)
    segundo = _subir(api)
    a = api.post(f"/api/expedientes/{primero['id']}/auditoria").json()
    time.sleep(0.01)
    b = api.post(f"/api/expedientes/{segundo['id']}/auditoria").json()
    assert a["en_cola_delante"] == 0
    assert b["en_cola_delante"] == 1
    _esperar(api, primero["id"])
    final = _esperar(api, segundo["id"])
    assert final["en_cola_delante"] == 0
