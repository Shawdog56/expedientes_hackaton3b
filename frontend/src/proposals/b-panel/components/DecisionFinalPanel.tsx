import { CircleCheck, CircleX, Loader2 } from 'lucide-react';
import { useState } from 'react';
import type { DecisionFinal } from '../../../shared/types/expediente';
import type { ExpedienteAnalisis } from '../../../shared/useSimulatedAnalysis';
import type { EstadoDecision } from '../useDecisionFinal';
import { DictamenChip } from './DictamenChip';

interface Props {
  analisis: ExpedienteAnalisis;
  estado: EstadoDecision;
  onDecidir: (decision: DecisionFinal) => void;
}

const ETIQUETA_DECISION: Record<DecisionFinal, string> = {
  aceptado: 'aceptado',
  rechazado: 'rechazado',
};

function formatearFecha(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });
}

/** Último paso del flujo: la persona que revisa decide si acepta el expediente. */
export function DecisionFinalPanel({ analisis, estado, onDecidir }: Props) {
  const { dictamen } = analisis;
  const [confirmandoAceptar, setConfirmandoAceptar] = useState(false);
  const [cambiando, setCambiando] = useState(false);

  const decidida = estado.decision !== null && !cambiando;
  const aceptarDirecto = dictamen === 'cumple';

  const decidir = (decision: DecisionFinal) => {
    setConfirmandoAceptar(false);
    setCambiando(false);
    onDecidir(decision);
  };

  const alAceptar = () => (aceptarDirecto ? decidir('aceptado') : setConfirmandoAceptar(true));

  return (
    <section aria-labelledby="decision-titulo" className="space-y-5 rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div>
        <h3 id="decision-titulo" className="text-base font-semibold text-ink">
          Decisión final
        </h3>
        <p className="mt-1 text-sm text-muted">
          Ya revisaste las validaciones y la zona y competencia. El análisis es una recomendación: la decisión final es
          tuya.
        </p>
      </div>

      <dl className="grid gap-3 rounded-lg border border-border bg-bg p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Expediente</dt>
          <dd className="mt-1 truncate font-medium text-ink" title={analisis.nombre}>
            {analisis.nombre}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Dictamen del análisis</dt>
          <dd className="mt-1">{dictamen && <DictamenChip dictamen={dictamen} />}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted">Zona y competencia</dt>
          <dd className="mt-1 inline-flex items-center gap-1.5 font-medium text-ink">
            <CircleCheck className="h-4 w-4 text-ok" aria-hidden="true" />
            Revisada
          </dd>
        </div>
      </dl>

      {decidida && estado.decision ? (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 ${
            estado.decision === 'aceptado' ? 'border-ok/40 bg-ok/10' : 'border-error/40 bg-error/10'
          }`}
        >
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            {estado.decision === 'aceptado' ? (
              <CircleCheck className="h-5 w-5 text-ok" aria-hidden="true" />
            ) : (
              <CircleX className="h-5 w-5 text-error" aria-hidden="true" />
            )}
            Expediente {ETIQUETA_DECISION[estado.decision]}
            {estado.decididoEn && (
              <span className="font-normal text-muted"> · {formatearFecha(estado.decididoEn)}</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => setCambiando(true)}
            className="text-sm font-medium text-brand underline underline-offset-2 hover:no-underline"
          >
            Cambiar decisión
          </button>
        </div>
      ) : confirmandoAceptar ? (
        <div role="alertdialog" aria-labelledby="confirmar-titulo" className="space-y-3 rounded-lg border border-warn/40 bg-warn/10 p-4">
          <p id="confirmar-titulo" className="text-sm text-ink">
            El análisis dictaminó <strong>{dictamen === 'revision' ? 'requiere revisión' : 'no cumple'}</strong>. ¿Aceptar
            el expediente de todos modos?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => decidir('aceptado')}
              className="rounded-md bg-ok px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Sí, aceptar
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoAceptar(false)}
              className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-brand/50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={alAceptar}
            disabled={estado.guardando}
            className="inline-flex items-center gap-2 rounded-md bg-ok px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {estado.guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CircleCheck className="h-4 w-4" aria-hidden="true" />
            )}
            Aceptar expediente
          </button>
          <button
            type="button"
            onClick={() => decidir('rechazado')}
            disabled={estado.guardando}
            className="inline-flex items-center gap-2 rounded-md border border-error/50 bg-surface px-5 py-2.5 font-medium text-error transition-colors hover:bg-error/5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CircleX className="h-4 w-4" aria-hidden="true" />
            Rechazar
          </button>
          {cambiando && (
            <button
              type="button"
              onClick={() => setCambiando(false)}
              className="text-sm font-medium text-muted underline underline-offset-2 hover:no-underline"
            >
              Mantener la decisión actual
            </button>
          )}
        </div>
      )}

      {estado.error && (
        <p role="alert" className="text-sm font-medium text-error">
          {estado.error}
        </p>
      )}
    </section>
  );
}
