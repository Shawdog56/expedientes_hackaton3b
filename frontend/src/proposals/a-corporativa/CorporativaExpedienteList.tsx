import { FileArchive, Folder, FolderOpen, Trash2 } from 'lucide-react';
import { EXPLICACION_EXPEDIENTE } from '../../shared/constants';
import { TIPOS_DOCUMENTALES, type Expediente } from '../../shared/types/expediente';
import { formatBytes } from '../../shared/utils/formatBytes';

interface Props {
  expedientes: Expediente[];
  onQuitar: (id: string) => void;
}

export function CorporativaExpedienteList({ expedientes, onQuitar }: Props) {
  return (
    <section aria-labelledby="lista-titulo" className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <h2 id="lista-titulo" className="mb-1 text-center text-xs font-semibold uppercase tracking-wide text-muted">
        Paso 2
      </h2>
      <p className="mb-6 text-center text-lg font-medium text-ink">
        Expedientes cargados {expedientes.length > 0 && `(${expedientes.length})`}
      </p>

      {expedientes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg px-6 py-10 text-center">
          <FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted" aria-hidden="true" />
          <p className="font-medium text-ink">Aún no has cargado ningún expediente</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">{EXPLICACION_EXPEDIENTE}</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {expedientes.map((expediente) => (
            <li key={expediente.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                    {expediente.origen === 'zip' ? (
                      <FileArchive className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Folder className="h-5 w-5" aria-hidden="true" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-ink break-all">{expediente.nombre}</p>
                    <p className="text-sm text-muted">
                      {expediente.origen === 'zip' ? 'Archivo .zip' : 'Carpeta'} ·{' '}
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
                {TIPOS_DOCUMENTALES.map((tipo) => (
                  <li key={tipo} className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-muted">
                    {tipo}: Pendiente de clasificar
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
