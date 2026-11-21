import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db.models import Expediente
from app.db.session import get_db
from app.schemas.expedientes import (
    ExpedienteOut,
    ReclasificarDocumento,
    TipoDocumentalOut,
)
from app.domain.documentos import AGENTE_POR_TIPO, ETIQUETAS, TipoDocumental
from app.services import expedientes as svc

router = APIRouter(tags=["expedientes"])


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
