import base64

import pytest
from sqlalchemy import text

from app.core.config import settings
from app.core.seguridad.cifrado import Cifrador
from app.core.seguridad.errores import ConfiguracionSeguridadError, DescifradoError
from app.core.seguridad.indices import indice_ciego
from app.core.seguridad.passwords import hashear_password, verificar_password
from app.db.models import Documento, Expediente, Extraccion, Hallazgo, ValidacionCruzada
from app.domain.documentos import EstadoClasificacion
from app.domain.estados import ResultadoValidacion

CLAVE_A = b"a" * 32
CLAVE_B = b"b" * 32


def test_cifrado_ida_y_vuelta_y_nonce_distinto():
    c = Cifrador({"v1": CLAVE_A}, "v1")
    uno = c.cifrar("Juan Pérez".encode(), "tabla.col")
    dos = c.cifrar("Juan Pérez".encode(), "tabla.col")
    assert uno != dos
    assert "Juan" not in uno
    assert c.descifrar(uno, "tabla.col") == "Juan Pérez".encode()


def test_el_contexto_liga_el_valor_a_su_columna():
    c = Cifrador({"v1": CLAVE_A}, "v1")
    with pytest.raises(DescifradoError):
        c.descifrar(c.cifrar(b"dato", "tabla.a"), "tabla.b")


def test_un_valor_alterado_no_se_descifra():
    c = Cifrador({"v1": CLAVE_A}, "v1")
    valor = c.cifrar(b"dato", "t.c")
    partes = valor.split(".")
    partes[4] = ("A" if partes[4][0] != "A" else "B") + partes[4][1:]
    with pytest.raises(DescifradoError):
        c.descifrar(".".join(partes), "t.c")
    with pytest.raises(DescifradoError):
        c.descifrar("basura", "t.c")


def test_rotacion_de_claves():
    viejo = Cifrador({"v1": CLAVE_A}, "v1")
    valor = viejo.cifrar(b"dato", "t.c")
    nuevo = Cifrador({"v1": CLAVE_A, "v2": CLAVE_B}, "v2")
    assert nuevo.descifrar(valor, "t.c") == b"dato"
    rotado = nuevo.reenvolver(valor, "t.c")
    assert nuevo.clave_de(rotado) == "v2"
    solo_v2 = Cifrador({"v2": CLAVE_B}, "v2")
    assert solo_v2.descifrar(rotado, "t.c") == b"dato"
    with pytest.raises(DescifradoError):
        solo_v2.descifrar(valor, "t.c")


def test_llavero_invalido():
    with pytest.raises(ConfiguracionSeguridadError):
        Cifrador({"v1": b"corta"}, "v1")
    with pytest.raises(ConfiguracionSeguridadError):
        Cifrador({"v1": CLAVE_A}, "v2")
    with pytest.raises(ConfiguracionSeguridadError):
        Cifrador({"v.1": CLAVE_A}, "v.1")


def test_indice_ciego_determinista_normalizado_y_por_contexto():
    base = indice_ciego("abc123", "extracciones.folio")
    assert indice_ciego("  ABC123 ", "extracciones.folio") == base
    assert indice_ciego("abc123", "otra.columna") != base
    assert indice_ciego("abc124", "extracciones.folio") != base
    assert indice_ciego("abc123", "extracciones.folio", clave=b"x" * 32) != base


def test_password_argon2id_correcta_e_incorrecta():
    hash_ = hashear_password("clave-secreta")
    assert hash_.startswith("$argon2id$")
    assert verificar_password("clave-secreta", hash_) == (True, None)
    assert verificar_password("otra", hash_) == (False, None)
    assert verificar_password("x", "no-es-un-hash") == (False, None)


def test_el_pepper_cambia_el_resultado(monkeypatch):
    hash_ = hashear_password("clave")
    monkeypatch.setattr(settings, "pepper_password", base64.b64encode(b"q" * 32).decode())
    assert verificar_password("clave", hash_)[0] is False


