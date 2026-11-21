import { Check, X } from 'lucide-react';

export type EstadoAnillo = 'en_espera' | 'validando' | 'completo' | 'revisar' | 'no_cumple';

interface Props {
  estado: EstadoAnillo;
  resueltos: number;
  total: number;
  etiqueta: string;
}

const RADIO = 16;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;

const COLOR_ARCO: Record<EstadoAnillo, string> = {
  en_espera: 'stroke-border',
  validando: 'stroke-brand',
  completo: 'stroke-ok',
  revisar: 'stroke-warn',
  no_cumple: 'stroke-error',
};

const COLOR_RELLENO: Record<EstadoAnillo, string> = {
  en_espera: '',
  validando: '',
  completo: 'fill-ok',
  revisar: 'fill-warn',
  no_cumple: 'fill-error',
};

/**
 * Anillo de progreso de 40×40 px. La pista siempre es gris; el arco y el
 * relleno central cambian de color y contenido según el estado del
 * documento. El arco arranca arriba porque el SVG completo está rotado.
 */
export function ProgressRing({ estado, resueltos, total, etiqueta }: Props) {
  const fraccion = total > 0 ? resueltos / total : 0;
  const relleno = estado === 'completo' || estado === 'revisar' || estado === 'no_cumple';
  const offset = CIRCUNFERENCIA * (1 - (relleno ? 1 : fraccion));

  return (
    <div role="img" aria-label={etiqueta} className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90" aria-hidden="true">
        <circle cx="20" cy="20" r={RADIO} fill="none" stroke="#EAEAEA" strokeWidth="4" />
        {estado !== 'en_espera' && (
          <circle
            cx="20"
            cy="20"
            r={RADIO}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={offset}
            className={`${COLOR_ARCO[estado]} transition-[stroke-dashoffset] duration-300 motion-reduce:transition-none`}
          />
        )}
        {relleno && <circle cx="20" cy="20" r={RADIO - 3} className={COLOR_RELLENO[estado]} />}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        {estado === 'validando' && (
          <span className="text-[11px] font-semibold text-ink">{Math.round(fraccion * 100)}%</span>
        )}
        {estado === 'completo' && <Check className="h-4 w-4 text-white" />}
        {estado === 'revisar' && <span className="text-sm font-bold leading-none text-white">!</span>}
        {estado === 'no_cumple' && <X className="h-4 w-4 text-white" />}
      </span>
    </div>
  );
}
