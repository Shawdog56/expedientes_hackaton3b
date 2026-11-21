"""Modelo de datos del flujo:

carga -> clasificación -> extracción (agentes especialistas) -> validación cruzada (orquestador) -> verificación
"""

import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import BigInteger, DateTime, Enum, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.db.tipos import JSONCifrado, TextoCifrado
from app.domain.documentos import AGENTE_POR_TIPO, EstadoClasificacion, FormatoArchivo, TipoDocumental
from app.domain.estados import (  # noqa: F401  (reexportados para compatibilidad)
    EstadoExpediente,
    EstadoExtraccion,
    ResultadoValidacion,
)

def ahora() -> datetime:
    return datetime.now(UTC)


def enum_col(enum: type[StrEnum], **kwargs: Any):
    """Enum guardado como VARCHAR + CHECK (evita migraciones de tipos ENUM nativos)."""
    return Enum(
        enum,
        native_enum=False,
        length=40,
        values_callable=lambda e: [m.value for m in e],
        validate_strings=True,
        **kwargs,
    )


class Expediente(Base):
    __tablename__ = "expedientes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(255))
    origen: Mapped[str] = mapped_column(String(20))  # carpeta | zip
    estado: Mapped[EstadoExpediente] = mapped_column(
        enum_col(EstadoExpediente), default=EstadoExpediente.CARGADO
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=ahora, onupdate=ahora
    )

    documentos: Mapped[list["Documento"]] = relationship(
        back_populates="expediente", cascade="all, delete-orphan", order_by="Documento.ruta"
    )
    rechazados: Mapped[list["ArchivoRechazado"]] = relationship(
        back_populates="expediente", cascade="all, delete-orphan"
    )
    validaciones: Mapped[list["ValidacionCruzada"]] = relationship(
        back_populates="expediente",
        cascade="all, delete-orphan",
        order_by="ValidacionCruzada.creada_en.desc()",
    )

    def _conteo_tipos(self) -> dict[TipoDocumental, int]:
        conteo = {tipo: 0 for tipo in TipoDocumental}
        for doc in self.documentos:
            if doc.tipo_documental:
                conteo[doc.tipo_documental] += 1
        return conteo

    @property
    def tipos_faltantes(self) -> list[TipoDocumental]:
        return [tipo for tipo, n in self._conteo_tipos().items() if n == 0]

    @property
    def tipos_duplicados(self) -> list[TipoDocumental]:
        return [tipo for tipo, n in self._conteo_tipos().items() if n > 1]

    @property
    def completo(self) -> bool:
        return not self.tipos_faltantes


class Documento(Base):
    """Documento (PDF o imagen) validado y guardado en disco; unidad de trabajo para un agente especialista."""

    __tablename__ = "documentos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    expediente_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("expedientes.id", ondelete="CASCADE"), index=True
    )
    nombre: Mapped[str] = mapped_column(String(255))
    ruta: Mapped[str] = mapped_column(String(1024))  # ruta relativa dentro del expediente
    ruta_almacenamiento: Mapped[str] = mapped_column(String(1024))  # ruta absoluta en el volumen
    tamano: Mapped[int] = mapped_column(BigInteger)
    paginas: Mapped[int]  # las imágenes cuentan como 1
    formato: Mapped[FormatoArchivo] = mapped_column(
        enum_col(FormatoArchivo), default=FormatoArchivo.PDF, server_default=FormatoArchivo.PDF.value
    )
    sha256: Mapped[str] = mapped_column(String(64), index=True)

    tipo_documental: Mapped[TipoDocumental | None] = mapped_column(
        enum_col(TipoDocumental), index=True
    )
    estado_clasificacion: Mapped[EstadoClasificacion] = mapped_column(
        enum_col(EstadoClasificacion)
    )
    fuente_clasificacion: Mapped[str | None] = mapped_column(String(20))  # nombre | carpeta | manual
    estado_extraccion: Mapped[EstadoExtraccion] = mapped_column(
        enum_col(EstadoExtraccion), default=EstadoExtraccion.PENDIENTE
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)

    expediente: Mapped[Expediente] = relationship(back_populates="documentos")
    extracciones: Mapped[list["Extraccion"]] = relationship(
        back_populates="documento", cascade="all, delete-orphan"
    )

    @property
    def agente(self) -> str | None:
        return AGENTE_POR_TIPO.get(self.tipo_documental) if self.tipo_documental else None


class ArchivoRechazado(Base):
    __tablename__ = "archivos_rechazados"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    expediente_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("expedientes.id", ondelete="CASCADE"), index=True
    )
    ruta: Mapped[str] = mapped_column(String(1024))
    motivo: Mapped[str] = mapped_column(String(500))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)

    expediente: Mapped[Expediente] = relationship(back_populates="rechazados")


class Extraccion(Base):
    """Salida de un agente especialista sobre un documento (una fila por intento)."""

    __tablename__ = "extracciones"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    documento_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documentos.id", ondelete="CASCADE"), index=True
    )
    agente: Mapped[str] = mapped_column(String(100))
    modelo: Mapped[str | None] = mapped_column(String(100))
    estado: Mapped[EstadoExtraccion] = mapped_column(
        enum_col(EstadoExtraccion), default=EstadoExtraccion.EN_PROCESO
    )
    # Características extraídas, p. ej. {"folio": "...", "propietario": "...", "superficie_m2": 120}
    # Se guarda cifrado (AES-256-GCM): en la base es texto ilegible.
    caracteristicas: Mapped[dict[str, Any] | None] = mapped_column(
        JSONCifrado("extracciones.caracteristicas")
    )
    confianza: Mapped[float | None] = mapped_column(Float)
    error: Mapped[str | None] = mapped_column(Text)
    iniciada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)
    terminada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    documento: Mapped[Documento] = relationship(back_populates="extracciones")


class ValidacionCruzada(Base):
    """Resultado del agente orquestador sobre todo el expediente."""

    __tablename__ = "validaciones_cruzadas"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    expediente_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("expedientes.id", ondelete="CASCADE"), index=True
    )
    resultado: Mapped[ResultadoValidacion] = mapped_column(enum_col(ResultadoValidacion))
    resumen: Mapped[str | None] = mapped_column(TextoCifrado("validaciones_cruzadas.resumen"))
    modelo: Mapped[str | None] = mapped_column(String(100))
    creada_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=ahora)

    expediente: Mapped[Expediente] = relationship(back_populates="validaciones")
    hallazgos: Mapped[list["Hallazgo"]] = relationship(
        back_populates="validacion", cascade="all, delete-orphan"
    )


class Hallazgo(Base):
    """Una regla de la validación cruzada, p. ej. 'el propietario coincide en escritura y predial'."""

    __tablename__ = "hallazgos"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    validacion_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("validaciones_cruzadas.id", ondelete="CASCADE"), index=True
    )
    regla: Mapped[str] = mapped_column(String(100))
    resultado: Mapped[ResultadoValidacion] = mapped_column(enum_col(ResultadoValidacion))
    mensaje: Mapped[str] = mapped_column(TextoCifrado("hallazgos.mensaje"))
    # Valores comparados y documentos involucrados: {"escrituras": "Juan P.", "predial": "Juan Pérez", "documentos": [...]}
    evidencia: Mapped[dict[str, Any] | None] = mapped_column(JSONCifrado("hallazgos.evidencia"))

    validacion: Mapped[ValidacionCruzada] = relationship(back_populates="hallazgos")
