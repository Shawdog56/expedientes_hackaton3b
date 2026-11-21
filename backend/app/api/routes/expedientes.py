import uuid
from contextlib import ExitStack
from pathlib import Path
from typing import Any, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.seguridad import requiere_entidad
from app.core.seguridad.errores import ConfiguracionSeguridadError, DescifradoError
from app.db.models import Expediente
from app.db.session import get_db
from app.domain.documentos import AGENTE_POR_TIPO, ETIQUETAS, MEDIA_TYPE_POR_FORMATO, TipoDocumental
from app.schemas.expedientes import (
    DecisionIn,
    ExpedienteOut,
    ReclasificarDocumento,
    TipoDocumentalOut,
)
from app.services import expedientes as svc
from app.services.expediente_service import ExpedienteService

router = APIRouter(tags=["expedientes"])

SIN_CLAVES = "El servidor no tiene configuradas las claves de cifrado (ver docs/seguridad.md)"


class AnalizarExpedienteRequest(BaseModel):
    textos: list[str] = Field(
        description="Lista de textos extraídos de los documentos (idealmente 4 documentos).",
        min_length=1,
    )
    anio_referencia: Optional[int] = Field(
        default=None,
        description="Año fiscal de referencia para evaluar vigencia del predial (por defecto el año en curso).",
    )


@router.get("/tipos-documentales", response_model=list[TipoDocumentalOut])
def tipos_documentales() -> list[TipoDocumentalOut]:
    return [
        TipoDocumentalOut(valor=t, etiqueta=ETIQUETAS[t], agente=AGENTE_POR_TIPO[t])
        for t in TipoDocumental
    ]


@router.post("/expedientes", response_model=ExpedienteOut, status_code=status.HTTP_201_CREATED)
def subir_expediente(
    archivos: list[UploadFile] = File(..., description="PDF, JPG o PNG sueltos/de una carpeta, o un .zip"),
    rutas: list[str] = Form(default=[], description="Ruta relativa de cada archivo, mismo orden"),
    nombre: str | None = Form(default=None),
    db: Session = Depends(get_db),
) -> Expediente:
    """Recibe un expediente: valida cada documento (PDF, JPG o PNG), descomprime los .zip y clasifica cada documento
    por tipo documental a partir de su nombre (o de su carpeta).

    Responde 201 con documentos (y su clasificación) y rechazados (con motivo).
    Si ningún documento es válido responde 422 con la lista de rechazados.
    """
    if rutas and len(rutas) != len(archivos):
        raise HTTPException(422, "'rutas' debe tener un elemento por archivo")

    subidos = [
        svc.ArchivoSubido(
            contenido=a.file,
            nombre=a.filename or "archivo",
            ruta=rutas[i] if rutas else (a.filename or "archivo"),
        )
        for i, a in enumerate(archivos)
    ]
    try:
        return svc.crear_expediente(db, nombre, subidos)
    except svc.SinDocumentosValidos as e:
        raise HTTPException(
            422, {"mensaje": "No se encontró ningún documento válido", "rechazados": e.rechazados}
        ) from None
    except ConfiguracionSeguridadError:
        raise HTTPException(503, SIN_CLAVES) from None


@router.get("/expedientes", response_model=list[ExpedienteOut])
def listar_expedientes(db: Session = Depends(get_db)) -> list[Expediente]:
    return svc.listar_expedientes(db)


@router.get("/expedientes/{expediente_id}", response_model=ExpedienteOut)
def obtener_expediente(expediente_id: uuid.UUID, db: Session = Depends(get_db)) -> Expediente:
    try:
        return svc.obtener_expediente(db, expediente_id)
    except LookupError:
        raise HTTPException(404, "Expediente no encontrado") from None


