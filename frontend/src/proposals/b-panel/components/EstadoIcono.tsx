import { Circle, CircleCheck, CircleX, LoaderCircle, TriangleAlert } from 'lucide-react';
import type { EstadoValidacion } from '../../../shared/validationRules';

interface Props {
  estado: EstadoValidacion;
  className?: string;
}

const COLOR_POR_ESTADO: Record<EstadoValidacion, string> = {
  pendiente: 'text-muted',
  validando: 'text-brand',
  verificado: 'text-ok',
  revisar: 'text-warn',
  no_cumple: 'text-error',
};

/**
 * Cada estado se distingue por ícono y color a la vez (no solo color),
 * para que la lectura no dependa de la percepción del tono.
 */
export function EstadoIcono({ estado, className = 'h-4 w-4' }: Props) {
  const color = COLOR_POR_ESTADO[estado];

  if (estado === 'pendiente') {
    return <Circle className={`${className} ${color}`} strokeDasharray="3 3" aria-hidden="true" />;
  }
  if (estado === 'validando') {
    return (
      <LoaderCircle className={`${className} ${color} animate-spin motion-reduce:animate-none`} aria-hidden="true" />
    );
  }
  if (estado === 'verificado') {
    return <CircleCheck className={`${className} ${color}`} aria-hidden="true" />;
  }
  if (estado === 'revisar') {
    return <TriangleAlert className={`${className} ${color}`} aria-hidden="true" />;
  }
  return <CircleX className={`${className} ${color}`} aria-hidden="true" />;
}
