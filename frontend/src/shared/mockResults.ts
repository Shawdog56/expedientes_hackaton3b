import type { Dictamen } from './useSimulatedAnalysis';
import type { TipoDocumentalId } from './validationRules';

export type Confianza = 'alta' | 'media' | 'baja';

export interface EvidenciaPunto {
  valorEncontrado: string;
  pagina: number;
  fragmento: string;
}

/** Evidencia de ejemplo para cada punto, en estado "verificado". Clave: `${tipoId}:${reglaId}`. */
export const EVIDENCIA_POR_PUNTO: Record<string, EvidenciaPunto> = {
  'escrituras:titular': {
    valorEncontrado: 'Juan Carlos Mendoza Ruiz',
    pagina: 1,
    fragmento: '«...el C. JUAN CARLOS MENDOZA RUIZ, en su carácter de propietario del inmueble que se describe...»',
  },
  'escrituras:direccion': {
    valorEncontrado: 'Av. Insurgentes Sur 1457, Col. Del Valle, CDMX',
    pagina: 2,
    fragmento: '«...inmueble ubicado en AVENIDA INSURGENTES SUR número 1457, Colonia Del Valle...»',
  },
  'escrituras:superficie': {
    valorEncontrado: '1,250.00 m²',
    pagina: 3,
    fragmento: '«...con una superficie total de MIL DOSCIENTOS CINCUENTA METROS CUADRADOS (1,250.00 m²)...»',
  },
  'escrituras:datos_relevantes': {
    valorEncontrado: 'Uso habitacional, construcción de 2 niveles',
    pagina: 2,
    fragmento: '«...construcción de dos niveles, destinada a casa habitación...»',
  },
  'escrituras:relacion_expediente': {
    valorEncontrado: 'Folio real 4821093',
    pagina: 1,
    fragmento: '«...inscrito bajo el folio real electrónico número 4821093...»',
  },

  'predial:contribuyente': {
    valorEncontrado: 'Juan Carlos Mendoza Ruiz',
    pagina: 1,
    fragmento: '«Contribuyente: MENDOZA RUIZ JUAN CARLOS»',
  },
  'predial:direccion': {
    valorEncontrado: 'Av. Insurgentes Sur 1457, Col. Del Valle, CDMX',
    pagina: 1,
    fragmento: '«Ubicación: AV INSURGENTES SUR 1457, DEL VALLE»',
  },
  'predial:clave_predial': {
    valorEncontrado: '09-087-25-034',
    pagina: 1,
    fragmento: '«Cuenta predial: 09-087-25-034»',
  },
  'predial:superficie_registrada': {
    valorEncontrado: '1,212.50 m²',
    pagina: 1,
    fragmento: '«Superficie de terreno: 1,212.50 m²»',
  },
  'predial:relacion_documentos': {
    valorEncontrado: 'Folio real 4821093',
    pagina: 2,
    fragmento: '«Referencia registral: folio 4821093»',
  },

  'alineamiento:direccion_oficial': {
    valorEncontrado: 'Av. Insurgentes Sur 1457, Col. Del Valle, CDMX',
    pagina: 1,
    fragmento: '«...el inmueble ubicado en Av. Insurgentes Sur No. 1457...»',
  },
  'alineamiento:numero_oficial': {
    valorEncontrado: '1457',
    pagina: 1,
    fragmento: '«Se asigna el número oficial 1457...»',
  },
  'alineamiento:identificacion_predio': {
    valorEncontrado: 'Manzana 12, Lote 7',
    pagina: 1,
    fragmento: '«...predio identificado como Manzana 12, Lote 7...»',
  },
  'alineamiento:alineamiento_autoridad': {
    valorEncontrado: 'Conforme, sin restricción vial',
    pagina: 2,
    fragmento: '«El alineamiento se determina conforme al eje vial existente...»',
  },
  'alineamiento:vigencia': {
    valorEncontrado: 'Emitido 14/02/2025 · vigente',
    pagina: 1,
    fragmento: '«Fecha de expedición: 14 de febrero de 2025. Vigencia: 2 años.»',
  },
  'alineamiento:autoridad_emisora': {
    valorEncontrado: 'Secretaría de Desarrollo Urbano, CDMX',
    pagina: 1,
    fragmento: '«...expedido por la Secretaría de Desarrollo Urbano y Vivienda...»',
  },

  'uso_suelo:direccion': {
    valorEncontrado: 'Av. Insurgentes Sur 1457, Col. Del Valle, CDMX',
    pagina: 1,
    fragmento: '«Predio ubicado en Av. Insurgentes Sur 1457...»',
  },
  'uso_suelo:uso_autorizado': {
    valorEncontrado: 'Comercial y de Servicios (CS)',
    pagina: 1,
    fragmento: '«Uso de suelo: Comercial y de Servicios (CS)»',
  },
  'uso_suelo:compatibilidad': {
    valorEncontrado: 'Compatible con tienda de autoservicio',
    pagina: 2,
    fragmento: '«...compatible con giros comerciales de abasto y autoservicio...»',
  },
  'uso_suelo:restricciones': {
    valorEncontrado: 'Altura máxima 3 niveles, COS 0.8',
    pagina: 2,
    fragmento: '«Restricción: altura máxima de 3 niveles, COS 0.8»',
  },
  'uso_suelo:superficie_aplicable': {
    valorEncontrado: '1,250.00 m²',
    pagina: 2,
    fragmento: '«Superficie aplicable al uso autorizado: 1,250.00 m²»',
  },
  'uso_suelo:vigencia': {
    valorEncontrado: 'Emitido 03/01/2025 · vigente',
    pagina: 1,
    fragmento: '«Vigencia: 3 años a partir de su expedición.»',
  },
  'uso_suelo:autoridad_emisora': {
    valorEncontrado: 'Secretaría de Desarrollo Urbano, CDMX',
    pagina: 1,
    fragmento: '«...expedido por la Secretaría de Desarrollo Urbano y Vivienda...»',
  },
};

