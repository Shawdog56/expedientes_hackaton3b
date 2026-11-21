/**
 * Traduce el resultado real de la auditoría (OCR + modelo + validación cruzada del backend) a lo que
 * pintan las pantallas del análisis: estado de cada punto de validación, dictamen y detalle por punto.
 */
import type { DocumentoAuditado, FaseDocumento, HallazgoAuditoria, ResultadoAuditoria } from '../api/expedientes';
import type { Dictamen, DocumentoAnalisis, EstadoRegla } from './useSimulatedAnalysis';
import type { EstadoValidacion, TipoDocumentalId } from './validationRules';

/** Avance de la auditoría real mientras corre: fase de cada documento y lugar en la cola. */
export interface ProgresoReal {
  documentos: { id: string; nombre: string; fase: FaseDocumento }[];
  listos: number;
  total: number;
  delante: number;
  iniciadaEn: string;
}

/** Lo que se muestra al abrir un punto de validación con datos reales. */
export interface DetalleRegla {
  documento: string | null;
  valores: { campo: string; valor: string }[];
  notas: string[];
}

/** Clase que devuelve el clasificador para cada tipo documental del frontend. */
const CLASE_POR_TIPO: Record<TipoDocumentalId, string> = {
  escrituras: 'escritura',
  predial: 'predial',
  alineamiento: 'alineamiento y número oficial',
  uso_suelo: 'uso de suelo',
};

const CRUZADA = 'cruzada' as const;

/** Campos extraídos por el modelo que respaldan cada punto (o `cruzada` si sale de la validación cruzada). */
const CAMPOS_POR_REGLA: Record<TipoDocumentalId, Record<string, string[] | typeof CRUZADA>> = {
  escrituras: {
    titular: ['titular_o_comprador'],
    direccion: ['direccion_inmueble'],
    superficie: ['superficie_terreno_m2'],
    datos_relevantes: ['numero_escritura_o_instrumento', 'fecha_escritura', 'notario_y_notaria', 'tipo_acto'],
    relacion_expediente: CRUZADA,
  },
  predial: {
    contribuyente: ['propietario_o_contribuyente'],
    direccion: ['direccion'],
    clave_predial: ['clave_catastral'],
    superficie_registrada: ['superficie_terreno_m2'],
    relacion_documentos: CRUZADA,
  },
  alineamiento: {
    direccion_oficial: ['direccion_oficial'],
    numero_oficial: ['numero_oficial_asignado'],
    identificacion_predio: ['clave_catastral'],
    alineamiento_autoridad: ['alineamiento_medidas'],
    vigencia: ['fecha_emision', 'vigencia'],
    autoridad_emisora: ['autoridad_emisora'],
  },
  uso_suelo: {
    direccion: ['direccion_inmueble'],
    uso_autorizado: ['uso_autorizado', 'giro_permitido'],
    compatibilidad: ['es_comercial'],
    restricciones: ['restricciones'],
    superficie_aplicable: ['superficie_terreno_m2'],
    vigencia: ['fecha_emision', 'vigencia'],
    autoridad_emisora: ['autoridad_emisora'],
  },
};

/** Reglas de la validación cruzada que bajan un punto a "no cumple" o a "revisar". */
const CRUZADAS_NO_CUMPLE = new Set(['discrepancia_clave_catastral', 'superficie_discrepancia_grave']);
const CRUZADAS_REVISAR = new Set(['superficie_discrepancia_menor', 'discrepancia_titulares', 'clave_catastral_parcial']);

const NOMBRE_CAMPO: Record<string, string> = {
  titular_o_comprador: 'Titular o comprador',
  propietario_o_contribuyente: 'Contribuyente',
  direccion_inmueble: 'Dirección',
  direccion: 'Dirección',
  direccion_oficial: 'Dirección oficial',
  superficie_terreno_m2: 'Superficie del terreno (m²)',
  clave_catastral: 'Clave catastral',
  numero_escritura_o_instrumento: 'Número de escritura',
  fecha_escritura: 'Fecha',
  notario_y_notaria: 'Notario',
  tipo_acto: 'Acto',
  numero_oficial_asignado: 'Número oficial',
  alineamiento_medidas: 'Alineamiento',
  fecha_emision: 'Fecha de emisión',
  vigencia: 'Vigencia',
  autoridad_emisora: 'Autoridad emisora',
  uso_autorizado: 'Uso autorizado',
  giro_permitido: 'Giro permitido',
  es_comercial: '¿Permite uso comercial?',
  restricciones: 'Restricciones',
};

