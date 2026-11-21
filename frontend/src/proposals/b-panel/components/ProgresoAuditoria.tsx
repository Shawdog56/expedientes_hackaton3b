import { CircleCheck, Clock, Hourglass, Loader2, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FaseDocumento } from '../../../api/expedientes';
import type { ProgresoReal } from '../../../shared/resultadosReales';

interface ConfigFase {
  etiqueta: string;
  Icono: LucideIcon;
  clase: string;
  gira?: boolean;
}

const FASES: Record<FaseDocumento, ConfigFase> = {
  en_espera: { etiqueta: 'En espera', Icono: Clock, clase: 'text-muted' },
  leyendo: { etiqueta: 'Leyendo con OCR', Icono: Loader2, clase: 'text-brand', gira: true },
  esperando_modelo: { etiqueta: 'Esperando al modelo', Icono: Hourglass, clase: 'text-warn' },
  analizando: { etiqueta: 'Analizando con el modelo', Icono: Loader2, clase: 'text-brand', gira: true },
  listo: { etiqueta: 'Listo', Icono: CircleCheck, clase: 'text-ok' },
};

function formatearDuracion(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const minutos = Math.floor(total / 60);
  return `${minutos}:${String(total % 60).padStart(2, '0')}`;
}

/** Avance real de la auditoría: qué hace cada documento, cuánto lleva y si hay expedientes delante. */
export function ProgresoAuditoria({ progreso }: { progreso: ProgresoReal }) {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const inicio = Date.parse(progreso.iniciadaEn);
  const transcurrido = Number.isNaN(inicio) ? null : (ahora - inicio) / 1000;

  return (
    <section
      aria-labelledby="progreso-auditoria-titulo"
      className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="progreso-auditoria-titulo" className="text-sm font-semibold text-ink" aria-live="polite">
          Analizando con agentes · {progreso.listos} de {progreso.total} documentos listos
        </h3>
        {transcurrido !== null && (
          <span className="text-sm tabular-nums text-muted" title="Tiempo desde que empezó la auditoría">
            {formatearDuracion(transcurrido)}
          </span>
        )}
      </div>

      {progreso.delante > 0 && (
        <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm text-ink">
          {progreso.delante === 1
            ? 'Hay 1 expediente delante en la cola.'
            : `Hay ${progreso.delante} expedientes delante en la cola.`}{' '}
          El OCR y el modelo se comparten, así que este avanza cuando aquellos liberan su turno.
        </p>
      )}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {progreso.documentos.map((documento) => {
          const { etiqueta, Icono, clase, gira } = FASES[documento.fase] ?? FASES.en_espera;
          return (
            <li key={documento.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-ink" title={documento.nombre}>
                {documento.nombre}
              </span>
              <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${clase}`}>
                <Icono className={`h-3.5 w-3.5 ${gira ? 'animate-spin' : ''}`} aria-hidden="true" />
                {etiqueta}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted">
        El OCR lee un documento a la vez y el modelo atiende una petición a la vez. En CPU, cada documento
        escaneado puede tardar varios minutos.
      </p>
    </section>
  );
}
