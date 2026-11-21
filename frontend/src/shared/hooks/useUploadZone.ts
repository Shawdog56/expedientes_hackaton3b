import { useRef, useState } from 'react';
import type { ArchivoExpediente, Expediente } from '../types/expediente';
import { listarArchivosDeEntry, obtenerEntryDesdeItem } from '../utils/readDroppedEntries';
import { crearExpediente } from '../utils/expediente';

/**
 * Lógica compartida de carga de expedientes (arrastrar y soltar, selección
 * de carpeta/.zip). Cada propuesta de diseño solo decide cómo se renderiza.
 */
export function useUploadZone(onExpedientesCargados: (expedientes: Expediente[]) => void) {
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputCarpetaRef = useRef<HTMLInputElement>(null);
  const inputZipRef = useRef<HTMLInputElement>(null);

  const abrirSelectorCarpeta = () => inputCarpetaRef.current?.click();
  const abrirSelectorZip = () => inputZipRef.current?.click();

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

      if (archivo.nombre.toLowerCase().endsWith('.zip')) {
        nuevosExpedientes.push(crearExpediente(archivo.nombre, 'zip', [archivo]));
      } else {
        nombresInvalidos.push(archivo.nombre);
      }
    }

    if (nombresInvalidos.length > 0) {
      setError(
        `Solo se aceptan carpetas de expediente completas o archivos .zip. Se ignoró: ${nombresInvalidos.join(', ')}.`,
      );
    }

    if (nuevosExpedientes.length > 0) {
      onExpedientesCargados(nuevosExpedientes);
    }
  };

  const handleDropzoneKeyDown = (evento: React.KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      abrirSelectorCarpeta();
    }
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
      lista.push({ nombre: archivo.name, ruta, tamano: archivo.size, file: archivo });
      grupos.set(carpetaRaiz, lista);
    }

    const nuevosExpedientes = Array.from(grupos.entries()).map(([nombre, lista]) =>
      crearExpediente(nombre, 'carpeta', lista),
    );
    onExpedientesCargados(nuevosExpedientes);
    evento.target.value = '';
  };

  const handleZipSeleccionado = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = evento.target.files;
    if (!archivos || archivos.length === 0) return;
    setError(null);

    const nuevosExpedientes = Array.from(archivos)
      .filter((archivo) => archivo.name.toLowerCase().endsWith('.zip'))
      .map((archivo) =>
        crearExpediente(archivo.name, 'zip', [
          { nombre: archivo.name, ruta: archivo.name, tamano: archivo.size, file: archivo },
        ]),
      );
    onExpedientesCargados(nuevosExpedientes);
    evento.target.value = '';
  };

  return {
    arrastrando,
    error,
    inputCarpetaRef,
    inputZipRef,
    abrirSelectorCarpeta,
    abrirSelectorZip,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDropzoneKeyDown,
    handleCarpetaSeleccionada,
    handleZipSeleccionado,
  };
}