export interface EvidenciaCruzada {
  documento: string;
  valor: string;
  pagina: number;
  fragmento: string;
  esDiscrepante: boolean;
}

export interface HallazgoCruzado {
  id: string;
  tipoId: TipoDocumentalId;
  reglaId: string;
  titulo: string;
  descripcion: string;
  tolerancia: string;
  evidencias: EvidenciaCruzada[];
}

/** Caso principal: coincide con `resultadoEjemploRegla` (predial · superficie_registrada). */
export const HALLAZGOS_CRUZADOS: HallazgoCruzado[] = [
  {
    id: 'superficie_predial',
    tipoId: 'predial',
    reglaId: 'superficie_registrada',
    titulo: 'Superficie registrada no coincide',
    descripcion: 'La superficie de Predial difiere de la registrada en Escrituras y Uso de Suelo.',
    tolerancia: 'Tolerancia aceptada: 1%',
    evidencias: [
      {
        documento: 'Escrituras',
        valor: '1,250.00 m²',
        pagina: 3,
        fragmento: '«...con una superficie total de MIL DOSCIENTOS CINCUENTA METROS CUADRADOS (1,250.00 m²)...»',
        esDiscrepante: false,
      },
      {
        documento: 'Predial',
        valor: '1,212.50 m²',
        pagina: 1,
        fragmento: '«Superficie de terreno: 1,212.50 m²»',
        esDiscrepante: true,
      },
      {
        documento: 'Uso de Suelo',
        valor: '1,250.00 m²',
        pagina: 2,
        fragmento: '«Superficie aplicable al uso autorizado: 1,250.00 m²»',
        esDiscrepante: false,
      },
    ],
  },
];

/** Resumen textual del dictamen. Determinista: no varía entre expedientes. */
export function obtenerResumenDictamen(
  dictamen: Dictamen,
  opciones?: { documentosFaltantes?: string[] },
): { confianza: Confianza; porQue: string } {
  const faltantes = opciones?.documentosFaltantes ?? [];

  if (dictamen === 'cumple') {
    return {
      confianza: 'alta',
      porQue:
        'Los datos coinciden entre Escrituras, Predial, Alineamiento y Número Oficial, y Uso de Suelo; no se detectaron inconsistencias.',
    };
  }
  if (dictamen === 'no_cumple') {
    return {
      confianza: 'baja',
      porQue: 'Se detectaron inconsistencias que impiden validar el expediente con la información disponible.',
    };
  }
  if (faltantes.length > 0) {
    return {
      confianza: 'media',
      porQue: `Falta ${faltantes.join(', ')} en el expediente. No se descarta: el resto de la documentación sí se validó, pero no puede concluirse el dictamen sin ese documento.`,
    };
  }
  return {
    confianza: 'media',
    porQue:
      'La superficie registrada en Predial (1,212.50 m²) no coincide con Escrituras ni Uso de Suelo (1,250.00 m²); la diferencia supera la tolerancia del 1%.',
  };
}

export const UBICACION_EJEMPLO = {
  direccion: 'Av. Insurgentes Sur 1457, Col. Del Valle, CDMX',
  fuente: 'Alineamiento y Número Oficial',
  coincide: true,
  coordenadas: { lat: 19.3773, lng: -99.1663 },
};

