import type {
  ArchivoRechazado,
  DocumentoValidado,
  Expediente,
  TipoDocumental,
} from '../types/expediente';
import { esArchivoPermitido } from '../utils/tiposArchivo';

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
