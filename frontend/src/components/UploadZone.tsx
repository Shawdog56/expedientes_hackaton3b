import { AlertCircle, FileArchive, FolderOpen, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ArchivoExpediente, Expediente } from '../types/expediente';
import { listarArchivosDeEntry, obtenerEntryDesdeItem } from '../utils/readDroppedEntries';

interface Props {
  onExpedientesCargados: (expedientes: Expediente[]) => void;
}

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

export function UploadZone({ onExpedientesCargados }: Props) {
  const [arrastrando, setArrastrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputCarpetaRef = useRef<HTMLInputElement>(null);
  const inputZipRef = useRef<HTMLInputElement>(null);

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

  const handleKeyDown = (evento: React.KeyboardEvent<HTMLDivElement>) => {
    if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      inputCarpetaRef.current?.click();
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
      lista.push({ nombre: archivo.name, ruta, tamano: archivo.size });
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
          { nombre: archivo.name, ruta: archivo.name, tamano: archivo.size },
        ]),
      );
    onExpedientesCargados(nuevosExpedientes);
    evento.target.value = '';
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Zona para arrastrar una carpeta o un archivo zip del expediente. Presiona Enter para seleccionar una carpeta."
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleKeyDown}
        className={`flex flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          arrastrando ? 'border-brand bg-brand-soft' : 'border-border bg-surface'
        }`}
      >
        <UploadCloud
          className={arrastrando ? 'h-10 w-10 text-brand' : 'h-10 w-10 text-muted'}
          aria-hidden="true"
        />
        <p className="text-base font-medium text-ink">
          Arrastra una carpeta o un archivo .zip con el expediente
        </p>
        <p className="text-sm text-muted">o selecciónalo manualmente</p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => inputCarpetaRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 font-medium text-brand transition-colors hover:bg-brand-soft"
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
            Seleccionar carpeta
          </button>
          <button
            type="button"
            onClick={() => inputZipRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 font-medium text-brand transition-colors hover:bg-brand-soft"
          >
            <FileArchive className="h-4 w-4" aria-hidden="true" />
            Seleccionar .zip
          </button>
        </div>

        <input
          ref={inputCarpetaRef}
          type="file"
          webkitdirectory=""
          multiple
          className="hidden"
          onChange={handleCarpetaSeleccionada}
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={inputZipRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleZipSeleccionado}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
