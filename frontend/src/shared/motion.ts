import { useReducedMotion, type Transition, type Variants } from 'motion/react';

/** Duraciones comunes, en segundos. */
export const DURACION = {
  rapida: 0.15,
  normal: 0.25,
  lenta: 0.4,
} as const;

/** Curva de salida suave, usada en la mayoría de las transiciones. */
export const CURVA_SALIDA = [0.22, 1, 0.36, 1] as const;

/** Spring para paneles que entran/salen (el drawer de hallazgos, diálogos). */
export const SPRING_PANEL: Transition = { type: 'spring', stiffness: 380, damping: 34 };

/**
 * Variantes ya ajustadas a `prefers-reduced-motion`: con reducir movimiento,
 * solo cambia la opacidad (0.15 s), sin desplazamientos ni escalas.
 */
export function useAnimaciones() {
  const reducido = useReducedMotion();

  const entrada: Variants = reducido
    ? { oculto: { opacity: 0 }, visible: { opacity: 1 } }
    : { oculto: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

  const salida: Variants = reducido
    ? { oculto: { opacity: 0 }, visible: { opacity: 1 } }
    : { oculto: { opacity: 0, y: -8 }, visible: { opacity: 1, y: 0 } };

  const crucePlano: Variants = { oculto: { opacity: 0 }, visible: { opacity: 1 } };

  const escala: Variants = reducido
    ? { oculto: { opacity: 0 }, visible: { opacity: 1 } }
    : { oculto: { opacity: 0, scale: 0.6 }, visible: { opacity: 1, scale: 1 } };

  const transicionRapida: Transition = { duration: DURACION.rapida, ease: [...CURVA_SALIDA] };
  const transicionNormal: Transition = { duration: DURACION.normal, ease: [...CURVA_SALIDA] };
  const transicionLenta: Transition = { duration: DURACION.lenta, ease: [...CURVA_SALIDA] };

  return {
    reducido,
    entrada,
    salida,
    crucePlano,
    escala,
    transicionRapida,
    transicionNormal,
    transicionLenta,
    spring: reducido ? ({ duration: DURACION.rapida } as Transition) : SPRING_PANEL,
  };
}
