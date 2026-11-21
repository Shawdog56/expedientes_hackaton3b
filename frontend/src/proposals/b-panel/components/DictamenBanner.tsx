import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { obtenerResumenDictamen } from '../../../shared/mockResults';
import type { Dictamen } from '../../../shared/useSimulatedAnalysis';

interface ChipProps {
  dictamen: Dictamen;
}

export function DictamenChip({ dictamen }: ChipProps) {
  if (dictamen === 'cumple') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ok/40 bg-ok/10 px-2.5 py-1 text-xs font-medium text-ink">
        <CircleCheck className="h-3.5 w-3.5 text-ok" aria-hidden="true" />
        Cumple
      </span>
    );
  }
  if (dictamen === 'revision') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-xs font-medium text-ink">
        <TriangleAlert className="h-3.5 w-3.5 text-warn" aria-hidden="true" />
        Requiere revisión
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-error/40 bg-error/10 px-2.5 py-1 text-xs font-medium text-ink">
      <CircleX className="h-3.5 w-3.5 text-error" aria-hidden="true" />
      No cumple
    </span>
  );
}

interface Props {
  dictamen: Dictamen;
  totalDocumentos: number;
}

const FONDO_POR_DICTAMEN: Record<Dictamen, string> = {
  cumple: 'border-ok/30 bg-ok/10',
  revision: 'border-warn/30 bg-warn/10',
  no_cumple: 'border-error/30 bg-error/10',
};

export function DictamenBanner({ dictamen, totalDocumentos }: Props) {
  const { confianza, porQue } = obtenerResumenDictamen(dictamen);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <DictamenChip dictamen={dictamen} />
        <span className="text-sm text-muted">
          {totalDocumentos} documentos · confianza del análisis: {confianza}
        </span>
      </div>
      <div className={`rounded-lg border px-4 py-3 ${FONDO_POR_DICTAMEN[dictamen]}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Por qué</p>
        <p className="mt-1 text-sm text-ink">{porQue}</p>
      </div>
    </div>
  );
}
