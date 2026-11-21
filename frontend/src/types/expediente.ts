export type OrigenExpediente = 'carpeta' | 'zip';

export interface ArchivoExpediente {
  nombre: string;
  ruta: string;
  tamano: number;
  /** Referencia al archivo para subirlo; no se lee su contenido en el navegador. */
  file?: File;
}

export type EstadoValidacion = 'validando' | 'validado' | 'error';

export type TipoDocumental = 'escrituras' | 'predial' | 'alineamiento_numero_oficial' | 'uso_suelo';

export type EstadoClasificacion = 'clasificado' | 'sin_clasificar' | 'ambiguo' | 'manual';

export type EstadoExtraccion = 'pendiente' | 'en_proceso' | 'completada' | 'error' | 'no_aplica';

/** PDF validado y clasificado por el backend (campos tal como llegan de la API). */
export interface DocumentoValidado {
  id: string;
  nombre: string;
  ruta: string;
  tamano: number;
  paginas: number;
  tipo_documental: TipoDocumental | null;
  estado_clasificacion: EstadoClasificacion;
  fuente_clasificacion: string | null;
  agente: string | null;
  estado_extraccion: EstadoExtraccion;
}

export interface ArchivoRechazado {
  ruta: string;
  motivo: string;
}

export interface Expediente {
  id: string;
  nombre: string;
  origen: OrigenExpediente;
  archivos: ArchivoExpediente[];
  tamanoTotal: number;
  estado: EstadoValidacion;
  /** Id asignado por el backend una vez guardado. */
  idServidor?: string;
  documentos: DocumentoValidado[];
  rechazados: ArchivoRechazado[];
  tiposFaltantes: TipoDocumental[];
  tiposDuplicados: TipoDocumental[];
  error?: string;
}

export const TIPOS_DOCUMENTALES: { valor: TipoDocumental; etiqueta: string }[] = [
  { valor: 'escrituras', etiqueta: 'Escrituras' },
  { valor: 'predial', etiqueta: 'Predial' },
  { valor: 'alineamiento_numero_oficial', etiqueta: 'Alineamiento y Número Oficial' },
  { valor: 'uso_suelo', etiqueta: 'Uso de Suelo' },
];

export const ETIQUETA_TIPO: Record<TipoDocumental, string> = Object.fromEntries(
  TIPOS_DOCUMENTALES.map(({ valor, etiqueta }) => [valor, etiqueta]),
) as Record<TipoDocumental, string>;
