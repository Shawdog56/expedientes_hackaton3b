import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  File as FileIcon,
  Loader2,
  XCircle,
} from 'lucide-react';
import {
  TIPOS_DOCUMENTALES,
  type DocumentoValidado,
  type Expediente,
  type TipoDocumental,
} from '../types/expediente';
import { formatBytes } from '../utils/formatBytes';
import { plural } from '../utils/plural';

/** Piezas de la clasificación de un expediente compartidas por todas las propuestas de diseño. */

export function Resumen({ expediente }: { expediente: Expediente }) {
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
      {plural(expediente.documentos.length, 'documento válido', 'documentos válidos')} · {plural(paginas, 'página')}
    </span>
  );
}

export function ChipTipo({ expediente, tipo, etiqueta }: { expediente: Expediente; tipo: TipoDocumental; etiqueta: string }) {
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

export function FilaDocumento({
  doc,
  onCambiarTipo,
  onVer,
}: {
  doc: DocumentoValidado;
  onCambiarTipo: (tipo: TipoDocumental | null) => void;
  /** Si se indica, muestra el botón para abrir el archivo en el visor. */
  onVer?: () => void;
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
          {doc.formato === 'pdf' ? plural(doc.paginas, 'pág.', 'págs.') : `Imagen ${doc.formato.toUpperCase()}`} ·{' '}
          {formatBytes(doc.tamano)}
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
        {onVer && (
          <button
            type="button"
            onClick={onVer}
            aria-label={`Ver el archivo ${doc.nombre}`}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs font-medium text-ink transition-colors hover:border-brand/50 hover:bg-bg"
          >
            <Eye className="h-3 w-3" aria-hidden="true" />
            Ver
          </button>
        )}
      </div>
    </li>
  );
}
