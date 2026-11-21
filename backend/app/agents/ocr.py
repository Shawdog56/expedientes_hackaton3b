"""Agente de extracción de texto y OCR de documentos (PDF, JPG, PNG).

Permite procesar archivos físicos o flujos en memoria, combinando extracción de texto
digital rápido (PyMuPDF) con OCR profundo (PaddleOCR con realce de contraste CLAHE
y ordenamiento geométrico de bloques).
"""

from __future__ import annotations

import logging
import tempfile
import threading
from pathlib import Path
from typing import Any, BinaryIO, Optional

import pymupdf

from app.agents.base import BaseAgent

logger = logging.getLogger(__name__)

# El motor PaddleOCR tarda varios segundos en cargar sus modelos: se crea una sola vez por proceso
# y se comparte. El candado evita que dos OCR usen el mismo motor a la vez (no es seguro entre hilos).
_MOTOR_COMPARTIDO: Any = None
_MOTOR_CARGADO = False
_CANDADO_MOTOR = threading.Lock()
_CANDADO_OCR = threading.Lock()

# Extensiones reconocidas para extracción
EXTENSIONES_IMAGEN = {".jpg", ".jpeg", ".png"}
EXTENSIONES_PDF = {".pdf"}
EXTENSIONES_TEXTO = {".txt"}
EXTENSIONES_SOPORTADAS = EXTENSIONES_PDF | EXTENSIONES_IMAGEN | EXTENSIONES_TEXTO


