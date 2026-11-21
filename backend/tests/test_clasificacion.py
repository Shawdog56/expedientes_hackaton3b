import pytest

from app.services.clasificacion import EstadoClasificacion, TipoDocumental, clasificar

E, P, A, U = (
    TipoDocumental.ESCRITURAS,
    TipoDocumental.PREDIAL,
    TipoDocumental.ALINEAMIENTO_NUMERO_OFICIAL,
    TipoDocumental.USO_SUELO,
)

# Nombres reales de "Archivos de prueba"
CASOS = [
    ("01 Escritura!!.pdf", E),
    ("01 Escriturav.pdf", E),
    ("02. Escritura (1).pdf", E),
    ("ESCRITURA 30,025 RELOTIFICACION DE MZAS 88-A A 93-A-HGO PASEOS DE LA PRADERA.pdf", E),
    ("Escrituras_Tepeji del Río 5.pdf", E),
    ("01 Boleta Predial  2025 Melchor Ocampo III.pdf", P),
    ("2024 - Comprobante Predial Toscana.pdf", P),
    ("PAGO PREDIAL 20205.pdf", P),
    ("PREDIAL-TULTEPEC SAN JUAN.pdf", P),
    ("03 Alineamiento y numero oficial  Melcho Ocampo III..pdf", A),
    ("03. Constancia de Alineamiento Sor Juana.pdf", A),
    ("03. Número Oficial Sor Juana.pdf", A),
    ("ALINEAMIANTO Y NUMERO OFICIAL.pdf", A),
    ("ALINEAMIENTO 2024.pdf", A),
    ("NUMERO OFICIAL Y ALINEACION DE SUELO.pdf", A),
    ("04 Licencia de Uso de Suelo...pdf", U),
    ("3737 LIC DE USO DE SUELO.pdf", U),
    ("USO DE SUELO Y ANTECEDENTE CB-HGO PASESO DE LA PRADERA.pdf", U),
    ("05 Licencia de uso de suelo actualizado al año en curso (uso comercial – minisúper).pdf", U),
]


@pytest.mark.parametrize(("nombre", "tipo"), CASOS)
def test_nombres_reales(nombre, tipo):
    resultado = clasificar(nombre)
    assert resultado.tipo == tipo
    assert resultado.estado == EstadoClasificacion.CLASIFICADO
    assert resultado.fuente == "nombre"


def test_sin_clasificar():
    resultado = clasificar("contrato de arrendamiento.pdf")
    assert resultado.tipo is None
    assert resultado.estado == EstadoClasificacion.SIN_CLASIFICAR


def test_ambiguo():
    resultado = clasificar("Escritura y Predial.pdf")
    assert resultado.estado == EstadoClasificacion.AMBIGUO
    assert set(resultado.candidatos) == {E, P}


def test_carpeta_mas_cercana_gana():
    assert clasificar("Escrituras/Predial/recibo.pdf").tipo == P
    assert clasificar("Exp 1/recibo.pdf").estado == EstadoClasificacion.SIN_CLASIFICAR