/** Escenario de ejemplo por posición del expediente en el lote (determinista). */
export interface EscenarioExpediente {
  documentoFaltante: TipoDocumentalId | null;
  archivosNoReconocidos: string[];
}

const ESCENARIOS_EJEMPLO: EscenarioExpediente[] = [
  { documentoFaltante: null, archivosNoReconocidos: [] },
  { documentoFaltante: 'uso_suelo', archivosNoReconocidos: ['plano_fachada.pdf'] },
];

/** El primer expediente es el caso principal; el segundo ilustra un documento faltante. */
export function obtenerEscenario(indice: number): EscenarioExpediente {
  return ESCENARIOS_EJEMPLO[indice] ?? { documentoFaltante: null, archivosNoReconocidos: [] };
}

export interface CeldaComparacion {
  reglaId: string;
}

export interface FilaComparacionCruzada {
  id: string;
  etiqueta: string;
  celdas: Partial<Record<TipoDocumentalId, CeldaComparacion>>;
  coincide: boolean;
  discrepante?: TipoDocumentalId;
  notaTolerancia?: string;
}

/**
 * Tabla de validación cruzada (pestaña "Validación cruzada"). Cada celda
 * referencia un punto de `EVIDENCIA_POR_PUNTO` (no duplica el valor/fragmento).
 * Caso principal: solo "Superficie" no coincide.
 */
export const COMPARACION_CRUZADA: FilaComparacionCruzada[] = [
  {
    id: 'direccion',
    etiqueta: 'Dirección',
    coincide: true,
    celdas: {
      escrituras: { reglaId: 'direccion' },
      predial: { reglaId: 'direccion' },
      alineamiento: { reglaId: 'direccion_oficial' },
      uso_suelo: { reglaId: 'direccion' },
    },
  },
  {
    id: 'propietario',
    etiqueta: 'Propietario o titular',
    coincide: true,
    celdas: {
      escrituras: { reglaId: 'titular' },
      predial: { reglaId: 'contribuyente' },
    },
  },
  {
    id: 'superficie',
    etiqueta: 'Superficie',
    coincide: false,
    discrepante: 'predial',
    notaTolerancia: 'Tolerancia aceptada: 1%',
    celdas: {
      escrituras: { reglaId: 'superficie' },
      predial: { reglaId: 'superficie_registrada' },
      uso_suelo: { reglaId: 'superficie_aplicable' },
    },
  },
  {
    id: 'numero_oficial',
    etiqueta: 'Número oficial',
    coincide: true,
    celdas: {
      alineamiento: { reglaId: 'numero_oficial' },
    },
  },
  {
    id: 'identificacion_predio',
    etiqueta: 'Identificación del predio',
    coincide: true,
    celdas: {
      predial: { reglaId: 'clave_predial' },
      alineamiento: { reglaId: 'identificacion_predio' },
    },
  },
];

export interface DatoFicha {
  id: string;
  etiqueta: string;
  tipoId: TipoDocumentalId;
  reglaId: string;
}

/** Ficha del inmueble (pestaña "Datos extraídos"). Cada dato referencia un punto de EVIDENCIA_POR_PUNTO. */
export const FICHA_INMUEBLE: DatoFicha[] = [
  { id: 'propietario', etiqueta: 'Propietario o titular', tipoId: 'escrituras', reglaId: 'titular' },
  { id: 'direccion', etiqueta: 'Dirección', tipoId: 'alineamiento', reglaId: 'direccion_oficial' },
  { id: 'superficie', etiqueta: 'Superficie del terreno', tipoId: 'predial', reglaId: 'superficie_registrada' },
  { id: 'clave_predial', etiqueta: 'Cuenta o clave predial', tipoId: 'predial', reglaId: 'clave_predial' },
  { id: 'numero_oficial', etiqueta: 'Número oficial', tipoId: 'alineamiento', reglaId: 'numero_oficial' },
  { id: 'uso_autorizado', etiqueta: 'Uso de suelo autorizado', tipoId: 'uso_suelo', reglaId: 'uso_autorizado' },
  { id: 'compatibilidad', etiqueta: 'Compatibilidad con uso comercial', tipoId: 'uso_suelo', reglaId: 'compatibilidad' },
  { id: 'vigencia_uso_suelo', etiqueta: 'Vigencia del Uso de Suelo', tipoId: 'uso_suelo', reglaId: 'vigencia' },
  { id: 'autoridad_emisora', etiqueta: 'Autoridad emisora', tipoId: 'uso_suelo', reglaId: 'autoridad_emisora' },
];
