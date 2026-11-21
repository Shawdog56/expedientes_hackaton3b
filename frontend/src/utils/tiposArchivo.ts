const EXTENSIONES_PERMITIDAS = ['.pdf', '.zip'];
const ARCHIVOS_DE_SISTEMA = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);

/** Archivos basura del sistema operativo que se descartan sin avisar. */
export function esArchivoDeSistema(nombre: string): boolean {
  const minusculas = nombre.toLowerCase();
  return ARCHIVOS_DE_SISTEMA.has(minusculas) || minusculas.startsWith('._');
}

/** Prevalidación por extensión; el backend valida el contenido real. */
export function esArchivoPermitido(nombre: string): boolean {
  const minusculas = nombre.toLowerCase();
  return EXTENSIONES_PERMITIDAS.some((ext) => minusculas.endsWith(ext));
}
