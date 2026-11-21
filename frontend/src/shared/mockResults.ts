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
export function obtenerResumenDictamen(dictamen: Dictamen): { confianza: Confianza; porQue: string } {
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
