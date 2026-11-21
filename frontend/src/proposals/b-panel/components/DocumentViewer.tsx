import { ExternalLink, FileText, Loader2, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { obtenerArchivo } from '../../../api/expedientes';
import type { ArchivoVisible, DocumentoParaVer } from '../../../shared/types/expediente';
import { plural } from '../../../shared/utils/plural';

type Carga =
  | { estado: 'cargando' }
  | { estado: 'listo'; url: string }
  | { estado: 'error'; mensaje: string };

interface ContenidoProps {
  archivo: ArchivoVisible;
}

/** Descarga el archivo y lo muestra. Se monta de nuevo por archivo (`key`), así cada carga empieza limpia. */
function ContenidoArchivo({ archivo }: ContenidoProps) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [intento, setIntento] = useState(0);
  const [ajustar, setAjustar] = useState(true);

  useEffect(() => {
    const control = new AbortController();
    let urlCreada: string | null = null;

    obtenerArchivo(archivo.id, control.signal)
      .then((blob) => {
        if (control.signal.aborted) return;
        urlCreada = URL.createObjectURL(blob);
        setCarga({ estado: 'listo', url: urlCreada });
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return;
        setCarga({
          estado: 'error',
          mensaje: error instanceof Error ? error.message : 'No se pudo cargar el archivo',
        });
      });

    return () => {
      control.abort();
      if (urlCreada) URL.revokeObjectURL(urlCreada);
    };
  }, [archivo.id, intento]);

  const reintentar = () => {
    setCarga({ estado: 'cargando' });
    setIntento((actual) => actual + 1);
  };

  if (carga.estado === 'cargando') {
    return (
      <div role="status" className="flex h-full items-center justify-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Cargando archivo…
      </div>
    );
  }

  if (carga.estado === 'error') {
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <TriangleAlert className="h-6 w-6 text-error" aria-hidden="true" />
        <p className="text-sm text-ink">{carga.mensaje}</p>
        <button
          type="button"
          onClick={reintentar}
          className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-brand/50"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end gap-2 border-b border-border bg-surface px-4 py-2">
        {archivo.formato !== 'pdf' && (
          <button
            type="button"
            onClick={() => setAjustar((actual) => !actual)}
            aria-pressed={!ajustar}
            className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-brand/50"
          >
            {ajustar ? 'Tamaño real' : 'Ajustar al panel'}
          </button>
        )}
        <a
          href={carga.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-brand/50"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          Abrir en una pestaña
        </a>
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-bg">
        {archivo.formato === 'pdf' ? (
          <iframe src={carga.url} title={`Vista de ${archivo.nombre}`} className="h-full w-full border-0" />
        ) : (
          <img
            src={carga.url}
            alt={`Imagen del documento ${archivo.nombre}`}
            className={ajustar ? 'mx-auto h-full w-full object-contain p-4' : 'max-w-none p-4'}
          />
        )}
      </div>
    </div>
  );
}

interface PanelProps {
  documento: DocumentoParaVer;
  onCerrar: () => void;
}

function PanelVisor({ documento, onCerrar }: PanelProps) {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const [indice, setIndice] = useState(documento.indiceInicial ?? 0);
  const archivo = documento.archivos[indice] ?? documento.archivos[0];

  useEffect(() => {
    const elementoPrevio = document.activeElement as HTMLElement | null;
    cerrarRef.current?.focus();
    return () => elementoPrevio?.focus();
  }, []);

  useEffect(() => {
    const alPulsarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPulsarTecla);
    return () => document.removeEventListener('keydown', alPulsarTecla);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40" onClick={onCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="visor-titulo"
        className="absolute right-0 top-0 flex h-full w-full flex-col bg-surface shadow-xl sm:w-[min(880px,92vw)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="visor-titulo" className="truncate text-base font-semibold text-ink">
              {documento.titulo}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted" title={archivo.nombre}>
              <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{archivo.nombre}</span>
              <span className="shrink-0">
                ·{' '}
                {archivo.formato === 'pdf'
                  ? plural(archivo.paginas, 'página')
                  : `Imagen ${archivo.formato.toUpperCase()}`}
              </span>
            </p>
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar visor"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {documento.archivos.length > 1 && (
          <div className="flex items-center gap-2 border-b border-border px-5 py-2.5">
            <label htmlFor="visor-archivo" className="text-xs font-medium text-muted">
              Archivo
            </label>
            <select
              id="visor-archivo"
              value={indice}
              onChange={(evento) => setIndice(Number(evento.target.value))}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-ink"
            >
              {documento.archivos.map((item, posicion) => (
                <option key={item.id} value={posicion}>
                  {posicion + 1} de {documento.archivos.length} · {item.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="min-h-0 flex-1">
          <ContenidoArchivo key={archivo.id} archivo={archivo} />
        </div>
      </div>
    </div>
  );
}

interface Props {
  documento: DocumentoParaVer | null;
  onCerrar: () => void;
}

/** Panel lateral para ver un archivo del expediente (PDF o imagen) sin salir de la pantalla. */
export function DocumentViewer({ documento, onCerrar }: Props) {
  if (!documento || documento.archivos.length === 0) return null;
  return <PanelVisor documento={documento} onCerrar={onCerrar} />;
}
