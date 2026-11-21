import { Circle, CircleCheck, CircleX, LoaderCircle, TriangleAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useAnimaciones } from '../../../shared/motion';
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
 * para que la lectura no dependa de la percepción del tono. Al cambiar de
 * estado, el ícono anterior se desvanece y el nuevo aparece con un
 * pequeño "pop" (cross-fade).
 */
export function EstadoIcono({ estado, className = 'h-4 w-4' }: Props) {
  const { reducido } = useAnimaciones();
  const color = COLOR_POR_ESTADO[estado];

  let icono: ReactNode;
  if (estado === 'pendiente') {
    icono = <Circle className={`h-full w-full ${color}`} strokeDasharray="3 3" aria-hidden="true" />;
  } else if (estado === 'validando') {
    icono = (
      <LoaderCircle className={`h-full w-full ${color} animate-spin motion-reduce:animate-none`} aria-hidden="true" />
    );
  } else if (estado === 'verificado') {
    icono = <CircleCheck className={`h-full w-full ${color}`} aria-hidden="true" />;
  } else if (estado === 'revisar') {
    icono = <TriangleAlert className={`h-full w-full ${color}`} aria-hidden="true" />;
  } else {
    icono = <CircleX className={`h-full w-full ${color}`} aria-hidden="true" />;
  }

  return (
    <span className={`relative inline-block ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={estado}
          className="absolute inset-0"
          initial={reducido ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducido ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.2 }}
        >
          {icono}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
