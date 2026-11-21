import type { ArchivoExpediente } from '../types/expediente';

export function obtenerEntryDesdeItem(item: DataTransferItem): FileSystemEntry | null {
  if (typeof item.webkitGetAsEntry === 'function') {
    return item.webkitGetAsEntry();
  }
  return null;
}

function leerDirectorioCompleto(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const entradas: FileSystemEntry[] = [];

    const leerLote = () => {
      reader.readEntries((lote) => {
        if (lote.length === 0) {
          resolve(entradas);
          return;
        }
        entradas.push(...lote);
        leerLote();
      }, reject);
    };

    leerLote();
  });
}

function obtenerArchivo(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

/**
 * Recorre un FileSystemEntry (archivo o carpeta) solo para listar nombres,
 * rutas relativas y tamaños, y conserva la referencia al File para subirlo.
 * Nunca lee el contenido de los archivos en el navegador.
 */
export async function listarArchivosDeEntry(
  entry: FileSystemEntry,
  rutaBase = '',
): Promise<ArchivoExpediente[]> {
  const ruta = rutaBase ? `${rutaBase}/${entry.name}` : entry.name;

  if (entry.isFile) {
    const archivo = await obtenerArchivo(entry as FileSystemFileEntry);
    return [{ nombre: archivo.name, ruta, tamano: archivo.size, file: archivo }];
  }

  if (entry.isDirectory) {
    const directorio = entry as FileSystemDirectoryEntry;
    const hijos = await leerDirectorioCompleto(directorio.createReader());
    const listas = await Promise.all(hijos.map((hijo) => listarArchivosDeEntry(hijo, ruta)));
    return listas.flat();
  }

  return [];
}
