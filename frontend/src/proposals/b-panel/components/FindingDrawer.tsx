import { Eye, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { COMPARACION_CRUZADA, EVIDENCIA_POR_PUNTO, HALLAZGOS_CRUZADOS, type EvidenciaCruzada } from '../../../shared/mockResults';
import { REGLAS_VALIDACION, type EstadoValidacion, type TipoDocumentalId } from '../../../shared/validationRules';

export interface PuntoDocumento {
  origen: 'punto';
  tipoId: TipoDocumentalId;
  reglaId: string;
  reglaEtiqueta: string;
  estado: EstadoValidacion;
  documentoNombre: string;
  documentoArchivo: string;
}

export interface FilaComparacionSeleccionada {
  origen: 'comparacion';
  filaId: string;
  tiposFaltantes: TipoDocumentalId[];
}

export type SeleccionHallazgo = PuntoDocumento | FilaComparacionSeleccionada;

interface Props {
  seleccion: SeleccionHallazgo | null;
  onCerrar: () => void;
}

function identidad(seleccion: SeleccionHallazgo | null): string | null {
  if (!seleccion) return null;
  return seleccion.origen === 'punto' ? `punto:${seleccion.tipoId}:${seleccion.reglaId}` : `fila:${seleccion.filaId}`;
}

function nombreTipo(tipoId: TipoDocumentalId): string {
  return REGLAS_VALIDACION.find((tipo) => tipo.id === tipoId)?.nombre ?? tipoId;
}

export function FindingDrawer({ seleccion, onCerrar }: Props) {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const elementoPrevioRef = useRef<HTMLElement | null>(null);
  const [indiceEvidencia, setIndiceEvidencia] = useState(0);

  // El índice de evidencia se reinicia cuando cambia la selección; se ajusta
  // durante el render (no en un efecto), siguiendo el patrón de React para
  // "adjusting state when a prop changes".
  const [identidadPrevia, setIdentidadPrevia] = useState<string | null>(null);
  const identidadActual = identidad(seleccion);
  if (identidadActual !== identidadPrevia) {
    setIdentidadPrevia(identidadActual);
    setIndiceEvidencia(0);
  }

  useEffect(() => {
    if (seleccion) {
      elementoPrevioRef.current = document.activeElement as HTMLElement | null;
      cerrarRef.current?.focus();
    } else {
      elementoPrevioRef.current?.focus();
    }
  }, [seleccion]);

  useEffect(() => {
    if (!seleccion) return;
    const handleKeyDown = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [seleccion, onCerrar]);

  if (!seleccion) return null;

  let titulo: string;
  let descripcion: string | null = null;
  let evidencias: EvidenciaCruzada[] = [];
  let contenidoSimple: { documentoNombre: string; reglaEtiqueta: string; valor: string; pagina: number; fragmento: string } | null =
    null;

  if (seleccion.origen === 'punto') {
    const hallazgo = HALLAZGOS_CRUZADOS.find((item) => item.tipoId === seleccion.tipoId && item.reglaId === seleccion.reglaId);
    if (hallazgo) {
      titulo = hallazgo.titulo;
      descripcion = `${hallazgo.descripcion} ${hallazgo.tolerancia}.`;
      evidencias = hallazgo.evidencias;
    } else {
      titulo = seleccion.reglaEtiqueta;
      const evidencia = EVIDENCIA_POR_PUNTO[`${seleccion.tipoId}:${seleccion.reglaId}`];
      if (evidencia) {
        contenidoSimple = {
          documentoNombre: seleccion.documentoArchivo || seleccion.documentoNombre,
          reglaEtiqueta: seleccion.reglaEtiqueta,
          valor: evidencia.valorEncontrado,
          pagina: evidencia.pagina,
          fragmento: evidencia.fragmento,
        };
      }
    }
  } else {
    const fila = COMPARACION_CRUZADA.find((item) => item.id === seleccion.filaId);
    titulo = fila?.etiqueta ?? 'Comparación';
    if (fila) {
      descripcion = fila.coincide
        ? 'Este dato coincide entre los documentos que lo registran.'
        : `Este dato no coincide entre documentos.${fila.notaTolerancia ? ` ${fila.notaTolerancia}` : ''}`;
      evidencias = (Object.entries(fila.celdas) as [TipoDocumentalId, { reglaId: string }][])
        .map(([tipoId, celda]) => {
          if (seleccion.tiposFaltantes.includes(tipoId)) {
            return {
              documento: nombreTipo(tipoId),
              valor: 'Faltante',
              pagina: 0,
              fragmento: 'Este documento no se encontró en el expediente.',
              esDiscrepante: false,
            };
          }
          const evidencia = EVIDENCIA_POR_PUNTO[`${tipoId}:${celda.reglaId}`];
          if (!evidencia) return null;
          return {
            documento: nombreTipo(tipoId),
            valor: evidencia.valorEncontrado,
            pagina: evidencia.pagina,
            fragmento: evidencia.fragmento,
            esDiscrepante: tipoId === fila.discrepante,
          };
        })
        .filter((item): item is EvidenciaCruzada => item !== null);
    }
  }

  const evidenciaMostrada = evidencias[indiceEvidencia];

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-ink/40" onClick={onCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-hallazgo-titulo"
        className="absolute right-0 top-0 flex h-full w-full flex-col bg-surface shadow-xl sm:w-[420px]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 id="panel-hallazgo-titulo" className="text-base font-semibold text-ink">
            {titulo}
          </h2>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar panel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {evidencias.length > 0 ? (
            <div className="space-y-4">
              {descripcion && <p className="text-sm text-ink">{descripcion}</p>}

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg text-left text-xs font-semibold uppercase tracking-wide text-muted">
                      <th scope="col" className="px-3 py-2">
                        Documento
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Valor encontrado
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Evidencia
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {evidencias.map((evidencia, indice) => (
                      <tr key={evidencia.documento}>
                        <td className="px-3 py-2 text-ink">{evidencia.documento}</td>
                        <td
                          className={`px-3 py-2 ${
                            evidencia.esDiscrepante
                              ? 'font-semibold text-warn'
                              : evidencia.valor === 'Faltante'
                                ? 'text-muted'
                                : 'text-ink'
                          }`}
                        >
                          {evidencia.valor}
                        </td>
                        <td className="px-3 py-2">
                          {evidencia.valor === 'Faltante' ? (
                            <span className="text-xs text-muted">—</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIndiceEvidencia(indice)}
                              aria-pressed={indiceEvidencia === indice}
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                                indiceEvidencia === indice
                                  ? 'border-brand bg-brand-soft text-ink'
                                  : 'border-border text-muted hover:border-brand/50'
                              }`}
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              pág. {evidencia.pagina}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {evidenciaMostrada && evidenciaMostrada.valor !== 'Faltante' && (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted">
                    {evidenciaMostrada.documento} · pág. {evidenciaMostrada.pagina}
                  </p>
                  <p className="rounded-lg border border-border bg-bg p-3 font-mono text-xs text-ink">
                    {evidenciaMostrada.fragmento}
                  </p>
                </div>
              )}
            </div>
          ) : contenidoSimple ? (
            <div className="space-y-4">
              <p className="text-sm text-ink">
                Valor encontrado: <span className="font-medium">{contenidoSimple.valor}</span>
              </p>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted">
                  {contenidoSimple.documentoNombre} · pág. {contenidoSimple.pagina}
                </p>
                <p className="rounded-lg border border-border bg-bg p-3 font-mono text-xs text-ink">
                  {contenidoSimple.fragmento}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">Sin evidencia de ejemplo disponible para este punto.</p>
          )}
        </div>
      </div>
    </div>
  );
}
