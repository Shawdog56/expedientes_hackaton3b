import type { ArchivoExpediente, Expediente } from '../types/expediente';
import { esArchivoDeSistema, esArchivoPermitido } from './tiposArchivo';

/**
 * Crea un expediente recién cargado, pendiente de enviarse al backend.
 * La prevalidación es solo por extensión; el backend valida el contenido real.
 */
export function crearExpediente(
  nombre: string,
  origen: Expediente['origen'],
  todos: ArchivoExpediente[],
): Expediente {
  const archivos = todos.filter((archivo) => !esArchivoDeSistema(archivo.nombre));
  const rechazados = archivos
    .filter((archivo) => !esArchivoPermitido(archivo.nombre))
    .map((archivo) => ({
      ruta: archivo.ruta,
      motivo: 'Tipo de archivo no permitido (solo PDF o ZIP)',
    }));

  return {
    id: crypto.randomUUID(),
    nombre,
    origen,
    archivos,
    tamanoTotal: archivos.reduce((total, archivo) => total + archivo.tamano, 0),
    estado: 'validando',
    documentos: [],
    rechazados,
    tiposFaltantes: [],
    tiposDuplicados: [],
  };
}

/** Un expediente está listo para analizarse cuando el backend ya lo validó y contiene PDFs. */
export function esExpedienteListo(expediente: Expediente): boolean {
  return expediente.estado === 'validado' && expediente.documentos.length > 0;
}
