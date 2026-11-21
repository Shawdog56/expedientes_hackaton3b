import os

import pytest

from app.core.seguridad import archivos
from app.core.seguridad.archivos import (
    cifrar_archivo,
    descifrar_a_archivo,
    descifrar_flujo,
    esta_cifrado,
)
from app.core.seguridad.errores import DescifradoError

CTX = "documentos.archivo:abc"


@pytest.fixture(autouse=True)
def bloque_pequeno(monkeypatch):
    """Bloques de 64 bytes para probar los bordes sin archivos enormes."""
    monkeypatch.setattr(archivos, "TAM_BLOQUE", 64)


def _cifrar(tmp_path, contenido: bytes):
    origen = tmp_path / "origen.bin"
    origen.write_bytes(contenido)
    destino = tmp_path / "salida.enc"
    cifrar_archivo(origen, destino, CTX)
    return destino


@pytest.mark.parametrize("tamano", [0, 1, 63, 64, 65, 128, 129, 1000])
def test_ida_y_vuelta_en_los_bordes_de_bloque(tmp_path, tamano):
    contenido = os.urandom(tamano)
    cifrado = _cifrar(tmp_path, contenido)
    assert esta_cifrado(cifrado)
    assert b"".join(descifrar_flujo(cifrado, CTX)) == contenido


def test_el_contenido_no_aparece_en_claro(tmp_path):
    cifrado = _cifrar(tmp_path, b"%PDF-1.4 Juan Perez propietario" * 10)
    crudo = cifrado.read_bytes()
    assert b"%PDF" not in crudo and b"Juan" not in crudo


def test_dos_cifrados_del_mismo_archivo_son_distintos(tmp_path):
    uno = _cifrar(tmp_path, b"igual" * 50).read_bytes()
    dos = _cifrar(tmp_path, b"igual" * 50).read_bytes()
    assert uno != dos


def test_contexto_distinto_no_abre(tmp_path):
    cifrado = _cifrar(tmp_path, b"x" * 200)
    with pytest.raises(DescifradoError):
        b"".join(descifrar_flujo(cifrado, "documentos.archivo:otro"))


def test_un_bit_alterado_se_detecta(tmp_path):
    cifrado = _cifrar(tmp_path, b"x" * 200)
    datos = bytearray(cifrado.read_bytes())
    datos[-20] ^= 1
    cifrado.write_bytes(bytes(datos))
    with pytest.raises(DescifradoError):
        b"".join(descifrar_flujo(cifrado, CTX))


def test_un_archivo_cortado_se_detecta(tmp_path):
    cifrado = _cifrar(tmp_path, b"x" * 300)
    completo = cifrado.read_bytes()
    # Quitar el último bloque deja un archivo que parece válido salvo por la marca de "último".
    cifrado.write_bytes(completo[: -(64 + archivos.LONGITUD_ETIQUETA)])
    with pytest.raises(DescifradoError):
        b"".join(descifrar_flujo(cifrado, CTX))


def test_bloques_reordenados_se_detectan(tmp_path):
    cifrado = _cifrar(tmp_path, b"A" * 64 + b"B" * 64 + b"C" * 10)
    datos = cifrado.read_bytes()
    tam = 64 + archivos.LONGITUD_ETIQUETA
    cabecera = datos[: len(datos) - (tam * 2 + 10 + archivos.LONGITUD_ETIQUETA)]
    b0, b1, b2 = (datos[len(cabecera) + i * tam : len(cabecera) + (i + 1) * tam] for i in range(3))
    cifrado.write_bytes(cabecera + b1 + b0 + datos[len(cabecera) + 2 * tam :])
    with pytest.raises(DescifradoError):
        b"".join(descifrar_flujo(cifrado, CTX))


def test_archivo_en_claro_no_se_trata_como_cifrado(tmp_path):
    plano = tmp_path / "plano.pdf"
    plano.write_bytes(b"%PDF-1.4 contenido")
    assert not esta_cifrado(plano)
    with pytest.raises(DescifradoError):
        list(descifrar_flujo(plano, CTX))
    assert not esta_cifrado(tmp_path / "no_existe")


def test_cabecera_truncada(tmp_path):
    cifrado = _cifrar(tmp_path, b"x" * 100)
    cifrado.write_bytes(cifrado.read_bytes()[:14])
    with pytest.raises(DescifradoError):
        list(descifrar_flujo(cifrado, CTX))


def test_descifrar_a_archivo_y_permisos(tmp_path):
    contenido = os.urandom(500)
    cifrado = _cifrar(tmp_path, contenido)
    destino = tmp_path / "sub" / "claro.bin"
    descifrar_a_archivo(cifrado, destino, CTX)
    assert destino.read_bytes() == contenido
    if os.name == "posix":
        assert oct(destino.stat().st_mode & 0o777) == "0o600"


def test_si_falla_no_deja_archivo_a_medias(tmp_path):
    cifrado = _cifrar(tmp_path, b"x" * 300)
    destino = tmp_path / "claro.bin"
    with pytest.raises(DescifradoError):
        descifrar_a_archivo(cifrado, destino, "otro-contexto")
    assert not destino.exists()
