import { Eye, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { EVIDENCIA_POR_PUNTO, HALLAZGOS_CRUZADOS } from '../../../shared/mockResults';
import { useAnimaciones } from '../../../shared/motion';
import type { EstadoValidacion, TipoDocumentalId } from '../../../shared/validationRules';

export interface SeleccionHallazgo {
  tipoId: TipoDocumentalId;
  reglaId: string;
  reglaEtiqueta: string;
  estado: EstadoValidacion;
  documentoNombre: string;
  documentoArchivo: string;
}

interface Props {
  seleccion: SeleccionHallazgo | null;
  onCerrar: () => void;
}

function identidad(seleccion: SeleccionHallazgo | null): string | null {
  return seleccion ? `${seleccion.tipoId}:${seleccion.reglaId}` : null;
}

export function FindingDrawer({ seleccion, onCerrar }: Props) {
  const { reducido, spring, transicionNormal } = useAnimaciones();
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

  const hallazgo = seleccion
    ? HALLAZGOS_CRUZADOS.find((item) => item.tipoId === seleccion.tipoId && item.reglaId === seleccion.reglaId)
    : undefined;
  const evidenciaSimple = seleccion ? EVIDENCIA_POR_PUNTO[`${seleccion.tipoId}:${seleccion.reglaId}`] : undefined;
  const evidenciaMostrada = hallazgo?.evidencias[indiceEvidencia];

  return (
    <AnimatePresence>
      {seleccion && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-ink/40"
            onClick={onCerrar}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transicionNormal}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="panel-hallazgo-titulo"
            initial={reducido ? { opacity: 0 } : { opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducido ? { opacity: 0 } : { opacity: 0, x: '100%' }}
            transition={spring}
            className="absolute right-0 top-0 flex h-full w-full flex-col bg-surface shadow-xl sm:w-[420px]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 id="panel-hallazgo-titulo" className="text-base font-semibold text-ink">
                {hallazgo ? hallazgo.titulo : seleccion.reglaEtiqueta}
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
              {hallazgo ? (
                <div className="space-y-4">
                  <p className="text-sm text-ink">
                    {hallazgo.descripcion} {hallazgo.tolerancia}.
                  </p>

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
                        {hallazgo.evidencias.map((evidencia, indice) => (
                          <tr key={evidencia.documento}>
                            <td className="px-3 py-2 text-ink">{evidencia.documento}</td>
                            <td
                              className={`px-3 py-2 ${evidencia.esDiscrepante ? 'font-semibold text-warn' : 'text-ink'}`}
                            >
                              {evidencia.valor}
                            </td>
                            <td className="px-3 py-2">
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
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {evidenciaMostrada && (
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
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-ink">
                    <span className="font-medium">{seleccion.documentoNombre}</span> · {seleccion.reglaEtiqueta}
                  </p>
                  {evidenciaSimple ? (
                    <>
                      <p className="text-sm text-ink">
                        Valor encontrado: <span className="font-medium">{evidenciaSimple.valorEncontrado}</span>
                      </p>
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-muted">
                          {seleccion.documentoArchivo} · pág. {evidenciaSimple.pagina}
                        </p>
                        <p className="rounded-lg border border-border bg-bg p-3 font-mono text-xs text-ink">
                          {evidenciaSimple.fragmento}
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted">Sin evidencia de ejemplo disponible para este punto.</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
