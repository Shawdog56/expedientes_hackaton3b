import { ArrowLeft, FileArchive, Folder, Sparkles, Trash2 } from 'lucide-react';
import { EXPLICACION_EXPEDIENTE } from '../../shared/constants';
import { ChipTipo } from '../../shared/components/ClasificacionExpediente';
import { TIPOS_DOCUMENTALES, type Expediente } from '../../shared/types/expediente';
import { formatBytes } from '../../shared/utils/formatBytes';

interface Props {
  expedientes: Expediente[];
  onQuitar: (id: string) => void;
  onVolver: () => void;
  onAnalizar: () => void;
}

export function AsistentePaso2({ expedientes, onQuitar, onVolver, onAnalizar }: Props) {
  if (expedientes.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
        <p className="font-medium text-ink">Ya no tienes expedientes cargados</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted">{EXPLICACION_EXPEDIENTE}</p>
        <button
          type="button"
          onClick={onVolver}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 font-medium text-brand transition-colors hover:bg-brand-soft"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a cargar
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6">
      <h2 className="text-center text-xl font-semibold text-ink">Revisa los archivos</h2>
      <p className="mx-auto mt-1 max-w-md text-center text-sm text-muted">
        Confirma que estos sean los expedientes correctos antes de analizarlos.
      </p>

      <ul className="mt-6 space-y-3">
        {expedientes.map((expediente) => (
          <li key={expediente.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  {expediente.origen === 'zip' ? (
                    <FileArchive className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Folder className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-ink break-all">{expediente.nombre}</p>
                  <p className="text-sm text-muted">
                    {expediente.archivos.length} archivo{expediente.archivos.length === 1 ? '' : 's'} ·{' '}
                    {formatBytes(expediente.tamanoTotal)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onQuitar(expediente.id)}
                aria-label={`Quitar expediente ${expediente.nombre}`}
                className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-error/10 hover:text-error"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
              {TIPOS_DOCUMENTALES.map(({ valor, etiqueta }) => (
  <ChipTipo key={valor} expediente={expediente} tipo={valor} etiqueta={etiqueta} />
))}
            </ul>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onVolver}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 font-medium text-ink transition-colors hover:bg-bg"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Cargar más
        </button>
        <button
          type="button"
          onClick={onAnalizar}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-dark"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Analizar expedientes
        </button>
      </div>
    </div>
  );
}
