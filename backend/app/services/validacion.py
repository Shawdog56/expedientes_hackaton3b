"""Validación de PDFs y extracción segura de ZIPs."""

import logging
import shutil
import zipfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import BinaryIO

from pypdf import PdfReader

from app.core.config import settings

logging.getLogger("pypdf").setLevel(logging.ERROR)

FIRMA_PDF = b"%PDF-"
FIRMAS_ZIP = (b"PK\x03\x04", b"PK\x05\x06")
ARCHIVOS_IGNORADOS = {".ds_store", "thumbs.db", "desktop.ini"}
CHUNK = 1024 * 1024
MB = 1024 * 1024


class ArchivoRechazado(Exception):
    def __init__(self, motivo: str):
        super().__init__(motivo)
        self.motivo = motivo


@dataclass
class ResultadoArchivo:
    ruta: str
    destino: Path | None = None
    tamano: int = 0
    paginas: int = 0
    motivo: str | None = None

    @property
    def aceptado(self) -> bool:
        return self.motivo is None


# --------------------------------------------------------------------- rutas


def sanear_ruta(ruta: str) -> str:
    """Normaliza una ruta relativa y rechaza rutas absolutas o con '..'."""
    ruta = ruta.replace("\\", "/")
    partes = []
    for parte in PurePosixPath(ruta).parts:
        if parte in ("", ".", "/"):
            continue
        if parte == ".." or ":" in parte:
            raise ArchivoRechazado("Ruta insegura dentro del archivo")
        limpia = "".join(c for c in parte if c.isprintable()).strip()
        if limpia:
            partes.append(limpia)
    if not partes:
        raise ArchivoRechazado("Nombre de archivo vacío")
    return "/".join(partes)


def es_ignorable(ruta: str) -> bool:
    """Basura de sistema que se descarta en silencio."""
    partes = ruta.split("/")
    nombre = partes[-1].lower()
    return "__MACOSX" in partes or nombre in ARCHIVOS_IGNORADOS or nombre.startswith("._")


def destino_seguro(base: Path, ruta: str) -> Path:
    """Resuelve la ruta dentro de `base`, evitando colisiones y escapes."""
    base = base.resolve()
    destino = (base / ruta).resolve()
    if not destino.is_relative_to(base):
        raise ArchivoRechazado("Ruta insegura dentro del archivo")
    if destino.exists():
        n = 1
        while (candidato := destino.with_stem(f"{destino.stem} ({n})")).exists():
            n += 1
        destino = candidato
    destino.parent.mkdir(parents=True, exist_ok=True)
    return destino


# ------------------------------------------------------------------ copiado


def copiar_con_limite(origen: BinaryIO, destino: Path, limite: int, etiqueta: str) -> int:
    """Copia por bloques cortando si se supera `limite` (no confía en tamaños declarados)."""
    total = 0
    try:
        with open(destino, "wb") as out:
            while chunk := origen.read(CHUNK):
                total += len(chunk)
                if total > limite:
                    raise ArchivoRechazado(
                        f"{etiqueta} excede el tamaño máximo de {limite // MB} MB"
                    )
                out.write(chunk)
    except ArchivoRechazado:
        destino.unlink(missing_ok=True)
        raise
    return total


def leer_cabecera(f: BinaryIO, n: int = 8) -> bytes:
    pos = f.tell()
    cabecera = f.read(n)
    f.seek(pos)
    return cabecera


def es_zip(nombre: str, cabecera: bytes) -> bool:
    return nombre.lower().endswith(".zip") or cabecera.startswith(FIRMAS_ZIP)


# --------------------------------------------------------------------- PDF


def validar_pdf(path: Path) -> int:
    """Valida que el archivo sea un PDF legible. Devuelve el número de páginas."""
    with open(path, "rb") as f:
        cabecera = f.read(1024)
    if FIRMA_PDF not in cabecera:
        raise ArchivoRechazado("No es un PDF válido (firma %PDF ausente)")

    try:
        reader = PdfReader(path)
        if reader.is_encrypted and not reader.decrypt(""):
            raise ArchivoRechazado("PDF protegido con contraseña")
        paginas = len(reader.pages)
    except ArchivoRechazado:
        raise
    except Exception as e:  # pypdf lanza errores muy variados en PDFs corruptos
        raise ArchivoRechazado(f"PDF dañado o ilegible ({type(e).__name__})") from e

    if paginas == 0:
        raise ArchivoRechazado("PDF sin páginas")
    return paginas


