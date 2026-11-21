import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models import Expediente
from app.db.session import get_db
from app.domain.documentos import AGENTE_POR_TIPO, ETIQUETAS, TipoDocumental
from app.schemas.expedientes import (
    ExpedienteOut,
    ReclasificarDocumento,
    TipoDocumentalOut,
)
from app.services import expedientes as svc
from app.services.expediente_service import ExpedienteService

router = APIRouter(tags=["expedientes"])


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


@router.post("/expedientes/analizar")
async def analizar_expediente(body: AnalizarExpedienteRequest) -> dict[str, Any]:
    """Endpoint principal de auditoría por JSON de textos:

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
        description="Hasta 4 archivos de texto (.txt) correspondientes a los documentos del expediente.",
    ),
    anio_referencia: Optional[int] = Form(
        None,
        description="Año de referencia fiscal para evaluar vigencia.",
    ),
) -> dict[str, Any]:
    """Permite subir directamente archivos .txt o extraídos desde el frontend / drag-and-drop
    y procesarlos a través de toda la cadena de auditoría.
    """
    if not archivos:
        raise HTTPException(status_code=400, detail="No se subieron archivos.")

    textos: list[str] = []
    nombres: list[str] = []

    for arch in archivos:
        contenido = await arch.read()
        texto = contenido.decode("utf-8", errors="ignore").strip()
        if texto:
            textos.append(texto)
            nombres.append(arch.filename or "archivo_sin_nombre")

    if not textos:
        raise HTTPException(
            status_code=400,
            detail="Los archivos subidos están vacíos o no contienen texto legible.",
        )

    service = ExpedienteService()
    resultado = await service.analizar_expediente(
        textos=textos,
        anio_referencia=anio_referencia,
    )
    resultado["archivos_recibidos"] = nombres
    return resultado
