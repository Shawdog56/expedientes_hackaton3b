import type {
  ArchivoRechazado,
  DecisionFinal,
  DocumentoValidado,
  Expediente,
  TipoDocumental,
} from '../shared/types/expediente';
import { esArchivoPermitido } from '../shared/utils/tiposArchivo';

const BASE = import.meta.env.VITE_API_URL ?? '/api';

export interface ExpedienteServidor {
  id: string;
  nombre: string;
  origen: 'carpeta' | 'zip';
  estado: string;
  creado_en: string;
  documentos: DocumentoValidado[];
  rechazados: ArchivoRechazado[];
  tipos_faltantes: TipoDocumental[];
  tipos_duplicados: TipoDocumental[];
  completo: boolean;
  decision_final: DecisionFinal | null;
  decidido_en: string | null;
  decidido_por: string | null;
}

export class ErrorValidacion extends Error {
  rechazados: ArchivoRechazado[];

  constructor(mensaje: string, rechazados: ArchivoRechazado[] = []) {
    super(mensaje);
    this.rechazados = rechazados;
  }
}

async function leerRespuesta<T>(res: Response): Promise<T> {
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    const detalle = cuerpo?.detail;
    if (detalle && typeof detalle === 'object' && 'mensaje' in detalle) {
      throw new ErrorValidacion(detalle.mensaje, detalle.rechazados ?? []);
    }
    throw new ErrorValidacion(
      typeof detalle === 'string' ? detalle : `Error del servidor (${res.status})`,
    );
  }
  return cuerpo as T;
}

/** Sube los archivos de un expediente; el backend valida, descomprime y clasifica. */
export async function subirExpediente(expediente: Expediente): Promise<ExpedienteServidor> {
  const form = new FormData();
  form.append('nombre', expediente.nombre.replace(/\.zip$/i, ''));
  for (const archivo of expediente.archivos) {
    if (!archivo.file || !esArchivoPermitido(archivo.nombre)) continue;
    form.append('archivos', archivo.file, archivo.nombre);
    form.append('rutas', archivo.ruta);
  }

  const res = await fetch(`${BASE}/expedientes`, { method: 'POST', body: form });
  return leerRespuesta<ExpedienteServidor>(res);
}

/** Asigna manualmente el tipo documental de un documento; devuelve el expediente actualizado. */
export async function reclasificarDocumento(
  documentoId: string,
  tipo: TipoDocumental | null,
): Promise<ExpedienteServidor> {
  const res = await fetch(`${BASE}/documentos/${documentoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo_documental: tipo }),
  });
  return leerRespuesta<ExpedienteServidor>(res);
}

export async function eliminarExpediente(idServidor: string): Promise<void> {
  await fetch(`${BASE}/expedientes/${idServidor}`, { method: 'DELETE' });
}

/** Descarga el archivo original de un documento para mostrarlo en el visor. */
export async function obtenerArchivo(documentoId: string, senal?: AbortSignal): Promise<Blob> {
  const res = await fetch(`${BASE}/documentos/${documentoId}/archivo`, { signal: senal });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? 'El archivo ya no está disponible en el servidor'
        : `No se pudo cargar el archivo (error ${res.status})`,
    );
  }
  return res.blob();
}

/** Registra la decisión final de la persona que revisa; devuelve el expediente actualizado. */
export async function decidirExpediente(
  idServidor: string,
  decision: DecisionFinal,
): Promise<ExpedienteServidor> {
  const res = await fetch(`${BASE}/expedientes/${idServidor}/decision`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });
  return leerRespuesta<ExpedienteServidor>(res);
}

export interface HallazgoAuditoria {
  regla: string;
  descripcion: string;
  severidad?: 'CRITICO' | 'ADVERTENCIA' | string;
}

/** Un documento tal como lo deja la auditoría: clase que reconoció el modelo, campos y observaciones. */
export interface DocumentoAuditado {
  documento_id?: string;
  archivo?: string;
  clase?: string;
  confianza?: number;
  resumen?: string;
  campos?: Record<string, unknown>;
  campos_normalizados?: Record<string, unknown>;
  campos_faltantes_criticos?: string[];
  observaciones?: string[];
  estado_documento?: 'valido' | 'con_observaciones' | 'invalido' | string;
  ocr_metadatos?: { metodo?: string; paginas?: number; advertencias?: string[] };
}

export interface ResultadoAuditoria {
  veredicto: string;
  confianza_veredicto: number;
  confianzas_por_documento?: Record<string, number>;
  explicacion?: string;
  hallazgos_criticos?: HallazgoAuditoria[];
  hallazgos_advertencias?: HallazgoAuditoria[];
  hallazgos_conformes?: HallazgoAuditoria[];
  documentos: DocumentoAuditado[];
}

export type EtapaAuditoria = 'extraer' | 'validar_reglas' | 'validacion_cruzada' | 'dictamen';

export interface EstadoAuditoria {
  expediente_id: string;
  estado: 'en_proceso' | 'completada' | 'error';
  etapa: EtapaAuditoria;
  documentos_total: number;
  documentos_listos: number;
  documentos_en_curso: string[];
  resultado: ResultadoAuditoria | null;
  error: string | null;
}

/** Inicia la auditoría con agentes (OCR y modelo de lenguaje) en segundo plano. */
export async function iniciarAuditoria(idServidor: string): Promise<EstadoAuditoria> {
  const res = await fetch(`${BASE}/expedientes/${idServidor}/auditoria`, { method: 'POST' });
  return leerRespuesta<EstadoAuditoria>(res);
}

/** Progreso y, al terminar, resultado de la auditoría. */
export async function consultarAuditoria(idServidor: string): Promise<EstadoAuditoria> {
  const res = await fetch(`${BASE}/expedientes/${idServidor}/auditoria`);
  return leerRespuesta<EstadoAuditoria>(res);
}