def guardar_pdf(origen: BinaryIO, ruta: str, base: Path) -> ResultadoArchivo:
    """Guarda un PDF subido directamente y lo valida."""
    if not ruta.lower().endswith(".pdf"):
        return ResultadoArchivo(ruta, motivo="Tipo de archivo no permitido (solo PDF o ZIP)")
    try:
        destino = destino_seguro(base, ruta)
    except ArchivoRechazado as e:
        return ResultadoArchivo(ruta, motivo=e.motivo)
    try:
        tamano = copiar_con_limite(origen, destino, settings.max_pdf_bytes, "El PDF")
        paginas = validar_pdf(destino)
    except ArchivoRechazado as e:
        destino.unlink(missing_ok=True)
        return ResultadoArchivo(ruta, motivo=e.motivo)
    return ResultadoArchivo(ruta, destino, tamano, paginas)


# --------------------------------------------------------------------- ZIP


def _nombre_miembro(info: zipfile.ZipInfo) -> str:
    """Corrige nombres sin flag UTF-8 (los zips de Windows suelen venir en cp437/utf-8 mezclado)."""
    if info.flag_bits & 0x800:
        return info.filename
    try:
        return info.filename.encode("cp437").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return info.filename


def extraer_zip(zip_path: Path, base: Path) -> Iterator[ResultadoArchivo]:
    """Extrae solo los PDFs válidos de un ZIP, con protección contra zip-slip y zip bombs."""
    try:
        zf = zipfile.ZipFile(zip_path)
    except (zipfile.BadZipFile, OSError) as e:
        raise ArchivoRechazado("ZIP dañado o inválido") from e

    with zf:
        miembros = [i for i in zf.infolist() if not i.is_dir()]
        if len(miembros) > settings.max_archivos_zip:
            raise ArchivoRechazado(
                f"El ZIP contiene demasiados archivos (máximo {settings.max_archivos_zip})"
            )
        if sum(i.file_size for i in miembros) > settings.max_zip_descomprimido_bytes:
            raise ArchivoRechazado(
                f"El contenido descomprimido excede {settings.max_zip_descomprimido_mb} MB"
            )

        descomprimido = 0
        for info in miembros:
            nombre = _nombre_miembro(info)
            try:
                ruta = sanear_ruta(nombre)
            except ArchivoRechazado as e:
                yield ResultadoArchivo(nombre, motivo=e.motivo)
                continue

            if es_ignorable(ruta):
                continue
            if info.flag_bits & 0x1:
                yield ResultadoArchivo(ruta, motivo="Archivo cifrado dentro del ZIP")
                continue
            if ruta.lower().endswith(".zip"):
                yield ResultadoArchivo(ruta, motivo="ZIP anidado no soportado")
                continue
            if not ruta.lower().endswith(".pdf"):
                yield ResultadoArchivo(ruta, motivo="Tipo de archivo no permitido (solo PDF)")
                continue
            if (
                info.compress_size
                and info.file_size / info.compress_size > settings.max_ratio_compresion
            ):
                yield ResultadoArchivo(ruta, motivo="Ratio de compresión sospechoso")
                continue

            destino = destino_seguro(base, ruta)
            try:
                restante = settings.max_zip_descomprimido_bytes - descomprimido
                limite = min(settings.max_pdf_bytes, restante)
                with zf.open(info) as src:
                    tamano = copiar_con_limite(src, destino, limite, "El PDF")
                descomprimido += tamano
                paginas = validar_pdf(destino)
            except ArchivoRechazado as e:
                destino.unlink(missing_ok=True)
                yield ResultadoArchivo(ruta, motivo=e.motivo)
                continue
            except (zipfile.BadZipFile, RuntimeError, OSError, EOFError) as e:
                destino.unlink(missing_ok=True)
                yield ResultadoArchivo(ruta, motivo=f"No se pudo extraer ({type(e).__name__})")
                continue

            yield ResultadoArchivo(ruta, destino, tamano, paginas)


def procesar_zip(origen: BinaryIO, nombre: str, base: Path, tmp_dir: Path) -> list[ResultadoArchivo]:
    """Guarda el ZIP subido en un temporal, lo extrae y elimina el temporal."""
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp = tmp_dir / "subida.zip"
    try:
        copiar_con_limite(origen, tmp, settings.max_zip_bytes, "El ZIP")
        if not zipfile.is_zipfile(tmp):
            raise ArchivoRechazado("No es un ZIP válido")
        resultados = list(extraer_zip(tmp, base))
    except ArchivoRechazado as e:
        return [ResultadoArchivo(nombre, motivo=e.motivo)]
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
    if not resultados:
        return [ResultadoArchivo(nombre, motivo="El ZIP no contiene archivos")]
    return resultados
