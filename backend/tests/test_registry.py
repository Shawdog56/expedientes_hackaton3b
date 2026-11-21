import sys
import textwrap

import pytest

import app.agents as paquete_agentes
from app.agents import registry
from app.agents.contratos import AgenteExtractor
from app.domain.documentos import AGENTE_POR_TIPO, TipoDocumental


@pytest.fixture
def agentes_tmp(tmp_path, monkeypatch):
    """Añade un directorio temporal al paquete `app.agents` para simular agentes nuevos."""
    monkeypatch.setattr(paquete_agentes, "__path__", [*paquete_agentes.__path__, str(tmp_path)])
    antes = set(sys.modules)
    registry.recargar()
    yield tmp_path
    for nombre in set(sys.modules) - antes:
        sys.modules.pop(nombre, None)
    registry.recargar()


def _escribir(directorio, nombre, codigo):
    (directorio / f"{nombre}.py").write_text(textwrap.dedent(codigo), encoding="utf-8")


def test_descubre_el_agente_de_ejemplo():
    registry.recargar()
    assert registry.get_agent("echo") is not None
    assert registry.errores_de_carga() == {}


def test_los_extractores_declaran_el_nombre_del_dominio():
    registry.recargar()
    for tipo, nombre in AGENTE_POR_TIPO.items():
        agente = registry.get_agent(nombre)
        if agente is None:  # aún no implementado
            continue
        assert isinstance(agente, AgenteExtractor)
        assert agente.tipo_documental == tipo


def test_un_agente_nuevo_se_registra_sin_editar_el_registro(agentes_tmp):
    _escribir(
        agentes_tmp,
        "ejemplo_predial",
        """
        from app.agents.contratos import AgenteExtractor, ResultadoExtraccion
        from app.domain.documentos import TipoDocumental

        class AgentePredialDePrueba(AgenteExtractor):
            name = "agente_predial"
            description = "prueba"
            tipo_documental = TipoDocumental.PREDIAL

            async def extraer(self, solicitud):
                return ResultadoExtraccion(caracteristicas={"ok": True})
        """,
    )
    registry.recargar()
    assert registry.get_agent("agente_predial") is not None
    assert registry.agente_para_tipo(TipoDocumental.PREDIAL) is registry.get_agent("agente_predial")
    assert registry.agente_para_tipo(TipoDocumental.USO_SUELO) is None
    assert registry.errores_de_carga() == {}


def test_un_agente_con_nombre_incorrecto_no_se_registra(agentes_tmp):
    _escribir(
        agentes_tmp,
        "mal_nombrado",
        """
        from app.agents.contratos import AgenteExtractor, ResultadoExtraccion
        from app.domain.documentos import TipoDocumental

        class Malo(AgenteExtractor):
            name = "otro_nombre"
            tipo_documental = TipoDocumental.PREDIAL

            async def extraer(self, solicitud):
                return ResultadoExtraccion(caracteristicas={})
        """,
    )
    registry.recargar()
    assert registry.get_agent("otro_nombre") is None
    assert any("mal_nombrado" in k for k in registry.errores_de_carga())


def test_un_modulo_roto_no_tumba_a_los_demas(agentes_tmp):
    _escribir(agentes_tmp, "roto", "import modulo_que_no_existe\n")
    registry.recargar()
    assert registry.get_agent("echo") is not None
    assert any("roto" in k for k in registry.errores_de_carga())


def test_el_endpoint_run_rechaza_extractores(client, agentes_tmp):
    _escribir(
        agentes_tmp,
        "ejemplo_escrituras",
        """
        from app.agents.contratos import AgenteExtractor, ResultadoExtraccion
        from app.domain.documentos import TipoDocumental

        class E(AgenteExtractor):
            name = "agente_escrituras"
            tipo_documental = TipoDocumental.ESCRITURAS

            async def extraer(self, solicitud):
                return ResultadoExtraccion(caracteristicas={})
        """,
    )
    registry.recargar()
    r = client.post("/api/agents/agente_escrituras/run", json={"input": "/etc/passwd"})
    assert r.status_code == 400
    assert client.post("/api/agents/echo/run", json={"input": "hola"}).status_code == 200
