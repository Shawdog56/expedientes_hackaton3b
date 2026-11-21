import io
import uuid
import zipfile

import pytest
from PIL import Image
from pypdf import PdfWriter

from app.core.config import settings


def pdf_bytes(paginas: int = 1, password: str | None = None) -> bytes:
    w = PdfWriter()
    for _ in range(paginas):
        w.add_blank_page(width=200, height=200)
    if password:
        w.encrypt(password)
    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def imagen_bytes(formato: str = "PNG", tamano: tuple[int, int] = (20, 20)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", tamano, (200, 30, 30)).save(buf, formato)
    return buf.getvalue()


def zip_bytes(miembros: dict[str, bytes], comprimir=zipfile.ZIP_DEFLATED) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", comprimir) as zf:
        for nombre, data in miembros.items():
            zf.writestr(nombre, data)
    return buf.getvalue()


@pytest.fixture
def subir(client):
    def _subir(archivos: list[tuple[str, bytes]], rutas: list[str] | None = None):
        files = [("archivos", (n, d, "application/octet-stream")) for n, d in archivos]
        data = {"rutas": rutas} if rutas else {}
        return client.post("/api/expedientes", files=files, data=data)

    return _subir


def dir_documentos(storage, exp_id: str):
    return storage / uuid.UUID(exp_id).hex / "documentos"


# ---------------------------------------------------------------- validación


def test_carpeta_con_pdfs_validos_e_invalidos(subir, client, storage_temporal):
    r = subir(
        [
            ("01 Escritura.pdf", pdf_bytes(3)),
            ("PAGO PREDIAL 2025.pdf", pdf_bytes(1)),
            ("falso.pdf", b"esto no es un pdf"),
            ("roto.pdf", b"%PDF-1.7\n basura sin estructura"),
            ("protegido.pdf", pdf_bytes(1, password="secreto")),
            ("foto.gif", imagen_bytes("GIF")),
        ],
        rutas=[
            "Exp1/01 Escritura.pdf",
            "Exp1/PAGO PREDIAL 2025.pdf",
            "Exp1/falso.pdf",
            "Exp1/roto.pdf",
            "Exp1/protegido.pdf",
            "Exp1/foto.gif",
        ],
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["nombre"] == "Exp1"
    assert body["origen"] == "carpeta"
    assert body["estado"] == "cargado"
    assert {d["ruta"]: d["paginas"] for d in body["documentos"]} == {
        "Exp1/01 Escritura.pdf": 3,
        "Exp1/PAGO PREDIAL 2025.pdf": 1,
    }
    motivos = {x["ruta"]: x["motivo"] for x in body["rechazados"]}
    assert "firma %PDF" in motivos["Exp1/falso.pdf"]
    assert "dañado" in motivos["Exp1/roto.pdf"]
    assert "contraseña" in motivos["Exp1/protegido.pdf"]
    assert "no permitido" in motivos["Exp1/foto.gif"]

    # En disco solo hay archivos cifrados con nombre aleatorio: ningún nombre original sobrevive.
    docs = dir_documentos(storage_temporal, body["id"])
    en_disco = sorted(p.name for p in docs.rglob("*") if p.is_file())
    assert len(en_disco) == 2 and all(n.endswith(".enc") for n in en_disco)
    assert not any(p.is_dir() for p in docs.rglob("*"))
    recuperado = client.get(f"/api/expedientes/{body['id']}").json()
    # SQLite (pruebas) no conserva la zona horaria; en PostgreSQL sí.
    assert {**recuperado, "creado_en": None} == {**body, "creado_en": None}


def test_zip_se_descomprime_y_filtra(subir, storage_temporal):
    contenido = zip_bytes(
        {
            "Exp2/Escrituras/escritura.pdf": pdf_bytes(2),
            "Exp2/Uso de Suelo/uso_suelo.pdf": pdf_bytes(1),
            "Exp2/notas.txt": b"hola",
            "Exp2/interno.zip": zip_bytes({"a.pdf": pdf_bytes()}),
            "__MACOSX/Exp2/._escritura.pdf": b"basura",
            "../../fuera.pdf": pdf_bytes(),
        }
    )
    r = subir([("Exp2.zip", contenido)])
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["origen"] == "zip"
    assert body["nombre"] == "Exp2"
    assert sorted(d["ruta"] for d in body["documentos"]) == [
        "Exp2/Escrituras/escritura.pdf",
        "Exp2/Uso de Suelo/uso_suelo.pdf",
    ]
    motivos = {x["ruta"]: x["motivo"] for x in body["rechazados"]}
    assert "no permitido" in motivos["Exp2/notas.txt"]
    assert "anidado" in motivos["Exp2/interno.zip"]
    assert "insegura" in motivos["../../fuera.pdf"]
    assert not any("MACOSX" in ruta for ruta in motivos)
    assert not (storage_temporal / "fuera.pdf").exists()
    assert not any(p.name == "subida.zip" for p in storage_temporal.rglob("*"))


def test_zip_bomb_por_ratio(subir, monkeypatch):
    monkeypatch.setattr(settings, "max_ratio_compresion", 10)
    contenido = zip_bytes({"ok.pdf": pdf_bytes(), "bomba.pdf": b"\0" * 5_000_000})
    r = subir([("x.zip", contenido)])
    assert r.status_code == 201
    motivos = {x["ruta"]: x["motivo"] for x in r.json()["rechazados"]}
    assert "Ratio" in motivos["bomba.pdf"]


def test_zip_excede_tamano_descomprimido(subir, monkeypatch):
    monkeypatch.setattr(settings, "max_zip_descomprimido_mb", 1)
    contenido = zip_bytes({"grande.pdf": b"%PDF-" + b"x" * 2_000_000}, zipfile.ZIP_STORED)
    r = subir([("x.zip", contenido)])
    assert r.status_code == 422
    assert "descomprimido" in r.json()["detail"]["rechazados"][0]["motivo"]


def test_zip_falso_y_sin_pdfs_validos(subir, client, storage_temporal):
    r = subir([("falso.zip", b"no soy un zip")])
    assert r.status_code == 422
    assert r.json()["detail"]["rechazados"] == [{"ruta": "falso.zip", "motivo": "No es un ZIP válido"}]
    assert list(storage_temporal.iterdir()) == []  # no deja archivos
    assert client.get("/api/expedientes").json() == []  # ni registros


def test_pdf_excede_tamano(subir, monkeypatch):
    monkeypatch.setattr(settings, "max_pdf_mb", 1)
    r = subir([("grande.pdf", b"%PDF-" + b"x" * 2_000_000), ("ok.pdf", pdf_bytes())])
    assert r.status_code == 201
    assert "tamaño máximo" in r.json()["rechazados"][0]["motivo"]


def test_zip_detectado_por_firma_aunque_no_tenga_extension(subir):
    r = subir([("expediente", zip_bytes({"a.pdf": pdf_bytes()}))])
    assert r.status_code == 201
    assert r.json()["origen"] == "zip"


def test_nombres_duplicados_no_se_pisan(subir):
    r = subir([("a.pdf", pdf_bytes(1)), ("a.pdf", pdf_bytes(2))])
    assert sorted(d["ruta"] for d in r.json()["documentos"]) == ["a (1).pdf", "a.pdf"]


def test_id_invalido(client):
    assert client.get("/api/expedientes/no-es-uuid").status_code == 422
    assert client.get(f"/api/expedientes/{uuid.uuid4()}").status_code == 404


def test_eliminar_borra_registro_y_archivos(subir, client, storage_temporal):
    exp_id = subir([("a.pdf", pdf_bytes())]).json()["id"]
    assert dir_documentos(storage_temporal, exp_id).exists()
    assert client.delete(f"/api/expedientes/{exp_id}").status_code == 204
    assert client.get(f"/api/expedientes/{exp_id}").status_code == 404
    assert not (storage_temporal / uuid.UUID(exp_id).hex).exists()


# ------------------------------------------------------------- clasificación


def test_clasifica_expediente_completo(subir):
    contenido = zip_bytes(
        {
            "Exp 0425/01 Escritura!!.pdf": pdf_bytes(),
            "Exp 0425/1. Pago de Predial 2025 Sor Juana.pdf": pdf_bytes(),
            "Exp 0425/03. Número Oficial Sor Juana.pdf": pdf_bytes(),
            "Exp 0425/3737 LIC DE USO DE SUELO.pdf": pdf_bytes(),
        }
    )
    body = subir([("Exp 0425.zip", contenido)]).json()
    tipos = {d["nombre"]: (d["tipo_documental"], d["agente"]) for d in body["documentos"]}
    assert tipos == {
        "01 Escritura!!.pdf": ("escrituras", "agente_escrituras"),
        "1. Pago de Predial 2025 Sor Juana.pdf": ("predial", "agente_predial"),
        "03. Número Oficial Sor Juana.pdf": ("alineamiento_numero_oficial", "agente_alineamiento"),
        "3737 LIC DE USO DE SUELO.pdf": ("uso_suelo", "agente_uso_suelo"),
    }
    assert all(d["estado_extraccion"] == "pendiente" for d in body["documentos"])
    assert body["completo"] is True
    assert body["tipos_faltantes"] == []


def test_sin_clasificar_faltantes_y_duplicados(subir):
    r = subir(
        [
            ("ESCRITURA.pdf", pdf_bytes()),
            ("Escrituras_Tepeji.pdf", pdf_bytes()),
            ("contrato.pdf", pdf_bytes()),
            ("Escritura y predial.pdf", pdf_bytes()),
        ]
    )
    body = r.json()
    estados = {d["nombre"]: d["estado_clasificacion"] for d in body["documentos"]}
    assert estados["contrato.pdf"] == "sin_clasificar"
    assert estados["Escritura y predial.pdf"] == "ambiguo"
    sin_tipo = [d for d in body["documentos"] if d["tipo_documental"] is None]
    assert all(d["estado_extraccion"] == "no_aplica" and d["agente"] is None for d in sin_tipo)
    assert body["tipos_duplicados"] == ["escrituras"]
    assert body["tipos_faltantes"] == ["predial", "alineamiento_numero_oficial", "uso_suelo"]
    assert body["completo"] is False


def test_clasifica_por_carpeta_si_el_nombre_no_basta(subir):
    r = subir([("recibo.pdf", pdf_bytes())], rutas=["Exp 12/Predial/recibo.pdf"])
    doc = r.json()["documentos"][0]
    assert (doc["tipo_documental"], doc["fuente_clasificacion"]) == ("predial", "carpeta")


def test_reclasificacion_manual(subir, client):
    body = subir([("contrato.pdf", pdf_bytes())]).json()
    doc_id = body["documentos"][0]["id"]

    r = client.patch(f"/api/documentos/{doc_id}", json={"tipo_documental": "predial"})
    assert r.status_code == 200
    doc = r.json()["documentos"][0]
    assert doc["tipo_documental"] == "predial"
    assert doc["estado_clasificacion"] == "manual"
    assert doc["estado_extraccion"] == "pendiente"
    assert doc["agente"] == "agente_predial"

    r = client.patch(f"/api/documentos/{doc_id}", json={"tipo_documental": "otro"})
    assert r.status_code == 422
    assert client.patch(f"/api/documentos/{uuid.uuid4()}", json={"tipo_documental": None}).status_code == 404


def test_tipos_documentales(client):
    tipos = client.get("/api/tipos-documentales").json()
    assert [t["valor"] for t in tipos] == [
        "escrituras",
        "predial",
        "alineamiento_numero_oficial",
        "uso_suelo",
    ]


# ------------------------------------------------------------------ imágenes


def test_imagenes_jpg_png_se_aceptan_y_se_clasifican(subir):
    r = subir(
        [
            ("Predial 2025.jpeg", imagen_bytes("JPEG")),
            ("escritura.PNG", imagen_bytes("PNG")),
            ("uso de suelo.jpg", imagen_bytes("JPEG", (40, 30))),
            ("alineamiento.pdf", pdf_bytes(2)),
        ]
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["rechazados"] == []
    docs = {d["ruta"]: d for d in body["documentos"]}
    assert {k: (v["formato"], v["paginas"]) for k, v in docs.items()} == {
        "Predial 2025.jpeg": ("jpeg", 1),
        "escritura.PNG": ("png", 1),
        "uso de suelo.jpg": ("jpeg", 1),
        "alineamiento.pdf": ("pdf", 2),
    }
    assert docs["Predial 2025.jpeg"]["tipo_documental"] == "predial"
    assert docs["escritura.PNG"]["tipo_documental"] == "escrituras"
    assert body["completo"] is True


def test_imagenes_invalidas_se_rechazan(subir):
    r = subir(
        [
            ("ok.png", imagen_bytes("PNG")),
            ("falsa.png", b"esto no es una imagen"),
            ("gif_disfrazado.png", imagen_bytes("GIF")),
            ("rota.jpg", b"\xff\xd8\xff" + b"basura" * 50),
            ("truncada.png", imagen_bytes("PNG")[:40]),
        ]
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert [d["ruta"] for d in body["documentos"]] == ["ok.png"]
    motivos = {x["ruta"]: x["motivo"] for x in body["rechazados"]}
    assert "firma" in motivos["falsa.png"]
    assert "firma" in motivos["gif_disfrazado.png"]
    assert "dañada" in motivos["rota.jpg"]
    assert "dañada" in motivos["truncada.png"]


def test_imagen_excede_tamano_y_pixeles(subir, monkeypatch):
    monkeypatch.setattr(settings, "max_imagen_pixeles", 100)
    r = subir([("grande.png", imagen_bytes("PNG", (50, 50))), ("pdf.pdf", pdf_bytes())])
    assert "megapíxeles" in r.json()["rechazados"][0]["motivo"]

    monkeypatch.setattr(settings, "max_imagen_pixeles", 80_000_000)
    monkeypatch.setattr(settings, "max_imagen_mb", 0)
    r = subir([("pesada.jpg", imagen_bytes("JPEG")), ("pdf.pdf", pdf_bytes())])
    assert "tamaño máximo" in r.json()["rechazados"][0]["motivo"]


def test_zip_con_imagenes(subir):
    contenido = zip_bytes(
        {
            "Exp/predial.jpg": imagen_bytes("JPEG"),
            "Exp/escritura.png": imagen_bytes("PNG"),
            "Exp/uso suelo.pdf": pdf_bytes(),
            "Exp/foto.gif": imagen_bytes("GIF"),
            "Exp/falsa.jpg": b"no es imagen",
        }
    )
    r = subir([("exp.zip", contenido)])
    assert r.status_code == 201, r.text
    body = r.json()
    assert {d["ruta"]: d["formato"] for d in body["documentos"]} == {
        "Exp/predial.jpg": "jpeg",
        "Exp/escritura.png": "png",
        "Exp/uso suelo.pdf": "pdf",
    }
    motivos = {x["ruta"]: x["motivo"] for x in body["rechazados"]}
    assert "no permitido" in motivos["Exp/foto.gif"]
    assert "firma" in motivos["Exp/falsa.jpg"]
