import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  File as FileIcon,
  FileArchive,
  Folder,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  ETIQUETA_TIPO,
  TIPOS_DOCUMENTALES,
  type DocumentoValidado,
  type Expediente,
  type TipoDocumental,
} from '../types/expediente';
import { formatBytes } from '../utils/formatBytes';

interface Props {
  expediente: Expediente;
  onQuitar: (id: string) => void;
  onReclasificar: (id: string, documentoId: string, tipo: TipoDocumental | null) => void;
}

function plural(n: number, singular: string, pluralTexto = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralTexto}`;
}

function Resumen({ expediente }: { expediente: Expediente }) {
  if (expediente.estado === 'validando') {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {expediente.origen === 'zip' ? 'Descomprimiendo y clasificando…' : 'Validando y clasificando…'}
      </span>
    );
  }
  if (expediente.estado === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-error">
        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {expediente.error ?? 'Error de validación'}
      </span>
    );
  }
  const paginas = expediente.documentos.reduce((total, doc) => total + doc.paginas, 0);
  return (
    <span className="inline-flex items-center gap-1.5 text-ok">
      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
      {plural(expediente.documentos.length, 'PDF válido', 'PDFs válidos')} · {plural(paginas, 'página')}
    </span>
  );
}

function ChipTipo({ expediente, tipo, etiqueta }: { expediente: Expediente; tipo: TipoDocumental; etiqueta: string }) {
  if (expediente.estado !== 'validado') {
    return (
      <li className="rounded-full border border-border bg-bg px-2.5 py-1 text-xs text-muted">
        {etiqueta}: Pendiente
      </li>
    );
  }
  const cantidad = expediente.documentos.filter((doc) => doc.tipo_documental === tipo).length;
  if (cantidad === 0) {
    return (
      <li className="inline-flex items-center gap-1 rounded-full border border-error/40 bg-error/5 px-2.5 py-1 text-xs font-medium text-error">
        <XCircle className="h-3 w-3" aria-hidden="true" />
        {etiqueta}: Faltante
      </li>
    );
  }
  if (cantidad > 1) {
    return (
      <li className="inline-flex items-center gap-1 rounded-full border border-warn/50 bg-warn/10 px-2.5 py-1 text-xs font-medium text-ink">
        <AlertTriangle className="h-3 w-3 text-warn" aria-hidden="true" />
        {etiqueta}: {cantidad} documentos
      </li>
    );
  }
  return (
    <li className="inline-flex items-center gap-1 rounded-full border border-ok/40 bg-ok/10 px-2.5 py-1 text-xs font-medium text-ink">
      <CheckCircle2 className="h-3 w-3 text-ok" aria-hidden="true" />
      {etiqueta}
    </li>
  );
}

function FilaDocumento({
  doc,
  onCambiarTipo,
}: {
  doc: DocumentoValidado;
  onCambiarTipo: (tipo: TipoDocumental | null) => void;
}) {
  const sinTipo = doc.tipo_documental === null;
  return (
    <li className="flex flex-col gap-1 px-2 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-ink">
          <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden="true" />
          <span className="truncate" title={doc.ruta}>{doc.ruta}</span>
        </span>
        <span className="shrink-0 text-xs text-muted">
          {plural(doc.paginas, 'pág.', 'págs.')} · {formatBytes(doc.tamano)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-5">
        {sinTipo && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warn">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {doc.estado_clasificacion === 'ambiguo' ? 'Nombre ambiguo' : 'Nombre no reconocido'}
          </span>
        )}
        <label className="sr-only" htmlFor={`tipo-${doc.id}`}>
          Tipo documental de {doc.nombre}
        </label>
        <select
          id={`tipo-${doc.id}`}
          value={doc.tipo_documental ?? ''}
          onChange={(evento) => onCambiarTipo((evento.target.value || null) as TipoDocumental | null)}
          className={`rounded-md border bg-surface px-2 py-0.5 text-xs ${
            sinTipo ? 'border-warn text-ink' : 'border-border text-muted'
          }`}
        >
          <option value="">Sin clasificar</option>
          {TIPOS_DOCUMENTALES.map(({ valor, etiqueta }) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
        {doc.estado_clasificacion === 'manual' && <span className="text-xs text-muted">(manual)</span>}
      </div>
    </li>
  );
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