class OCRAgent(BaseAgent):
    """Agente especialista que recupera texto y coordenadas de documentos inmobiliarios."""

    name: str = "ocr"
    description: str = (
        "Extrae texto y metadatos de documentos inmobiliarios (PDF, JPG, PNG). "
        "Utiliza texto digital nativo cuando está disponible y pipeline PaddleOCR "
        "con ordenamiento geométrico cuando los documentos son escaneados o imágenes."
    )

    def __init__(
        self,
        engine: Any = None,
        dpi: int = 300,
        quality: str = "fast",
        usar_muestras: bool = False,
    ) -> None:
        self.dpi = dpi
        self.quality = quality
        self._engine = engine
        self._engine_initialized = engine is not None
        # Solo para pruebas: si el OCR falla, buscar un texto de muestra con el mismo nombre de
        # archivo. Nunca en el flujo real: auditaría el texto de otro documento.
        self.usar_muestras = usar_muestras

    def _obtener_engine(self) -> Any:
        """Motor PaddleOCR compartido por el proceso, creado la primera vez que se necesita."""
        global _MOTOR_COMPARTIDO, _MOTOR_CARGADO
        if self._engine_initialized:
            return self._engine
        with _CANDADO_MOTOR:
            if not _MOTOR_CARGADO:
                try:
                    from app.agents.prueba3b.extract_pdf import create_engine

                    _MOTOR_COMPARTIDO = create_engine(language="es", device="cpu")
                    logger.info("Motor PaddleOCR inicializado correctamente.")
                except Exception as e:
                    logger.warning("No se pudo inicializar PaddleOCR (%s). Solo habrá extracción nativa.", e)
                    _MOTOR_COMPARTIDO = None
                _MOTOR_CARGADO = True
        self._engine = _MOTOR_COMPARTIDO
        self._engine_initialized = True
        return self._engine

    def _buscar_muestra_local(self, nombre_archivo: str) -> Optional[str]:
        """Busca si existe una muestra pre-extraída en tests/samples/txts/ como respaldo."""
        nombre_base = Path(nombre_archivo).stem
        raiz_repo = Path(__file__).resolve().parents[3]
        posibles_rutas = [
            raiz_repo / "tests" / "samples" / "txts" / f"{nombre_base}.txt",
            raiz_repo / "backend" / "tests" / "samples" / "txts" / f"{nombre_base}.txt",
            raiz_repo / "tests" / "samples" / f"{nombre_base}.txt",
            Path("tests/samples/txts") / f"{nombre_base}.txt",
            Path("backend/tests/samples/txts") / f"{nombre_base}.txt",
            Path("tests/samples") / f"{nombre_base}.txt",
        ]
        for ruta in posibles_rutas:
            if ruta.exists():
                try:
                    return ruta.read_text(encoding="utf-8").strip()
                except Exception:
                    pass
        return None

    def extraer_texto(
        self,
        archivo: Path | str | bytes | BinaryIO,
        nombre: str = "",
    ) -> dict[str, Any]:
        """Punto de entrada principal para extraer texto de un archivo.

        Devuelve un diccionario con:
        - texto: string completo formateado con encabezados de página.
        - paginas: número de páginas procesadas.
        - metodo: 'digital_pdf' | 'ocr_paddle' | 'texto_plano' | 'cache_muestra'.
        - bloques: lista de bloques con texto, confianza y coordenadas (si aplica).
        - advertencias: lista de avisos o advertencias.
        """
        # Caso 1: Archivo en bytes o stream -> guardar temporalmente para lectura uniforme
        if isinstance(archivo, (bytes, bytearray)):
            sufijo = Path(nombre).suffix if nombre else ".pdf"
            tmp = tempfile.NamedTemporaryFile(suffix=sufijo, delete=False)
            try:
                tmp.write(archivo)
                tmp.flush()
                tmp.close()
                tmp_path = Path(tmp.name)
                return self.extraer_texto(tmp_path, nombre=nombre or tmp_path.name)
            finally:
                Path(tmp.name).unlink(missing_ok=True)

        if hasattr(archivo, "read") and callable(getattr(archivo, "read")):
            contenido = archivo.read()
            if hasattr(archivo, "seek") and callable(getattr(archivo, "seek")):
                archivo.seek(0)
            return self.extraer_texto(contenido, nombre=nombre)

        # Caso 2: Ruta física en disco
        ruta = Path(archivo).resolve()
        if not ruta.exists():
            raise FileNotFoundError(f"El archivo no existe: {ruta}")

        nombre_archivo = nombre or ruta.name
        ext = ruta.suffix.lower()

        if ext not in EXTENSIONES_SOPORTADAS:
            raise ValueError(
                f"Formato no soportado '{ext}'. Se admiten: {', '.join(sorted(EXTENSIONES_SOPORTADAS))}"
            )

        # Subcaso 2.1: Archivo de texto plano
        if ext == ".txt":
            try:
                texto = ruta.read_text(encoding="utf-8").strip()
            except UnicodeDecodeError:
                texto = ruta.read_text(encoding="latin-1", errors="ignore").strip()
            return {
                "texto": texto,
                "paginas": 1,
                "metodo": "texto_plano",
                "bloques": [],
                "advertencias": [],
                "archivo": nombre_archivo,
            }

        # Subcaso 2.2: PDF (comprobar primero si contiene texto digital nativo)
        if ext == ".pdf":
            try:
                doc = pymupdf.open(ruta)
                paginas_digitales: list[tuple[int, str]] = []
                total_caracteres = 0

                for i, page in enumerate(doc, 1):
                    txt_pag = page.get_text().strip()
                    if txt_pag:
                        paginas_digitales.append((i, txt_pag))
                        total_caracteres += len(txt_pag)

                # Si el PDF tiene texto digital significativo (> 80 caracteres), usar extracción nativa rápida
                if total_caracteres > 80 and len(paginas_digitales) == len(doc):
                    texto_completo = "\n\n".join(
                        f"--- Página {num} ---\n{txt}" for num, txt in paginas_digitales
                    )
                    return {
                        "texto": texto_completo,
                        "paginas": len(doc),
                        "metodo": "digital_pdf",
                        "bloques": [],
                        "advertencias": [],
                        "archivo": nombre_archivo,
                    }
            except Exception as e:
                logger.warning("Fallo al inspeccionar texto nativo de %s: %s", nombre_archivo, e)

        # Subcaso 2.3: Documento escaneado o imagen (ejecutar OCR)
        engine = self._obtener_engine()
        if engine is not None:
            try:
                from app.agents.prueba3b.extract_pdf import extract

                with _CANDADO_OCR:
                    resultado_ocr = extract(
                        path=ruta,
                        engine=engine,
                        dpi=self.dpi,
                        quality=self.quality,
                    )
                paginas = resultado_ocr.get("pages", [])
                texto_paginas = [
                    f"--- Página {p['page']} ---\n{p['text']}"
                    for p in paginas
                    if p.get("text", "").strip()
                ]
                texto_final = "\n\n".join(texto_paginas)

                todos_bloques = []
                for p in paginas:
                    for b in p.get("blocks", []):
                        todos_bloques.append(
                            {
                                "pagina": p["page"],
                                "texto": b.get("text", ""),
                                "confianza": b.get("confidence", 0.0),
                                "bbox_px": b.get("bbox_px"),
                                "polygon_normalized": b.get("polygon_normalized"),
                            }
                        )

                return {
                    "texto": texto_final,
                    "paginas": len(paginas),
                    "metodo": "ocr_paddle",
                    "bloques": todos_bloques,
                    "paginas_detalle": paginas,
                    "advertencias": [w for p in paginas for w in p.get("warnings", [])],
                    "archivo": nombre_archivo,
                }
            except Exception as exc:
                logger.warning("Fallo durante ejecución de PaddleOCR en %s: %s", nombre_archivo, exc)

        # Subcaso 2.4: solo en pruebas, muestra pre-extraída con el mismo nombre de archivo
        muestra = self._buscar_muestra_local(nombre_archivo) if self.usar_muestras else None
        if muestra:
            return {
                "texto": muestra,
                "paginas": 1,
                "metodo": "cache_muestra",
                "bloques": [],
                "advertencias": ["ocr_no_disponible_usando_muestra_previa"],
                "archivo": nombre_archivo,
            }

        # Si no hubo forma de extraer
        return {
            "texto": "",
            "paginas": 0,
            "metodo": "fallido",
            "bloques": [],
            "advertencias": ["no_se_pudo_extraer_texto_requiere_paddleocr"],
            "archivo": nombre_archivo,
        }

    async def run(self, input: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Cumple el contrato BaseAgent.run().

        Puede recibir:
        - input como ruta a un archivo físico.
        - context con 'bytes' o 'archivo'.
        - input como texto plano ya extraído (en cuyo caso lo normaliza).
        """
        ctx = context or {}
        archivo = ctx.get("archivo") or ctx.get("bytes") or ctx.get("path") or input
        nombre = ctx.get("nombre", "")

        # Si input es una ruta existente en el sistema de archivos
        p = Path(str(archivo))
        if p.exists() and p.is_file():
            return self.extraer_texto(p, nombre=nombre or p.name)

        # Si ya es texto plano directo
        if input and not input.endswith(tuple(EXTENSIONES_SOPORTADAS)):
            return {
                "texto": input.strip(),
                "paginas": 1,
                "metodo": "texto_directo",
                "bloques": [],
                "advertencias": [],
                "archivo": nombre or "texto_en_memoria",
            }

        return self.extraer_texto(archivo, nombre=nombre)
