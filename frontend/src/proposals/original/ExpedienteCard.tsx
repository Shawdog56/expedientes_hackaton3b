import { AlertCircle, ChevronDown, ChevronRight, FileArchive, Folder, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  ETIQUETA_TIPO,
  TIPOS_DOCUMENTALES,
  type Expediente,
  type TipoDocumental,
} from '../../shared/types/expediente';
import { ChipTipo, FilaDocumento, Resumen } from '../../shared/components/ClasificacionExpediente';
import { formatBytes } from '../../shared/utils/formatBytes';
import { plural } from '../../shared/utils/plural';

interface Props {
  expediente: Expediente;
  onQuitar: (id: string) => void;
  onReclasificar: (id: string, documentoId: string, tipo: TipoDocumental | null) => void;
}

export function ExpedienteCard({ expediente, onQuitar, onReclasificar }: Props) {
  const { documentos, rechazados } = expediente;
  const sinClasificar = documentos.filter((doc) => doc.tipo_documental === null);
  const [verDocumentos, setVerDocumentos] = useState<boolean | null>(null);
  const [verRechazados, setVerRechazados] = useState(false);
  // Se abre solo si hay documentos que requieren clasificación manual.
  const documentosAbiertos = verDocumentos ?? sinClasificar.length > 0;
  const esZip = expediente.origen === 'zip';

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
              {esZip ? 'Archivo .zip' : plural(expediente.archivos.length, 'archivo')}
              {' · '}
              {formatBytes(expediente.tamanoTotal)}
            </p>
            <p className="mt-0.5 text-sm text-muted" role="status">
              <Resumen expediente={expediente} />
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

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Tipos documentales</p>
        <ul className="flex flex-wrap gap-1.5">
          {TIPOS_DOCUMENTALES.map(({ valor, etiqueta }) => (
            <ChipTipo key={valor} expediente={expediente} tipo={valor} etiqueta={etiqueta} />
          ))}
        </ul>
      </div>

      {documentos.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerDocumentos(!documentosAbiertos)}
            aria-expanded={documentosAbiertos}
            className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
          >
            {documentosAbiertos ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
            {plural(documentos.length, 'documento')}
            {sinClasificar.length > 0 && (
              <span className="text-warn">· {sinClasificar.length} sin clasificar</span>
            )}
          </button>
          {documentosAbiertos && (
            <ul className="mt-2 max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-bg p-1">
              {[...documentos]
                .sort((a, b) => Number(a.tipo_documental !== null) - Number(b.tipo_documental !== null))
                .map((doc) => (
                  <FilaDocumento
                    key={doc.id}
                    doc={doc}
                    onCambiarTipo={(tipo) => {
                      setVerDocumentos(true);
                      onReclasificar(expediente.id, doc.id, tipo);
                    }}
                  />
                ))}
            </ul>
          )}
        </div>
      )}

      {rechazados.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setVerRechazados((valor) => !valor)}
            aria-expanded={verRechazados}
            className="flex items-center gap-1 text-sm font-medium text-error hover:underline"
          >
            {verRechazados ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
            {plural(rechazados.length, 'archivo rechazado', 'archivos rechazados')}
          </button>
          {verRechazados && (
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-error/30 bg-error/5 p-2">
              {rechazados.map((archivo, indice) => (
                <li key={`${archivo.ruta}-${indice}`} className="flex items-start gap-2 px-2 py-1 text-sm">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-ink" title={archivo.ruta}>{archivo.ruta}</span>
                    <span className="block text-error">{archivo.motivo}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {expediente.estado === 'validado' && expediente.tiposFaltantes.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/5 px-3 py-2 text-xs text-error">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Expediente incompleto: falta {expediente.tiposFaltantes.map((tipo) => ETIQUETA_TIPO[tipo]).join(', ')}.
        </p>
      )}
    </div>
  );
}
