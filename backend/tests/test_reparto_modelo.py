"""Reparto de peticiones entre las instancias del modelo (sin Ollama real: clasificadores falsos)."""

import asyncio
import time

import pytest

from app.core.concurrencia import PoolDeRecursos
from app.services import expediente_service as modulo
from app.services.expediente_service import ExpedienteService


class ClasificadorLento:
    """Simula una instancia de Ollama: tarda en responder y registra la concurrencia."""

    def __init__(self, nombre: str, registro: dict):
        self.nombre = nombre
        self.registro = registro
        self.ocupado = False

    async def run(self, texto, context=None):
        assert not self.ocupado, f"{self.nombre} recibió dos peticiones a la vez"
        self.ocupado = True
        self.registro["en_curso"] += 1
        self.registro["maximo"] = max(self.registro["maximo"], self.registro["en_curso"])
        self.registro["por_instancia"][self.nombre] = self.registro["por_instancia"].get(self.nombre, 0) + 1
        await asyncio.sleep(0.05)
        self.registro["en_curso"] -= 1
        self.ocupado = False
        return {"tipo_documento": "desconocido", "texto": texto, "instancia": self.nombre}


@pytest.fixture
def dos_instancias(monkeypatch):
    registro = {"en_curso": 0, "maximo": 0, "por_instancia": {}}
    pool = PoolDeRecursos([ClasificadorLento("ollama-1", registro), ClasificadorLento("ollama-2", registro)])
    monkeypatch.setattr(modulo, "_pool", pool)
    return registro


class OCRFalso:
    def __init__(self, espera: float = 0.0):
        self.espera = espera

    def extraer_texto(self, archivo, nombre=""):
        time.sleep(self.espera)  # trabajo síncrono, como PyMuPDF o PaddleOCR
        return {"texto": f"texto de {nombre}", "archivo": nombre}


def test_el_pool_nunca_pasa_de_su_capacidad_y_devuelve_el_recurso_con_error():
    async def principal():
        pool = PoolDeRecursos(["a", "b"])
        en_curso = maximo = 0

        async def tarea(i):
            nonlocal en_curso, maximo
            async with pool.usar():
                en_curso += 1
                maximo = max(maximo, en_curso)
                await asyncio.sleep(0.01)
                en_curso -= 1
                if i == 3:
                    raise RuntimeError("falla del modelo")

        resultados = await asyncio.gather(*(tarea(i) for i in range(8)), return_exceptions=True)
        assert maximo == 2
        assert sum(isinstance(r, RuntimeError) for r in resultados) == 1
        assert pool.libres() == 2  # el recurso de la tarea que falló volvió al pool

    asyncio.run(principal())


def test_el_pool_funciona_en_bucles_distintos():
    pool = PoolDeRecursos(["a"])

    async def usar():
        async with pool.usar() as recurso:
            return recurso

    assert asyncio.run(usar()) == "a"
    assert asyncio.run(usar()) == "a"


def test_pool_vacio_no_se_permite():
    with pytest.raises(ValueError):
        PoolDeRecursos([])


def test_un_lote_procesa_dos_documentos_a_la_vez_y_usa_ambas_instancias(dos_instancias):
    servicio = ExpedienteService(ocr_agent=OCRFalso())
    archivos = [(f"doc{i}.pdf", b"x") for i in range(6)]

    inicio = time.perf_counter()
    asyncio.run(servicio.auditar_archivos(archivos))
    duracion = time.perf_counter() - inicio

    assert dos_instancias["maximo"] == 2
    assert dos_instancias["por_instancia"] == {"ollama-1": 3, "ollama-2": 3}
    # 6 documentos de 0.05 s en 2 instancias: unos 0.15 s, no 0.30 s como en serie.
    assert duracion < 0.27


def test_dos_expedientes_a_la_vez_comparten_las_mismas_dos_instancias(dos_instancias):
    async def principal():
        a = ExpedienteService(ocr_agent=OCRFalso())
        b = ExpedienteService(ocr_agent=OCRFalso())
        await asyncio.gather(
            a.auditar_archivos([(f"a{i}.pdf", b"x") for i in range(4)]),
            b.auditar_archivos([(f"b{i}.pdf", b"x") for i in range(4)]),
        )

    asyncio.run(principal())
    assert dos_instancias["maximo"] == 2
    assert sum(dos_instancias["por_instancia"].values()) == 8


def test_el_ocr_no_bloquea_las_demas_peticiones(dos_instancias):
    """El OCR va de uno en uno (motor compartido), pero en un hilo: el servidor sigue respondiendo."""

    async def principal():
        servicio = ExpedienteService(ocr_agent=OCRFalso(espera=0.2))
        latidos = 0

        async def otra_peticion():
            nonlocal latidos
            while True:
                latidos += 1
                await asyncio.sleep(0.01)

        latido = asyncio.create_task(otra_peticion())
        inicio = time.perf_counter()
        await servicio.auditar_archivos([("a.pdf", b"x"), ("b.pdf", b"x")])
        duracion = time.perf_counter() - inicio
        latido.cancel()
        return latidos, duracion

    latidos, duracion = asyncio.run(principal())
    assert duracion >= 0.38  # dos OCR de 0.2 s, uno tras otro
    assert latidos > 20  # mientras tanto el bucle de eventos atendió otras tareas


def test_el_progreso_reporta_las_fases_de_cada_documento(dos_instancias):
    eventos = []
    servicio = ExpedienteService(ocr_agent=OCRFalso())
    asyncio.run(servicio.auditar_archivos([("a.pdf", b"x")], al_avanzar=eventos.append))
    fases = [e["documento_fase"][1] for e in eventos if "documento_fase" in e]
    assert fases == ["leyendo", "esperando_modelo", "analizando", "listo"]


def test_el_analisis_por_textos_tambien_usa_el_reparto(dos_instancias):
    servicio = ExpedienteService(ocr_agent=OCRFalso())
    asyncio.run(servicio.analizar_expediente([f"texto {i}" for i in range(4)]))
    assert dos_instancias["maximo"] == 2
    assert set(dos_instancias["por_instancia"]) == {"ollama-1", "ollama-2"}


def test_un_clasificador_inyectado_se_usa_tal_cual(dos_instancias):
    registro = {"en_curso": 0, "maximo": 0, "por_instancia": {}}
    propio = ClasificadorLento("propio", registro)
    servicio = ExpedienteService(clasificador=propio, ocr_agent=OCRFalso())
    asyncio.run(servicio.analizar_expediente(["uno"]))
    assert registro["por_instancia"] == {"propio": 1}
    assert dos_instancias["por_instancia"] == {}


def test_el_pool_real_crea_un_clasificador_por_instancia_configurada(monkeypatch):
    monkeypatch.setattr(modulo, "_pool", None)
    monkeypatch.setattr(modulo.settings, "ollama_base_urls", ["http://uno:11434", "http://dos:11434"])
    pool = modulo.pool_clasificadores()
    assert pool.capacidad == 2
    assert [c.base_url for c in pool._recursos] == ["http://uno:11434", "http://dos:11434"]
    monkeypatch.setattr(modulo, "_pool", None)
