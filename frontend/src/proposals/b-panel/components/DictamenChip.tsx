import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import type { Dictamen } from '../../../shared/useSimulatedAnalysis';

/** Etiqueta compacta con el dictamen del análisis (cumple, requiere revisión o no cumple). */
export function DictamenChip({ dictamen }: { dictamen: Dictamen }) {
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
