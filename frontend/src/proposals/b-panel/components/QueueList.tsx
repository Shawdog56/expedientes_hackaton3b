import { CircleCheck, CircleX, Clock, TriangleAlert } from 'lucide-react';
import type { Dictamen, ExpedienteAnalisis } from '../../../shared/useSimulatedAnalysis';

interface ChipProps {
  dictamen: Dictamen | null;
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
  if (dictamen === 'no_cumple') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-error/40 bg-error/10 px-2.5 py-1 text-xs font-medium text-ink">
        <CircleX className="h-3.5 w-3.5 text-error" aria-hidden="true" />
        No cumple
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-xs font-medium text-muted">
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      En cola
    </span>
  );
}

interface Props {
  items: ExpedienteAnalisis[];
}

export function QueueList({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm">
      <p className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
        Otros expedientes
      </p>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.expedienteId} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <span className="truncate text-sm font-medium text-ink">{item.nombre}</span>
            <DictamenChip dictamen={item.dictamen} />
          </li>
        ))}
      </ul>
    </div>
  );
}
