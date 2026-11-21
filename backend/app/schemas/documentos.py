from typing import Any, Literal, Optional
from pydantic import BaseModel, Field

TipoDocumento = Literal[
    "predial",
    "escritura",
    "alineamiento y número oficial",
    "uso de suelo",
    "ninguna",
]


class ClasificacionDocumento(BaseModel):
    """Clasificación inicial, resumen y evidencia obtenida mediante LangChain."""

    resumen: str = Field(
        description="Resumen conciso de 2 a 3 líneas del propósito principal y contenido del documento."
    )
    evidencia: str = Field(
        description="Cita textual breve o términos clave del texto que justifican la clase asignada."
    )
    conflictos: str = Field(
        default="Ninguno",
        description="Términos de otros trámites, ruido de OCR o ambigüedad detectada. Si no hay, escribir 'Ninguno'.",
    )
    clase: TipoDocumento = Field(
        description="Debe ser EXACTAMENTE una de las 5 etiquetas permitidas: predial, escritura, alineamiento y número oficial, uso de suelo, ninguna."
    )
    confianza_llm: int = Field(
        ge=0,
        le=100,
        description="Porcentaje entero de 0 a 100 de certeza de la clasificación según la rúbrica.",
    )
    nota: Optional[str] = Field(
        default=None,
        description="Aclaración adicional obligatoria si confianza < 75 o clase == 'ninguna'.",
    )


class CamposPredial(BaseModel):
    """Características vitales extraídas de boletas o comprobantes de pago de predial."""

    propietario_o_contribuyente: Optional[str] = Field(
        default=None,
        description="Nombre completo de la persona física o moral registrada como contribuyente o propietario.",
    )
    direccion: Optional[str] = Field(
        default=None,
        description="Ubicación o domicilio registrado del predio (calle, número, colonia, municipio).",
    )
    clave_catastral: Optional[str] = Field(
        default=None,
        description="Clave catastral completa del inmueble (secuencia numérica o alfanumérica).",
    )
    superficie_terreno_m2: Optional[float] = Field(
        default=None,
        description="Superficie total de terreno propio en metros cuadrados (solo el número decimal).",
    )
    superficie_construccion_m2: Optional[float] = Field(
        default=None,
        description="Superficie construida en metros cuadrados (solo número decimal).",
    )
    ejercicio_o_periodo: Optional[str] = Field(
        default=None,
        description="Año fiscal o periodo cubierto (ej. '2025', '01-2025 12-2025', 'ENE-DIC 2024').",
    )
    valor_catastral: Optional[float] = Field(
        default=None,
        description="Valor catastral registrado del predio en pesos.",
    )
    total_pagado: Optional[float] = Field(
        default=None,
        description="Monto total liquidado o a pagar en pesos.",
    )
    folio_o_recibo: Optional[str] = Field(
        default=None,
        description="Folio de recibo, serie, número de caja o UUID/folio fiscal del CFDI.",
    )
    es_comprobante_pago: Optional[bool] = Field(
        default=None,
        description="True si cuenta con certificación, sello digital, recibo de caja pagado o CFDI. False si es una línea de captura o formato preliminar de ventanilla que advierte 'este documento no es el comprobante de pago'.",
    )
    autoridad_emisora: Optional[str] = Field(
        default=None,
        description="Municipio, Ayuntamiento o Tesorería que emite el documento.",
    )


class CamposEscritura(BaseModel):
    """Características vitales extraídas de escrituras públicas o títulos de propiedad."""

    titular_o_comprador: Optional[str] = Field(
        default=None,
        description="Nombre del adquirente, comprador o titular favorecido en el acto o sentencia.",
    )
    vendedor: Optional[str] = Field(
        default=None,
        description="Nombre de la parte vendedora o transmitente original, si aplica.",
    )
    direccion_inmueble: Optional[str] = Field(
        default=None,
        description="Ubicación precisa del inmueble (calle, número, lote, manzana, colonia, municipio).",
    )
    clave_catastral: Optional[str] = Field(
        default=None,
        description="Clave catastral citada en los antecedentes del inmueble.",
    )
    superficie_terreno_m2: Optional[float] = Field(
        default=None,
        description="Superficie total de terreno amparada en metros cuadrados (solo número decimal).",
    )
    medidas_y_colindancias: Optional[str] = Field(
        default=None,
        description="Descripción de los linderos y colindancias (al norte, sur, oriente, poniente).",
    )
    numero_escritura_o_instrumento: Optional[str] = Field(
        default=None,
        description="Número de escritura pública, instrumento notarial o expediente de juicio.",
    )
    volumen_o_libro: Optional[str] = Field(
        default=None,
        description="Volumen, tomo o libro notarial.",
    )
    notario_y_notaria: Optional[str] = Field(
        default=None,
        description="Nombre del Notario Público y número o adscripción de la Notaría.",
    )
    tipo_acto: Optional[str] = Field(
        default=None,
        description="Tipo de acto jurídico (ej. 'Compraventa', 'Sentencia Definitiva - Información de Dominio', 'Relotificación').",
    )
    folio_real_o_registro: Optional[str] = Field(
        default=None,
        description="Datos de inscripción en el Registro Público de la Propiedad o Instituto de la Función Registral.",
    )
    fecha_escritura: Optional[str] = Field(
        default=None,
        description="Fecha en que se otorgó la escritura o se dictó la sentencia definitiva.",
    )