@router.delete("/expedientes/{expediente_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_expediente(expediente_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    try:
        svc.eliminar_expediente(db, expediente_id)
    except LookupError:
        raise HTTPException(404, "Expediente no encontrado") from None


@router.patch("/documentos/{documento_id}", response_model=ExpedienteOut)
def reclasificar_documento(
    documento_id: uuid.UUID, body: ReclasificarDocumento, db: Session = Depends(get_db)
) -> Expediente:
    """Asigna manualmente el tipo documental de un documento. Devuelve el expediente actualizado."""
    try:
        return svc.reclasificar_documento(db, documento_id, body.tipo_documental)
    except LookupError:
        raise HTTPException(404, "Documento no encontrado") from None


@router.get("/documentos/{documento_id}/archivo")
def ver_archivo(documento_id: uuid.UUID, db: Session = Depends(get_db)) -> StreamingResponse:
    """Devuelve el archivo original para verlo en el navegador (PDF, JPG o PNG).

    El tipo de contenido sale del formato validado al subirlo, nunca del nombre del archivo.
    """
    try:
        documento, contenido = svc.contenido_de_documento(db, documento_id)
    except LookupError:
        raise HTTPException(404, "Documento no encontrado") from None
    except DescifradoError:
        raise HTTPException(500, "No se pudo leer el archivo: está alterado o falta su clave") from None
    except ConfiguracionSeguridadError:
        raise HTTPException(503, SIN_CLAVES) from None
    return StreamingResponse(
        contenido,
        media_type=MEDIA_TYPE_POR_FORMATO[documento.formato],
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{quote(documento.nombre)}",
            "Content-Length": str(documento.tamano),
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.put("/expedientes/{expediente_id}/decision", response_model=ExpedienteOut)
def decidir_expediente(
    expediente_id: uuid.UUID,
    body: DecisionIn,
    db: Session = Depends(get_db),
    entidad: dict[str, Any] | None = Depends(requiere_entidad),
) -> Expediente:
    """Marca la decisión final (aceptado o rechazado) de la persona que revisa el expediente."""
    try:
        return svc.decidir_expediente(
            db, expediente_id, body.decision, entidad["sub"] if entidad else None
        )
    except LookupError:
        raise HTTPException(404, "Expediente no encontrado") from None
@router.post("/expedientes/analizar")
async def analizar_expediente(body: AnalizarExpedienteRequest) -> dict[str, Any]:
    """Endpoint de auditoría directa por JSON de textos:

    1. Clasifica y extrae características de cada documento con LangChain.
    2. Valida datos faltantes y vigencia del predial.
    3. Cruza claves catastrales, superficies y titulares.
    4. Emite el veredicto (Cumple, Requiere Revisión, No Cumple) y las 5 confianzas.
    """
    service = ExpedienteService()
    return await service.analizar_expediente(
        textos=body.textos,
        anio_referencia=body.anio_referencia,
    )


@router.post("/expedientes/subir-archivos")
async def analizar_archivos_subidos(
    archivos: list[UploadFile] = File(
        ...,
        description="Archivos PDF, imágenes (JPG, PNG) o texto (.txt) del expediente.",
    ),
    anio_referencia: Optional[int] = Form(
        None,
        description="Año de referencia fiscal para evaluar vigencia.",
    ),
) -> dict[str, Any]:
    """Permite subir directamente archivos PDF, JPG, PNG o TXT:

    1. El agente OCR extrae el texto de cada archivo (digital u OCR con PaddleOCR).
    2. Transporta los textos al ClasificadorAgent para su clasificación y extracción.
    3. Ejecuta la validación determinista y la validación cruzada.
    4. Devuelve el veredicto y reporte integral.
    """
    if not archivos:
        raise HTTPException(status_code=400, detail="No se subieron archivos.")

    entradas: list[tuple[str, bytes]] = []
    for arch in archivos:
        contenido = await arch.read()
        nombre = arch.filename or "archivo_sin_nombre"
        if contenido:
            entradas.append((nombre, contenido))

    if not entradas:
        raise HTTPException(
            status_code=400,
            detail="Los archivos subidos están vacíos o no contienen contenido legible.",
        )

    service = ExpedienteService()
    resultado = await service.auditar_archivos(
        archivos=entradas,
        anio_referencia=anio_referencia,
    )
    return resultado


@router.post("/expedientes/{expediente_id}/auditar")
async def auditar_expediente_guardado(
    expediente_id: uuid.UUID,
    anio_referencia: Optional[int] = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """Audita un expediente previamente cargado en el sistema y guardado en base de datos:

    1. Carga los documentos físicos asociados desde el almacenamiento local.
    2. Recupera el texto de cada documento mediante el agente OCR.
    3. Transporta los textos al ClasificadorAgent y al ValidadorCruzado.
    4. Devuelve el veredicto oficial de Tiendas 3B.
    """
    try:
        expediente = svc.obtener_expediente(db, expediente_id)
    except LookupError:
        raise HTTPException(404, "Expediente no encontrado") from None

    # Los archivos del volumen están cifrados: cada uno se abre como copia temporal en claro, que se
    # borra al terminar la auditoría. El OCR y el clasificador reciben rutas, como siempre.
    with ExitStack() as copias:
        documentos_fisicos: list[tuple[str, Path]] = []
        try:
            for doc in expediente.documentos:
                if Path(doc.ruta_almacenamiento).exists():
                    documentos_fisicos.append((doc.nombre, copias.enter_context(svc.documento_en_claro(doc))))
        except DescifradoError:
            raise HTTPException(500, "No se pudo leer un archivo: está alterado o falta su clave") from None
        except ConfiguracionSeguridadError:
            raise HTTPException(503, SIN_CLAVES) from None

        if not documentos_fisicos:
            raise HTTPException(
                status_code=422,
                detail="El expediente no cuenta con archivos físicos disponibles en disco para auditar.",
            )

        service = ExpedienteService()
        resultado = await service.auditar_archivos(
            archivos=documentos_fisicos,
            anio_referencia=anio_referencia,
        )
    resultado["expediente_id"] = str(expediente_id)
    resultado["nombre_expediente"] = expediente.nombre
    return resultado