def test_hash_con_parametros_viejos_se_actualiza():
    from argon2 import PasswordHasher

    viejo = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1)
    from app.core.seguridad.passwords import _con_pepper

    hash_viejo = viejo.hash(_con_pepper("clave"))
    correcta, nuevo = verificar_password("clave", hash_viejo)
    assert correcta and nuevo and nuevo != hash_viejo
    assert verificar_password("clave", nuevo) == (True, None)


def test_sin_claves_configuradas_falla_con_mensaje_claro(monkeypatch, db_session):
    monkeypatch.setattr(settings, "claves_cifrado", {})
    with db_session() as db:
        exp = Expediente(nombre="e", origen="zip")
        db.add(exp)
        db.flush()
        v = ValidacionCruzada(
            expediente_id=exp.id, resultado=ResultadoValidacion.CUMPLE, resumen="Juan"
        )
        db.add(v)
        with pytest.raises(Exception, match="CLAVES_CIFRADO"):
            db.flush()


def _expediente_con_datos(db):
    exp = Expediente(nombre="exp", origen="zip")
    doc = Documento(
        nombre="d.pdf",
        ruta="d.pdf",
        ruta_almacenamiento="/x/d.pdf",
        tamano=1,
        paginas=1,
        sha256="0" * 64,
        estado_clasificacion=EstadoClasificacion.SIN_CLASIFICAR,
    )
    exp.documentos.append(doc)
    db.add(exp)
    db.flush()
    db.add(
        Extraccion(
            documento_id=doc.id,
            agente="agente_escrituras",
            caracteristicas={"propietario": "María Núñez", "superficie_m2": 120},
        )
    )
    val = ValidacionCruzada(
        expediente_id=exp.id, resultado=ResultadoValidacion.CUMPLE, resumen="Propietario: María Núñez"
    )
    exp.validaciones.append(val)
    db.flush()
    db.add(
        Hallazgo(
            validacion_id=val.id,
            regla="propietario",
            resultado=ResultadoValidacion.CUMPLE,
            mensaje="Coincide con María Núñez",
            evidencia={"escrituras": "María Núñez"},
        )
    )
    db.commit()
    return exp.id


def test_los_campos_sensibles_se_guardan_cifrados_y_se_leen_en_claro(db_session):
    with db_session() as db:
        exp_id = _expediente_con_datos(db)

    with db_session() as db:
        crudo = {
            tabla_col: db.execute(text(f"SELECT {col} FROM {tabla}")).scalar_one()
            for tabla_col, (tabla, col) in {
                "caracteristicas": ("extracciones", "caracteristicas"),
                "resumen": ("validaciones_cruzadas", "resumen"),
                "mensaje": ("hallazgos", "mensaje"),
                "evidencia": ("hallazgos", "evidencia"),
            }.items()
        }
        for valor in crudo.values():
            assert valor.startswith("enc1.v1.")
            assert "Núñez" not in valor

        exp = db.get(Expediente, exp_id)
        assert exp.documentos[0].extracciones[0].caracteristicas == {
            "propietario": "María Núñez",
            "superficie_m2": 120,
        }
        assert exp.validaciones[0].resumen == "Propietario: María Núñez"
        assert exp.validaciones[0].hallazgos[0].mensaje == "Coincide con María Núñez"
        assert exp.validaciones[0].hallazgos[0].evidencia == {"escrituras": "María Núñez"}


def test_valores_nulos_se_conservan(db_session):
    with db_session() as db:
        exp = Expediente(nombre="e", origen="zip")
        exp.validaciones.append(
            ValidacionCruzada(resultado=ResultadoValidacion.CUMPLE, resumen=None)
        )
        db.add(exp)
        db.commit()
        assert db.execute(text("SELECT resumen FROM validaciones_cruzadas")).scalar_one() is None
