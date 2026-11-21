export type OrigenExpediente = 'carpeta' | 'zip';

export interface ArchivoExpediente {
  nombre: string;
  ruta: string;
  tamano: number;
}

export interface TipoDocumentalEstado {
  tipo: string;
  estado: 'pendiente';
}

export interface Expediente {
  id: string;
  nombre: string;
  origen: OrigenExpediente;
  archivos: ArchivoExpediente[];
  tamanoTotal: number;
}

export const TIPOS_DOCUMENTALES = [
  'Escrituras',
  'Predial',
  'Alineamiento y Numero Oficial',
  'Uso de Suelo',
] as const;