export function dictamenDesdeVeredicto(veredicto: string | undefined): Dictamen {
  const normal = (veredicto ?? '').toLowerCase();
  if (normal.startsWith('cumple')) return 'cumple';
  if (normal.startsWith('no cumple')) return 'no_cumple';
  return 'revision';
}

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
  return String(valor);
}

function todosLosHallazgos(resultado: ResultadoAuditoria): HallazgoAuditoria[] {
  return [
    ...(resultado.hallazgos_criticos ?? []),
    ...(resultado.hallazgos_advertencias ?? []),
    ...(resultado.hallazgos_conformes ?? []),
  ];
}

/** Documento auditado que corresponde a un tipo: el que el usuario clasificó así, o el que el modelo reconoció. */
function documentoDelTipo(
  documento: DocumentoAnalisis,
  resultado: ResultadoAuditoria,
): DocumentoAuditado | undefined {
  const ids = new Set(documento.archivos.map((archivo) => archivo.id));
  return (
    resultado.documentos.find((doc) => doc.documento_id && ids.has(doc.documento_id)) ??
    resultado.documentos.find((doc) => doc.clase === CLASE_POR_TIPO[documento.tipoId])
  );
}

function evaluarRegla(
  tipoId: TipoDocumentalId,
  reglaId: string,
  doc: DocumentoAuditado | undefined,
  resultado: ResultadoAuditoria,
): { estado: EstadoValidacion; detalle: DetalleRegla } {
  const definicion = CAMPOS_POR_REGLA[tipoId][reglaId];
  const notasDocumento = doc?.observaciones ?? [];

  if (definicion === CRUZADA || definicion === undefined) {
    const hallazgos = todosLosHallazgos(resultado).filter(
      (h) => CRUZADAS_NO_CUMPLE.has(h.regla) || CRUZADAS_REVISAR.has(h.regla) ||
        ['clave_catastral_identica', 'superficie_coherente', 'titular_coincidente'].includes(h.regla),
    );
    const estado: EstadoValidacion = hallazgos.some((h) => CRUZADAS_NO_CUMPLE.has(h.regla))
      ? 'no_cumple'
      : hallazgos.some((h) => CRUZADAS_REVISAR.has(h.regla)) || !doc
        ? 'revisar'
        : 'verificado';
    return {
      estado,
      detalle: { documento: doc?.archivo ?? null, valores: [], notas: hallazgos.map((h) => h.descripcion) },
    };
  }

  const campos = doc?.campos_normalizados ?? doc?.campos ?? {};
  const valores = definicion
    .map((campo) => ({ campo: NOMBRE_CAMPO[campo] ?? campo, valor: texto(campos[campo]) }))
    .filter((v): v is { campo: string; valor: string } => v.valor !== null);

  let estado: EstadoValidacion = valores.length > 0 ? 'verificado' : 'revisar';
  if (tipoId === 'uso_suelo' && reglaId === 'compatibilidad' && campos.es_comercial === false) estado = 'no_cumple';
  if (!doc) estado = 'revisar';

  const notas = [...notasDocumento];
  if (valores.length === 0) notas.unshift('El modelo no encontró este dato en el documento.');
  return { estado, detalle: { documento: doc?.archivo ?? null, valores, notas } };
}

/** Aplica el resultado real a los documentos del análisis: estado y detalle de cada punto. */
export function documentosConResultado(
  documentos: DocumentoAnalisis[],
  resultado: ResultadoAuditoria,
): DocumentoAnalisis[] {
  return documentos.map((documento) => {
    if (documento.faltante) return documento;
    const doc = documentoDelTipo(documento, resultado);
    const reglas: EstadoRegla[] = documento.reglas.map((regla) => {
      const { estado, detalle } = evaluarRegla(documento.tipoId, regla.id, doc, resultado);
      return { ...regla, estado, detalle };
    });
    return { ...documento, reglas };
  });
}

/** Confianza 0-100 del backend en los tres niveles que muestra la interfaz. */
export function nivelDeConfianza(confianza: number | undefined): 'alta' | 'media' | 'baja' {
  if ((confianza ?? 0) >= 80) return 'alta';
  if ((confianza ?? 0) >= 60) return 'media';
  return 'baja';
}
