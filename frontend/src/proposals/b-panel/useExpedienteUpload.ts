import { useRef, useState } from 'react';
import { listarArchivosDeEntry, obtenerEntryDesdeItem } from '../../shared/utils/readDroppedEntries';
import type { ArchivoExpediente, Expediente } from '../../shared/types/expediente';

function crearExpediente(
  nombre: string,
  origen: Expediente['origen'],
  archivos: ArchivoExpediente[],
): Expediente {
  return {
    id: crypto.randomUUID(),
    nombre,
    origen,
    archivos,
    tamanoTotal: archivos.reduce((total, archivo) => total + archivo.tamano, 0),
  };
}

function siguienteNombreSueltos(actuales: Expediente[]): string {
  const cantidad = actuales.filter((expediente) => expediente.origen === 'archivos').length;
  return `Archivos sueltos ${cantidad + 1}`;
}

/**
 * Lógica de carga propia de la propuesta B: carpeta, .zip o PDF sueltos
 * (agrupados en un único expediente "Archivos sueltos N" por lote).
 */
export function useExpedienteUpload(
  expedientesActuales: Expediente[],
  onExpedientesCargados: (expedientes: Expediente[]) => void,
) {
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputArchivosRef = useRef<HTMLInputElement>(null);
  const inputCarpetaRef = useRef<HTMLInputElement>(null);

  const abrirSelectorArchivos = () => inputArchivosRef.current?.click();
  const abrirSelectorCarpeta = () => inputCarpetaRef.current?.click();

  const handleDropzoneKeyDown = (evento: React.KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      abrirSelectorArchivos();
    }
  };

  const handleDragOver = (evento: React.DragEvent<HTMLDivElement>) => {
    evento.preventDefault();
    setArrastrando(true);
  };

  const handleDragLeave = (evento: React.DragEvent<HTMLDivElement>) => {
    evento.preventDefault();
    setArrastrando(false);
  };

  const handleDrop = async (evento: React.DragEvent<HTMLDivElement>) => {
    evento.preventDefault();
    setArrastrando(false);
    setError(null);

    const items = Array.from(evento.dataTransfer.items).filter((item) => item.kind === 'file');
    const nuevosExpedientes: Expediente[] = [];
    const sueltos: ArchivoExpediente[] = [];
    const nombresInvalidos: string[] = [];

    for (const item of items) {
      const entry = obtenerEntryDesdeItem(item);
      if (!entry) continue;

      if (entry.isDirectory) {
        const archivos = await listarArchivosDeEntry(entry);
        nuevosExpedientes.push(crearExpediente(entry.name, 'carpeta', archivos));
        continue;
      }

      const [archivo] = await listarArchivosDeEntry(entry);
      if (!archivo) continue;

      const nombreMinusculas = archivo.nombre.toLowerCase();
      if (nombreMinusculas.endsWith('.zip')) {
        nuevosExpedientes.push(crearExpediente(archivo.nombre, 'zip', [archivo]));
      } else if (nombreMinusculas.endsWith('.pdf')) {
        sueltos.push(archivo);
      } else {
        nombresInvalidos.push(archivo.nombre);
      }
    }

    if (sueltos.length > 0) {
      nuevosExpedientes.push(
        crearExpediente(siguienteNombreSueltos([...expedientesActuales, ...nuevosExpedientes]), 'archivos', sueltos),
      );
    }

    if (nombresInvalidos.length > 0) {
      setError(`Solo se aceptan carpetas, archivos .zip o .pdf. Se ignoró: ${nombresInvalidos.join(', ')}.`);
    }

    if (nuevosExpedientes.length > 0) {
      onExpedientesCargados(nuevosExpedientes);
    }
  };

  const handleArchivosSeleccionados = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = evento.target.files;
    if (!archivos || archivos.length === 0) return;
    setError(null);

    const nuevosExpedientes: Expediente[] = [];
    const sueltos: ArchivoExpediente[] = [];
    const nombresInvalidos: string[] = [];

    for (const archivo of Array.from(archivos)) {
      const nombreMinusculas = archivo.name.toLowerCase();
      if (nombreMinusculas.endsWith('.zip')) {
        nuevosExpedientes.push(
          crearExpediente(archivo.name, 'zip', [{ nombre: archivo.name, ruta: archivo.name, tamano: archivo.size }]),
        );
      } else if (nombreMinusculas.endsWith('.pdf')) {
        sueltos.push({ nombre: archivo.name, ruta: archivo.name, tamano: archivo.size });
      } else {
        nombresInvalidos.push(archivo.name);
      }
    }

    if (sueltos.length > 0) {
      nuevosExpedientes.push(
        crearExpediente(siguienteNombreSueltos([...expedientesActuales, ...nuevosExpedientes]), 'archivos', sueltos),
      );
    }

    if (nombresInvalidos.length > 0) {
      setError(`Solo se aceptan archivos .pdf o .zip. Se ignoró: ${nombresInvalidos.join(', ')}.`);
    }

    if (nuevosExpedientes.length > 0) {
      onExpedientesCargados(nuevosExpedientes);
    }
    evento.target.value = '';
  };

  const handleCarpetaSeleccionada = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = evento.target.files;
    if (!archivos || archivos.length === 0) return;
    setError(null);

    const grupos = new Map<string, ArchivoExpediente[]>();
    for (const archivo of Array.from(archivos)) {
      const ruta = archivo.webkitRelativePath || archivo.name;
      const carpetaRaiz = ruta.split('/')[0] ?? archivo.name;
      const lista = grupos.get(carpetaRaiz) ?? [];
      lista.push({ nombre: archivo.name, ruta, tamano: archivo.size });
      grupos.set(carpetaRaiz, lista);
    }

    const nuevosExpedientes = Array.from(grupos.entries()).map(([nombre, lista]) =>
      crearExpediente(nombre, 'carpeta', lista),
    );
    onExpedientesCargados(nuevosExpedientes);
    evento.target.value = '';
  };

  return {
    arrastrando,
    error,
    inputArchivosRef,
    inputCarpetaRef,
    abrirSelectorArchivos,
    abrirSelectorCarpeta,
    handleDropzoneKeyDown,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleArchivosSeleccionados,
    handleCarpetaSeleccionada,
  };
}
