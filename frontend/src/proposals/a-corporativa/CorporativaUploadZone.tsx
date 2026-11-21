import { AlertCircle, FileArchive, FolderOpen, UploadCloud } from 'lucide-react';
import { useUploadZone } from '../../shared/hooks/useUploadZone';
import type { Expediente } from '../../shared/types/expediente';

interface Props {
  onExpedientesCargados: (expedientes: Expediente[]) => void;
}

export function CorporativaUploadZone({ onExpedientesCargados }: Props) {
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
    <section aria-labelledby="carga-titulo" className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <h2 id="carga-titulo" className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted">
        Paso 1
      </h2>
      <p className="mb-6 text-center text-lg font-medium text-ink">Carga el expediente completo</p>

      <div
        role="button"
        tabIndex={0}
        aria-label="Zona para arrastrar una carpeta o un archivo zip del expediente. Presiona Enter para seleccionar una carpeta."
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onKeyDown={handleDropzoneKeyDown}
        className={`flex flex-col items-center gap-4 rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors ${
          arrastrando ? 'border-brand bg-brand-soft' : 'border-border bg-bg'
        }`}
      >
        <UploadCloud
          className={arrastrando ? 'h-12 w-12 text-brand' : 'h-12 w-12 text-muted'}
          aria-hidden="true"
        />
        <p className="text-base font-medium text-ink">Arrastra aquí la carpeta o el .zip del expediente</p>
        <p className="text-sm text-muted">Debe contener Escrituras, Predial, Alineamiento y Uso de Suelo</p>

        <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={abrirSelectorCarpeta}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-dark"
          >
            <FolderOpen className="h-4 w-4" aria-hidden="true" />
            Seleccionar carpeta
          </button>
          <button
            type="button"
            onClick={abrirSelectorZip}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-brand px-5 py-2.5 font-medium text-brand transition-colors hover:bg-brand-soft"
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
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
    </section>
  );
}
