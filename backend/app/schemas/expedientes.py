import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

from app.domain.documentos import EstadoClasificacion, FormatoArchivo, TipoDocumental
from app.domain.estados import DecisionFinal, EstadoExpediente, EstadoExtraccion


class DocumentoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    ruta: str
    tamano: int
    paginas: int
    formato: FormatoArchivo
    tipo_documental: TipoDocumental | None
    estado_clasificacion: EstadoClasificacion
    fuente_clasificacion: str | None
    agente: str | None
    estado_extraccion: EstadoExtraccion


class ArchivoRechazadoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ruta: str
    motivo: str


class ExpedienteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    origen: Literal["carpeta", "zip"]
    estado: EstadoExpediente
    creado_en: datetime
    documentos: list[DocumentoOut]
    rechazados: list[ArchivoRechazadoOut]
    tipos_faltantes: list[TipoDocumental]
    tipos_duplicados: list[TipoDocumental]
    completo: bool
    decision_final: DecisionFinal | None
    decidido_en: datetime | None
    decidido_por: str | None

    @field_validator("documentos")
    @classmethod
    def _ordenar_documentos(cls, documentos: list[DocumentoOut]) -> list[DocumentoOut]:
        # La ruta está cifrada en la base y no se puede ordenar con SQL: se ordena aquí.
        return sorted(documentos, key=lambda doc: doc.ruta)


class DecisionIn(BaseModel):
    decision: DecisionFinal


class ReclasificarDocumento(BaseModel):
    tipo_documental: TipoDocumental | None


class TipoDocumentalOut(BaseModel):
    valor: TipoDocumental
    etiqueta: str
    agente: str
