import { Hash, Receipt, ScrollText, Store, type LucideIcon } from 'lucide-react';

export type TipoDocumentalId = 'escrituras' | 'predial' | 'alineamiento' | 'uso_suelo';

import type { TipoDocumental } from './types/expediente';

export type EstadoValidacion = 'pendiente' | 'validando' | 'verificado' | 'revisar' | 'no_cumple';

export type Etapa = 'clasificar' | 'extraer' | 'validar_reglas' | 'validacion_cruzada' | 'dictamen';

export interface ReglaValidacion {
  id: string;
  etiqueta: string;
}

export interface TipoDocumentalRegla {
  id: TipoDocumentalId;
  nombre: string;
  /** Mismo ícono en toda la app: bandeja vacía, tarjetas de validación, etc. */
  Icono: LucideIcon;
  descripcionCorta: string;
  reglas: ReglaValidacion[];
}

export const REGLAS_VALIDACION: TipoDocumentalRegla[] = [
  {
    id: 'escrituras',
    nombre: 'Escrituras',
    Icono: ScrollText,
    descripcionCorta: 'Titular, dirección y superficie del terreno',
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
    Icono: Receipt,
    descripcionCorta: 'Contribuyente, cuenta predial y superficie',
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
    Icono: Hash,
    descripcionCorta: 'Dirección oficial, vigencia y autoridad',
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
    Icono: Store,
    descripcionCorta: 'Uso autorizado y compatibilidad comercial',
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

/** Equivalencia entre los ids de las reglas y los tipos documentales que devuelve la API. */
export const TIPO_DOCUMENTAL_API: Record<TipoDocumentalId, TipoDocumental> = {
  escrituras: 'escrituras',
  predial: 'predial',
  alineamiento: 'alineamiento_numero_oficial',
  uso_suelo: 'uso_suelo',
};

export const ETAPAS: { id: Etapa; etiqueta: string }[] = [
  { id: 'clasificar', etiqueta: 'Clasificar' },
  { id: 'extraer', etiqueta: 'Extraer datos' },
  { id: 'validar_reglas', etiqueta: 'Validar reglas' },
  { id: 'validacion_cruzada', etiqueta: 'Validación cruzada' },
  { id: 'dictamen', etiqueta: 'Dictamen' },
];

/**
 * Resultado por punto de validación. Si el documento falta en el expediente no hay nada que
 * validar y el punto no cumple; en otro caso devuelve un resultado de ejemplo determinista
 * hasta que el servicio de extracción del backend entregue el real.
 */
export function resultadoRegla(
  tipoId: TipoDocumentalId,
  reglaId: string,
  documentoFaltante: boolean,
): EstadoValidacion {
  if (documentoFaltante) return 'no_cumple';
  if (tipoId === 'predial' && reglaId === 'superficie_registrada') return 'revisar';
  return 'verificado';
}