class CamposUsoSuelo(BaseModel):
    """Características vitales extraídas de licencias o certificados de uso de suelo."""

    titular_o_solicitante: Optional[str] = Field(
        default=None,
        description="Nombre del solicitante, titular o persona a favor de quien se expide.",
    )
    direccion_inmueble: Optional[str] = Field(
        default=None,
        description="Ubicación oficial del predio en la licencia.",
    )
    clave_catastral: Optional[str] = Field(
        default=None,
        description="Clave catastral del predio.",
    )
    superficie_terreno_m2: Optional[float] = Field(
        default=None,
        description="Superficie de terreno amparada en m².",
    )
    uso_autorizado: Optional[str] = Field(
        default=None,
        description="Clasificación general de uso (ej. 'COMERCIAL', 'HABITACIONAL', 'CENTRO URBANO', 'CORREDOR URBANO').",
    )
    giro_permitido: Optional[str] = Field(
        default=None,
        description="Giro específico o actividad puntual autorizada (ej. 'Minisúper', 'Comercio básico', 'Vivienda unifamiliar').",
    )
    es_comercial: Optional[bool] = Field(
        default=None,
        description="True si el uso o giro permite actividades comerciales compatibles con tienda/minisúper. False si es exclusivamente habitacional o prohíbe comercio.",
    )
    restricciones: Optional[str] = Field(
        default=None,
        description="Restricciones o condicionantes expresas descritas en la licencia.",
    )
    vigencia: Optional[str] = Field(
        default=None,
        description="Fecha de vencimiento o plazo de vigencia señalado en el documento.",
    )
    fecha_emision: Optional[str] = Field(
        default=None,
        description="Fecha en que fue expedida la licencia.",
    )
    folio_o_expediente: Optional[str] = Field(
        default=None,
        description="Folio o número de expediente de la licencia.",
    )
    autoridad_emisora: Optional[str] = Field(
        default=None,
        description="Dirección de Desarrollo Urbano o Municipio que expide.",
    )


class CamposAlineamiento(BaseModel):
    """Características vitales extraídas de constancias de alineamiento y número oficial."""

    titular_o_propietario: Optional[str] = Field(
        default=None,
        description="Nombre del propietario o promovente a quien se le expide.",
    )
    direccion_oficial: Optional[str] = Field(
        default=None,
        description="Dirección y vialidad oficial asignada al predio.",
    )
    numero_oficial_asignado: Optional[str] = Field(
        default=None,
        description="Número oficial asignado por la autoridad (ej. '174', '15', '104'). Si no asigna, indicar 'S/N' o null.",
    )
    clave_catastral: Optional[str] = Field(
        default=None,
        description="Clave catastral asociada al predio.",
    )
    superficie_terreno_m2: Optional[float] = Field(
        default=None,
        description="Superficie de terreno indicada en el croquis o datos del predio en m².",
    )
    alineamiento_medidas: Optional[str] = Field(
        default=None,
        description="Datos del croquis o especificación de frente, sección de calle o restricciones al frente.",
    )
    fecha_emision: Optional[str] = Field(
        default=None,
        description="Fecha de emisión de la constancia.",
    )
    vigencia: Optional[str] = Field(
        default=None,
        description="Vigencia establecida (ej. 'un año', 'indefinida', fecha exacta).",
    )
    folio_o_expediente: Optional[str] = Field(
        default=None,
        description="Folio oficial, número de expediente de alineamiento o número oficial.",
    )
    autoridad_emisora: Optional[str] = Field(
        default=None,
        description="Dirección de Desarrollo Urbano o dependencia municipal emisora.",
    )
    documento_antecedente_propiedad: Optional[str] = Field(
        default=None,
        description="Título o contrato con el que el propietario acreditó sus derechos ante la autoridad, si se cita.",
    )


class ResultadoDocumento(BaseModel):
    """Contrato final devuelto por el ClasificadorAgent."""

    clase: TipoDocumento
    confianza: int = Field(
        ge=0,
        le=100,
        description="Nivel de confianza real calibrado combinando LLM, completitud y léxico.",
    )
    confianza_llm: int = Field(ge=0, le=100)
    confianza_detalle: dict[str, Any] = Field(default_factory=dict)
    resumen: str
    evidencia: str
    conflictos: str
    nota: Optional[str] = None
    campos: dict[str, Any] = Field(default_factory=dict)
