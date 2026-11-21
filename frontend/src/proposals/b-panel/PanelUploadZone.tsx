import { AlertCircle, UploadCloud } from 'lucide-react';
import type { Expediente } from '../../shared/types/expediente';
import { useExpedienteUpload } from './useExpedienteUpload';

interface Props {
  expedientesActuales: Expediente[];
  onExpedientesCargados: (expedientes: Expediente[]) => void;
}

export function PanelUploadZone({ expedientesActuales, onExpedientesCargados }: Props) {
  const {
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
  } = useExpedienteUpload(expedientesActuales, onExpedientesCargados);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Zona para cargar el expediente. Arrastra una carpeta o archivos PDF o ZIP, o presiona para seleccionar archivos."
        onClick={abrirSelectorArchivos}
        onKeyDown={handleDropzoneKeyDown}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ${
          arrastrando ? 'border-brand bg-brand-soft' : 'border-border bg-bg hover:border-brand/50'
        }`}
      >
        <UploadCloud className={arrastrando ? 'h-8 w-8 text-brand' : 'h-8 w-8 text-muted'} aria-hidden="true" />
        <p className="text-sm font-medium text-ink">Arrastra una carpeta o archivos</p>
        <p className="text-xs text-muted">PDF o .zip · también puedes hacer clic</p>

        <input
          ref={inputArchivosRef}
          type="file"
          accept=".pdf,.zip"
          multiple
          className="hidden"
          onChange={handleArchivosSeleccionados}
          aria-hidden="true"
          tabIndex={-1}
        />
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
      </div>

      <button
        type="button"
        onClick={abrirSelectorCarpeta}
        className="mt-2 w-full text-center text-xs font-medium text-brand underline underline-offset-2 hover:no-underline"
      >
        o selecciona una carpeta
      </button>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
