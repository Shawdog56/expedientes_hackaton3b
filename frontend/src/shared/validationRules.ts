export type TipoDocumentalId = 'escrituras' | 'predial' | 'alineamiento' | 'uso_suelo';

export type EstadoValidacion = 'pendiente' | 'validando' | 'verificado' | 'revisar' | 'no_cumple';

export type Etapa = 'clasificar' | 'extraer' | 'validar_reglas' | 'validacion_cruzada' | 'dictamen';

export interface ReglaValidacion {
  id: string;
  etiqueta: string;
}

export interface TipoDocumentalRegla {
  id: TipoDocumentalId;
  nombre: string;
  archivoEjemplo: string;
  reglas: ReglaValidacion[];
}

export const REGLAS_VALIDACION: TipoDocumentalRegla[] = [
  {
    id: 'escrituras',
    nombre: 'Escrituras',
    archivoEjemplo: 'escritura_publica_84521.pdf',
    reglas: [
      { id: 'titular', etiqueta: 'Identificación del propietario o titular' },
      { id: 'direccion', etiqueta: 'Dirección e identificación del inmueble' },
      { id: 'superficie', etiqueta: 'Superficie del terreno' },
      { id: 'datos_relevantes', etiqueta: 'Datos relevantes del inmueble' },
      { id: 'relacion_expediente', etiqueta: 'Relación con el resto del expediente' },
    ],
  },
  {
    id: 'predial',
    nombre: 'Predial',
    archivoEjemplo: 'boleta_predial_2026.pdf',
    reglas: [
      { id: 'contribuyente', etiqueta: 'Propietario o contribuyente' },
      { id: 'direccion', etiqueta: 'Dirección del inmueble' },
      { id: 'clave_predial', etiqueta: 'Cuenta o clave predial' },
      { id: 'superficie_registrada', etiqueta: 'Superficie registrada' },
      { id: 'relacion_documentos', etiqueta: 'Relación con los demás documentos' },
    ],
  },
  {
    id: 'alineamiento',
    nombre: 'Alineamiento y Número Oficial',
    archivoEjemplo: 'alineamiento_numero_oficial.pdf',
    reglas: [
      { id: 'direccion_oficial', etiqueta: 'Dirección oficial del inmueble' },
      { id: 'numero_oficial', etiqueta: 'Número oficial asignado' },
      { id: 'identificacion_predio', etiqueta: 'Identificación del predio' },
      { id: 'alineamiento_autoridad', etiqueta: 'Alineamiento determinado por la autoridad' },
      { id: 'vigencia', etiqueta: 'Fecha de emisión y vigencia' },
      { id: 'autoridad_emisora', etiqueta: 'Autoridad emisora' },
    ],
  },
  {
    id: 'uso_suelo',
    nombre: 'Uso de Suelo',
    archivoEjemplo: 'constancia_uso_suelo.pdf',
    reglas: [
      { id: 'direccion', etiqueta: 'Dirección e identificación del inmueble' },
      { id: 'uso_autorizado', etiqueta: 'Uso de suelo autorizado' },
      { id: 'compatibilidad', etiqueta: 'Compatibilidad con el uso comercial requerido' },
      { id: 'restricciones', etiqueta: 'Restricciones o condicionantes' },
      { id: 'superficie_aplicable', etiqueta: 'Superficie aplicable' },
      { id: 'vigencia', etiqueta: 'Fecha de emisión y vigencia' },
      { id: 'autoridad_emisora', etiqueta: 'Autoridad emisora' },
    ],
  },
];

export const ETAPAS: { id: Etapa; etiqueta: string }[] = [
  { id: 'clasificar', etiqueta: 'Clasificar' },
  { id: 'extraer', etiqueta: 'Extraer datos' },
  { id: 'validar_reglas', etiqueta: 'Validar reglas' },
  { id: 'validacion_cruzada', etiqueta: 'Validación cruzada' },
  { id: 'dictamen', etiqueta: 'Dictamen' },
];

/**
 * Resultado de ejemplo determinista por punto de validación. Cuando exista
 * backend real, esta función se sustituye por la respuesta del análisis.
 */
export function resultadoEjemploRegla(tipoId: TipoDocumentalId, reglaId: string): EstadoValidacion {
  if (tipoId === 'predial' && reglaId === 'superficie_registrada') return 'revisar';
  return 'verificado';
}
