import { CircleCheck, CircleX, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { Dictamen } from '../../../shared/useSimulatedAnalysis';

interface Props {
  dictamen: Dictamen;
}

interface ConfigDictamen {
  Icono: LucideIcon;
  colorIcono: string;
  colorTexto: string;
  texto: string;
}

const CONFIG: Record<Dictamen, ConfigDictamen> = {
  cumple: { Icono: CircleCheck, colorIcono: 'text-ok', colorTexto: '#14532D', texto: 'Cumple' },
  revision: { Icono: TriangleAlert, colorIcono: 'text-warn', colorTexto: '#7A4B00', texto: 'Requiere revisión' },
  no_cumple: { Icono: CircleX, colorIcono: 'text-error', colorTexto: '#7F1D1D', texto: 'No cumple' },
};

export function RecomendacionInicial({ dictamen }: Props) {
  const { Icono, colorIcono, colorTexto, texto } = CONFIG[dictamen];

  return (
    <div className="flex items-center gap-3">
      <Icono className={`h-7 w-7 shrink-0 ${colorIcono}`} aria-hidden="true" />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Recomendación inicial</p>
        <p className="text-[18px] font-bold" style={{ color: colorTexto }}>
          {texto}
        </p>
      </div>
    </div>
  );
}
