import { CircleCheck, CircleX, TriangleAlert } from 'lucide-react';
import { obtenerResumenDictamen, type Confianza } from '../../../shared/mockResults';
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
  documentosFaltantes: string[];
}

const FONDO_POR_DICTAMEN: Record<Dictamen, string> = {
  cumple: 'border-ok/30 bg-ok/10',
  revision: 'border-warn/30 bg-warn/10',
  no_cumple: 'border-error/30 bg-error/10',
};

const NIVEL_CONFIANZA: Record<Confianza, number> = { alta: 3, media: 2, baja: 1 };

function IndicadorConfianza({ confianza }: { confianza: Confianza }) {
  const nivel = NIVEL_CONFIANZA[confianza];

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title="Qué tan seguros estamos de los datos leídos de los documentos"
    >
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((barra) => (
          <span
            key={barra}
            className={`w-1 rounded-sm ${barra <= nivel ? 'bg-ink' : 'bg-border'}`}
            style={{ height: `${barra * 4 + 4}px` }}
          />
        ))}
      </span>
      <span className="text-sm text-muted">Confianza: {confianza}</span>
    </span>
  );
}

export function DictamenBanner({ dictamen, totalDocumentos, documentosFaltantes }: Props) {
  const { confianza, porQue } = obtenerResumenDictamen(dictamen, { documentosFaltantes });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <DictamenChip dictamen={dictamen} />
        <span className="text-sm text-muted">{totalDocumentos} documentos</span>
        <IndicadorConfianza confianza={confianza} />
      </div>
      <div className={`rounded-lg border px-4 py-3 ${FONDO_POR_DICTAMEN[dictamen]}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Por qué</p>
        <p className="mt-1 text-sm text-ink">{porQue}</p>
      </div>
    </div>
  );
}
