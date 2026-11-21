const EXTENSIONES_DOCUMENTO = ['.pdf', '.jpg', '.jpeg', '.png'];
const EXTENSIONES_PERMITIDAS = [...EXTENSIONES_DOCUMENTO, '.zip'];
const ARCHIVOS_DE_SISTEMA = new Set(['.ds_store', 'thumbs.db', 'desktop.ini']);

/** Valor para el atributo `accept` de los selectores de archivos. */
export const ACEPTAR_ARCHIVOS = EXTENSIONES_PERMITIDAS.join(',');

/** Texto para avisos al usuario. */
export const FORMATOS_PERMITIDOS = 'PDF, JPG, PNG o ZIP';

/** Archivos basura del sistema operativo que se descartan sin avisar. */
export function esArchivoDeSistema(nombre: string): boolean {
  const minusculas = nombre.toLowerCase();
  return ARCHIVOS_DE_SISTEMA.has(minusculas) || minusculas.startsWith('._');
}

export function esZip(nombre: string): boolean {
  return nombre.toLowerCase().endsWith('.zip');
}

/** Documento individual aceptado (PDF o imagen JPG/PNG); excluye el .zip. */
export function esDocumento(nombre: string): boolean {
  const minusculas = nombre.toLowerCase();
  return EXTENSIONES_DOCUMENTO.some((ext) => minusculas.endsWith(ext));
}

/** Prevalidación por extensión; el backend valida el contenido real. */
export function esArchivoPermitido(nombre: string): boolean {
  const minusculas = nombre.toLowerCase();
  return EXTENSIONES_PERMITIDAS.some((ext) => minusculas.endsWith(ext));
}
