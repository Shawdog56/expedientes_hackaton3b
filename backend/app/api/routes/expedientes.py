from typing import Any, Optional
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.services.expediente_service import ExpedienteService

router = APIRouter(prefix="/expedientes", tags=["expedientes"])


class AnalizarExpedienteRequest(BaseModel):
    textos: list[str] = Field(
        description="Lista de textos extraídos de los documentos (idealmente 4 documentos).",
        min_length=1,
    )
    anio_referencia: Optional[int] = Field(
        default=None,
        description="Año fiscal de referencia para evaluar vigencia del predial (por defecto el año en curso).",
    )


@router.post("/analizar")
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


@router.post("/subir-archivos")
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
