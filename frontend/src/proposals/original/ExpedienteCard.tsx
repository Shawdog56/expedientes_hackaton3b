import { ChevronDown, ChevronRight, File as FileIcon, FileArchive, Folder, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { TIPOS_DOCUMENTALES, type Expediente } from '../../shared/types/expediente';
import { formatBytes } from '../../shared/utils/formatBytes';

interface Props {
  expediente: Expediente;
  onQuitar: (id: string) => void;
}

export function ExpedienteCard({ expediente, onQuitar }: Props) {
  const [expandido, setExpandido] = useState(false);
  const esZip = expediente.origen === 'zip';
  const pdfs = expediente.archivos.filter((archivo) => archivo.nombre.toLowerCase().endsWith('.pdf'));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            {esZip ? <FileArchive className="h-5 w-5" aria-hidden="true" /> : <Folder className="h-5 w-5" aria-hidden="true" />}
          </div>
          <div>
            <p className="font-medium text-ink break-all">{expediente.nombre}</p>
            <p className="text-sm text-muted">
              {esZip ? 'Contenido por analizar' : `${expediente.archivos.length} archivo${expediente.archivos.length === 1 ? '' : 's'}`}
              {' · '}
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

      {!esZip && (
        <div>
          <button
            type="button"
            onClick={() => setExpandido((valor) => !valor)}
            aria-expanded={expandido}
            className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
          >
            {expandido ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
            {pdfs.length} PDF{pdfs.length === 1 ? '' : 's'} encontrado{pdfs.length === 1 ? '' : 's'}
          </button>
          {expandido && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-bg p-2">
              {pdfs.length === 0 && <li className="px-2 py-1 text-sm text-muted">No se encontraron PDFs en esta carpeta.</li>}
              {pdfs.map((archivo) => (
                <li key={archivo.ruta} className="flex items-center justify-between gap-2 px-2 py-1 text-sm">
                  <span className="flex items-center gap-2 truncate text-ink">
                    <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
                    <span className="truncate">{archivo.ruta}</span>
                  </span>
                  <span className="shrink-0 text-muted">{formatBytes(archivo.tamano)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Tipos documentales</p>
        <ul className="flex flex-wrap gap-1.5">
          {TIPOS_DOCUMENTALES.map((tipo) => (
            <li
              key={tipo}
              className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-muted"
            >
              {tipo}: Pendiente de clasificar
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
