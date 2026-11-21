import { AlertCircle, FileArchive, FolderOpen, UploadCloud } from 'lucide-react';
import { useUploadZone } from '../../shared/hooks/useUploadZone';
import type { Expediente } from '../../shared/types/expediente';

interface Props {
  onExpedientesCargados: (expedientes: Expediente[]) => void;
}

export function UploadZone({ onExpedientesCargados }: Props) {
  const {
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
  } = useUploadZone(onExpedientesCargados);

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
        onKeyDown={handleDropzoneKeyDown}
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
            onClick={abrirSelectorCarpeta}
            className="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 font-medium text-brand transition-colors hover:bg-brand-soft"
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
            Seleccionar carpeta
          </button>
          <button
            type="button"
            onClick={abrirSelectorZip}
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
